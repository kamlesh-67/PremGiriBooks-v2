"use client";

import NextImage from "next/image";
import { Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyStatusBadge } from "@/modules/company/components/company-status-badge";
import type { CompanyWithSettings } from "@/types/company";

interface CompanyCardProps {
  company: CompanyWithSettings;
  onSelect: () => void;
  isSelecting?: boolean;
}

export function CompanyCard({ company, onSelect, isSelecting }: CompanyCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSelecting}
      className="w-full text-left outline-none disabled:opacity-60"
    >
      <Card className="transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
        <CardHeader>
          <div className="flex items-center gap-3">
            {company.logo ? (
              <NextImage
                src={company.logo}
                alt={company.companyName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg border border-border object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                <Building2 size={20} />
              </div>
            )}
            <div className="flex flex-col">
              <CardTitle>{company.displayName ?? company.companyName}</CardTitle>
              <span className="text-xs text-muted-foreground">{company.legalName}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{company.gstin ?? "No GSTIN"}</span>
          <CompanyStatusBadge isActive={company.isActive} />
        </CardContent>
      </Card>
    </button>
  );
}
