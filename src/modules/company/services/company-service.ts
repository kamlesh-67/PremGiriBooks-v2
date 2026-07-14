import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser, getCurrentSuperAdmin, getCurrentUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { auditLogService } from "@/modules/administration/services/audit-log-service";
import { tenantBootstrapService } from "@/modules/administration/services/tenant-bootstrap-service";
import { createCompanySchema, type CreateCompanyInput } from "@/modules/administration/validation/create-company-schema";
import { companyRepository } from "@/modules/company/repositories/company-repository";
import { blankToNull, normalizeCompanyInput } from "@/modules/company/utils/normalize-company-input";
import type { CompanyPersistData } from "@/modules/company/utils/normalize-company-input";
import {
  companyProfileSchema,
  companySchema,
  type CompanyInput,
  type CompanyProfileInput,
} from "@/modules/company/validation/company-schema";
import { userRepository } from "@/modules/users/repositories/user-repository";
import { getUniqueConstraintFields } from "@/modules/users/utils/prisma-errors";
import type { CompanyListFilters, CompanyWithSettings } from "@/types/company";

function translateCompanyAdminPersistError(error: unknown): never {
  const fields = getUniqueConstraintFields(error);
  if (fields.includes("username")) {
    throw new AppError("That Company Admin username is already taken.");
  }
  if (fields.includes("email")) {
    throw new AppError("That Company Admin email is already registered.");
  }
  throw error;
}

export const companyService = {
  // Super Admin (userType === "PLATFORM") sees every company; a COMPANY
  // user only ever sees their own — the old "Administrator sees all"
  // special case is retired along with the Administrator role itself.
  async listCompanies(filters: CompanyListFilters = {}): Promise<CompanyWithSettings[]> {
    const user = await getCurrentUser();
    if (user.userType === "PLATFORM") {
      return companyRepository.findMany(filters);
    }

    const company = await companyRepository.findById(user.companyId);
    if (!company) {
      return [];
    }

    if (filters.status === "active" && !company.isActive) {
      return [];
    }

    if (filters.status === "inactive" && company.isActive) {
      return [];
    }

    return [company];
  },

  async getCompany(id: string): Promise<CompanyWithSettings | null> {
    const user = await getCurrentUser();
    if (user.userType !== "PLATFORM" && user.companyId !== id) {
      return null;
    }

    return companyRepository.findById(id);
  },

  /**
   * The full Company Creation workflow per
   * architecture-Migration-Super-Admin-Administration.md: Company row ->
   * TenantBootstrapService (Roles + their permissions, Financial Year,
   * Ledger Groups, default Ledger) -> the first Company Admin User, all in
   * one transaction — a failure at any step rolls the whole company back
   * with it. Company Settings is created as part of companyRepository's
   * own nested-create, unchanged from before.
   */
  async createCompany(input: CreateCompanyInput): Promise<CompanyWithSettings> {
    const actor = await getCurrentSuperAdmin();
    const data = createCompanySchema.parse(input);
    const companyData = normalizeCompanyInput(companySchema.parse(data.company));
    const passwordHash = await hashPassword(data.companyAdmin.password);

    const company = await prisma.$transaction(async (tx) => {
      const company = await companyRepository.create(companyData, tx);

      const { companyAdminRoleId } = await tenantBootstrapService.bootstrapTenant(
        company.id,
        { financialYear: data.financialYear },
        tx
      );

      let adminResult;
      try {
        adminResult = await userRepository.create(
          company.id,
          {
            username: data.companyAdmin.username,
            fullName: data.companyAdmin.fullName,
            email: data.companyAdmin.email,
            mobile: data.companyAdmin.mobile ? data.companyAdmin.mobile : null,
            roleId: companyAdminRoleId,
          },
          passwordHash,
          tx
        );
      } catch (error) {
        translateCompanyAdminPersistError(error);
      }
      if (adminResult.status !== "ok") {
        // Not reachable in practice — the role was just seeded active and
        // company-owned by the same transaction — but the result type is a
        // union, so this satisfies it without a non-null assertion.
        throw new AppError("Failed to create the Company Admin user.");
      }

      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company.created",
          targetType: "Company",
          targetId: company.id,
          companyId: company.id,
        },
        tx
      );
      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company_admin.created",
          targetType: "User",
          targetId: adminResult.user.id,
          companyId: company.id,
        },
        tx
      );

      return company;
    });

    return company;
  },

  async updateCompany(id: string, input: CompanyInput): Promise<CompanyWithSettings> {
    const actor = await getCurrentSuperAdmin();
    const data = normalizeCompanyInput(companySchema.parse(input));

    return prisma.$transaction(async (tx) => {
      const company = await companyRepository.update(id, data, tx);
      if (!company) {
        throw new AppError("Company not found.");
      }
      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company.updated",
          targetType: "Company",
          targetId: company.id,
          companyId: company.id,
        },
        tx
      );
      return company;
    });
  },

  /**
   * Company Admin's own self-service edit of their company's profile —
   * everything except the compliance-sensitive registration identifiers
   * (legalName, gstin, pan, tan, cin) and the currency ISO code, which stay
   * Super-Admin-only via updateCompany() above. Permission-gated
   * (assertPermission "company"/"edit", per Principle 1 — never a role-name
   * check) and hard-scoped to the caller's own company; no audit entry, same
   * as every other Company-side settings mutation (audit logging is narrow,
   * Administration-lifecycle-only — see architecture-context.md).
   */
  async updateCompanyProfile(
    id: string,
    input: CompanyProfileInput
  ): Promise<CompanyWithSettings> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", "edit");
    if (user.companyId !== id) {
      throw new AppError("Company not found.");
    }

    const existing = await companyRepository.findById(id);
    if (!existing) {
      throw new AppError("Company not found.");
    }

    const data = companyProfileSchema.parse(input);
    const merged: CompanyPersistData = {
      ...existing,
      ...data,
      displayName: blankToNull(data.displayName),
      businessType: blankToNull(data.businessType),
      mobileNumber: blankToNull(data.mobileNumber),
      alternateMobile: blankToNull(data.alternateMobile),
      email: blankToNull(data.email),
      website: blankToNull(data.website),
      addressLine1: blankToNull(data.addressLine1),
      addressLine2: blankToNull(data.addressLine2),
      city: blankToNull(data.city),
      state: blankToNull(data.state),
      district: blankToNull(data.district),
      pinCode: blankToNull(data.pinCode),
      logo: blankToNull(data.logo),
    };

    const company = await companyRepository.update(id, merged);
    if (!company) {
      throw new AppError("Company not found.");
    }
    return company;
  },

  async activateCompany(id: string): Promise<CompanyWithSettings> {
    const actor = await getCurrentSuperAdmin();
    return prisma.$transaction(async (tx) => {
      const company = await companyRepository.setActive(id, true, tx);
      if (!company) {
        throw new AppError("Company not found.");
      }
      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company.activated",
          targetType: "Company",
          targetId: company.id,
          companyId: company.id,
        },
        tx
      );
      return company;
    });
  },

  async deactivateCompany(id: string): Promise<CompanyWithSettings> {
    const actor = await getCurrentSuperAdmin();
    return prisma.$transaction(async (tx) => {
      const company = await companyRepository.setActive(id, false, tx);
      if (!company) {
        throw new AppError("Company not found.");
      }
      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company.deactivated",
          targetType: "Company",
          targetId: company.id,
          companyId: company.id,
        },
        tx
      );
      return company;
    });
  },
};
