'use client';

import { useCallback, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import type { MessageInstance } from 'antd/es/message/interface';

interface UseQuickPayslipEmailDeps {
  memberId: string;
  memberEmail?: string;
  msgApi: MessageInstance;
}

export function useQuickPayslipEmail({ memberId, memberEmail, msgApi }: UseQuickPayslipEmailDeps) {
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const [sending, setSending] = useState(false);

  const sendLatest = useCallback(async () => {
    if (!currentWorkspaceId) return;
    if (!memberEmail) {
      msgApi.warning('No email on file for this member');
      return;
    }
    setSending(true);
    try {
      // Fetch ledger to find most-recent salary record
      const ledgerRaw = await salaryApi.getLedger(currentWorkspaceId, memberId);
      // API typed as LedgerRecord[] but backend returns single LedgerRecord
      const ledgerRecord = (Array.isArray(ledgerRaw) ? ledgerRaw[0] : ledgerRaw) as
        | import('@/types').LedgerRecord
        | undefined;
      const months = ledgerRecord?.months ?? [];

      if (months.length === 0) {
        msgApi.warning('No payroll records found for this member');
        return;
      }

      // getLedger sorts desc by year/month - first entry is most recent
      const latest = months[0];
      const salaryId = latest?.salaryId;

      if (!salaryId) {
        msgApi.warning('Payslip data unavailable for the latest month');
        return;
      }

      await salaryApi.sendPayslipEmail(currentWorkspaceId, { salaryId });

      msgApi.success(`Payslip for ${latest.monthLabel} sent to ${memberEmail}`);
    } catch (e) {
      const { parseApiError } = await import('@/lib/utils');
      msgApi.error(parseApiError(e) ?? 'Failed to send payslip');
    } finally {
      setSending(false);
    }
  }, [currentWorkspaceId, memberId, memberEmail, msgApi]);

  return { sendLatest, sending };
}
