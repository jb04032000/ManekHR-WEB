'use client';

// Custom invoice numbering editor (2026-06-01).
// Allows Owner/HR to customise prefix, padDigits, and startNumber per voucher
// series. Mirrors the branding page for RBAC gating (finance.settings.manage),
// page chrome (DsPageHeader, Can, ManagersOnly), and save/error/dirty handling.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { App, Button, Input, InputNumber, Result, Skeleton, Tag, Tooltip } from 'antd';
import { InfoCircleFilled, LockOutlined, NumberOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { Can } from '@/components/rbac/Can';
import { DsPageHeader } from '@/components/ui';
import { getFirm, listVoucherSeries, updateVoucherSeries } from '@/lib/actions/finance.actions';
import { parseApiError } from '@/lib/utils';
import type { VoucherSeries } from '@/types';

// ---------------------------------------------------------------------------
// Local type: one row of editable state, keyed by series _id.
// ---------------------------------------------------------------------------
interface SeriesRow extends VoucherSeries {
  _prefix: string;
  _padDigits: number;
  _startNumber: number;
}

// ---------------------------------------------------------------------------
// Derive the sample voucher number from the series values.
// Format: PREFIX/FY-SHORT/PADDED  e.g. "INV/25-26/0001"
// fyShort from financialYear "2025-26" -> "25-26" (last 5 chars).
// ---------------------------------------------------------------------------
function buildPreview(
  prefix: string,
  padDigits: number,
  startNumber: number,
  financialYear: string,
): string {
  const fyShort =
    financialYear.length >= 5 ? financialYear.slice(financialYear.length - 5) : financialYear;
  const padded = String(startNumber).padStart(padDigits, '0');
  return `${prefix || '?'}/${fyShort}/${padded}`;
}

// ---------------------------------------------------------------------------
// Single editable row rendered inside AntD Table using its render API.
// Keeps its own local field state so the user can edit one row at a time
// without affecting others. On save it calls the parent handler.
// ---------------------------------------------------------------------------
function EditableRow({
  record,
  onSave,
  t,
}: {
  record: SeriesRow;
  onSave: (
    id: string,
    updates: { prefix?: string; padDigits?: number; startNumber?: number },
  ) => Promise<void>;
  t: ReturnType<typeof useTranslations<'finance.numbering'>>;
}) {
  const { message } = App.useApp();
  const [prefix, setPrefix] = useState(record._prefix);
  const [padDigits, setPadDigits] = useState(record._padDigits);
  const [startNumber, setStartNumber] = useState(record._startNumber);
  const [saving, setSaving] = useState(false);

  const dirty =
    prefix !== record._prefix ||
    padDigits !== record._padDigits ||
    startNumber !== record._startNumber;

  const preview = useMemo(
    () => buildPreview(prefix, padDigits, startNumber, record.financialYear),
    [prefix, padDigits, startNumber, record.financialYear],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(record._id as unknown as string, { prefix, padDigits, startNumber });
      message.success(t('saveSuccess'));
    } catch (err) {
      message.error(parseApiError(err) || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [onSave, record._id, prefix, padDigits, startNumber, message, t]);

  return (
    <tr>
      <td className="py-3 pr-3 pl-4 text-sm font-medium text-heading">
        {t(`voucherTypes.${record.voucherType}` as Parameters<typeof t>[0])}
      </td>
      <td className="px-3 py-3">
        <Input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          maxLength={10}
          placeholder={t('prefixPlaceholder')}
          style={{ width: 90 }}
          size="small"
        />
      </td>
      <td className="px-3 py-3">
        <Tooltip title={t('padDigitsHint')}>
          <InputNumber
            value={padDigits}
            min={1}
            max={8}
            style={{ width: 70 }}
            size="small"
            onChange={(v) => {
              if (v !== null) setPadDigits(v);
            }}
          />
        </Tooltip>
      </td>
      <td className="px-3 py-3">
        <Tooltip title={t('startNumberHint')}>
          <InputNumber
            value={startNumber}
            min={1}
            style={{ width: 80 }}
            size="small"
            onChange={(v) => {
              if (v !== null) setStartNumber(v);
            }}
          />
        </Tooltip>
      </td>
      <td className="px-3 py-3">
        <Tag className="font-mono text-xs" color="geekblue" style={{ userSelect: 'all' }}>
          {preview}
        </Tag>
      </td>
      <td className="py-3 pr-4 pl-3 text-right">
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={!dirty}
          onClick={handleSave}
        >
          {t('saveRow')}
        </Button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main editor component.
// ---------------------------------------------------------------------------
function NumberingEditor() {
  const t = useTranslations('finance.numbering');
  const params = useParams<{ firmId: string }>();
  const firmId = params?.firmId ?? '';
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [firmName, setFirmName] = useState('');
  const [rows, setRows] = useState<SeriesRow[]>([]);

  useEffect(() => {
    if (!wsId || !firmId) return;
    let active = true;

    // Reset flags via a microtask so the synchronous effect body does not
    // call setState directly (avoids react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setLoadError(false);
    });

    Promise.all([getFirm(wsId, firmId), listVoucherSeries(wsId, firmId)])
      .then(([firm, series]) => {
        if (!active) return;
        setFirmName(firm?.firmName ?? '');
        const mapped: SeriesRow[] = series.map((s) => ({
          ...s,
          _prefix: s.prefix,
          _padDigits: s.padDigits ?? 4,
          _startNumber: s.startNumber ?? 1,
        }));
        setRows(mapped);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [wsId, firmId]);

  const handleSave = useCallback(
    async (id: string, updates: { prefix?: string; padDigits?: number; startNumber?: number }) => {
      const updated = await updateVoucherSeries(wsId, firmId, id, updates);
      setRows((prev) =>
        prev.map((r) =>
          (r._id as unknown as string) === id
            ? {
                ...r,
                ...updated,
                _prefix: updated.prefix,
                _padDigits: updated.padDigits ?? 4,
                _startNumber: updated.startNumber ?? 1,
              }
            : r,
        ),
      );
    },
    [wsId, firmId],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} active paragraph={{ rows: 1 }} />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-6">
        <Result
          status="warning"
          title={t('loadErrorTitle')}
          subTitle={t('loadErrorSubtitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <DsPageHeader
        icon={<NumberOutlined />}
        title={t('pageTitle')}
        sub={firmName ? t('pageDescriptionNamed', { firm: firmName }) : t('pageDescription')}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <InfoCircleFilled
          style={{ color: 'var(--cr-info-500)', fontSize: 14, marginTop: 2, flexShrink: 0 }}
        />
        <p className="m-0 text-[12px] leading-relaxed text-blue-700">{t('introBanner')}</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-subtle">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--cr-border-light)]">
          <table className="min-w-full divide-y divide-[var(--cr-border-light)]">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 pr-3 pl-4 text-left text-xs font-semibold tracking-wide text-subtle uppercase">
                  {t('columnVoucherType')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-subtle uppercase">
                  {t('columnPrefix')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-subtle uppercase">
                  {t('columnPadDigits')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-subtle uppercase">
                  {t('columnStartNumber')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-subtle uppercase">
                  {t('columnPreview')}
                </th>
                <th className="py-3 pr-4 pl-3 text-right text-xs font-semibold tracking-wide text-subtle uppercase" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cr-border-light)] bg-white">
              {rows.map((row) => (
                <EditableRow
                  key={row._id as unknown as string}
                  record={row}
                  onSave={handleSave}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Managers only" friendly fallback when caller lacks finance.settings.manage.
// ---------------------------------------------------------------------------
function ManagersOnly() {
  const t = useTranslations('finance.numbering');
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-6">
      <Result
        icon={<LockOutlined style={{ color: 'var(--cr-text-4)' }} />}
        title={t('noAccessTitle')}
        subTitle={t('noAccessSubtitle')}
      />
    </div>
  );
}

export default function FirmNumberingSettingsPage() {
  return (
    <Can
      path="finance.settings.manage"
      scope="all"
      fallback={<ManagersOnly />}
      showFallbackOnLoading
    >
      <NumberingEditor />
    </Can>
  );
}
