import type { CreatePriceListInput } from "@/modules/price-lists/validation/price-list-schema";
import type { PriceList } from "@/types/price-list";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Converts a stored header into the form's string-based input shape —
 * mirrors financial-year module's toFinancialYearFormValues. */
export function toPriceListFormValues(priceList: PriceList): CreatePriceListInput {
  return {
    name: priceList.name,
    customerType: priceList.customerType ?? undefined,
    effectiveFrom: priceList.effectiveFrom ? toDateInputValue(priceList.effectiveFrom) : undefined,
    effectiveTo: priceList.effectiveTo ? toDateInputValue(priceList.effectiveTo) : undefined,
    description: priceList.description ?? undefined,
  };
}
