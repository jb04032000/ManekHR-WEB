'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Input,
  InputNumber,
  Popover,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  backfillEmployeeCodes,
  getEmployeeCodeSettings,
  updateEmployeeCodeSettings,
} from '@/lib/actions/workspaces.actions';
import { getPendingBackfillCount } from '@/lib/actions';
import type { BackfillEmployeeCodesResponse, EmployeeCodeSettings } from '@/types';

interface BackfillResult extends BackfillEmployeeCodesResponse {
  ranAt: Date;
}

// New default format embeds the workspace code via the {WS} token. allowCustom is
// retired (codes are always system-generated + immutable) - we keep it false so
// the BE-mirrored type stays satisfied without exposing any custom-code toggle.
const DEFAULT_SETTINGS: EmployeeCodeSettings = {
  enabled: false,
  format: '{WS}-{PREFIX}-{####}',
  prefix: 'EMP',
  startingNumber: 1,
  allowCustom: false,
};

const TOKENS: { token: string; descKey: string }[] = [
  // {WS} = fixed workspace code (auto-derived server-side), always embedded.
  { token: '{WS}', descKey: 'tokenWS' },
  { token: '{PREFIX}', descKey: 'tokenPrefix' },
  { token: '{YYYY}', descKey: 'tokenYYYY' },
  { token: '{YY}', descKey: 'tokenYY' },
  { token: '{MM}', descKey: 'tokenMM' },
  { token: '{#}', descKey: 'tokenSeq1' },
  { token: '{##}', descKey: 'tokenSeq2' },
  { token: '{###}', descKey: 'tokenSeq3' },
  { token: '{####}', descKey: 'tokenSeq4' },
];

const FORMAT_SEQUENCE_REGEX = /\{#{1,4}\}/;
const SAFE_CHARS_REGEX = /^[A-Za-z0-9_\-{}#]+$/;

/**
 * Client-side mirror of the backend employee code renderer. Must match the
 * longest-token-first substitution order used in
 * manekhr-backend/src/modules/team/team.service.ts so the preview shown
 * here matches what the backend will actually assign.
 *
 * {WS} handling mirrors the backend exactly: substitute {WS} (case-insensitive)
 * with the fixed workspaceCode, and if the format contains NO {WS} token at all,
 * prepend `${workspaceCode}-` so every generated code still embeds the workspace
 * code. Keep in sync with the backend renderer + EmployeeCodeSettingsResponse.
 */
function renderEmployeeCode(
  format: string,
  prefix: string,
  sequence: number,
  workspaceCode: string,
  now: Date = new Date(),
): string {
  const yyyy = now.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const hasWsToken = /\{WS\}/i.test(format);
  const rendered = format
    .replace(/\{WS\}/gi, workspaceCode)
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{####\}/g, String(sequence).padStart(4, '0'))
    .replace(/\{###\}/g, String(sequence).padStart(3, '0'))
    .replace(/\{##\}/g, String(sequence).padStart(2, '0'))
    .replace(/\{#\}/g, String(sequence));
  // Backend parity: if the format omits {WS}, the workspace code is still
  // prepended so the code remains workspace-scoped.
  return hasWsToken || !workspaceCode ? rendered : `${workspaceCode}-${rendered}`;
}

export default function EmployeeCodeSettingsPage() {
  const t = useTranslations('workspace.employeeCode');
  const router = useRouter();
  const { message: msgApi, modal: modalApi } = App.useApp();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  // RBAC gate (ADR-001 R-4): action visibility is driven by `workspaces.edit`,
  // not the coarse membership-`role` string. `canPermission` returns `false`
  // while permissions resolve and owners short-circuit to `true`, so the
  // Save/backfill controls never flash enabled during the initial fetch.
  const { can: canPermission } = useMyPermissions();
  const canManage = canPermission('workspaces', 'edit');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [lastBackfillResult, setLastBackfillResult] = useState<BackfillResult | null>(null);
  const [settings, setSettings] = useState<EmployeeCodeSettings>(DEFAULT_SETTINGS);
  const [savedSnapshot, setSavedSnapshot] = useState<EmployeeCodeSettings | null>(null);
  const [currentCounter, setCurrentCounter] = useState(0);
  // Fixed workspace code returned by getEmployeeCodeSettings (e.g. "ZARI"). Auto-
  // derived server-side and read-only here; substituted for the {WS} token in the
  // live preview and prepended when the format omits {WS} (backend parity).
  const [workspaceCode, setWorkspaceCode] = useState('');
  /** Total non-archived members (active + inactive + offboarding) - matches backend backfill scope */
  const [memberCount, setMemberCount] = useState(0);
  /** Members within that scope that have no employeeCode yet */
  const [membersWithoutCode, setMembersWithoutCode] = useState(0);

  const [formatError, setFormatError] = useState<string | null>(null);
  const [prefixError, setPrefixError] = useState<string | null>(null);
  const [startingNumberError, setStartingNumberError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    // allowCustom is retired - no longer part of the dirty check.
    return (
      settings.enabled !== savedSnapshot.enabled ||
      settings.format !== savedSnapshot.format ||
      settings.prefix !== savedSnapshot.prefix ||
      settings.startingNumber !== savedSnapshot.startingNumber
    );
  }, [settings, savedSnapshot]);

  /**
   * The next sequence the backend will assign. If the user has bumped
   * `startingNumber` above the current counter locally, reflect that in the
   * preview so it matches what the PATCH will produce once saved.
   */
  const previewSequence = useMemo(() => {
    const nextFromCounter = currentCounter + 1;
    if (settings.startingNumber > nextFromCounter) {
      return settings.startingNumber;
    }
    return nextFromCounter;
  }, [currentCounter, settings.startingNumber]);

  const preview = useMemo(() => {
    if (!settings.format) return '';
    return renderEmployeeCode(
      settings.format,
      settings.prefix ?? '',
      previewSequence,
      workspaceCode,
    );
  }, [settings.format, settings.prefix, previewSequence, workspaceCode]);

  const loadAll = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [settingsRes, countRes] = await Promise.all([
        getEmployeeCodeSettings(currentWorkspaceId),
        // Dedicated count endpoint - two MongoDB countDocuments, no member payloads.
        // Scope matches backend backfill exactly: isDeleted.$ne=true, isPermanentlyDeleted.$ne=true.
        getPendingBackfillCount(currentWorkspaceId).catch(() => null),
      ]);

      if (settingsRes.ok) {
        const loaded = settingsRes.data.settings ?? DEFAULT_SETTINGS;
        setSettings(loaded);
        setSavedSnapshot(loaded);
        setCurrentCounter(settingsRes.data.currentCounter ?? 0);
        // Workspace code is fixed/auto-derived server-side; only read it here.
        setWorkspaceCode(settingsRes.data.workspaceCode ?? '');
      } else {
        msgApi.error(settingsRes.error);
      }

      if (countRes) {
        setMemberCount(countRes.total);
        setMembersWithoutCode(countRes.withoutCode);
      }
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, msgApi]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const validate = useCallback((): boolean => {
    setFormatError(null);
    setPrefixError(null);
    setStartingNumberError(null);
    let ok = true;

    if (!settings.format || !FORMAT_SEQUENCE_REGEX.test(settings.format)) {
      setFormatError(t('errorFormatNeedsSequence'));
      ok = false;
    } else if (!SAFE_CHARS_REGEX.test(settings.format)) {
      setFormatError(t('errorFormatChars'));
      ok = false;
    }

    if (settings.prefix && !SAFE_CHARS_REGEX.test(settings.prefix)) {
      setPrefixError(t('errorPrefixChars'));
      ok = false;
    }

    if (
      !Number.isInteger(settings.startingNumber) ||
      settings.startingNumber < 1 ||
      settings.startingNumber > 9_999_999
    ) {
      setStartingNumberError(t('errorStartingNumberRange'));
      ok = false;
    }

    return ok;
  }, [settings, t]);

  const commitSave = useCallback(async () => {
    if (!currentWorkspaceId) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const res = await updateEmployeeCodeSettings(currentWorkspaceId, settings);
      if (res.ok) {
        const saved = res.data.settings ?? settings;
        setSettings(saved);
        setSavedSnapshot(saved);
        setCurrentCounter(res.data.currentCounter ?? 0);
        msgApi.success(t('saveSuccess'));
      } else if (res.code === 'EMP_CODE_STARTING_NUMBER_TOO_LOW') {
        const currentMax = res.currentMax ?? 0;
        setStartingNumberError(
          t('errorStartingNumberTooLow', {
            currentMax,
            nextValid: currentMax + 1,
          }),
        );
      } else {
        msgApi.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  }, [currentWorkspaceId, settings, validate, msgApi, t]);

  const handleSave = useCallback(() => {
    // Edge case 4 - confirm before disabling when codes already exist.
    if (savedSnapshot?.enabled && !settings.enabled) {
      modalApi.confirm({
        title: t('disableConfirmTitle'),
        icon: <ExclamationCircleOutlined />,
        content: t('disableConfirmContent'),
        okText: t('disableConfirmOk'),
        cancelText: t('disableConfirmCancel'),
        okButtonProps: { danger: true },
        onOk: commitSave,
      });
      return;
    }
    void commitSave();
  }, [savedSnapshot, settings.enabled, modalApi, commitSave, t]);

  const handleDiscard = useCallback(() => {
    if (!savedSnapshot) return;
    setSettings(savedSnapshot);
    setFormatError(null);
    setPrefixError(null);
    setStartingNumberError(null);
  }, [savedSnapshot]);

  // ── Cmd/Ctrl+S keyboard shortcut ──────────────────────────────────────────
  // Mirrors team-detail page. Fires handleSave only when there's something to
  // save AND the user has permission. Effect re-binds when isDirty/canManage/
  // saving change so the listener captures the latest closure.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === 's')) return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      if (!isDirty || !canManage || saving) return;
      handleSave();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirty, canManage, saving, handleSave]);

  // ── Browser-level guard when leaving with unsaved edits ──────────────────
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── In-app navigation guard (sidebar / breadcrumb / back button) ─────────
  // Intercepts anchor clicks + browser back/forward while dirty. Reuses the
  // same Modal.confirm UX so the prompt is consistent across exit surfaces.
  useEffect(() => {
    if (!isDirty) return;

    const confirmLeave = (onConfirm: () => void) => {
      modalApi.confirm({
        title: t('leaveTitle'),
        icon: <ExclamationCircleOutlined />,
        content: t('leaveContent'),
        okText: t('leavePage'),
        okButtonProps: { danger: true },
        cancelText: t('leaveStay'),
        onOk: onConfirm,
      });
    };

    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;
      if (dest.pathname === window.location.pathname && dest.search === window.location.search)
        return;

      e.preventDefault();
      e.stopPropagation();
      confirmLeave(() => router.push(dest.pathname + dest.search + dest.hash));
    };

    const sentinel = { __unsavedGuard: true };
    window.history.pushState(sentinel, '', window.location.href);
    const onPopState = () => {
      window.history.pushState(sentinel, '', window.location.href);
      confirmLeave(() => {
        window.history.go(-2);
      });
    };

    // Keyboard-shortcut nav (g>h, g>d, g>t, etc.) bypasses anchor-click +
    // popstate. KeyboardShortcutProvider dispatches a cancellable
    // 'cr:beforenav' event before router.push; intercept it here and route
    // through the same confirm-leave UX as anchor clicks.
    const onShortcutNav = (e: Event) => {
      const ce = e as CustomEvent<{ href: string }>;
      if (!ce.detail?.href) return;
      e.preventDefault();
      const target = ce.detail.href;
      confirmLeave(() => router.push(target));
    };

    document.addEventListener('click', onAnchorClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('cr:beforenav', onShortcutNav);
    return () => {
      document.removeEventListener('click', onAnchorClick, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('cr:beforenav', onShortcutNav);
    };
  }, [isDirty, modalApi, router, t]);

  const handleBackfill = useCallback(() => {
    if (!currentWorkspaceId) return;
    modalApi.confirm({
      title: t('backfillConfirmTitle'),
      icon: <ExclamationCircleOutlined />,
      content: (
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            {t('backfillConfirmAssignTo', {
              count: membersWithoutCode,
              total: memberCount,
            })}
          </p>
          <ul className="list-disc space-y-1 pl-4 text-gray-700">
            <li>{t('backfillConfirmBullet1')}</li>
            <li>{t('backfillConfirmBullet2')}</li>
            <li>{t('backfillConfirmBullet3')}</li>
            <li>{t('backfillConfirmBullet4')}</li>
            <li>{t('backfillConfirmBullet5')}</li>
          </ul>
        </div>
      ),
      okText: t('backfillConfirmOk'),
      cancelText: t('backfillConfirmCancel'),
      onOk: async () => {
        setBackfilling(true);
        setLastBackfillResult(null);
        try {
          const res = await backfillEmployeeCodes(currentWorkspaceId);
          if (res.ok) {
            setLastBackfillResult({ ...res.data, ranAt: new Date() });
            await loadAll();
          } else {
            msgApi.error(res.error);
          }
        } finally {
          setBackfilling(false);
        }
      },
    });
  }, [currentWorkspaceId, membersWithoutCode, memberCount, modalApi, msgApi, loadAll, t]);

  // Edge case 5 - warn when format changes while codes already exist.
  const showFormatChangeWarning = useMemo(() => {
    if (!savedSnapshot?.enabled) return false;
    if (currentCounter <= 0) return false;
    return settings.format !== savedSnapshot.format;
  }, [savedSnapshot, currentCounter, settings.format]);

  if (!currentWorkspaceId) {
    return <Alert type="warning" showIcon title={t('noWorkspaceWarning')} />;
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="mb-8">
        <Typography.Title level={2} className="!mb-1">
          {t('title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0 text-[14px]">
          {t('description')}
        </Typography.Paragraph>
      </div>

      {/* ── Alerts ── */}
      <div className="mb-8 flex flex-col gap-3">
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          className="rounded-[10px]"
          title={t('permanentTitle')}
          description={t('permanentDesc')}
        />
        {!canManage && (
          <Alert
            type="warning"
            showIcon
            icon={<LockOutlined />}
            className="rounded-[10px]"
            title={t('adminRequiredTitle')}
            description={t('adminRequiredDesc')}
          />
        )}
      </div>

      {/* ── Main settings card ── */}
      <Card loading={loading} className="mb-6" styles={{ body: { padding: '28px 28px' } }}>
        <div className="flex flex-col gap-0">
          {/* § Enable toggle */}
          <div className="flex items-start justify-between gap-4 pb-7">
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-heading">{t('enableLabel')}</div>
              <div className="mt-0.5 text-[13px] text-muted">{t('enableDesc')}</div>
            </div>
            <Switch
              checked={settings.enabled}
              onChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
              disabled={!canManage}
              aria-label={t('enableLabel')}
            />
          </div>

          <hr className="mb-7 border-gray-100" />

          {/* § Format group */}
          <div className="mb-2">
            <p className="mb-5 text-[11px] font-bold tracking-widest text-muted uppercase">
              {t('codeFormatHeader')}
            </p>
            <div className="flex flex-col gap-6">
              {/* Format field */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[14px] font-semibold text-heading">
                    {t('formatLabel')}
                  </label>
                  <Popover
                    title={t('tokenHelperTitle')}
                    placement="bottomRight"
                    content={
                      <div className="flex max-w-[280px] flex-col gap-1.5">
                        {TOKENS.map((tok) => (
                          <div key={tok.token} className="flex items-center gap-2 text-[13px]">
                            <code className="bg-surface-secondary rounded px-1.5 py-0.5 font-mono">
                              {tok.token}
                            </code>
                            <span className="text-muted">{t(tok.descKey)}</span>
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <Button type="link" size="small">
                      {t('tokenHelperBtn')}
                    </Button>
                  </Popover>
                </div>
                <Input
                  value={settings.format}
                  onChange={(e) => {
                    setFormatError(null);
                    setSettings((s) => ({ ...s, format: e.target.value }));
                  }}
                  size="large"
                  placeholder="{PREFIX}-{YYYY}-{####}"
                  aria-label={t('formatLabel')}
                  disabled={!settings.enabled || !canManage}
                  status={formatError ? 'error' : ''}
                />
                {formatError && <div className="mt-1 text-[12px] text-error">{formatError}</div>}
                <div className="mt-1.5 text-[12px] text-muted">
                  {t('formatHelper', {
                    sequenceTokens: '{#}, {##}, {###}, or {####}',
                  })}
                </div>
                <div className="mt-3">
                  <div className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                    {t('quickExamplesLabel')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        label: 'EMP-2026-0001',
                        value: '{PREFIX}-{YYYY}-{####}',
                      },
                      { label: 'EMP-0001', value: '{PREFIX}-{####}' },
                      { label: 'EMP/001', value: '{PREFIX}/{###}' },
                      { label: '202604-001', value: '{YYYY}{MM}-{###}' },
                      { label: 'EMP-26-01', value: '{PREFIX}-{YY}-{##}' },
                    ].map((ex) => (
                      <button
                        key={ex.value}
                        type="button"
                        disabled={!settings.enabled || !canManage}
                        onClick={() => {
                          setFormatError(null);
                          setSettings((s) => ({ ...s, format: ex.value }));
                        }}
                        className="bg-surface-secondary cursor-pointer rounded-md border border-gray-200 px-2.5 py-1 font-mono text-[12px] transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prefix + Starting number side by side on md+ */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[14px] font-semibold text-heading">
                    {t('prefixLabel')}
                  </label>
                  <Input
                    value={settings.prefix}
                    onChange={(e) => {
                      setPrefixError(null);
                      setSettings((s) => ({ ...s, prefix: e.target.value }));
                    }}
                    size="large"
                    placeholder={t('prefixPlaceholder')}
                    aria-label={t('prefixLabel')}
                    disabled={!settings.enabled || !canManage}
                    status={prefixError ? 'error' : ''}
                    maxLength={16}
                  />
                  {prefixError && <div className="mt-1 text-[12px] text-error">{prefixError}</div>}
                  <div className="mt-1.5 text-[12px] text-muted">
                    {t('prefixHelper', { prefixToken: '{PREFIX}' })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <label className="text-[14px] font-semibold text-heading">
                      {t('startingNumberLabel')}
                    </label>
                    <Tooltip
                      title={
                        <div className="space-y-1.5 text-[12px]">
                          <p>{t('startingNumberTooltipP1')}</p>
                          <p>{t('startingNumberTooltipP2')}</p>
                          <p>{t('startingNumberTooltipP3')}</p>
                        </div>
                      }
                      styles={{ root: { maxWidth: 280 } }}
                    >
                      <InfoCircleOutlined className="cursor-pointer text-[13px] text-faint" />
                    </Tooltip>
                  </div>
                  <InputNumber
                    value={settings.startingNumber}
                    onChange={(v) => {
                      setStartingNumberError(null);
                      setSettings((s) => ({
                        ...s,
                        startingNumber: Math.max(1, Number.isFinite(Number(v)) ? Number(v) : 1),
                      }));
                    }}
                    size="large"
                    min={1}
                    max={9_999_999}
                    className="w-full"
                    aria-label={t('startingNumberLabel')}
                    disabled={!settings.enabled || !canManage}
                    status={startingNumberError ? 'error' : ''}
                  />
                  {startingNumberError && (
                    <div className="mt-1 text-[12px] text-error">{startingNumberError}</div>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <Tooltip title={t('counterTooltip')}>
                      <span className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {t('counterChip', { count: currentCounter })}
                      </span>
                    </Tooltip>
                    <Tooltip title={t('nextTooltip')}>
                      <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary-border bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">
                        {t('nextChip', { count: previewSequence })}
                      </span>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="mb-1.5 block text-[14px] font-semibold text-heading">
                  {t('previewLabel')}
                </label>
                <div className="bg-surface-secondary flex items-center justify-between gap-4 rounded-[10px] border border-gray-100 px-5 py-4">
                  <span className="font-mono text-xl font-semibold tracking-wide text-heading">
                    {preview || '-'}
                  </span>
                  {settings.format && (
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {settings.format}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* allowCustom retired (owner request 2026-06-13): employee codes are
              always system-generated, immutable, and non-replaceable, so there
              is no per-workspace toggle to permit custom codes. */}

          {/* § Format change warning */}
          {showFormatChangeWarning && (
            <>
              <hr className="my-7 border-gray-100" />
              <Alert type="info" showIcon title={t('formatChangeWarning')} />
            </>
          )}

          {/* § Actions */}
          <hr className="my-7 border-gray-100" />
          <div className="flex gap-3">
            <Button
              type="primary"
              size="large"
              loading={saving}
              disabled={!isDirty || !canManage}
              onClick={handleSave}
            >
              {t('saveBtn')}
            </Button>
            {isDirty && canManage && (
              <Button size="large" onClick={handleDiscard}>
                {t('discardBtn')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Backfill card ── only shown when codes are enabled AND at least one member lacks a code */}
      {savedSnapshot?.enabled && membersWithoutCode > 0 && (
        <Card
          title={<span className="font-display font-bold">{t('backfillTitle')}</span>}
          styles={{ body: { padding: '24px 28px' } }}
        >
          <div className="flex flex-col gap-6">
            {/* Description + stats row */}
            <div className="flex flex-col gap-2">
              <Typography.Paragraph type="secondary" className="!mb-0 text-[14px]">
                {t('backfillDescription', {
                  withoutCount: membersWithoutCode,
                  totalCount: memberCount,
                })}
              </Typography.Paragraph>
              <div className="mt-1 flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700">
                  {t('backfillChipWithout', { count: membersWithoutCode })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-[12px] font-medium text-gray-600">
                  {t('backfillChipAssigned', {
                    count: memberCount - membersWithoutCode,
                  })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-primary-border bg-primary-light px-2.5 py-1 text-[12px] font-medium text-primary">
                  {t('backfillChipCounter', { count: currentCounter })}
                </span>
              </div>
            </div>

            {/* Action button */}
            <div>
              <Button
                icon={<ReloadOutlined />}
                size="large"
                loading={backfilling}
                disabled={!canManage}
                onClick={handleBackfill}
              >
                {backfilling ? t('backfillBtnRunning') : t('backfillBtnIdle')}
              </Button>
            </div>

            {/* Result card - shown after a successful backfill run */}
            {lastBackfillResult && (
              <div className="overflow-hidden rounded-[10px] border border-gray-200">
                {/* Result header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <CheckCircleOutlined className="text-green-700" />
                    <span className="text-[14px] font-semibold text-heading">
                      {t('backfillResultComplete')}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {lastBackfillResult.ranAt.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Result stats */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 px-0">
                  <div className="flex flex-col items-center gap-0.5 py-4">
                    <span className="text-[22px] leading-none font-bold text-green-700">
                      {lastBackfillResult.assigned}
                    </span>
                    <span className="mt-1 text-[11px] text-muted">{t('backfillStatAssigned')}</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 py-4">
                    <span className="text-[22px] leading-none font-bold text-gray-700">
                      {lastBackfillResult.skipped}
                    </span>
                    <span className="mt-1 text-[11px] text-muted">{t('backfillStatSkipped')}</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 py-4">
                    <span
                      className={`text-[22px] leading-none font-bold ${lastBackfillResult.conflicts.length > 0 ? 'text-amber-700' : 'text-faint'}`}
                    >
                      {lastBackfillResult.conflicts.length}
                    </span>
                    <span className="mt-1 text-[11px] text-muted">
                      {t('backfillStatConflicts')}
                    </span>
                  </div>
                </div>

                {/* Conflicts list */}
                {lastBackfillResult.conflicts.length > 0 && (
                  <div className="border-t border-gray-100">
                    <Collapse
                      ghost
                      items={[
                        {
                          key: 'conflicts',
                          label: (
                            <span className="flex items-center gap-2 text-[13px] font-medium text-amber-700">
                              <WarningOutlined />
                              {t('backfillConflictsLabel', {
                                count: lastBackfillResult.conflicts.length,
                              })}
                            </span>
                          ),
                          children: (
                            <div className="flex flex-col gap-2 pb-2">
                              <p className="mb-2 text-[12px] text-muted">
                                {t('backfillConflictsDesc')}
                              </p>
                              {lastBackfillResult.conflicts.map((c) => (
                                <div
                                  key={c.memberId}
                                  className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2"
                                >
                                  <WarningOutlined className="shrink-0 text-[12px] text-amber-700" />
                                  <span className="text-[13px] text-heading">{c.name}</span>
                                  <Tag color="orange" className="ml-auto text-[11px]">
                                    {t('backfillConflictTag')}
                                  </Tag>
                                </div>
                              ))}
                            </div>
                          ),
                        },
                      ]}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
