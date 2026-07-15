import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HsnCodeType } from "@/types/hsn-code";

// HSN (goods) vs SAC (services), following the multi-value badge convention
// of account-nature-badge.tsx.
const TYPE_CLASSES: Record<HsnCodeType, string> = {
  HSN: "border-primary/30 bg-primary/10 text-primary",
  SAC: "border-warning/30 bg-warning/10 text-warning",
};

interface HsnCodeTypeBadgeProps {
  codeType: HsnCodeType;
}

export function HsnCodeTypeBadge({ codeType }: HsnCodeTypeBadgeProps) {
  return (
    <Badge variant="outline" className={cn(TYPE_CLASSES[codeType])}>
      {codeType}
    </Badge>
  );
}
