'use client';
// Bank reconciliation worksheet (Finance > Payments & Banking). Polish: i18n via
// finance.banking.reconcile. Renders BankStatementUpload (new) or ReconciliationWorksheet.
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin, Alert } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { financeBankReconciliationApi } from '@/lib/api/modules/finance-bank-reconciliation.api';
import { getBankAccount } from '@/lib/actions/finance-bank-accounts.actions';
import { listFirms } from '@/lib/actions/finance.actions';
import BankStatementUpload from '@/components/finance/bank/BankStatementUpload';
import ReconciliationWorksheet from '@/components/finance/bank/ReconciliationWorksheet';
import type { ReconciliationSession, BankStatement, FinanceBankAccount } from '@/types';

export default function ReconciliationWorksheetPage() {
  const params = useParams();
  const router = useRouter();
  const bankAccountId = params.id as string;
  const sessionId = params.sessionId as string; // 'new' if not yet created
  const t = useTranslations('finance.banking');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [session, setSession] = useState<ReconciliationSession | null>(null);
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [bankAccount, setBankAccount] = useState<FinanceBankAccount | null>(null);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load data
  useEffect(() => {
    if (!isHydrated || !wsId) return;
    let cancelled = false;

    (async () => {
      try {
        // Get firmId via listFirms (matches hub page pattern)
        const firms = await listFirms(wsId);
        if (cancelled) return;
        const fId = firms?.[0]?._id;
        if (!fId) {
          setError(t('reconcile.noFirm'));
          setLoading(false);
          return;
        }
        setFirmId(fId);

        const account = await getBankAccount(wsId, fId, bankAccountId);
        if (cancelled) return;
        setBankAccount(account);

        if (sessionId === 'new') {
          setLoading(false);
          return;
        }

        const ses = await financeBankReconciliationApi.getSession(
          wsId,
          fId,
          bankAccountId,
          sessionId,
        );
        if (cancelled) return;
        setSession(ses);

        const stmt = await financeBankReconciliationApi.getStatement(
          wsId,
          fId,
          bankAccountId,
          ses.bankStatementId,
        );
        if (!cancelled) setStatement(stmt);
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          setError(err?.message ?? t('reconcile.loadSessionFailed'));

          console.error(e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is a stable next-intl formatter; reload only on workspace/account/session change.
  }, [isHydrated, wsId, bankAccountId, sessionId]);

  // Mobile guard
  if (isMobile) {
    return (
      <div className="p-lg">
        <Alert type="warning" title={t('reconcile.mobileWarning')} />
      </div>
    );
  }

  if (!isHydrated || loading) {
    return (
      <div className="p-lg">
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-lg">
        <Alert type="error" title={error} />
      </div>
    );
  }

  // Show upload wizard if new session or no statement/session loaded
  if (sessionId === 'new' || !session || !statement) {
    return (
      <div className="p-lg">
        <BankStatementUpload
          wsId={wsId!}
          firmId={firmId!}
          bankAccountId={bankAccountId}
          onConfirmed={(newSessionId) => {
            router.replace(
              `/dashboard/finance/bank-accounts/${bankAccountId}/reconcile/${newSessionId}`,
            );
          }}
        />
      </div>
    );
  }

  return (
    <ReconciliationWorksheet
      session={session}
      statement={statement}
      bankAccount={bankAccount!}
      wsId={wsId!}
      firmId={firmId!}
      bankAccountId={bankAccountId}
      sessionId={sessionId}
      onSessionUpdated={(s) => setSession(s)}
    />
  );
}
