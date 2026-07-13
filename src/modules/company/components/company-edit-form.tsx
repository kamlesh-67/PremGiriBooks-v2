"use client";

import { updateCompanyAction } from "@/modules/administration/actions/company-admin-actions";
import { CompanyForm } from "@/modules/company/components/company-form";
import type { CompanyInput } from "@/modules/company/validation/company-schema";

interface CompanyEditFormProps {
  companyId: string;
  defaultValues: Partial<CompanyInput>;
}

// Legal/business info editing is Super-Admin-only now (Company Module
// split) — this form only ever renders under /administration/companies.
export function CompanyEditForm({ companyId, defaultValues }: CompanyEditFormProps) {
  return (
    <CompanyForm
      defaultValues={defaultValues}
      submitLabel="Save Changes"
      redirectPath="/administration/companies"
      onSubmit={(data) => updateCompanyAction(companyId, data)}
    />
  );
}
