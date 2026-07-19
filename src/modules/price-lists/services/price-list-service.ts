import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  priceListRepository,
  type PriceListItemPersistData,
  type PriceListPersistData,
} from "@/modules/price-lists/repositories/price-list-repository";
import {
  createPriceListSchema,
  priceListItemSchema,
  updatePriceListItemSchema,
  updatePriceListSchema,
  type CreatePriceListInput,
  type PriceListItemInput,
  type UpdatePriceListInput,
  type UpdatePriceListItemInput,
} from "@/modules/price-lists/validation/price-list-schema";
import type {
  EffectivePriceList,
  EffectivePriceListCriteria,
  PriceList,
  PriceListDetail,
  PriceListItemWithProduct,
  PriceListListFilters,
  PriceListWithItemCount,
} from "@/types/price-list";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", the documented convention
// since ledger-service.ts.
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Price list not found.";
const ITEM_NOT_FOUND_MESSAGE = "Price list item not found.";

function toDate(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toPersistData(data: CreatePriceListInput): PriceListPersistData {
  return {
    name: data.name,
    customerType: data.customerType ?? null,
    effectiveFrom: toDate(data.effectiveFrom),
    effectiveTo: toDate(data.effectiveTo),
    description: data.description ?? null,
  };
}

// PriceListItem's DEFAULT constraint (1) lives on the DB column, but the
// service normalizes an omitted value here too so every caller sees the
// resolved quantity, not undefined (mirrors gst-rate-service.ts's
// toPersistData normalizing an optional cess percent).
function toItemPersistData(data: PriceListItemInput): PriceListItemPersistData {
  return {
    productId: data.productId,
    sellingPrice: data.sellingPrice,
    minQuantity: data.minQuantity ?? 1,
  };
}

// PriceList has ONE per-company unique constraint — the name.
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A price list with this name already exists in this company.");
  }
  throw error;
}

// PriceListItem's unique constraint is the (priceListId, productId,
// minQuantity) triple — there is no second constraint on the table to
// disambiguate against, so an unqualified check is enough here.
function translateItemPersistError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw new AppError("This product already has a row at this quantity break.");
  }
  throw error;
}

export const priceListService = {
  async listPriceLists(filters: PriceListListFilters = {}): Promise<PriceListWithItemCount[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return priceListRepository.findMany(user.companyId, filters);
  },

  // A list belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring margin-profile-service.ts's identical rule.
  async getPriceList(id: string): Promise<PriceListDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const priceList = await priceListRepository.findById(id);
    if (!priceList || priceList.companyId !== user.companyId) {
      return null;
    }
    return priceList;
  },

  async createPriceList(input: CreatePriceListInput): Promise<PriceListDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createPriceListSchema.parse(input);

    try {
      return await priceListRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updatePriceList(id: string, input: UpdatePriceListInput): Promise<PriceListDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updatePriceListSchema.parse(input);

    try {
      const priceList = await priceListRepository.update(id, user.companyId, toPersistData(data));
      if (!priceList) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return priceList;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activatePriceList(id: string): Promise<PriceList> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await priceListRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.priceList;
    }
  },

  async deactivatePriceList(id: string): Promise<PriceList> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await priceListRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.priceList;
    }
  },

  // Item mutations gate on "edit" — they are edits OF the list, not a
  // separate permission (29-price-lists.md's Security).
  async addItem(listId: string, input: PriceListItemInput): Promise<PriceListItemWithProduct> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = priceListItemSchema.parse(input);

    try {
      const result = await priceListRepository.addItem(
        listId,
        user.companyId,
        toItemPersistData(data)
      );
      if (result.status === "not_found") {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return result.item;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translateItemPersistError(error);
    }
  },

  async updateItem(
    listId: string,
    itemId: string,
    input: UpdatePriceListItemInput
  ): Promise<PriceListItemWithProduct> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updatePriceListItemSchema.parse(input);

    try {
      const result = await priceListRepository.updateItem(
        listId,
        itemId,
        user.companyId,
        toItemPersistData(data)
      );
      if (result.status === "not_found") {
        throw new AppError(ITEM_NOT_FOUND_MESSAGE);
      }
      return result.item;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translateItemPersistError(error);
    }
  },

  async removeItem(listId: string, itemId: string): Promise<void> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const result = await priceListRepository.removeItem(listId, itemId, user.companyId);
    if (result.status === "not_found") {
      throw new AppError(ITEM_NOT_FOUND_MESSAGE);
    }
  },

  /**
   * Active lists with their items, optionally filtered by customer tier
   * and/or an effective date — the read API the Pricing Engine (#28) will
   * consume (29-price-lists.md's Service/Repository).
   */
  async findEffectiveLists(
    criteria: EffectivePriceListCriteria = {}
  ): Promise<EffectivePriceList[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return priceListRepository.findEffectiveLists(user.companyId, criteria);
  },
};
