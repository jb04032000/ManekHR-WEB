export function formatAdjustmentCategory(value?: string): string {
  if (!value) return 'Other';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getAdjustmentActorName(actor?: string | { name?: string } | null): string {
  if (!actor) return 'Admin';
  if (typeof actor === 'string') return actor;
  return actor.name || 'Admin';
}

export function slugifyFilenamePart(value?: string): string {
  return (
    value
      ?.toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'employee'
  );
}

export function formatPayrollDayValue(value?: number): string {
  if (value === undefined || value === null) return '00';
  if (!Number.isInteger(value)) return value.toFixed(1);
  return String(value).padStart(2, '0');
}

export function getPaymentCreditedAmount(payment: {
  amount?: number;
  commission?: number;
}): number {
  return (payment.amount ?? 0) + (payment.commission ?? 0);
}
