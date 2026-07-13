import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { getBankAccountsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import { ledgerRepository } from "@/modules/ledgers/repositories/ledger-repository";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { bankAccountRepository } from "@/modules/bank-accounts/repositories/bank-account-repository";
import { getUniqueConstraintTarget, isUniqueConstraintError } from "@/modules/bank-accounts/utils/prisma-errors";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
} from "@/modules/bank-accounts/validation/bank-account-schema";
import type { BankAccountListFilters, BankAccountWithLedger } from "@/types/bank-account";
import type { LedgerGroup } from "@/types/ledger-group";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// ledgerService.ts's/ledgerGroupService.ts's identical reasoning.
const LIFECYCLE_ACTION = "delete";

function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    const target = getUniqueConstraintTarget(error);
    if (target.includes("accountNumber")) {
      throw new AppError("A bank account with this account number already exists in this company.");
    }
    throw new AppError("A ledger with this name already exists in this company.");
  }
  throw error;
}

export const bankAccountService = {
  async listBankAccounts(filters: BankAccountListFilters = {}): Promise<BankAccountWithLedger[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");
    return bankAccountRepository.findMany(user.companyId, filters);
  },

  // A bank account belonging to a different company must resolve
  // identically to "not found" — mirrors ledgerService.ts's/
  // ledgerGroupService.ts's identical rule.
  async getBankAccount(id: string): Promise<BankAccountWithLedger | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const bankAccount = await bankAccountRepository.findById(id);
    if (!bankAccount || bankAccount.companyId !== user.companyId) {
      return null;
    }
    return bankAccount;
  },

  /**
   * Active "Bank Accounts"-subtree ledger groups for the Create Bank
   * Account form's group picker — per 15-bank-management.md, the only
   * groups a Bank Account's Ledger may ever be created under. When this
   * resolves to a single group (the common case: no custom sub-groups),
   * the form shows no picker at all and submits that one id directly.
   */
  async listSelectableLedgerGroupsForBankAccount(): Promise<LedgerGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, { status: "active" });
    const bankAccountsSubtreeIds = getBankAccountsSubtreeIds(groups);
    return groups.filter((group) => bankAccountsSubtreeIds.has(group.id));
  },

  async createBankAccount(input: CreateBankAccountInput): Promise<BankAccountWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "create");

    const data = createBankAccountSchema.parse(input);

    // Re-verified server-side against a fresh, company-scoped group list —
    // never trust the client-supplied ledgerGroupId. This also closes the
    // documented trust-boundary gap in ledgerService.createUnderGroup
    // (14-ledger-master.md's progress-tracker note): allGroups is already
    // scoped to user.companyId, so a cross-tenant group id can never match.
    const allGroups = await ledgerGroupRepository.findMany(user.companyId, {});
    const bankAccountsSubtreeIds = getBankAccountsSubtreeIds(allGroups);
    if (!bankAccountsSubtreeIds.has(data.ledgerGroupId)) {
      throw new AppError('The ledger group must be "Bank Accounts" or one of its sub-groups.');
    }

    const group = allGroups.find((candidate) => candidate.id === data.ledgerGroupId);
    if (!group?.isActive) {
      throw new AppError("Cannot create a bank account under an inactive ledger group.");
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const ledger = await ledgerService.createUnderGroup(
          user.companyId,
          data.ledgerGroupId,
          {
            name: data.accountDisplayName,
            openingBalance: data.openingBalance,
            openingBalanceType: data.openingBalanceType,
            description: data.description ?? null,
          },
          tx
        );

        const bankAccount = await bankAccountRepository.create(
          user.companyId,
          ledger.id,
          {
            bankName: data.bankName,
            accountNumber: data.accountNumber,
            ifscCode: data.ifscCode.toUpperCase(),
            branchName: data.branchName,
            accountHolderName: data.accountHolderName,
            accountType: data.accountType,
            upiId: data.upiId ? data.upiId : null,
          },
          tx
        );

        return { ...bankAccount, ledger: { ...ledger, ledgerGroup: group } };
      });
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateBankAccount(id: string, input: UpdateBankAccountInput): Promise<BankAccountWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "edit");

    const data = updateBankAccountSchema.parse(input);

    const existing = await bankAccountRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError("Bank account not found.");
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const ledger = await ledgerRepository.update(
          existing.ledgerId,
          user.companyId,
          {
            name: data.accountDisplayName,
            openingBalance: data.openingBalance,
            openingBalanceType: data.openingBalanceType,
            description: data.description ?? null,
          },
          tx
        );
        if (!ledger) {
          throw new AppError("Ledger not found.");
        }

        const bankAccount = await bankAccountRepository.update(
          id,
          user.companyId,
          {
            bankName: data.bankName,
            accountNumber: data.accountNumber,
            ifscCode: data.ifscCode.toUpperCase(),
            branchName: data.branchName,
            accountHolderName: data.accountHolderName,
            accountType: data.accountType,
            upiId: data.upiId ? data.upiId : null,
          },
          tx
        );
        if (!bankAccount) {
          throw new AppError("Bank account not found.");
        }

        return { ...bankAccount, ledger: { ...ledger, ledgerGroup: existing.ledger.ledgerGroup } };
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateBankAccount(id: string): Promise<BankAccountWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await bankAccountRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Bank account not found.");
      case "ok":
        return result.bankAccount;
    }
  },

  async deactivateBankAccount(id: string): Promise<BankAccountWithLedger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await bankAccountRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Bank account not found.");
      case "ok":
        return result.bankAccount;
    }
  },
};
