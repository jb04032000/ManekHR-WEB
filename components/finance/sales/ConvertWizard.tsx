'use client';
/**
 * ConvertWizard - 3-step modal for multi-doc combine (D-04).
 * Step 1: Choose target type + party-conflict guard
 * Step 2: Review merged line items (remove per source doc)
 * Step 3: Fill target-specific fields (date, payment terms)
 */
import { useEffect, useMemo, useState, startTransition } from 'react';
import { Steps, Radio, Table, DatePicker, InputNumber, Alert, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { LineItem } from '@/types';

// D-04 ALLOWED_TRANSITIONS: which source types can convert to which targets
const ALLOWED_TARGETS: Record<string, Array<{ value: string; label: string }>> = {
  quotation: [
    { value: 'sale_order', label: 'Sale Order' },
    { value: 'proforma', label: 'Proforma Invoice' },
    { value: 'delivery_challan', label: 'Delivery Challan' },
    { value: 'sale_invoice', label: 'Tax Invoice' },
  ],
  sale_order: [
    { value: 'delivery_challan', label: 'Delivery Challan' },
    { value: 'sale_invoice', label: 'Tax Invoice' },
  ],
  proforma: [{ value: 'sale_invoice', label: 'Tax Invoice' }],
  delivery_challan: [{ value: 'sale_invoice', label: 'Tax Invoice' }],
};

// Slug used in the URL path for each target type
const TARGET_SLUG: Record<string, string> = {
  sale_order: 'orders',
  proforma: 'proforma',
  delivery_challan: 'delivery-challans',
  sale_invoice: 'invoices',
};

// Source API key for financeSalesApi
const SOURCE_API_KEY: Record<string, string> = {
  quotation: 'quotations',
  sale_order: 'orders',
  proforma: 'proforma',
  delivery_challan: 'deliveryChallans',
};

type SourceType = 'quotation' | 'sale_order' | 'proforma' | 'delivery_challan';

interface MergedLine extends LineItem {
  _sourceVoucherNo: string;
  _sourceLineIdx: number;
  _sourceId: string;
}

interface Props {
  open: boolean;
  sourceType: SourceType;
  sourceIds: string[];
  firmId: string;
  onClose: () => void;
}

export function ConvertWizard({ open, sourceType, sourceIds, firmId, onClose }: Props) {
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [targetType, setTargetType] = useState<string>(
    ALLOWED_TARGETS[sourceType]?.[0]?.value ?? 'sale_invoice',
  );
  const [sources, setSources] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [removedSourceIds, setRemovedSourceIds] = useState<Set<string>>(new Set());
  const [voucherDate, setVoucherDate] = useState<Dayjs>(dayjs());
  const [dueDays, setDueDays] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset wizard state when opened/reopened
  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      setStep(0);
      setTargetType(ALLOWED_TARGETS[sourceType]?.[0]?.value ?? 'sale_invoice');
      setRemovedSourceIds(new Set());
      setVoucherDate(dayjs());
      setDueDays(0);
      setError(null);
      setLoadError(null);
      setSources([]);
    });
  }, [open, sourceType]);

  // Load source documents when wizard opens
  useEffect(() => {
    if (!open || !ws?._id || sourceIds.length === 0) return;
    const apiKey = SOURCE_API_KEY[sourceType];
    if (!apiKey) return;
    const api = (financeSalesApi as any)[apiKey]; // eslint-disable-line @typescript-eslint/no-explicit-any
    Promise.all(sourceIds.map((id) => api.get(ws._id, firmId, id)))
      .then((docs) => setSources(docs))
      .catch((e: any) =>
        setLoadError(e?.response?.data?.message ?? e?.message ?? 'Failed to load documents'),
      );
  }, [open, ws?._id, firmId, sourceType, sourceIds]);

  // D-04: party conflict - cannot combine docs with different partyIds
  const partyConflict = useMemo(() => {
    if (sources.length <= 1) return false;
    const partyIds = new Set(sources.map((s) => s.partyId));
    return partyIds.size > 1;
  }, [sources]);

  // Merged line items from all non-removed source documents
  const mergedLines: MergedLine[] = useMemo(
    () =>
      sources
        .filter((s) => !removedSourceIds.has(s._id))
        .flatMap((s) =>
          (s.lineItems ?? []).map((l: LineItem, i: number) => ({
            ...l,
            _sourceVoucherNo: s.voucherNumber ?? '(draft)',
            _sourceLineIdx: i,
            _sourceId: s._id,
          })),
        ),
    [sources, removedSourceIds],
  );

  const remainingSourceIds = sourceIds.filter((id) => !removedSourceIds.has(id));

  const handleConvert = async () => {
    if (!ws?._id) return;
    setBusy(true);
    setError(null);
    try {
      const target = await financeSalesApi.convert(ws._id, firmId, {
        sourceType,
        sourceIds: remainingSourceIds,
        targetType,
        voucherDate: voucherDate.toISOString(),
        paymentTermsDays: dueDays,
      });
      const slug = TARGET_SLUG[targetType] ?? 'invoices';
      router.push(
        `/dashboard/finance/firms/${firmId}/sales/${slug}/${(target as any)._id}`, // eslint-disable-line @typescript-eslint/no-explicit-any
      );
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Convert failed');
    } finally {
      setBusy(false);
    }
  };

  const canNext =
    step === 0 ? !!targetType && !partyConflict : step === 1 ? mergedLines.length > 0 : true;

  return (
    <DsModal open={open} onCancel={onClose} title="Convert Vouchers" width={720} footer={null}>
      <Steps
        progressDot
        current={step}
        items={[
          { title: 'Choose Target' },
          { title: 'Review Lines' },
          { title: 'Fill Target Fields' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {loadError && (
        <Alert
          type="error"
          title={loadError}
          closable
          onClose={() => setLoadError(null)}
          style={{ marginBottom: 12 }}
        />
      )}
      {error && (
        <Alert
          type="error"
          title={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Step 0: Choose target type */}
      {step === 0 && (
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            Source documents ({sources.length})
          </h4>
          <ul style={{ fontSize: 13, marginBottom: 16, paddingLeft: 16, lineHeight: '1.8' }}>
            {sources.map((s) => (
              <li key={s._id}>
                <strong>{s.voucherNumber ?? '(draft)'}</strong>
                {' - '}
                {s.partySnapshot?.name ?? s.partyId}
                {' - '}₹
                {((s.grandTotalPaise ?? 0) / 100).toLocaleString('en-IN', {
                  maximumFractionDigits: 2,
                })}
              </li>
            ))}
          </ul>

          {partyConflict && (
            <Alert
              type="error"
              title="Cannot combine: selected documents belong to different parties. Multi-doc combine requires the same party."
              style={{ marginBottom: 12 }}
            />
          )}

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Convert to</div>
          <Radio.Group value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <Space direction="vertical">
              {ALLOWED_TARGETS[sourceType]?.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>
      )}

      {/* Step 1: Review merged lines */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--cr-text-3)', marginBottom: 8 }}>
            Review the merged line items. Remove a source document by clicking Remove on any of its
            lines.
          </div>
          <Table
            size="small"
            rowKey={(r: MergedLine, i?: number) => `${r._sourceId}-${r._sourceLineIdx}-${i}`}
            dataSource={mergedLines}
            pagination={false}
            columns={[
              { title: 'Source', dataIndex: '_sourceVoucherNo', width: 120 },
              { title: 'Item', dataIndex: 'itemName', ellipsis: true },
              { title: 'Qty', dataIndex: 'qty', align: 'right', width: 70 },
              {
                title: 'Rate',
                dataIndex: 'ratePaise',
                align: 'right',
                width: 90,
                render: (p: number) => '₹' + ((p ?? 0) / 100).toFixed(2),
              },
              { title: 'Tax%', dataIndex: 'taxRate', width: 60, align: 'right' },
              {
                title: <span className="sr-only">Actions</span>,
                width: 80,
                render: (_: unknown, row: MergedLine) => (
                  <DsButton
                    dsVariant="ghost"
                    dsSize="sm"
                    onClick={() => setRemovedSourceIds((prev) => new Set(prev).add(row._sourceId))}
                  >
                    Remove
                  </DsButton>
                ),
              },
            ]}
          />
          {mergedLines.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--cr-text-3)' }}>
              All source documents removed. Go back to restore selections.
            </div>
          )}
        </div>
      )}

      {/* Step 2: Fill target-specific fields */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Voucher Date</div>
            <DatePicker
              value={voucherDate}
              onChange={(d) => d && setVoucherDate(d)}
              allowClear={false}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Payment Terms (days)
            </div>
            <InputNumber
              min={0}
              max={365}
              value={dueDays}
              onChange={(v) => setDueDays(v ?? 0)}
              style={{ width: 120 }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
            Voucher number format placeholder: <code>INV/25-26/XXXX</code> (assigned at Post)
          </div>
        </div>
      )}

      {/* Footer navigation */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <DsButton dsVariant="ghost" onClick={onClose}>
          Cancel
        </DsButton>
        {step > 0 && (
          <DsButton dsVariant="ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </DsButton>
        )}
        {step < 2 && (
          <DsButton dsVariant="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Next
          </DsButton>
        )}
        {step === 2 && (
          <DsButton dsVariant="primary" loading={busy} onClick={handleConvert}>
            Convert
          </DsButton>
        )}
      </div>
    </DsModal>
  );
}
