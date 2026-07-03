'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { App, Button, Card, Skeleton, Switch, Tooltip, Typography } from 'antd';
import { BellOutlined, InfoCircleOutlined, LockOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { getWorkspace } from '@/lib/actions/workspaces.actions';
import { updateNotificationPolicy } from '@/lib/actions/workspaces.actions';
import type { WorkspaceNotificationPolicy } from '@/types';

// ── Defaults (mirror BE schema defaults) ────────────────────────────────────
const DEFAULT_POLICY: Required<NonNullable<WorkspaceNotificationPolicy['permissionChanges']>> = {
  enabled: true,
  channels: { inApp: true, email: false, sms: false },
};

type ChannelState = { inApp: boolean; email: boolean; sms: boolean };
type FormState = { enabled: boolean; channels: ChannelState };

function stateFromPolicy(policy: WorkspaceNotificationPolicy | undefined): FormState {
  const pc = policy?.permissionChanges;
  if (!pc) return { enabled: DEFAULT_POLICY.enabled, channels: { ...DEFAULT_POLICY.channels } };
  return {
    enabled: pc.enabled,
    channels: {
      inApp: pc.channels?.inApp ?? DEFAULT_POLICY.channels.inApp,
      email: pc.channels?.email ?? DEFAULT_POLICY.channels.email,
      sms: pc.channels?.sms ?? DEFAULT_POLICY.channels.sms,
    },
  };
}

function statesEqual(a: FormState, b: FormState): boolean {
  return (
    a.enabled === b.enabled &&
    a.channels.inApp === b.channels.inApp &&
    a.channels.email === b.channels.email &&
    a.channels.sms === b.channels.sms
  );
}

// ── Channel row ─────────────────────────────────────────────────────────────
function ChannelRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  disabledTooltip,
  trailingNote,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  disabledTooltip?: string;
  trailingNote?: string;
}) {
  const toggle = (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      size="small"
      aria-label={label}
    />
  );

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-medium text-heading">{label}</span>
          <Tooltip title={hint} styles={{ root: { maxWidth: 260 } }}>
            <InfoCircleOutlined className="cursor-pointer text-[12px] text-faint" />
          </Tooltip>
        </div>
        {trailingNote && <span className="text-[12px] text-muted">{trailingNote}</span>}
      </div>
      {disabledTooltip && disabled ? <Tooltip title={disabledTooltip}>{toggle}</Tooltip> : toggle}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationSettingsPage() {
  const t = useTranslations('workspace.notifications');
  const { message: msgApi } = App.useApp();
  // AC-3.3 / AC-4.1: per-slice selectors. `setCurrentWorkspace` is used after a
  // successful policy save so `currentWorkspace.notificationPolicy` in the store
  // is up to date (no page refresh needed, and the load path can trust the store).
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);

  const { can } = useMyPermissions();
  const canManage = can('workspaces', 'edit');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    enabled: DEFAULT_POLICY.enabled,
    channels: { ...DEFAULT_POLICY.channels },
  });
  const [savedSnapshot, setSavedSnapshot] = useState<FormState | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadPolicy = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      // Try the in-memory workspace from store first; fall back to a fresh fetch
      // (the store may not carry notificationPolicy if it was hydrated before
      // Phase 2.4 shipped on the backend).
      let source = currentWorkspace?.notificationPolicy !== undefined ? currentWorkspace : null;
      if (!source) {
        const res = await getWorkspace(currentWorkspaceId);
        if (res.ok) source = res.data;
      }
      const derived = stateFromPolicy(source?.notificationPolicy);
      setForm(derived);
      setSavedSnapshot(derived);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, currentWorkspace]);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  // ── Dirty detection ───────────────────────────────────────────────────────
  const isDirty = useMemo(
    () => (savedSnapshot ? !statesEqual(form, savedSnapshot) : false),
    [form, savedSnapshot],
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!currentWorkspaceId || !isDirty) return;
    setSaving(true);
    const optimistic = { ...form };
    try {
      const payload: WorkspaceNotificationPolicy = {
        permissionChanges: {
          enabled: form.enabled,
          channels: { ...form.channels },
        },
      };
      const res = await updateNotificationPolicy(currentWorkspaceId, payload);
      if (res.ok) {
        // Update snapshot to the freshly persisted policy
        const persisted = stateFromPolicy(res.data.workspace?.notificationPolicy);
        setForm(persisted);
        setSavedSnapshot(persisted);
        // AC-3.3: keep `currentWorkspace.notificationPolicy` in the Zustand store
        // fresh so a later load (which reads the store first) and any other
        // consumer see the new policy without a page refresh. Merge the persisted
        // policy onto the current doc (preserve all other workspace fields).
        const nextPolicy = res.data.workspace?.notificationPolicy;
        if (currentWorkspace && nextPolicy !== undefined) {
          setCurrentWorkspace({ ...currentWorkspace, notificationPolicy: nextPolicy });
        }
        msgApi.success(t('permissionChanges.saveSuccess'));
      } else {
        // Revert to last-known-good on failure
        setForm(savedSnapshot ?? optimistic);
        msgApi.error(res.error || t('permissionChanges.saveFailed'));
      }
    } catch {
      setForm(savedSnapshot ?? optimistic);
      msgApi.error(t('permissionChanges.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [
    currentWorkspaceId,
    isDirty,
    form,
    savedSnapshot,
    msgApi,
    t,
    currentWorkspace,
    setCurrentWorkspace,
  ]);

  const handleDiscard = useCallback(() => {
    if (savedSnapshot) setForm(savedSnapshot);
  }, [savedSnapshot]);

  // ── Channel helpers ───────────────────────────────────────────────────────
  const setChannel = (ch: keyof ChannelState, v: boolean) =>
    setForm((s) => ({ ...s, channels: { ...s.channels, [ch]: v } }));

  const channelsDisabled = !form.enabled || !canManage;

  // ── Render ────────────────────────────────────────────────────────────────
  if (!currentWorkspaceId) {
    return (
      <div className="mt-12 text-center">
        <p className="text-[14px] text-muted">{t('noWorkspace')}</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="mb-8">
        <Typography.Title level={2} className="!mb-1">
          {t('title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0 text-[14px]">
          {t('subtitle')}
        </Typography.Paragraph>
      </div>

      {/* ── Permission notice ── */}
      {!canManage && (
        <div className="mb-6 flex items-start gap-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3.5">
          <LockOutlined className="mt-0.5 shrink-0 text-amber-600" />
          <p className="m-0 text-[13px] text-amber-800">{t('readOnlyNotice')}</p>
        </div>
      )}

      {/* ── Permission changes section ── */}
      <Card styles={{ body: { padding: '28px 28px' } }} className="mb-6">
        {loading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <div className="flex flex-col gap-0">
            {/* Section heading */}
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] bg-primary-light text-[15px] text-primary">
                <BellOutlined />
              </div>
              <div>
                <p className="m-0 text-[15px] font-semibold text-heading">
                  {t('permissionChanges.title')}
                </p>
                <p className="m-0 mt-0.5 text-[13px] text-muted">
                  {t('permissionChanges.description')}
                </p>
              </div>
            </div>

            <hr className="mb-5 border-gray-100" />

            {/* Master toggle */}
            <div className="flex items-start justify-between gap-4 pb-3">
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-heading">
                  {t('permissionChanges.enabled')}
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted">
                  {t('permissionChanges.enabledHint')}
                </div>
              </div>
              <Switch
                checked={form.enabled}
                onChange={(v) => setForm((s) => ({ ...s, enabled: v }))}
                disabled={!canManage}
                aria-label={t('permissionChanges.enabled')}
              />
            </div>

            {/* Channel toggles - only visible when master is ON */}
            {form.enabled && (
              <>
                <hr className="my-1 border-gray-100" />
                <p className="mt-4 mb-1 text-[11px] font-bold tracking-widest text-muted uppercase">
                  {t('permissionChanges.channelsHeader')}
                </p>

                <div className="divide-y divide-gray-50">
                  {/* In-app */}
                  <ChannelRow
                    label={t('permissionChanges.channels.inApp')}
                    hint={t('permissionChanges.channels.inAppHint')}
                    checked={form.channels.inApp}
                    onChange={(v) => setChannel('inApp', v)}
                    disabled={channelsDisabled}
                  />

                  {/* Email */}
                  <ChannelRow
                    label={t('permissionChanges.channels.email')}
                    hint={t('permissionChanges.channels.emailHint')}
                    checked={form.channels.email}
                    onChange={(v) => setChannel('email', v)}
                    disabled={channelsDisabled}
                  />

                  {/* SMS */}
                  <ChannelRow
                    label={t('permissionChanges.channels.sms')}
                    hint={t('permissionChanges.channels.smsHint')}
                    checked={form.channels.sms}
                    onChange={(v) => setChannel('sms', v)}
                    disabled={channelsDisabled}
                    trailingNote={t('permissionChanges.channels.smsCreditNote')}
                  />
                </div>
              </>
            )}

            <hr className="mt-5 mb-5 border-gray-100" />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                type="primary"
                size="large"
                loading={saving}
                disabled={!isDirty || !canManage}
                onClick={() => void handleSave()}
              >
                {t('saveBtn')}
              </Button>
              {isDirty && canManage && (
                <Button size="large" onClick={handleDiscard}>
                  {t('discardBtn')}
                </Button>
              )}
              {isDirty && (
                <span className="ml-auto flex items-center gap-1.5 text-[12px] text-amber-700">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {t('unsavedChanges')}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
