import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FinancialYearStatusBadgeProps {
  isCurrent: boolean;
  isClosed: boolean;
}

export function FinancialYearStatusBadge({ isCurrent, isClosed }: FinancialYearStatusBadgeProps) {
  if (isClosed) {
    return (
      <Badge variant="outline" className="border-muted-foreground/20 bg-muted text-muted-foreground">
        Closed
      </Badge>
    );
  }

  if (isCurrent) {
    return (
      <Badge variant="outline" className={cn("border-success/30 bg-success/10 text-success")}>
        Current
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-border text-foreground">
      Open
    </Badge>
  );
}
