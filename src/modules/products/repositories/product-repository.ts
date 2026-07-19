import type { Prisma, ProductType } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivateProductResult,
  DeactivateProductResult,
  ProductListFilters,
  ProductWithRelations,
} from "@/types/product";

export interface ProductPersistData {
  name: string;
  productCode: string;
  barcode: string | null;
  productType: ProductType;
  categoryId: string | null;
  brandId: string | null;
  unitId: string;
  hsnCodeId: string | null;
  gstRateId: string | null;
  defaultWarehouseId: string | null;
  marginProfileId: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  purchasePrice: number | null;
  minStockLevel: number | null;
  description: string | null;
}

// Field-specific messages for the six reference checks — a cross-company id
// reports the same "not found" as a nonexistent one (never reveal that a row
// exists in another company), mirroring warehouse-repository.ts's
// BRANCH_NOT_FOUND_MESSAGE convention. Exported for the schema/service tests.
export const HSN_TYPE_MISMATCH_SERVICE_MESSAGE =
  "A service product must use a SAC code, not an HSN code.";
export const HSN_TYPE_MISMATCH_GOODS_MESSAGE =
  "A goods product must use an HSN code, not a SAC code.";

function referenceNotFoundMessage(label: string): string {
  return `Selected ${label} was not found.`;
}

function referenceInactiveMessage(label: string): string {
  return `Selected ${label} is inactive.`;
}

/**
 * A referenced master must belong to the same company and be active at
 * assignment time — server-verified, never trusted from the client
 * (25-product-management.md's Business Rules). Runs inside the caller's
 * transaction so the check and the write see the same snapshot.
 */
function assertAssignable(
  row: { companyId: string; isActive: boolean } | null,
  companyId: string,
  label: string
): void {
  if (!row || row.companyId !== companyId) {
    throw new AppError(referenceNotFoundMessage(label));
  }
  if (!row.isActive) {
    throw new AppError(referenceInactiveMessage(label));
  }
}

/**
 * Goods (TRADING/EXPENSE) pick HSN-type codes, SERVICE picks SAC-type codes
 * (25-product-management.md; the codeType field is 22-hsn-management.md's).
 * Checked against the row's FINAL state — also when only the product type
 * changed while the code stayed, since that too would save a mismatched row.
 */
function assertHsnTypeMatch(codeType: "HSN" | "SAC", productType: ProductType): void {
  if (productType === "SERVICE" && codeType === "HSN") {
    throw new AppError(HSN_TYPE_MISMATCH_SERVICE_MESSAGE);
  }
  if (productType !== "SERVICE" && codeType === "SAC") {
    throw new AppError(HSN_TYPE_MISMATCH_GOODS_MESSAGE);
  }
}

/**
 * minStockLevel must not carry more decimal places than the selected unit's
 * decimalPlaces — the first consumer of that Unit field, exactly as
 * 19-unit-management.md anticipated. Same scaled-with-tolerance float check
 * as gst-rate-schema.ts (18.15 * 100 === 1814.9999… in binary floats).
 */
function assertMinStockLevelPrecision(minStockLevel: number, decimalPlaces: number): void {
  const factor = 10 ** decimalPlaces;
  if (Math.abs(minStockLevel * factor - Math.round(minStockLevel * factor)) >= 1e-6) {
    throw new AppError(
      decimalPlaces === 0
        ? "Min stock level must be a whole number — the selected unit has 0 decimal places."
        : `Min stock level can have at most ${decimalPlaces} decimal places — the selected unit's limit.`
    );
  }
}

const MASTER_OPTION_SELECT = { id: true, name: true, isActive: true } as const;
const UNIT_OPTION_SELECT = {
  id: true,
  name: true,
  symbol: true,
  decimalPlaces: true,
  isActive: true,
} as const;
const HSN_OPTION_SELECT = {
  id: true,
  code: true,
  codeType: true,
  description: true,
  isActive: true,
} as const;

// Related master names are read with the product row itself — the list table
// shows Category/Brand/Unit and the edit page keeps a since-deactivated
// reference visible in its picker (25-product-management.md's UI).
const PRODUCT_INCLUDE = {
  category: { select: MASTER_OPTION_SELECT },
  brand: { select: MASTER_OPTION_SELECT },
  unit: { select: UNIT_OPTION_SELECT },
  hsnCode: { select: HSN_OPTION_SELECT },
  gstRate: { select: MASTER_OPTION_SELECT },
  defaultWarehouse: { select: MASTER_OPTION_SELECT },
  marginProfile: { select: MASTER_OPTION_SELECT },
} as const;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

// The four Decimal columns are decimal.js instances at the database boundary
// — never serializable across a Server Component prop or a Server Action
// return value, so every read is normalized to plain numbers here, before it
// can reach a Client Component (mirrors gst-rate-repository.ts's toGstRate).
function toProduct(raw: ProductRow): ProductWithRelations {
  return {
    ...raw,
    mrp: raw.mrp === null ? null : raw.mrp.toNumber(),
    sellingPrice: raw.sellingPrice === null ? null : raw.sellingPrice.toNumber(),
    purchasePrice: raw.purchasePrice === null ? null : raw.purchasePrice.toNumber(),
    minStockLevel: raw.minStockLevel === null ? null : raw.minStockLevel.toNumber(),
  };
}

function buildWhere(companyId: string, filters: ProductListFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.productType) {
    where.productType = filters.productType;
  }
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters.brandId) {
    where.brandId = filters.brandId;
  }

  if (filters.search) {
    // Search covers name + SKU + barcode — the three identity fields a
    // billing screen will look a product up by.
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { productCode: { contains: filters.search, mode: "insensitive" } },
      { barcode: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

/**
 * Verifies every supplied master reference (company scope + active), the
 * HSN-vs-SAC type match, and the minStockLevel precision — for create, or
 * for the subset of references an update actually changed. `existing` is
 * null on create (verify everything supplied); on update, a reference the
 * edit leaves unchanged is preserved as-is even if that master has since
 * been deactivated — otherwise fixing a typo in the product name would be
 * blocked by a since-deactivated brand (25-product-management.md's "at
 * assignment time" rule). Changed or newly assigned ids are always fully
 * re-verified, so an inactive or cross-company master can never be
 * INTRODUCED via update.
 */
async function verifyReferences(
  tx: Prisma.TransactionClient,
  companyId: string,
  data: ProductPersistData,
  existing: {
    unitId: string;
    categoryId: string | null;
    brandId: string | null;
    hsnCodeId: string | null;
    gstRateId: string | null;
    defaultWarehouseId: string | null;
    marginProfileId: string | null;
    productType: ProductType;
  } | null
): Promise<void> {
  // Unit — required for every type. Read even when unchanged if
  // minStockLevel is set: the precision rule needs decimalPlaces (a plain
  // read, not an active re-check, for the unchanged case).
  const unitChanged = !existing || data.unitId !== existing.unitId;
  if (unitChanged || data.minStockLevel !== null) {
    const unit = await tx.unit.findUnique({ where: { id: data.unitId } });
    if (unitChanged) {
      assertAssignable(unit, companyId, "unit");
    }
    if (data.minStockLevel !== null) {
      // The unchanged-unit row can only be missing if data raced a hard
      // delete, which no code path performs — guard anyway.
      if (!unit || unit.companyId !== companyId) {
        throw new AppError(referenceNotFoundMessage("unit"));
      }
      assertMinStockLevelPrecision(data.minStockLevel, unit.decimalPlaces);
    }
  }

  if (data.categoryId && (!existing || data.categoryId !== existing.categoryId)) {
    const category = await tx.category.findUnique({ where: { id: data.categoryId } });
    assertAssignable(category, companyId, "category");
  }

  if (data.brandId && (!existing || data.brandId !== existing.brandId)) {
    const brand = await tx.brand.findUnique({ where: { id: data.brandId } });
    assertAssignable(brand, companyId, "brand");
  }

  // HSN/SAC — scope+active checks only for a changed/new id, but the
  // type-match rule guards the row's FINAL state, so it also runs when only
  // the product type changed around an unchanged code.
  if (data.hsnCodeId) {
    const hsnChanged = !existing || data.hsnCodeId !== existing.hsnCodeId;
    const typeChanged = !existing || data.productType !== existing.productType;
    if (hsnChanged || typeChanged) {
      const hsnCode = await tx.hsnCode.findUnique({ where: { id: data.hsnCodeId } });
      if (hsnChanged) {
        assertAssignable(hsnCode, companyId, "HSN/SAC code");
      }
      if (!hsnCode || hsnCode.companyId !== companyId) {
        throw new AppError(referenceNotFoundMessage("HSN/SAC code"));
      }
      assertHsnTypeMatch(hsnCode.codeType, data.productType);
    }
  }

  if (data.gstRateId && (!existing || data.gstRateId !== existing.gstRateId)) {
    const gstRate = await tx.gstRate.findUnique({ where: { id: data.gstRateId } });
    assertAssignable(gstRate, companyId, "GST rate");
  }

  if (
    data.defaultWarehouseId &&
    (!existing || data.defaultWarehouseId !== existing.defaultWarehouseId)
  ) {
    const warehouse = await tx.warehouse.findUnique({ where: { id: data.defaultWarehouseId } });
    assertAssignable(warehouse, companyId, "warehouse");
  }

  if (
    data.marginProfileId &&
    (!existing || data.marginProfileId !== existing.marginProfileId)
  ) {
    const marginProfile = await tx.marginProfile.findUnique({
      where: { id: data.marginProfileId },
    });
    assertAssignable(marginProfile, companyId, "margin profile");
  }
}

export const productRepository = {
  async findMany(
    companyId: string,
    filters: ProductListFilters = {}
  ): Promise<ProductWithRelations[]> {
    const rows = await prisma.product.findMany({
      where: buildWhere(companyId, filters),
      include: PRODUCT_INCLUDE,
      orderBy: { name: "asc" },
    });
    return rows.map(toProduct);
  },

  async findById(id: string): Promise<ProductWithRelations | null> {
    const row = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    return row ? toProduct(row) : null;
  },

  // No Serializable isolation — there is no cross-row invariant to guard.
  // The active-at-assignment checks have no invariant behind them (a master
  // deactivated after assignment does not cascade to its products, so a
  // concurrent deactivation slipping past the check breaks nothing) — the
  // same reasoning as warehouse-repository.ts's create().
  async create(companyId: string, data: ProductPersistData): Promise<ProductWithRelations> {
    return runInTransaction(async (tx) => {
      await verifyReferences(tx, companyId, data, null);
      const row = await tx.product.create({ data: { ...data, companyId }, include: PRODUCT_INCLUDE });
      return toProduct(row);
    });
  },

  // Read-check-write in one transaction: reads the stored row
  // (company-scoped), diffs each reference against it, and re-verifies only
  // the changed or newly assigned ids — unchanged references pass through
  // untouched, even if since deactivated (25-product-management.md's
  // Business Rules; same shape as every prior master, over more references).
  async update(
    id: string,
    companyId: string,
    data: ProductPersistData
  ): Promise<ProductWithRelations | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      await verifyReferences(tx, companyId, data, existing);

      try {
        const row = await tx.product.update({ where: { id }, data, include: PRODUCT_INCLUDE });
        return toProduct(row);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateProductResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.product.update({
        where: { id },
        data: { isActive: true },
        include: PRODUCT_INCLUDE,
      });
      return { status: "ok", product: toProduct(row) };
    });
  },

  // Deactivation has no invariant to guard today — a plain scoped update.
  // Deactivated products keep all references; future documents simply cannot
  // select them (25-product-management.md's Business Rules).
  async deactivate(id: string, companyId: string): Promise<DeactivateProductResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.product.update({
        where: { id },
        data: { isActive: false },
        include: PRODUCT_INCLUDE,
      });
      return { status: "ok", product: toProduct(row) };
    });
  },
};
