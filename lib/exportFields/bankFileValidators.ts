const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_REGEX = /^\d{9,18}$/;

export function isValidIfsc(ifsc: string): boolean {
  return IFSC_REGEX.test(ifsc.toUpperCase().trim());
}

export function isValidAccountNumber(accountNumber: string): boolean {
  return ACCOUNT_REGEX.test(accountNumber.trim());
}

export function sanitizeName(name: string, maxLen = 50): string {
  return name.replace(/[^a-zA-Z0-9 .&-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function coerceTxnDate(date: string): string {
  if (/^\d{2}-\d{2}-\d{4}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export const IMPS_CAP = 500000;

export function autoPickMode(amount: number): 'IMPS' | 'NEFT' | 'RTGS' {
  if (amount > IMPS_CAP) return 'RTGS';
  return 'IMPS';
}
