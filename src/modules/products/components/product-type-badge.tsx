import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/types/product";

// Trading / Service / Expense per the Product Architecture, following the
// multi-value badge convention of hsn-code-type-badge.tsx.
const TYPE_CLASSES: Record<ProductType, string> = {
  TRADING: "border-primary/30 bg-primary/10 text-primary",
  SERVICE: "border-warning/30 bg-warning/10 text-warning",
  EXPENSE: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  TRADING: "Trading",
  SERVICE: "Service",
  EXPENSE: "Expense",
};

interface ProductTypeBadgeProps {
  productType: ProductType;
}

export function ProductTypeBadge({ productType }: ProductTypeBadgeProps) {
  return (
    <Badge variant="outline" className={cn(TYPE_CLASSES[productType])}>
      {PRODUCT_TYPE_LABELS[productType]}
    </Badge>
  );
}
