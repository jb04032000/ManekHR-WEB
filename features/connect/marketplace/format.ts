/**
 * Shared rupee formatting for the marketplace listing surfaces.
 *
 * Single source so the facet panel price readout and the listing detail price
 * block render an amount identically: Indian numbering, rupee symbol, no
 * decimals (`₹4,49,500`).
 */
export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
