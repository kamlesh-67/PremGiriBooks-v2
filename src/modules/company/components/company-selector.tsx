"use client";

import * as React from "react";
import { toast } from "sonner";

import { CompanyCard } from "@/modules/company/components/company-card";
import { selectCompanyAction } from "@/modules/company/actions/company-actions";
import type { CompanyWithSettings } from "@/types/company";

interface CompanySelectorProps {
  companies: CompanyWithSettings[];
}

export function CompanySelector({ companies }: CompanySelectorProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const hasAutoSelected = React.useRef(false);

  const handleSelect = React.useCallback(async (companyId: string) => {
    setPendingId(companyId);
    const result = await selectCompanyAction(companyId);
    if (result && !result.success) {
      toast.error(result.error ?? "Failed to select company.");
    }
    setPendingId(null);
  }, []);

  React.useEffect(() => {
    if (companies.length === 1 && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      void handleSelect(companies[0].id);
    }
  }, [companies, handleSelect]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard
          key={company.id}
          company={company}
          onSelect={() => handleSelect(company.id)}
          isSelecting={pendingId === company.id}
        />
      ))}
    </div>
  );
}
