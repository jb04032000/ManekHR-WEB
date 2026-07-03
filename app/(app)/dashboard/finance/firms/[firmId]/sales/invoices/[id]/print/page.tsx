'use client';
import { startTransition, use, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { PrintTemplatePicker } from '@/components/finance/sales/PrintTemplatePicker';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import http, { unwrap } from '@/lib/api/client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { useWorkspaceStore } from '@/lib/store';
import type { SaleInvoice, Firm } from '@/types';
import type { FirmProfile, PartyProfile } from '@/lib/finance/print/types';
import { useTranslations } from 'next-intl';

export default function PrintInvoicePage({
  params,
}: {
  params: Promise<{ firmId: string; id: string }>;
}) {
  const { firmId, id } = use(params);
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);

  const [invoice, setInvoice] = useState<SaleInvoice | null>(null);
  const [firm, setFirm] = useState<FirmProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws?._id) return;
    startTransition(() => {
      setLoading(true);
    });
    Promise.all([
      financeSalesApi.invoices.get(ws._id, firmId, id),
      http.get(ApiEndpoints.finance.firm(ws._id, firmId)).then(unwrap<Firm>),
    ])
      .then(([inv, firmData]) => {
        setInvoice(inv as SaleInvoice);
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
          // R3: feed the firm default print locale so the picker can seed the print
          // language (party.preferredLocale wins, this is the fallback before 'en').
          // Without this the picker always defaulted to English even when the firm
          // had a Gujarati/Hindi default set in settings.
          defaultPrintLocale: f.defaultPrintLocale,
        });
      })
      .catch((e: { message?: string }) => setError(e?.message ?? t('detail.loadFailed')))
      .finally(() => setLoading(false));
  }, [ws?._id, firmId, id, t]);

  if (!ws?._id || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  if (error || !invoice || !firm) {
    return (
      <div
        className="flex h-screen items-center justify-center text-sm"
        style={{ color: 'var(--cr-error)' }}
      >
        {error ?? t('print.invoiceNotFound')}
      </div>
    );
  }

  // Build PartyProfile from invoice's partySnapshot (already embedded in voucher)
  const ps = invoice.partySnapshot ?? {};
  const party: PartyProfile = {
    _id: invoice.partyId,
    name: (ps.name as string) ?? t('print.unknownParty'),
    gstin: ps.gstin as string | undefined,
    phone: ps.phone as string | undefined,
    email: ps.email as string | undefined,
    address: ps.address as PartyProfile['address'] | undefined,
    // R3: party-saved print locale (captured into partySnapshot at invoice write time).
    // The picker seeds the print language from this first, so a Gujarati customer's
    // invoice prints in Gujarati with no manual picker change.
    preferredLocale: ps.preferredLocale as 'en' | 'gu' | 'hi' | undefined,
  };

  return (
    <PrintTemplatePicker
      voucher={invoice}
      firm={firm}
      party={party}
      voucherType="sale_invoice"
      firmId={firmId}
    />
  );
}
