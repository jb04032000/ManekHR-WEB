'use client';
/**
 * New Payment-Receipt page.
 * Phase 17 / D-04 - non-blocking warning when intelligence.blacklisted on payer.
 */
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import PaymentReceiptForm from '@/components/finance/payments/PaymentReceiptForm';
import BlacklistedPartyWarning from '@/components/parties/BlacklistedPartyWarning';

export default function NewPaymentReceiptPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.banking');
  const searchParams = useSearchParams();
  const partyId = searchParams?.get('partyId') ?? undefined;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader title={t('payments.newTitle')} style={{ marginBottom: 24 }} />
      {/* Phase 17 / D-04 - intelligence.blacklisted non-blocking warning. */}
      {wsId && partyId ? <BlacklistedPartyWarning wsId={wsId} partyId={partyId} /> : null}
      <PaymentReceiptForm firmId={firmId} />
    </div>
  );
}
