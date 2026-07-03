'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Typography, Skeleton } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { getPurchaseOrder, getGrn } from '@/lib/actions/finance-purchases.actions';
import PurchaseBillForm from '@/components/finance/purchases/PurchaseBillForm';
import type { PurchaseBill, PurchaseOrder, GoodsReceiptNote, OcrExtractionResult } from '@/types';
// Phase 17 / D-04 - non-blocking warning when intelligence.blacklisted on vendor.
import BlacklistedPartyWarning from '@/components/parties/BlacklistedPartyWarning';

export default function NewPurchaseBillPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.editor');
  const searchParams = useSearchParams();
  const sourcePoId = searchParams.get('sourcePoId');
  const sourceGrnId = searchParams.get('sourceGrnId');
  const fromOcrKey = searchParams.get('fromOcr');

  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [sourcePo, setSourcePo] = useState<PurchaseOrder | undefined>();
  const [sourceGrn, setSourceGrn] = useState<GoodsReceiptNote | undefined>();
  const [ocrPrefill, setOcrPrefill] = useState<
    Partial<import('@/types').PurchaseBill> | undefined
  >();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    const tasks: Promise<void>[] = [];

    if (sourcePoId) {
      tasks.push(
        getPurchaseOrder(wsId, firmId, sourcePoId)
          .then((po) => setSourcePo(po))
          .catch(() => {}),
      );
    }
    if (sourceGrnId) {
      tasks.push(
        getGrn(wsId, firmId, sourceGrnId)
          .then((grn) => setSourceGrn(grn))
          .catch(() => {}),
      );
    }
    if (fromOcrKey) {
      try {
        const stored = sessionStorage.getItem(fromOcrKey);
        if (stored) {
          const extraction: OcrExtractionResult = JSON.parse(stored);
          // Map OCR extraction fields to PurchaseBill shape for pre-fill
          startTransition(() => {
            setOcrPrefill({
              vendorBillNumber: extraction.invoiceNumber,
              vendorBillDate: extraction.invoiceDate,
              ocrStatus: extraction.ocrStatus,
              ocrConfidence: extraction.confidence,
              lineItems: extraction.lineItems.map((li) => ({
                itemName: li.description ?? '',
                qty: li.qty ?? 1,
                unit: li.unit,
                ratePaise: li.ratePaise ?? 0,
                taxRate: li.taxRate,
                lineTotalPaise: li.lineTotalPaise ?? 0,
              })),
            });
          });
        }
      } catch {
        // sessionStorage parse failure - proceed without prefill
      }
    }

    Promise.all(tasks).finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, sourcePoId, sourceGrnId, fromOcrKey]);

  if (!isHydrated || loading) return <Skeleton active style={{ padding: 24 }} />;

  // Phase 17 / D-04 - vendor partyId comes from sourcePo when prefilled.
  const vendorPartyId = sourcePo
    ? typeof (sourcePo as unknown as { partyId?: unknown }).partyId === 'string'
      ? (sourcePo as unknown as { partyId: string }).partyId
      : undefined
    : undefined;

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={1} style={{ marginBottom: 24, fontSize: 22 }}>
        {t('newBillTitle')}
      </Typography.Title>
      {wsId && vendorPartyId ? (
        <BlacklistedPartyWarning wsId={wsId} partyId={vendorPartyId} />
      ) : null}
      <PurchaseBillForm
        firmId={firmId}
        wsId={wsId}
        initialBill={ocrPrefill}
        sourcePo={sourcePo}
        sourceGrn={sourceGrn}
        onSaved={(bill: PurchaseBill) => {
          // Clear OCR session storage after save
          if (fromOcrKey) sessionStorage.removeItem(fromOcrKey);
          router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-bills/${bill._id}`);
        }}
      />
    </div>
  );
}
