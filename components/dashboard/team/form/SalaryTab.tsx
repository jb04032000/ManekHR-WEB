'use client';

import type { LedgerRecord, GratuityLedger } from '@/types';
import SalaryWorkspace from '@/components/dashboard/team/salary/SalaryWorkspace';

export interface SalaryTabProps {
  memberId: string;
  memberName: string;
  memberEmail?: string;
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
  gratuityLedger: GratuityLedger | null;
  gratuityLoading: boolean;
  gratuityLoaded: boolean;
  canViewGratuityTracking: boolean;
  initialSection?: 'summary' | 'history' | 'payslips';
}

/**
 * Thin shim: preserves the existing public interface while delegating all
 * rendering to SalaryWorkspace. Callers (member detail page) continue passing
 * the same props; SalaryWorkspace handles back-compat for legacy section names.
 */
export default function SalaryTab(props: SalaryTabProps) {
  return <SalaryWorkspace {...props} />;
}
