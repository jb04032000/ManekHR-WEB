'use client';
import React, { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Skeleton, Typography } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import PaymentOutForm from '@/components/finance/purchases/PaymentOutForm';
import type { PaymentOut } from '@/types';
import { useRouter } from 'next/navigation';
// Phase 17 / D-04 - intelligence.blacklisted non-blocking warning.
import BlacklistedPartyWarning from '@/components/parties/BlacklistedPartyWarning';

function NewPaymentOutInner() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.editor');
  const searchParams = useSearchParams();
  const partyId = searchParams.get('partyId') ?? undefined;

  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  if (!isHydrated) return <Skeleton active />;

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={1} style={{ marginBottom: 24, fontSize: 22 }}>
        {t('newPaymentOutTitle')}
      </Typography.Title>
      {wsId && partyId ? <BlacklistedPartyWarning wsId={wsId} partyId={partyId} /> : null}
      <PaymentOutForm
        firmId={firmId}
        wsId={wsId}
        partyId={partyId}
        onSaved={(out: PaymentOut) => {
          router.push(`/dashboard/finance/firms/${firmId}/purchases/payment-out/${out._id}`);
        }}
      />
    </div>
  );
}

export default function NewPaymentOutPage() {
  return (
    <Suspense fallback={<Skeleton active style={{ padding: 24 }} />}>
      <NewPaymentOutInner />
    </Suspense>
  );
}
