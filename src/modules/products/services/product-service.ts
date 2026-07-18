import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  productRepository,
  type ProductPersistData,
} from "@/modules/products/repositories/product-repository";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/modules/products/validation/product-schema";
import type { ProductListFilters, ProductWithRelations } from "@/types/product";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", the documented convention
// since ledger-service.ts.
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Product not found.";

// Product has THREE per-company unique constraints — name, productCode, and
// barcode (when present) — so each duplicate surfaces its own field-specific
// friendly message (25-product-management.md's Business Rules), mirroring
// warehouse-service.ts.
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A product with this name already exists in this company.");
  }
  if (isUniqueConstraintError(error, "productCode")) {
    throw new AppError("A product with this product code already exists in this company.");
  }
  if (isUniqueConstraintError(error, "barcode")) {
    throw new AppError("A product with this barcode already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreateProductInput): ProductPersistData {
  return {
    name: data.name,
    productCode: data.productCode,
    barcode: data.barcode ?? null,
    productType: data.productType,
    categoryId: data.categoryId ?? null,
    brandId: data.brandId ?? null,
    unitId: data.unitId,
    hsnCodeId: data.hsnCodeId ?? null,
    gstRateId: data.gstRateId ?? null,
    defaultWarehouseId: data.defaultWarehouseId ?? null,
    mrp: data.mrp ?? null,
    sellingPrice: data.sellingPrice ?? null,
    purchasePrice: data.purchasePrice ?? null,
    minStockLevel: data.minStockLevel ?? null,
    description: data.description ?? null,
  };
}

export const productService = {
  async listProducts(filters: ProductListFilters = {}): Promise<ProductWithRelations[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return productRepository.findMany(user.companyId, filters);
  },

  // A product belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring unit-service.ts's identical rule.
  async getProduct(id: string): Promise<ProductWithRelations | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const product = await productRepository.findById(id);
    if (!product || product.companyId !== user.companyId) {
      return null;
    }
    return product;
  },

  /**
   * Active products for the current company — the lookup Sales (#41),
   * Purchase (#42), and the Inventory Engine (#30) will consume.
   */
  async listSelectableProducts(): Promise<ProductWithRelations[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return productRepository.findMany(user.companyId, { status: "active" });
  },

  // Every supplied master reference is verified (company scope + active,
  // plus the HSN-vs-SAC type match and the minStockLevel precision rule)
  // inside the repository's write transaction — see verifyReferences().
  async createProduct(input: CreateProductInput): Promise<ProductWithRelations> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createProductSchema.parse(input);

    try {
      return await productRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  // Scope/active re-verification applies to changed or newly assigned
  // references only — an unchanged, since-deactivated reference must not
  // block an unrelated edit (25-product-management.md's Business Rules).
  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductWithRelations> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateProductSchema.parse(input);

    try {
      const product = await productRepository.update(id, user.companyId, toPersistData(data));
      if (!product) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return product;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateProduct(id: string): Promise<ProductWithRelations> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await productRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.product;
    }
  },

  async deactivateProduct(id: string): Promise<ProductWithRelations> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await productRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.product;
    }
  },
};
