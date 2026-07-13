import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AccountNature } from "@/types/ledger-group";

const NATURE_LABELS: Record<AccountNature, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  INCOME: "Income",
  EXPENSE: "Expense",
};

const NATURE_CLASSES: Record<AccountNature, string> = {
  ASSET: "border-primary/30 bg-primary/10 text-primary",
  LIABILITY: "border-warning/30 bg-warning/10 text-warning",
  INCOME: "border-success/30 bg-success/10 text-success",
  EXPENSE: "border-error/30 bg-error/10 text-error",
};

interface AccountNatureBadgeProps {
  nature: AccountNature;
}

export function AccountNatureBadge({ nature }: AccountNatureBadgeProps) {
  return (
    <Badge variant="outline" className={cn(NATURE_CLASSES[nature])}>
      {NATURE_LABELS[nature]}
    </Badge>
  );
}
