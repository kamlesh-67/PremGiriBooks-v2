import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriceListStatusBadgeProps {
  isActive: boolean;
}

export function PriceListStatusBadge({ isActive }: PriceListStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        isActive
          ? "border-success/30 bg-success/10 text-success"
          : "border-muted-foreground/20 bg-muted text-muted-foreground"
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
