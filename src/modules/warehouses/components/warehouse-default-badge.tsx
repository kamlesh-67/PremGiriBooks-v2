import { Badge } from "@/components/ui/badge";

/**
 * Marks the company's single default warehouse in the list — the location
 * documents will preselect once transactional modules exist
 * (24-warehouse-management.md). Rendered only for the default row; primary
 * tint following account-nature-badge.tsx's multi-value badge convention.
 */
export function WarehouseDefaultBadge() {
  return (
    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
      Default
    </Badge>
  );
}
