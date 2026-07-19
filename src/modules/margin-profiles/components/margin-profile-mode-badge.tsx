import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PriceCalculationMode } from "@/types/margin-profile";

// Margin / Markup per PRD.md §12, following the multi-value badge convention
// of product-type-badge.tsx.
const MODE_CLASSES: Record<PriceCalculationMode, string> = {
  MARGIN: "border-primary/30 bg-primary/10 text-primary",
  MARKUP: "border-warning/30 bg-warning/10 text-warning",
};

export const PRICE_CALCULATION_MODE_LABELS: Record<PriceCalculationMode, string> = {
  MARGIN: "Margin",
  MARKUP: "Markup",
};

interface MarginProfileModeBadgeProps {
  calculationMode: PriceCalculationMode;
}

export function MarginProfileModeBadge({ calculationMode }: MarginProfileModeBadgeProps) {
  return (
    <Badge variant="outline" className={cn(MODE_CLASSES[calculationMode])}>
      {PRICE_CALCULATION_MODE_LABELS[calculationMode]}
    </Badge>
  );
}
