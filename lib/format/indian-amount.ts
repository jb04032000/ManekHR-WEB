/**
 * Indian-grouping amount formatter/parser pair for AntD `<InputNumber>`.
 *
 * `formatter` renders the in-progress value with en-IN digit grouping
 * (e.g. 123456 -> "1,23,456") while preserving a trailing decimal the user is
 * mid-typing; `parser` strips the grouping back to a plain numeric string so
 * the form value stays a number.
 *
 * Extracted from `PayDrawer` (2026-05-22) so the add-member salary field and
 * the payment drawer share one implementation instead of duplicating it.
 */

export function formatIndianAmountInput(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  const [wholePart, decimalPart] = String(value).split('.');
  const sanitizedWhole = wholePart.replace(/[^\d-]/g, '');

  if (!sanitizedWhole || sanitizedWhole === '-') {
    return decimalPart !== undefined ? `${sanitizedWhole}.${decimalPart}` : sanitizedWhole;
  }

  const formattedWhole = new Intl.NumberFormat('en-IN').format(Number(sanitizedWhole));
  return decimalPart !== undefined ? `${formattedWhole}.${decimalPart}` : formattedWhole;
}

export function parseAmountInput(value: string | undefined): number {
  if (!value) return 0;
  const sanitized = value.replace(/[^\d.]/g, '');
  const [wholePart, ...decimalParts] = sanitized.split('.');
  const normalized = decimalParts.length > 0 ? `${wholePart}.${decimalParts.join('')}` : wholePart;
  return normalized ? Number(normalized) : 0;
}
