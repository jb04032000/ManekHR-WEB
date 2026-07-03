import type { TeamMember } from '@/types';

function hasBank(m: TeamMember): boolean {
  return !!(m.bankDetails?.accountNumber && m.bankDetails?.ifscCode);
}

function hasUpi(m: TeamMember): boolean {
  return !!(m.upiDetails?.upiId);
}

function isCash(m: TeamMember): boolean {
  return (m.preferredMethod as string) === 'CASH';
}

export function isPayrollReady(m: TeamMember): boolean {
  return !!(m.salaryAmount) && (hasBank(m) || hasUpi(m) || isCash(m));
}

export interface PayrollMissingItem {
  id: string;
  name: string;
  missing: string[];
}

export function getPayrollMissing(m: TeamMember): string[] {
  const missing: string[] = [];
  if (!m.salaryAmount) missing.push('salary');
  if (!hasBank(m) && !hasUpi(m) && !isCash(m)) missing.push('payment method');
  return missing;
}
