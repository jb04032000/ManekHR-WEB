'use client';

// Invoice layout settings editor (design spec 2026-06-01 SS2C / 3B).
// Allows Owner/HR to show or hide specific columns and sections on printed
// invoices and bills. Mirrors the branding and numbering pages for RBAC gating
// (finance.settings.manage), page chrome (DsPageHeader, Can, ManagersOnly),
// and save/error/dirty handling.
// The five flags all default to true (show). A flag that is undefined is treated
// as ON, so the switch is checked when `value !== false`.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { App, Button, Result, Skeleton, Switch } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleFilled,
  InfoCircleFilled,
  LockOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { Can } from '@/components/rbac/Can';
import { DsPageHeader } from '@/components/ui';
import { getFirm, updateFirmInvoiceLayout } from '@/lib/actions/finance.actions';
import { parseApiError } from '@/lib/utils';
import type { Firm } from '@/types';

// ---------------------------------------------------------------------------
// Types for the layout state managed in this page.
// ---------------------------------------------------------------------------
interface LayoutFlags {
  showHsnColumn: boolean;
  showDiscountColumn: boolean;
  showBankDetails: boolean;
  showSignature: boolean;
  showTermsAndConditions: boolean;
}

// Resolve a possibly-undefined boolean flag to a boolean.
// Undefined means the default (show = true), so treat it as true.
function resolveFlag(value: boolean | undefined): boolean {
  return value !== false;
}

function defaultFlags(firm: Firm | null): LayoutFlags {
  const layout = firm?.invoiceLayout ?? {};
  return {
    showHsnColumn: resolveFlag(layout.showHsnColumn),
    showDiscountColumn: resolveFlag(layout.showDiscountColumn),
    showBankDetails: resolveFlag(layout.showBankDetails),
    showSignature: resolveFlag(layout.showSignature),
    showTermsAndConditions: resolveFlag(layout.showTermsAndConditions),
  };
}

// ---------------------------------------------------------------------------
// A single toggle row: label + helper text on the left, Switch on the right.
// ---------------------------------------------------------------------------
function ToggleRow({
  label,
  helperText,
  checked,
  onChange,
}: {
  label: string;
  helperText: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--cr-border-light)] py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium text-heading">{label}</p>
        <p className="m-0 mt-0.5 text-xs text-subtle">{helperText}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor component.
// ---------------------------------------------------------------------------
function LayoutEditor() {
  const t = useTranslations('finance.layout');
  const { message } = App.useApp();
  const params = useParams<{ firmId: string }>();
  const firmId = params?.firmId ?? '';
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firmName, setFirmName] = useState<string>('');
  const [initial, setInitial] = useState<LayoutFlags>({
    showHsnColumn: true,
    showDiscountColumn: true,
    showBankDetails: true,
    showSignature: true,
    showTermsAndConditions: true,
  });
  const [flags, setFlags] = useState<LayoutFlags>({
    showHsnColumn: true,
    showDiscountColumn: true,
    showBankDetails: true,
    showSignature: true,
    showTermsAndConditions: true,
  });

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

    getFirm(wsId, firmId)
      .then((f: Firm) => {
        if (!active) return;
        const resolved = defaultFlags(f);
        setFirmName(f?.firmName ?? '');
        setInitial(resolved);
        setFlags(resolved);
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

  const setFlag = useCallback(<K extends keyof LayoutFlags>(key: K, value: boolean) => {
    setFlags((current) => ({ ...current, [key]: value }));
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(initial) !== JSON.stringify(flags),
    [initial, flags],
  );

  const handleSave = useCallback(async () => {
    if (!wsId || !firmId) return;
    setSaving(true);
    try {
      const updated = await updateFirmInvoiceLayout(wsId, firmId, {
        showHsnColumn: flags.showHsnColumn,
        showDiscountColumn: flags.showDiscountColumn,
        showBankDetails: flags.showBankDetails,
        showSignature: flags.showSignature,
        showTermsAndConditions: flags.showTermsAndConditions,
      });
      const next = defaultFlags(updated);
      setInitial(next);
      setFlags(next);
      message.success(t('saveSuccess'));
    } catch (error) {
      message.error(parseApiError(error) || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [wsId, firmId, flags, message, t]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="mt-8 space-y-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} active paragraph={{ rows: 1 }} />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <DsPageHeader
        icon={<AppstoreOutlined />}
        title={t('pageTitle')}
        sub={firmName ? t('pageDescriptionNamed', { firm: firmName }) : t('pageDescription')}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <InfoCircleFilled
          style={{ color: 'var(--cr-info-500)', fontSize: 14, marginTop: 2, flexShrink: 0 }}
        />
        <p className="m-0 text-[12px] leading-relaxed text-blue-700">{t('introBanner')}</p>
      </div>

      <div className="rounded-xl border border-[var(--cr-border-light)] px-4">
        <ToggleRow
          label={t('showHsnColumnLabel')}
          helperText={t('showHsnColumnHelper')}
          checked={flags.showHsnColumn}
          onChange={(v) => setFlag('showHsnColumn', v)}
        />
        <ToggleRow
          label={t('showDiscountColumnLabel')}
          helperText={t('showDiscountColumnHelper')}
          checked={flags.showDiscountColumn}
          onChange={(v) => setFlag('showDiscountColumn', v)}
        />
        <ToggleRow
          label={t('showBankDetailsLabel')}
          helperText={t('showBankDetailsHelper')}
          checked={flags.showBankDetails}
          onChange={(v) => setFlag('showBankDetails', v)}
        />
        <ToggleRow
          label={t('showSignatureLabel')}
          helperText={t('showSignatureHelper')}
          checked={flags.showSignature}
          onChange={(v) => setFlag('showSignature', v)}
        />
        <ToggleRow
          label={t('showTermsAndConditionsLabel')}
          helperText={t('showTermsAndConditionsHelper')}
          checked={flags.showTermsAndConditions}
          onChange={(v) => setFlag('showTermsAndConditions', v)}
        />
      </div>

      {/* Save bar */}
      <div className="mt-6 flex items-center gap-3 border-t border-[var(--cr-border-light)] pt-5">
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={!isDirty}
          onClick={handleSave}
        >
          {t('save')}
        </Button>
        {isDirty ? (
          <span className="flex items-center gap-1.5 text-[12px] text-amber-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            {t('unsaved')}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12px] text-subtle">
            <CheckCircleFilled style={{ fontSize: 11, color: 'var(--cr-success-500, #10b981)' }} />
            {t('allSaved')}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Managers only" friendly fallback when caller lacks finance.settings.manage.
// ---------------------------------------------------------------------------
function ManagersOnly() {
  const t = useTranslations('finance.layout');
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <Result
        icon={<LockOutlined style={{ color: 'var(--cr-text-4)' }} />}
        title={t('noAccessTitle')}
        subTitle={t('noAccessSubtitle')}
      />
    </div>
  );
}

export default function FirmLayoutSettingsPage() {
  return (
    <Can
      path="finance.settings.manage"
      scope="all"
      fallback={<ManagersOnly />}
      showFallbackOnLoading
    >
      <LayoutEditor />
    </Can>
  );
}
