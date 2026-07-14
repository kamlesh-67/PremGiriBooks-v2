import * as React from "react";

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

// Shared multi-section form layout used by every form that groups fields
// under labeled sections (Company creation/edit, Company profile) — extracted
// from what were three near-identical local definitions.
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
