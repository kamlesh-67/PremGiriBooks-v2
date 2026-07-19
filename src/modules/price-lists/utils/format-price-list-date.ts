// Mirrors financial-year module's formatFinancialYearDate — UTC-anchored so
// a @db.Date column (stored as midnight UTC) never shifts a day under the
// viewer's local timezone.
function formatPriceListDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Renders a PriceList's effective window for the list table
 * (29-price-lists.md's UI). Both null = always effective ("—"); a one-sided
 * window reads as "From …" or "Until …".
 */
export function formatEffectiveWindow(
  effectiveFrom: Date | null,
  effectiveTo: Date | null
): string {
  if (!effectiveFrom && !effectiveTo) {
    return "—";
  }
  if (effectiveFrom && effectiveTo) {
    return `${formatPriceListDate(effectiveFrom)} – ${formatPriceListDate(effectiveTo)}`;
  }
  if (effectiveFrom) {
    return `From ${formatPriceListDate(effectiveFrom)}`;
  }
  return `Until ${formatPriceListDate(effectiveTo as Date)}`;
}
