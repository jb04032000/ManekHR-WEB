'use client';
import { startTransition, use, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { PrintTemplatePicker } from '@/components/finance/sales/PrintTemplatePicker';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import http, { unwrap } from '@/lib/api/client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { useWorkspaceStore } from '@/lib/store';
import type { Proforma, Firm } from '@/types';
import type { FirmProfile, PartyProfile } from '@/lib/finance/print/types';
import { useTranslations } from 'next-intl';

export default function PrintProformaPage({
  params,
}: {
  params: Promise<{ firmId: string; id: string }>;
}) {
  const { firmId, id } = use(params);
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);

  const [voucher, setVoucher] = useState<Proforma | null>(null);
  const [firm, setFirm] = useState<FirmProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws?._id) return;
    startTransition(() => {
      setLoading(true);
    });
    Promise.all([
      financeSalesApi.proforma.get(ws._id, firmId, id),
      http.get(ApiEndpoints.finance.firm(ws._id, firmId)).then(unwrap<Firm>),
    ])
      .then(([vou, firmData]) => {
        setVoucher(vou as Proforma);
        const f = firmData as Firm;
        setFirm({
          _id: f._id,
          firmName: f.firmName,
          gstin: f.gstin,
          pan: f.pan,
          addressLine: [f.address?.line1, f.address?.line2].filter(Boolean).join(', ') || undefined,
          city: f.address?.city,
          state: f.address?.state,
          pincode: f.address?.pincode,
          phone: f.contactPhone,
          email: f.contactEmail,
          brandProfile: f.brandProfile as FirmProfile['brandProfile'],
          // R3: firm default print locale (fallback after party.preferredLocale).
          defaultPrintLocale: f.defaultPrintLocale,
        });
      })
      .catch((e: { message?: string }) => setError(e?.message ?? t('detail.loadFailed')))
      .finally(() => setLoading(false));
  }, [ws?._id, firmId, id, t]);

  if (!ws?._id || loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  if (error || !voucher || !firm)
    return (
      <div
        className="flex h-screen items-center justify-center text-sm"
        style={{ color: 'var(--cr-error)' }}
      >
        {error ?? t('print.notFound')}
      </div>
    );

  const ps = voucher.partySnapshot ?? {};
  const party: PartyProfile = {
    _id: voucher.partyId,
    name: (ps.name as string) ?? t('print.unknownParty'),
    gstin: ps.gstin as string | undefined,
    phone: ps.phone as string | undefined,
    email: ps.email as string | undefined,
    address: ps.address as PartyProfile['address'] | undefined,
    // R3: party-saved print locale (if captured into the snapshot).
    preferredLocale: ps.preferredLocale as 'en' | 'gu' | 'hi' | undefined,
  };

  return (
    <PrintTemplatePicker
      voucher={voucher}
      firm={firm}
      party={party}
      voucherType="proforma"
      firmId={firmId}
    />
  );
}
