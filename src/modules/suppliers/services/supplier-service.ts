import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository } from "@/modules/ledgers/repositories/ledger-repository";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { getSundryCreditorsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import {
  supplierRepository,
  type SupplierPersistData,
} from "@/modules/suppliers/repositories/supplier-repository";
import {
  createSupplierSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from "@/modules/suppliers/validation/supplier-schema";
import type { SupplierListFilters, SupplierWithLedger } from "@/types/supplier";
import type { LedgerGroup } from "@/types/ledger-group";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", the documented convention
// since ledger-service.ts. Suppliers sit under "masters" (not "purchase")
// because project-overview.md's Master Management section owns them, the
// same reasoning as customer-service.ts's "masters"-not-"sales" decision.
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Supplier not found.";

const INVALID_GROUP_MESSAGE =
  'The ledger group must be "Sundry Creditors" or one of its sub-groups.';

function translatePersistError(error: unknown): never {
  // The only unique constraint a supplier write can violate is the paired
  // Ledger's per-company name — surface it as the display-name conflict it
  // is (27-supplier-management.md's friendly, field-specific message rule).
  if (isUniqueConstraintError(error)) {
    throw new AppError("A ledger with this display name already exists in this company.");
  }
  throw error;
}

// Blank optionals arrive as undefined from the schema and persist as NULL;
// `country` falls back to the model's "India" default when cleared.
function toPersistData(data: CreateSupplierInput): SupplierPersistData {
  return {
    contactPerson: data.contactPerson ?? null,
    mobileNumber: data.mobileNumber ?? null,
    alternateMobile: data.alternateMobile ?? null,
    email: data.email ?? null,
    gstin: data.gstin ?? null,
    pan: data.pan ?? null,
    addressLine1: data.addressLine1 ?? null,
    addressLine2: data.addressLine2 ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    district: data.district ?? null,
    country: data.country ?? "India",
    pinCode: data.pinCode ?? null,
    creditDays: data.creditDays ?? null,
  };
}

/**
 * Re-verifies the client-supplied group id against a fresh, company-scoped
 * group list — the group must exist, be active, and sit inside the "Sundry
 * Creditors" subtree (27-supplier-management.md's parent-chain rule; a
 * cross-company group id can never match the company-scoped subtree set).
 */
function resolveCreditorGroup(allGroups: LedgerGroup[], ledgerGroupId: string): LedgerGroup {
  if (!getSundryCreditorsSubtreeIds(allGroups).has(ledgerGroupId)) {
    throw new AppError(INVALID_GROUP_MESSAGE);
  }

  const group = allGroups.find((candidate) => candidate.id === ledgerGroupId);
  if (!group?.isActive) {
    throw new AppError("Cannot assign a supplier to an inactive ledger group.");
  }
  return group;
}

export const supplierService = {
  async listSuppliers(filters: SupplierListFilters = {}): Promise<SupplierWithLedger[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return supplierRepository.findMany(user.companyId, filters);
  },

  // A supplier belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," the rule every module follows since user-service.ts.
  async getSupplier(id: string): Promise<SupplierWithLedger | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const supplier = await supplierRepository.findById(id);
    if (!supplier || supplier.companyId !== user.companyId) {
      return null;
    }
    return supplier;
  },

  /**
   * Active suppliers only — the lookup Purchase Orders (#40), Goods Receipt
   * Notes (#41), and Purchase Invoice (#42) will consume. Deactivated
   * suppliers keep all data and simply disappear from here.
   */
  async listSelectableSuppliers(): Promise<SupplierWithLedger[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return supplierRepository.findMany(user.companyId, { status: "active" });
  },

  /**
   * Active "Sundry Creditors"-subtree groups for the Supplier form's group
   * picker — when this resolves to a single group (the common case: no
   * custom sub-groups), the form shows no picker at all and submits that one
   * id directly (the bank-management/customer-management rule verbatim).
   */
  async listSelectableLedgerGroupsForSupplier(): Promise<LedgerGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, { status: "active" });
    const creditorIds = getSundryCreditorsSubtreeIds(groups);
    return groups.filter((group) => creditorIds.has(group.id));
  },

  // Creates BOTH the underlying Ledger (via ledgerService.createUnderGroup —
  // never duplicated Ledger-write logic) AND the Supplier row in one
  // transaction; neither can exist without the other
  // (27-supplier-management.md, the customer/bank-management shape exactly).
  async createSupplier(input: CreateSupplierInput): Promise<SupplierWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createSupplierSchema.parse(input);

    const allGroups = await ledgerGroupRepository.findMany(user.companyId, {});
    const group = resolveCreditorGroup(allGroups, data.ledgerGroupId);

    try {
      return await runInTransaction(async (tx) => {
        // Re-checked inside the transaction so a concurrent group
        // deactivation between the read above and this write is caught.
        const freshGroup = await tx.ledgerGroup.findUnique({ where: { id: data.ledgerGroupId } });
        if (!freshGroup?.isActive) {
          throw new AppError("Cannot assign a supplier to an inactive ledger group.");
        }

        const ledger = await ledgerService.createUnderGroup(
          user.companyId,
          data.ledgerGroupId,
          {
            name: data.displayName,
            openingBalance: data.openingBalance,
            openingBalanceType: data.openingBalanceType,
            description: data.description ?? null,
          },
          tx
        );

        const supplier = await supplierRepository.create(
          user.companyId,
          ledger.id,
          toPersistData(data),
          tx
        );

        return { ...supplier, ledger: { ...ledger, ledgerGroup: group } };
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  // Updates both halves through one combined form, in one transaction.
  // Re-parenting to a different group re-validates the "Sundry Creditors or
  // descendant" rule (27-supplier-management.md).
  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<SupplierWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateSupplierSchema.parse(input);

    const existing = await supplierRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }

    // Only a CHANGED group is re-validated (subtree membership + active) —
    // an unchanged, since-deactivated group must not block an unrelated
    // edit, the same "at assignment time" rule as customer-service.ts's.
    const groupChanged = data.ledgerGroupId !== existing.ledger.ledgerGroupId;
    let group = existing.ledger.ledgerGroup;
    if (groupChanged) {
      const allGroups = await ledgerGroupRepository.findMany(user.companyId, {});
      group = resolveCreditorGroup(allGroups, data.ledgerGroupId);
    }

    try {
      return await runInTransaction(async (tx) => {
        // Re-checked inside the transaction so a concurrent group
        // deactivation between the read above and this write is caught —
        // the same freshGroup guard as createSupplier's.
        if (groupChanged) {
          const freshGroup = await tx.ledgerGroup.findUnique({
            where: { id: data.ledgerGroupId },
          });
          if (!freshGroup?.isActive) {
            throw new AppError("Cannot assign a supplier to an inactive ledger group.");
          }
        }

        const ledger = await ledgerRepository.update(
          existing.ledgerId,
          user.companyId,
          {
            name: data.displayName,
            openingBalance: data.openingBalance,
            openingBalanceType: data.openingBalanceType,
            description: data.description ?? null,
            ledgerGroupId: data.ledgerGroupId,
          },
          tx
        );
        if (!ledger) {
          throw new AppError("Ledger not found.");
        }

        const supplier = await supplierRepository.update(id, user.companyId, toPersistData(data), tx);
        if (!supplier) {
          throw new AppError(NOT_FOUND_MESSAGE);
        }

        return { ...supplier, ledger: { ...ledger, ledgerGroup: group } };
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  // Activate/Deactivate flip the Supplier row and its underlying Ledger
  // together, in one transaction — there is no way to toggle just one half
  // (27-supplier-management.md, the customer/bank-management invariant verbatim).
  async activateSupplier(id: string): Promise<SupplierWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    return runInTransaction(async (tx) => {
      const result = await supplierRepository.activate(id, user.companyId, tx);
      switch (result.status) {
        case "not_found":
          throw new AppError(NOT_FOUND_MESSAGE);
        case "ok":
          return result.supplier;
      }
    });
  },

  async deactivateSupplier(id: string): Promise<SupplierWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    return runInTransaction(async (tx) => {
      const result = await supplierRepository.deactivate(id, user.companyId, tx);
      switch (result.status) {
        case "not_found":
          throw new AppError(NOT_FOUND_MESSAGE);
        case "ok":
          return result.supplier;
      }
    });
  },
};
