'use client';

/**
 * Phase 16 / FIN-15-01 - Tally Export form (client component).
 *
 * Wires:
 *   • DatePicker.RangePicker (default = current FY → today)
 *   • Voucher-type Select (multi)
 *   • Firm Select (single, default current firm)
 *   • Optional Tally company-name override
 *   • "Run validator" + "Generate XML" CTAs
 *   • ValidatorReportCard + RecentExportsList
 *
 * All copywriting verbatim from `.planning/phases/16-tally-fy-portal-i18n/16-UI-SPEC.md`
 * §Tally Export. Spacing tokens: page lg=24px (page wrapper), filter rows md=16px,
 * header bottom 2xl=48px (page shell), card body 20px (Ant default - preserved).
 *
 * Sub-feature gate per UI-SPEC: `useFeatureAccess('finance', 'finance_advanced')`.
 * The hook signature is `(module, subFeature?)` - see hooks/useFeatureAccess.ts.
 *
 * Threat-model mitigations (Plan 16-06):
 *   T-16-06-01 (Tampering - date-range bypass): client `isSameFiscalYear` blocks
 *               the CTA; server re-validates via `assertSameFy` in the service.
 *   T-16-06-03 (Privilege Escalation): hook gates the CTA; backend
 *               @RequireSubscription('finance_advanced') is authoritative.
 */
import { useEffect, useMemo, useState, startTransition } from 'react';
import { Alert, DatePicker, Form, Input, Popconfirm, Select, Tooltip, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { DsButton, DsCard } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { listFirms } from '@/lib/actions/finance.actions';
import { tallyExportApi } from '@/lib/api/modules/tally-export.api';
import type { Firm, TallyValidatorReport, GenerateTallyExportInput } from '@/types';
import { defaultFyRange, isSameFiscalYear } from '@/lib/fiscal-year';
import ValidatorReportCard from './ValidatorReportCard';
import RecentExportsList from './RecentExportsList';

const { RangePicker } = DatePicker;

/**
 * Internal voucher classes - mirrors Plan 02 D-05 mapping. Keys are the
 * `LedgerEntry.sourceVoucherType` values the exporter accepts.
 */
const VOUCHER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sale_invoice', label: 'Sale Invoice' },
  { value: 'tax_invoice', label: 'Tax Invoice' },
  { value: 'bill_of_supply', label: 'Bill of Supply' },
  { value: 'export_invoice', label: 'Export Invoice' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'sales_return', label: 'Sales Return' },
  { value: 'purchase_bill', label: 'Purchase Bill' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'purchase_return', label: 'Purchase Return' },
  { value: 'payment_in', label: 'Receipt (Payment In)' },
  { value: 'payment_out', label: 'Payment (Payment Out)' },
  { value: 'journal_voucher', label: 'Journal Voucher' },
  { value: 'contra', label: 'Contra' },
  { value: 'manufacturing_voucher', label: 'Manufacturing Voucher' },
  { value: 'job_work_out', label: 'Job-Work Out' },
  { value: 'job_work_in', label: 'Job-Work In' },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TallyExportForm() {
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const {
    hasAccess,
    isLocked,
    isLoading: featureLoading,
  } = useFeatureAccess('finance', 'finance_advanced');

  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmId, setFirmId] = useState<string>('');
  const [voucherTypes, setVoucherTypes] = useState<string[]>([]);
  const [companyNameOverride, setCompanyNameOverride] = useState<string>('');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);

  const [validatorLoading, setValidatorLoading] = useState(false);
  const [report, setReport] = useState<TallyValidatorReport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [emptyState, setEmptyState] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [recentReloadKey, setRecentReloadKey] = useState(0);

  const currentFirm = useMemo(
    () => firms.find((f) => f._id === firmId) ?? firms[0],
    [firms, firmId],
  );
  const fyStartMonth = currentFirm?.fyStartMonth ?? 4;

  // Load firms on workspace switch.
  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((rows) => {
        setFirms(rows ?? []);
        if (rows && rows.length > 0 && !firmId) {
          setFirmId(rows[0]._id);
          setCompanyNameOverride(rows[0].firmName);
        }
      })
      .catch(() => {});
    // We deliberately omit firmId from deps - only re-fetch on workspace change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  // Default range = current FY start → today (recomputed when firm changes).
  useEffect(() => {
    if (!currentFirm) return;
    const { start, end } = defaultFyRange(new Date(), fyStartMonth);
    startTransition(() => {
      setRange([dayjs(start), dayjs(end)]);
      setCompanyNameOverride((prev) => prev || currentFirm.firmName);
    });
  }, [currentFirm, fyStartMonth]);

  const sameFy = !!range && isSameFiscalYear(range[0].toDate(), range[1].toDate(), fyStartMonth);
  const dateOrderOk = !!range && range[0].toDate().getTime() <= range[1].toDate().getTime();
  const formValid = !!firmId && !!range && dateOrderOk && sameFy && hasAccess && !featureLoading;

  // Inline hint reason for disabled CTA.
  const disabledHint = (() => {
    if (featureLoading) return 'Loading subscription…';
    if (!hasAccess) return 'Tally Export requires the Finance Advanced sub-feature on your plan.';
    if (!firmId) return 'Select a Tally Company.';
    if (!range || !dateOrderOk) return 'Pick a valid date range.';
    if (!sameFy)
      return 'Date range must fall within a single fiscal year. Split multi-year exports manually.';
    return '';
  })();

  async function handleRunValidator() {
    if (!wsId || !firmId || !range) return;
    setValidatorLoading(true);
    setErrorState(null);
    try {
      const data = await tallyExportApi.validator(
        wsId,
        firmId,
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
      );
      setReport(data);
    } catch (e) {
      message.error('Validator failed. Try again or contact support.');
    } finally {
      setValidatorLoading(false);
    }
  }

  async function handleGenerate() {
    if (!wsId || !firmId || !range) return;
    setSubmitting(true);
    setErrorState(null);
    setQueued(false);
    setEmptyState(false);
    const input: GenerateTallyExportInput = {
      firmId,
      fromDate: range[0].format('YYYY-MM-DD'),
      toDate: range[1].format('YYYY-MM-DD'),
      voucherTypes: voucherTypes.length ? voucherTypes : undefined,
      companyNameOverride:
        companyNameOverride && companyNameOverride !== currentFirm?.firmName
          ? companyNameOverride
          : undefined,
    };
    try {
      const res = await tallyExportApi.generate(wsId, input);
      const ct = String(res.headers?.['content-type'] ?? '');

      // Backend returns 202 + JSON for queued; 200 + binary XML for ready.
      if (ct.includes('application/json')) {
        // Blob → JSON parse to surface queued / error envelope.
        const text = await (res.data as Blob).text();
        const parsed = JSON.parse(text);
        if (parsed?.data?.status === 'queued') {
          setQueued(true);
        } else if (parsed?.success === false) {
          setErrorState(
            parsed?.error ||
              'Export failed. Try a smaller date range or contact support if it persists.',
          );
        }
        return;
      }

      // ready - binary XML; trigger browser download
      const blob = res.data as Blob;
      if (!blob || blob.size === 0) {
        setEmptyState(true);
        return;
      }
      const headerCount = Number(res.headers?.['x-tally-voucher-count'] ?? 0);
      if (headerCount === 0) {
        setEmptyState(true);
        return;
      }
      const filename = `tally-export-${firmId}-${input.fromDate}-${input.toDate}.xml`;
      downloadBlob(blob, filename);
      message.success('Export complete');
      setRecentReloadKey((k) => k + 1);
    } catch (e: any) {
      setErrorState(
        e?.response?.data?.message ||
          'Export failed. Try a smaller date range or contact support if it persists.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const hasWarnings = !!report && (report.warnings?.length ?? 0) > 0;
  const exportAnywayCta = (
    <Popconfirm
      title="Continue with warnings"
      description="The validator surfaced warnings. Tally will still accept the import - proceed?"
      okText="Continue with warnings"
      cancelText="Cancel"
      onConfirm={handleGenerate}
      disabled={!formValid}
    >
      <DsButton dsVariant="secondary" disabled={!formValid || submitting} loading={submitting}>
        Export anyway
      </DsButton>
    </Popconfirm>
  );

  return (
    <>
      {/* Sub-feature gate banner */}
      {!featureLoading && !hasAccess && (
        <Alert
          type="warning"
          showIcon
          title="Upgrade required"
          description="Tally Export is available on plans that include the Finance Advanced sub-feature. Form is read-only until upgraded."
          style={{
            marginBottom: 16,
            background: 'var(--cr-warning-bg)',
            borderColor: 'var(--cr-warning)',
          }}
        />
      )}

      {queued && (
        <Alert
          type="info"
          closable
          showIcon
          onClose={() => setQueued(false)}
          title="Export running in the background"
          description="We'll email you a download link when it's ready. You can leave this page."
          style={{
            marginBottom: 16,
            background: 'var(--cr-surface)',
            borderColor: 'var(--cr-info)',
          }}
        />
      )}

      {errorState && (
        <Alert
          type="error"
          closable
          showIcon
          onClose={() => setErrorState(null)}
          title="Export failed. Try a smaller date range or contact support if it persists."
          style={{ marginBottom: 16 }}
        />
      )}

      <DsCard
        title="Date Range"
        styles={{ header: { fontFamily: 'var(--font-display)', fontWeight: 700 } }}
      >
        <Form layout="vertical" disabled={isLocked || submitting}>
          <Form.Item
            label="Range"
            help="Single financial year per export. Split multi-year exports manually."
            style={{ marginBottom: 16 /* md */ }}
          >
            <RangePicker
              style={{ width: '100%', maxWidth: 360 }}
              value={range as any}
              onChange={(vals) => {
                if (vals && vals[0] && vals[1]) {
                  setRange([vals[0], vals[1]] as [Dayjs, Dayjs]);
                } else {
                  setRange(null);
                }
              }}
            />
          </Form.Item>

          <Form.Item label="Voucher types" style={{ marginBottom: 16 /* md */ }}>
            <Select
              mode="multiple"
              allowClear
              placeholder="All voucher types"
              aria-label="Voucher types"
              value={voucherTypes}
              onChange={setVoucherTypes}
              options={VOUCHER_TYPE_OPTIONS}
              style={{ width: '100%', maxWidth: 540 }}
            />
          </Form.Item>

          <Form.Item
            label="Tally Company"
            help="Defaults to firm legal name. Override only if merging into an existing Tally company file."
            style={{ marginBottom: 16 /* md */ }}
          >
            <Select
              value={firmId || undefined}
              onChange={(v) => {
                setFirmId(v);
                const f = firms.find((x) => x._id === v);
                if (f) setCompanyNameOverride(f.firmName);
              }}
              placeholder="Select firm"
              aria-label="Tally Company"
              style={{ width: '100%', maxWidth: 360 }}
              options={firms.map((f) => ({ value: f._id, label: f.firmName }))}
            />
          </Form.Item>

          <Form.Item label="Company name override" style={{ marginBottom: 16 }}>
            <Input
              value={companyNameOverride}
              onChange={(e) => setCompanyNameOverride(e.target.value)}
              placeholder={currentFirm?.firmName ?? ''}
              aria-label="Company name override"
              style={{ width: '100%', maxWidth: 360 }}
            />
          </Form.Item>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Tooltip title={!formValid ? disabledHint : ''}>
              <span>
                <DsButton
                  dsVariant="primary"
                  disabled={!formValid || submitting}
                  loading={submitting}
                  onClick={handleGenerate}
                >
                  Generate XML
                </DsButton>
              </span>
            </Tooltip>

            <DsButton
              dsVariant="ghost"
              loading={validatorLoading}
              disabled={!firmId || !range || !dateOrderOk || isLocked}
              onClick={handleRunValidator}
            >
              Run validator
            </DsButton>

            {hasWarnings && exportAnywayCta}

            {!formValid && disabledHint && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--cr-text-3)',
                  marginLeft: 4,
                }}
              >
                {disabledHint}
              </span>
            )}
          </div>

          {emptyState && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: 'var(--cr-surface-2)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'var(--cr-text)',
                }}
              >
                No vouchers in this range
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 14,
                  color: 'var(--cr-text-3)',
                }}
              >
                Pick a wider date range, or check that vouchers exist for the selected firm.
              </p>
            </div>
          )}
        </Form>
      </DsCard>

      <ValidatorReportCard loading={validatorLoading} report={report} />

      {wsId && firmId && (
        <RecentExportsList wsId={wsId} firmId={firmId} reloadKey={recentReloadKey} />
      )}
    </>
  );
}
