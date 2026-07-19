import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository } from "@/modules/ledgers/repositories/ledger-repository";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { getSundryDebtorsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import {
  customerRepository,
  type CustomerPersistData,
} from "@/modules/customers/repositories/customer-repository";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/modules/customers/validation/customer-schema";
import type { CustomerListFilters, CustomerWithLedger } from "@/types/customer";
import type { LedgerGroup } from "@/types/ledger-group";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", the documented convention
// since ledger-service.ts. Customers sit under "masters" (not "sales")
// because project-overview.md's Master Management section owns them
// (26-customer-management.md's Security section).
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Customer not found.";

const INVALID_GROUP_MESSAGE =
  'The ledger group must be "Sundry Debtors" or one of its sub-groups.';

function translatePersistError(error: unknown): never {
  // The only unique constraint a customer write can violate is the paired
  // Ledger's per-company name — surface it as the display-name conflict it
  // is (26-customer-management.md's friendly, field-specific message rule).
  if (isUniqueConstraintError(error)) {
    throw new AppError("A ledger with this display name already exists in this company.");
  }
  throw error;
}

// Blank optionals arrive as undefined from the schema and persist as NULL;
// `country` falls back to the model's "India" default when cleared.
function toPersistData(data: CreateCustomerInput): CustomerPersistData {
  return {
    customerType: data.customerType,
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
    creditLimit: data.creditLimit ?? null,
    creditDays: data.creditDays ?? null,
  };
}

/**
 * Re-verifies the client-supplied group id against a fresh, company-scoped
 * group list — the group must exist, be active, and sit inside the "Sundry
 * Debtors" subtree (26-customer-management.md's parent-chain rule; a
 * cross-company group id can never match the company-scoped subtree set).
 */
function resolveDebtorGroup(allGroups: LedgerGroup[], ledgerGroupId: string): LedgerGroup {
  if (!getSundryDebtorsSubtreeIds(allGroups).has(ledgerGroupId)) {
    throw new AppError(INVALID_GROUP_MESSAGE);
  }

  const group = allGroups.find((candidate) => candidate.id === ledgerGroupId);
  if (!group?.isActive) {
    throw new AppError("Cannot assign a customer to an inactive ledger group.");
  }
  return group;
}

export const customerService = {
  async listCustomers(filters: CustomerListFilters = {}): Promise<CustomerWithLedger[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return customerRepository.findMany(user.companyId, filters);
  },

  // A customer belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," the rule every module follows since user-service.ts.
  async getCustomer(id: string): Promise<CustomerWithLedger | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const customer = await customerRepository.findById(id);
    if (!customer || customer.companyId !== user.companyId) {
      return null;
    }
    return customer;
  },

  /**
   * Active customers only — the lookup Quotations (#33), Sales Orders (#34),
   * and Sales Invoice (#36) will consume. Deactivated customers keep all
   * data and simply disappear from here.
   */
  async listSelectableCustomers(): Promise<CustomerWithLedger[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return customerRepository.findMany(user.companyId, { status: "active" });
  },

  /**
   * Active "Sundry Debtors"-subtree groups for the Customer form's group
   * picker — when this resolves to a single group (the common case: no
   * custom sub-groups), the form shows no picker at all and submits that one
   * id directly (the bank-management rule verbatim).
   */
  async listSelectableLedgerGroupsForCustomer(): Promise<LedgerGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, { status: "active" });
    const debtorIds = getSundryDebtorsSubtreeIds(groups);
    return groups.filter((group) => debtorIds.has(group.id));
  },

  // Creates BOTH the underlying Ledger (via ledgerService.createUnderGroup —
  // never duplicated Ledger-write logic) AND the Customer row in one
  // transaction; neither can exist without the other
  // (26-customer-management.md, the 15-bank-management.md shape exactly).
  async createCustomer(input: CreateCustomerInput): Promise<CustomerWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createCustomerSchema.parse(input);

    const allGroups = await ledgerGroupRepository.findMany(user.companyId, {});
    const group = resolveDebtorGroup(allGroups, data.ledgerGroupId);

    try {
      return await runInTransaction(async (tx) => {
        // Re-checked inside the transaction so a concurrent group
        // deactivation between the read above and this write is caught.
        const freshGroup = await tx.ledgerGroup.findUnique({ where: { id: data.ledgerGroupId } });
        if (!freshGroup?.isActive) {
          throw new AppError("Cannot assign a customer to an inactive ledger group.");
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

        const customer = await customerRepository.create(
          user.companyId,
          ledger.id,
          toPersistData(data),
          tx
        );

        return { ...customer, ledger: { ...ledger, ledgerGroup: group } };
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  // Updates both halves through one combined form, in one transaction.
  // Re-parenting to a different group re-validates the "Sundry Debtors or
  // descendant" rule (26-customer-management.md).
  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateCustomerSchema.parse(input);

    const existing = await customerRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }

    // Only a CHANGED group is re-validated (subtree membership + active) —
    // an unchanged, since-deactivated group must not block an unrelated
    // edit, the same "at assignment time" rule as 25-product-management.md's
    // reference checks.
    const groupChanged = data.ledgerGroupId !== existing.ledger.ledgerGroupId;
    let group = existing.ledger.ledgerGroup;
    if (groupChanged) {
      const allGroups = await ledgerGroupRepository.findMany(user.companyId, {});
      group = resolveDebtorGroup(allGroups, data.ledgerGroupId);
    }

    try {
      return await runInTransaction(async (tx) => {
        // Re-checked inside the transaction so a concurrent group
        // deactivation between the read above and this write is caught —
        // the same freshGroup guard as createCustomer's.
        if (groupChanged) {
          const freshGroup = await tx.ledgerGroup.findUnique({
            where: { id: data.ledgerGroupId },
          });
          if (!freshGroup?.isActive) {
            throw new AppError("Cannot assign a customer to an inactive ledger group.");
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

        const customer = await customerRepository.update(id, user.companyId, toPersistData(data), tx);
        if (!customer) {
          throw new AppError(NOT_FOUND_MESSAGE);
        }

        return { ...customer, ledger: { ...ledger, ledgerGroup: group } };
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  // Activate/Deactivate flip the Customer row and its underlying Ledger
  // together, in one transaction — there is no way to toggle just one half
  // (26-customer-management.md, the bank-management invariant verbatim).
  async activateCustomer(id: string): Promise<CustomerWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    return runInTransaction(async (tx) => {
      const result = await customerRepository.activate(id, user.companyId, tx);
      switch (result.status) {
        case "not_found":
          throw new AppError(NOT_FOUND_MESSAGE);
        case "ok":
          return result.customer;
      }
    });
  },

  async deactivateCustomer(id: string): Promise<CustomerWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    return runInTransaction(async (tx) => {
      const result = await customerRepository.deactivate(id, user.companyId, tx);
      switch (result.status) {
        case "not_found":
          throw new AppError(NOT_FOUND_MESSAGE);
        case "ok":
          return result.customer;
      }
    });
  },
};
