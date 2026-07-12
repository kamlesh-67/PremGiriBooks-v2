"use client";

import { updateFinancialYearAction } from "@/modules/financial-year/actions/financial-year-actions";
import { FinancialYearForm } from "@/modules/financial-year/components/financial-year-form";
import type { FinancialYearInput } from "@/modules/financial-year/validation/financial-year-schema";

interface FinancialYearEditFormProps {
  financialYearId: string;
  defaultValues: Partial<FinancialYearInput>;
}

export function FinancialYearEditForm({
  financialYearId,
  defaultValues,
}: FinancialYearEditFormProps) {
  return (
    <FinancialYearForm
      defaultValues={defaultValues}
      submitLabel="Save Changes"
      onSubmit={(data) => updateFinancialYearAction(financialYearId, data)}
    />
  );
}
