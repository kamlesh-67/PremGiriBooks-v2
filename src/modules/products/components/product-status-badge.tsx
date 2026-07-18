import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProductStatusBadgeProps {
  isActive: boolean;
}

export function ProductStatusBadge({ isActive }: ProductStatusBadgeProps) {
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
