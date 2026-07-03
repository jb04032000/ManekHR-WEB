'use client';

import { useEffect, useState } from 'react';
import type { TeamMember, LedgerRecord } from '@/types';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { salaryApi } from '@/lib/api/modules/salary.api';
import { QuickFactsCard } from './QuickFactsCard';
import { AttendanceSnapshotCard } from './AttendanceSnapshotCard';
import { SalarySnapshotCard } from './SalarySnapshotCard';

export interface EmployeeOverviewTabProps {
  wsId: string;
  member: TeamMember;
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
  canViewAttendance: boolean;
  canViewSalary: boolean;
  isOwnRecord: boolean;
  canViewAll: boolean;
  onOpenTab: (tab: 'attendance' | 'salary') => void;
  reportsToName?: string;
}

export default function EmployeeOverviewTab({
  wsId,
  member,
  ledger,
  ledgerLoading,
  canViewAttendance,
  canViewSalary,
  isOwnRecord,
  canViewAll,
  onOpenTab,
  reportsToName,
}: EmployeeOverviewTabProps) {
  const features = useSalaryFeatures();
  const advancesEnabled = features.advancePayments.enabled;
  const loansEnabled = features.loanManagement.enabled;

  const [advancesOutstanding, setAdvancesOutstanding] = useState<number | null>(null);
  const [loanOutstanding, setLoanOutstanding] = useState<number | null>(null);

  useEffect(() => {
    if (!canViewSalary || !advancesEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await salaryApi.getOutstandingAdvances(wsId, member.id);
        if (!cancelled) setAdvancesOutstanding(res.outstanding);
      } catch {
        if (!cancelled) setAdvancesOutstanding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, member.id, canViewSalary, advancesEnabled]);

  useEffect(() => {
    if (!canViewSalary || !loansEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const amount = await salaryApi.getMemberLoanOutstanding(wsId, member.id);
        if (!cancelled) setLoanOutstanding(amount);
      } catch {
        if (!cancelled) setLoanOutstanding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, member.id, canViewSalary, loansEnabled]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <QuickFactsCard member={member} reportsToName={reportsToName} />

      {canViewAttendance && (
        <AttendanceSnapshotCard
          wsId={wsId}
          memberId={member.id}
          isOwnRecord={isOwnRecord}
          canViewAll={canViewAll}
          onViewAttendance={() => onOpenTab('attendance')}
        />
      )}

      {canViewSalary && (
        <div className="lg:col-span-2">
          <SalarySnapshotCard
            memberId={member.id}
            ledger={ledger}
            ledgerLoading={ledgerLoading}
            advancesOutstanding={advancesOutstanding}
            loanOutstanding={loanOutstanding}
            advancesEnabled={advancesEnabled}
            loansEnabled={loansEnabled}
            onViewSalary={() => onOpenTab('salary')}
          />
        </div>
      )}
    </div>
  );
}
