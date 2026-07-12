"use client";

import { updateCompanyAction } from "@/modules/company/actions/company-actions";
import { CompanyForm } from "@/modules/company/components/company-form";
import type { CompanyInput } from "@/modules/company/validation/company-schema";

interface CompanyEditFormProps {
  companyId: string;
  defaultValues: Partial<CompanyInput>;
}

export function CompanyEditForm({ companyId, defaultValues }: CompanyEditFormProps) {
  return (
    <CompanyForm
      defaultValues={defaultValues}
      submitLabel="Save Changes"
      onSubmit={(data) => updateCompanyAction(companyId, data)}
    />
  );
}
