'use client';

/**
 * ERPConsentModal - the consent + transparency dialog for the "ERP-linked"
 * trust badge (ADR-0004 / 2026-06-18 spec). One modal serves two modes:
 *
 *  - `profile`  the PERSON consent grant. The owner reads exactly what the
 *               platform looks at (activity counts only), what it never reads,
 *               and what appears publicly, then grants. `onConfirm()` is called
 *               with no argument (the backend reads the caller's own memberships).
 *  - `entity`   the COMPANY-PAGE / STOREFRONT link. Same transparency body PLUS a
 *               workspace picker populated from the workspaces the caller OWNS.
 *               `onConfirm(workspaceId)` carries the chosen workspace; the backend
 *               re-checks ownership and 403s a workspace the caller does not own.
 *
 * Cross-module:
 *  - opened by ERPConsentBanner + ProfileView's privacy setting (profile mode)
 *    and by ERPEntityLinkControl on CompanyPageForm + StorefrontSettings (entity).
 *  - the workspace list comes from lib/actions/workspaces.actions `listWorkspaces`
 *    (the ERP workspaces module), filtered to the caller's owned workspaces via
 *    `Workspace.ownerId === currentUser._id`.
 *
 * Watch: copy lives entirely in the `connect.erpConsent.modal.*` i18n namespace
 * (all four locales) - keep the weLookAt/never/public/control lists in sync with
 * the design spec. AntD v6 only (`open`, `destroyOnHidden`, `styles.body`).
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Select } from 'antd';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Globe, Settings2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import { listWorkspaces } from '@/lib/actions/workspaces.actions';
import type { Workspace } from '@/types';

export interface ERPConsentModalProps {
  open: boolean;
  /** `profile` = person consent (no workspace); `entity` = link a page/shop. */
  mode: 'profile' | 'entity';
  /** Confirm in flight (the parent owns the grant/link call) - drives the OK spinner. */
  loading: boolean;
  /** profile mode: called with no id. entity mode: called with the picked workspace id. */
  onConfirm: (workspaceId?: string) => void;
  onCancel: () => void;
}

export default function ERPConsentModal({
  open,
  mode,
  loading,
  onConfirm,
  onCancel,
}: ERPConsentModalProps) {
  const t = useTranslations('connect.erpConsent.modal');
  const currentUserId = useAuthStore((s) => s.user?._id);

  // Owned-workspace picker state (entity mode only). Loaded lazily when the
  // modal opens so the profile-mode path never pays for the workspace fetch.
  // `null` = not yet loaded (drives the picker's loading state in entity mode).
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>(undefined);

  // On (re)open in entity mode: reset the picked workspace + (re)load the owned
  // workspaces. All setState lives inside a microtask / promise callback so it
  // stays out of the synchronous effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open || mode !== 'entity') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelectedWorkspaceId(undefined);
      setWorkspaces(null);
    });
    void listWorkspaces().then((res) => {
      if (cancelled) return;
      setWorkspaces(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  // Only workspaces the caller OWNS are linkable (the backend 403s the rest).
  // Filter on `ownerId`; when the id is unknown (auth not hydrated) fall back to
  // the full list so we never wrongly hide a legitimately-owned workspace - the
  // backend ownership check is the real gate, this is just the friendly filter.
  const ownedWorkspaces = useMemo(() => {
    const list = workspaces ?? [];
    if (!currentUserId) return list;
    return list.filter((w) => w.ownerId === currentUserId);
  }, [workspaces, currentUserId]);

  const isEntity = mode === 'entity';
  // Loading the picker = entity mode + the list has not resolved yet (`null`).
  const loadingWorkspaces = isEntity && workspaces === null;
  const noOwnedWorkspaces = isEntity && !loadingWorkspaces && ownedWorkspaces.length === 0;
  // Entity mode requires a chosen workspace before linking; profile mode has none.
  const confirmDisabled = isEntity && (noOwnedWorkspaces || !selectedWorkspaceId);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={t('title')}
      footer={
        <div className="flex justify-end gap-2">
          <DsButton dsVariant="ghost" onClick={onCancel} disabled={loading}>
            {t('notNow')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            loading={loading}
            disabled={confirmDisabled}
            onClick={() => onConfirm(isEntity ? selectedWorkspaceId : undefined)}
          >
            {isEntity ? t('link') : t('verify')}
          </DsButton>
        </div>
      }
      // Tall transparency content scrolls inside the body so the title + footer
      // stay pinned (binding modal rule). `destroyOnHidden` opens it clean.
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      destroyOnHidden
      centered
    >
      <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--cr-text-2)' }}>
        {t('body')}
      </p>

      {/* What we look at - counts only (Eye glyph reinforces "we only count"). */}
      <TransparencyBlock
        icon={<Eye size={15} aria-hidden style={{ color: 'var(--cr-primary)' }} />}
        title={t('weLookAtTitle')}
        items={[t('weLookAt1'), t('weLookAt2')]}
      />

      {/* What we never read or show - the privacy wall. */}
      <TransparencyBlock
        icon={<EyeOff size={15} aria-hidden style={{ color: 'var(--cr-text-3)' }} />}
        title={t('neverTitle')}
        items={[t('never1'), t('never2'), t('never3'), t('never4')]}
      />

      {/* What appears publicly - the badge + active-since line, nothing else. */}
      <TransparencyBlock
        icon={<Globe size={15} aria-hidden style={{ color: 'var(--cr-primary)' }} />}
        title={t('publicTitle')}
        body={t('publicBody')}
      />

      {/* Your control - turn off anytime, badge drops immediately. */}
      <TransparencyBlock
        icon={<Settings2 size={15} aria-hidden style={{ color: 'var(--cr-text-3)' }} />}
        title={t('controlTitle')}
        body={t('controlBody')}
      />

      {/* Entity mode: pick the owned ERP workspace that backs this page/shop. */}
      {isEntity && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--cr-border-light)' }}>
          <label
            htmlFor="erp-consent-workspace"
            className="block text-[13px] font-semibold"
            style={{ color: 'var(--cr-text)' }}
          >
            {t('entityWorkspaceLabel')}
          </label>
          <p className="m-0 mt-0.5 mb-2 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('entityWorkspaceHint')}
          </p>
          {noOwnedWorkspaces ? (
            <p
              className="m-0 rounded-md p-3 text-[12.5px]"
              style={{
                background: 'var(--cr-surface-2)',
                border: '1px solid var(--cr-divider)',
                color: 'var(--cr-text-3)',
              }}
            >
              {t('entityNoWorkspaces')}
            </p>
          ) : (
            <Select
              id="erp-consent-workspace"
              className="w-full"
              loading={loadingWorkspaces}
              value={selectedWorkspaceId}
              onChange={setSelectedWorkspaceId}
              placeholder={t('entityWorkspacePlaceholder')}
              options={ownedWorkspaces.map((w) => ({ value: w._id, label: w.name }))}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * One transparency row: an icon + bold title, then either a bullet list (counts /
 * never lists) or a single body line (public / control). Kept local - it is only
 * meaningful inside this modal's layout.
 */
function TransparencyBlock({
  icon,
  title,
  items,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  items?: string[];
  body?: string;
}) {
  return (
    <div className="mt-3.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {title}
        </span>
      </div>
      {items ? (
        <ul
          className="m-0 mt-1.5 flex list-disc flex-col gap-1 pl-7 text-[12.5px]"
          style={{ color: 'var(--cr-text-3)' }}
        >
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p
          className="m-0 mt-1 pl-7 text-[12.5px] leading-relaxed"
          style={{ color: 'var(--cr-text-3)' }}
        >
          {body}
        </p>
      )}
    </div>
  );
}
