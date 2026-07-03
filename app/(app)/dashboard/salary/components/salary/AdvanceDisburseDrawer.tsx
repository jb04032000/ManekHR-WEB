'use client';

/**
 * AdvanceDisburseDrawer - second step of the two-step advance flow (Plan 2026-06-22).
 *
 * What it does: Collects HOW the approved advance was physically disbursed:
 *   - Payment method (cash / bank_transfer / upi / cheque / split / other)
 *   - If split: dynamic split lines (method + amount in Rs) validated to sum to approvedAmount
 *   - Reference number, optional note
 *   - Who physically disbursed it (disbursedByName free text)
 *   - Recovery installment configuration via AdvanceInstallmentConfigurator
 *   Submits via payAdvanceRequest -> PATCH :id/pay. On success: calls onSuccess() to refresh queue.
 *
 * Cross-module links:
 *   - payAdvanceRequest (salary.api.ts) -> BE PATCH advance-requests/:id/pay
 *   - AdvanceInstallmentConfigurator: reuses the same recovery-plan UI used in the old approve modal
 *   - LedgerSplitLine type (types/index.ts)
 *   - PayAdvanceRequestPayload (types/index.ts)
 *
 * Watch: AntD v6 conventions enforced (Drawer size=, destroyOnHidden, no addonAfter on InputNumber).
 *   Amounts are stored in paise internally; InputNumber shows rupees (/ 100 for display, * 100 on submit).
 */

import { useEffect, useState, useCallback } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select, App } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { payAdvanceRequest } from '@/lib/api/modules/salary.api';
import type { AdvanceSalaryRequest, LedgerSplitLine, PayAdvanceRequestPayload } from '@/types';

type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'split' | 'other';

interface SplitLineRow {
  id: string;
  method: string;
  amountRupees: number | null;
}

interface DisburseFormValues {
  paymentMode: PaymentMethod;
  referenceNo?: string;
  disbursedByName?: string;
  note?: string;
}

interface AdvanceDisburseDrawerProps {
  open: boolean;
  workspaceId: string;
  /** One request = normal disburse; several = bulk disburse with the same
   *  payment details applied to each (split mode is single-request only). */
  requests: AdvanceSalaryRequest[];
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; labelKey: string; defaultLabel: string }[] = [
  { value: 'cash', labelKey: 'cash', defaultLabel: 'Cash' },
  { value: 'bank_transfer', labelKey: 'bankTransfer', defaultLabel: 'Bank transfer' },
  { value: 'upi', labelKey: 'upi', defaultLabel: 'UPI' },
  { value: 'cheque', labelKey: 'cheque', defaultLabel: 'Cheque' },
  { value: 'split', labelKey: 'split', defaultLabel: 'Split' },
  { value: 'other', labelKey: 'other', defaultLabel: 'Other' },
];

/** Generates a cheap unique id for split rows (not persisted). */
const nextId = (() => {
  let n = 0;
  return () => `split-${++n}`;
})();

function makeSplitRow(): SplitLineRow {
  return { id: nextId(), method: 'cash', amountRupees: null };
}

export function AdvanceDisburseDrawer({
  open,
  workspaceId,
  requests,
  onClose,
  onSuccess,
}: AdvanceDisburseDrawerProps) {
  const t = useTranslations('advanceDisburse');
  const { message } = App.useApp();
  const currencyFmt = useCurrencyFormatter();
  const [form] = Form.useForm<DisburseFormValues>();

  const [saving, setSaving] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('cash');
  // Split lines - only shown when mode === 'split'.
  const [splitRows, setSplitRows] = useState<SplitLineRow[]>([makeSplitRow(), makeSplitRow()]);
  const [splitError, setSplitError] = useState<string | null>(null);
  // NO recovery-plan option here (owner directive 2026-07-03): an advance is
  // part of the salary paid early, recovered in FULL from the next salary.
  // Multi-month installments are the 0% employee LOAN's job (Payroll > Loans),
  // not the advance flow — offering both blurred the two products.

  const isBulk = requests.length > 1;

  // Recovery targets the request's OWN month (owner directive 2026-07-03): an
  // advance is part of THAT month's salary paid early, so the deduction lands
  // on the same month's payroll ("asked 5k of a 30k July salary -> gets 25k on
  // July's salary day"). The old month+1 grace default pushed the deduction to
  // the NEXT payslip, zeroing the wrong month.
  const recoveryStartFor = (req: AdvanceSalaryRequest) => ({
    startMonth: req.month,
    startYear: req.year,
  });

  // Reset all state when drawer opens fresh (destroyOnHidden handles unmount on close;
  // this extra reset guards the case where the drawer stays mounted and reopens for a new request).
  const resetState = useCallback(() => {
    form.resetFields();
    setPaymentMode('cash');
    setSplitRows([makeSplitRow(), makeSplitRow()]);
    setSplitError(null);
  }, [form]);

  useEffect(() => {
    if (open) resetState();
  }, [open, resetState]);

  // Single request: its approved amount. Bulk: the batch total (display only).
  const approvedAmountPaise = requests.reduce(
    (sum, r) => sum + (r.approvedAmount ?? r.requestedAmount),
    0,
  );
  const approvedAmountRupees = approvedAmountPaise / 100;

  // Validate split rows: each amount must be > 0 and total must equal approvedAmount.
  const validateSplit = (): boolean => {
    if (paymentMode !== 'split') return true;
    const total = splitRows.reduce((s, r) => s + (r.amountRupees ?? 0), 0);
    if (Math.round(total * 100) !== approvedAmountPaise) {
      setSplitError(
        t('splitSumError', { defaultValue: 'Split amounts must add up to the approved amount.' }),
      );
      return false;
    }
    setSplitError(null);
    return true;
  };

  const handleAddSplitRow = () => setSplitRows((prev) => [...prev, makeSplitRow()]);

  const handleRemoveSplitRow = (id: string) =>
    setSplitRows((prev) => prev.filter((r) => r.id !== id));

  const handleSplitMethodChange = (id: string, method: string) =>
    setSplitRows((prev) => prev.map((r) => (r.id === id ? { ...r, method } : r)));

  const handleSplitAmountChange = (id: string, value: number | null) => {
    setSplitRows((prev) => prev.map((r) => (r.id === id ? { ...r, amountRupees: value } : r)));
    setSplitError(null);
  };

  const handleSubmit = async (values: DisburseFormValues) => {
    if (!validateSplit()) return;
    setSaving(true);
    try {
      // Same payment details for every request in the batch; recovery start is
      // per request. No installmentCount/installmentAmount: the backend
      // recovers each full amount as ONE deduction from its start month's
      // salary (lump path). Sequential (not Promise.all) so ledger postings
      // don't race and a failure identifies the exact remaining rows.
      let failed = 0;
      for (const req of requests) {
        const start = recoveryStartFor(req);
        const payload: PayAdvanceRequestPayload = {
          paymentMode: values.paymentMode,
          referenceNo: values.referenceNo?.trim() || undefined,
          note: values.note?.trim() || undefined,
          disbursedByName: values.disbursedByName?.trim() || undefined,
          startMonth: start.startMonth,
          startYear: start.startYear,
        };

        // Split lines: single-request only (per-request amounts cannot be
        // shared across a batch); convert rupees to paise.
        if (!isBulk && paymentMode === 'split' && splitRows.length > 0) {
          payload.splitLines = splitRows.map(
            (r): LedgerSplitLine => ({
              method: r.method,
              amount: Math.round((r.amountRupees ?? 0) * 100),
            }),
          );
        }

        try {
          await payAdvanceRequest(workspaceId, req._id, payload);
        } catch (err) {
          failed++;
          message.error(parseApiError(err));
        }
      }

      if (failed === 0) {
        message.success(
          isBulk
            ? t('bulkSuccessMessage', { count: requests.length })
            : t('successMessage', { defaultValue: 'Advance disbursed.' }),
        );
      } else {
        message.warning(t('bulkPartialMessage', { failed, total: requests.length }));
      }
      if (failed < requests.length) onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isSplitMode = paymentMode === 'split';

  return (
    <Drawer
      open={open}
      title={
        isBulk
          ? t('bulkDrawerTitle', { count: requests.length })
          : t('drawerTitle', { defaultValue: 'Disburse advance' })
      }
      size="large"
      onClose={onClose}
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            {t('submitButton', { defaultValue: 'Confirm disbursement' })}
          </Button>
        </div>
      }
    >
      {/* Approved amount display (batch total when bulk) */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="m-0 text-xs text-muted">
          {isBulk
            ? t('totalApprovedLabel', { count: requests.length })
            : t('approvedAmountLabel', { defaultValue: 'Approved amount' })}
        </p>
        <p className="m-0 text-lg font-semibold text-heading">
          {currencyFmt.inline(approvedAmountRupees)}
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ paymentMode: 'cash' }}
      >
        {/* Payment method */}
        <Form.Item
          name="paymentMode"
          label={t('paymentMethodLabel', { defaultValue: 'Payment method' })}
          rules={[{ required: true }]}
        >
          <Select
            // Split needs per-request line amounts, so it is single-request only.
            options={PAYMENT_METHOD_OPTIONS.filter((o) => !isBulk || o.value !== 'split').map(
              (o) => ({
                value: o.value,
                label: t(o.labelKey, { defaultValue: o.defaultLabel }),
              }),
            )}
            onChange={(v: PaymentMethod) => {
              setPaymentMode(v);
              setSplitError(null);
            }}
          />
        </Form.Item>

        {/* Split lines — shown only when mode === split */}
        {isSplitMode && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
            <p className="m-0 mb-2 text-xs font-semibold text-purple-700">
              {t('paymentMethodLabel', { defaultValue: 'Payment method' })} —{' '}
              {t('split', { defaultValue: 'Split' })}
            </p>

            {splitRows.map((row, idx) => (
              <div key={row.id} className="mb-2 flex items-start gap-2">
                {/* Method select for this split line */}
                <Select
                  size="small"
                  value={row.method}
                  style={{ flex: 1, minWidth: 110 }}
                  onChange={(v: string) => handleSplitMethodChange(row.id, v)}
                  options={PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== 'split').map((o) => ({
                    value: o.value,
                    label: t(o.labelKey, { defaultValue: o.defaultLabel }),
                  }))}
                  aria-label={`${t('splitMethodLabel', { defaultValue: 'Method' })} ${idx + 1}`}
                />
                {/* Amount in rupees */}
                <InputNumber
                  size="small"
                  min={1}
                  precision={0}
                  style={{ flex: 1 }}
                  value={row.amountRupees}
                  prefix={currencyFmt.symbol}
                  onChange={(v) => handleSplitAmountChange(row.id, v)}
                  placeholder={t('splitAmountLabel', { defaultValue: 'Amount' })}
                  aria-label={`${t('splitAmountLabel', { defaultValue: 'Amount' })} ${idx + 1}`}
                />
                {/* Remove row button (keep at least one row) */}
                {splitRows.length > 1 && (
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveSplitRow(row.id)}
                    aria-label={t('removeSplitLine', { defaultValue: 'Remove' })}
                  />
                )}
              </div>
            ))}

            {splitError && <p className="m-0 mt-1 text-xs text-red-500">{splitError}</p>}

            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddSplitRow}
              className="mt-1"
            >
              {t('addSplitLine', { defaultValue: 'Add split line' })}
            </Button>
          </div>
        )}

        {/* Reference number */}
        <Form.Item
          name="referenceNo"
          label={t('referenceNoLabel', { defaultValue: 'Reference no.' })}
        >
          <Input placeholder={t('referenceNoLabel', { defaultValue: 'Reference no.' })} />
        </Form.Item>

        {/* Who disbursed */}
        <Form.Item
          name="disbursedByName"
          label={t('disbursedByLabel', { defaultValue: 'Disbursed by' })}
        >
          <Input
            placeholder={t('disbursedByPlaceholder', { defaultValue: 'Who handed over the money' })}
          />
        </Form.Item>

        {/* Note */}
        <Form.Item name="note" label={t('noteLabel', { defaultValue: 'Note' })}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
