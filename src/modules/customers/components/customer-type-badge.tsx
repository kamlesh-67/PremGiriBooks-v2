import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CustomerType } from "@/types/customer";

// Retail / Wholesale / Dealer / Distributor — the pricing tiers the Pricing
// Engine (#28) will key on, following the multi-value badge convention of
// product-type-badge.tsx.
const TYPE_CLASSES: Record<CustomerType, string> = {
  RETAIL: "border-muted-foreground/20 bg-muted text-muted-foreground",
  WHOLESALE: "border-primary/30 bg-primary/10 text-primary",
  DEALER: "border-warning/30 bg-warning/10 text-warning",
  DISTRIBUTOR: "border-success/30 bg-success/10 text-success",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  RETAIL: "Retail",
  WHOLESALE: "Wholesale",
  DEALER: "Dealer",
  DISTRIBUTOR: "Distributor",
};

interface CustomerTypeBadgeProps {
  customerType: CustomerType;
}

export function CustomerTypeBadge({ customerType }: CustomerTypeBadgeProps) {
  return (
    <Badge variant="outline" className={cn(TYPE_CLASSES[customerType])}>
      {CUSTOMER_TYPE_LABELS[customerType]}
    </Badge>
  );
}
