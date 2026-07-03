'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Divider, Form, Input, Select, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  MailOutlined,
  MessageOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import dayjs from 'dayjs';

import { Can } from '@/components/rbac';
import {
  getGrantContext,
  inviteTeamMember,
  revokeTeamAccess,
  resendTeamInvite,
  changeTeamAccessRole,
  setTeamPermissionOverrides,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { GridDraft } from '@/lib/rbac/permission-grid-payload';
import { buildOverridesPayload } from '@/lib/rbac/permission-grid-payload';
import { normaliseGridDraft } from '@/lib/rbac/grid-normalise';
import { useRbacRegistry } from '@/hooks/useRbacRegistry';
import { usePermissionsStore } from '@/lib/stores/permissions-store';
import type {
  GrantAccessPayload,
  GrantContext,
  TeamMember,
  Role,
  TeamMemberPermissionOverride,
} from '@/types';
import type { PathOverride, GrantedPath } from '@/types/rbac-registry';

import AccessResendModal from './AccessResendModal';
import AccessChangeRoleModal from './AccessChangeRoleModal';
import AccessChannelPicker, {
  defaultAccessChannelSelection,
  type AccessChannelSelection,
} from './AccessChannelPicker';
import PermissionOverridesMatrix from './PermissionOverridesMatrix';

const { Option } = Select;

/**
 * Numbered step label used in the NONE-state Configure Access form.
 * Visual anchor for the top-to-bottom reading order owner follows
 * when granting access (① role → ② perms → ③ delivery → ④ email →
 * Grant button). `optional` badge calls out non-required steps so
 * owner knows they can skip without breaking the flow.
 */
function StepLabel({
  index,
  label,
  optional,
}: {
  index: number;
  label: string;
  optional?: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="mt-1 mb-2 flex items-center gap-2">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{
          backgroundColor: 'var(--cr-primary, #1677ff)',
          color: '#fff',
        }}
      >
        {index}
      </span>
      <span className="text-[13px] font-semibold text-gray-900">{label}</span>
      {optional && (
        <span className="text-[11px] tracking-wide text-gray-400 uppercase">
          {t('team.grantStepOptional')}
        </span>
      )}
    </div>
  );
}

/** Stable empty GridDraft - avoids allocating a new object on every render. */
const EMPTY_GRID_DRAFT: GridDraft = { flatByCell: {}, pathByCell: {} };

interface Props {
  workspaceId: string;
  member: TeamMember;
  roles: Role[];
  onMemberChange: (updated: TeamMember) => void;
  /** Re-fetches the full member record from the BE. Called when a write
   *  succeeded server-side but the local optimistic state is incomplete
   *  (e.g. retry hits "already invited" because the prior call's response
   *  was lost - the actual grant DID land, so the rail needs a true
   *  refresh to flip out of NONE). */
  onRefresh?: () => Promise<void> | void;
}

type AccessState = 'NONE' | 'INVITED' | 'ACTIVE';

function getAccessState(member: TeamMember): AccessState {
  if (member.appAccessStatus === 'active') return 'ACTIVE';
  if (member.appAccessStatus === 'invited') return 'INVITED';
  if (member.hasAppAccess && member.linkedUserId) return 'ACTIVE';
  if (member.appAccessInviteExpiry && dayjs(member.appAccessInviteExpiry).isAfter(dayjs())) {
    return 'INVITED';
  }
  return 'NONE';
}

/**
 * AppAccessSection - owner-facing surface for the App Access lifecycle.
 *
 * State machine UI:
 *   NONE     → "Grant app access" (deep-link to the existing grant modal)
 *   INVITED  → Resend invite / Cancel invite (revoke)
 *   ACTIVE   → Change role / Revoke access (hard) + Permission overrides
 *
 * Permission overrides only render when state ∈ {INVITED, ACTIVE} - there is
 * nothing to override for a member with no app-access role at all.
 */
export default function AppAccessSection({
  workspaceId,
  member,
  roles,
  onMemberChange,
  onRefresh,
}: Props) {
  const t = useTranslations();
  const { message: messageApi, modal } = App.useApp();
  const state = getAccessState(member);
  // Registry is static - fetch once per workspace and pass into both matrix renders.
  const registry = useRbacRegistry(workspaceId);

  const [resendOpen, setResendOpen] = useState(false);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [busy, setBusy] = useState<'revoke' | null>(null);
  // P1.8-revert.13 (2026-05-14) - cached warm/cold result for the resend
  // modal's in-app channel. Determines whether the in-app checkbox is
  // enabled. Lazy-fetched when the modal opens for an INVITED member to
  // avoid the round trip on the rail's main render path.
  const [resendIsWarm, setResendIsWarm] = useState<boolean>(false);
  useEffect(() => {
    if (!resendOpen || !workspaceId || !member?.id) return;
    let cancelled = false;
    getGrantContext(workspaceId, member.id)
      .then((ctx) => {
        if (cancelled) return;
        // P1.8-revert.14 (2026-05-14) - warm detection now uses the
        // matchedUser presence directly. Previously we keyed on
        // inviteeStatus === 'registered', but for an already-INVITED
        // member the BE returns 'already_granted' regardless of warm/
        // cold. The matchedUser field is populated whenever the BE
        // finds a User row matching the member's mobile / email.
        setResendIsWarm(!!ctx.matchedUser);
      })
      .catch(() => {
        if (cancelled) return;
        // Fail-open: assume warm so the checkbox stays enabled. BE
        // silently no-ops if cold, so checking it is harmless.
        setResendIsWarm(true);
      });
    return () => {
      cancelled = true;
    };
  }, [resendOpen, workspaceId, member?.id]);

  // ── P1.8-revert (2026-05-14) - inline NONE-state grant form ────────────
  // The previous P1.8.5 drawer was friction: this surface already lives
  // on a dedicated detail page with vertical scroll, so wrapping it in a
  // drawer just added an open/close click for content that fits natively.
  // All grant inputs (role + permission matrix + delivery + email) now
  // render directly on the rail. One primary button bundles overrides +
  // invite into a single submit.
  const [grantForm] = Form.useForm<GrantAccessPayload>();
  const [grantOverrides, setGrantOverrides] = useState<GridDraft>(EMPTY_GRID_DRAFT);
  const [granting, setGranting] = useState(false);
  // P1.8-revert.7 (2026-05-14) - Step 2 (Customize permissions) is
  // collapsed by default to keep the form scannable for the 90% of
  // grants that use pure role defaults. Auto-expands when there are
  // pre-existing overrides loaded from the context (i.e. the owner
  // has previously customized this employee - surface that state, don't
  // hide it behind a click). Resetting overrides also collapses back.
  // A future subscription gate can wrap the expanded matrix block
  // without touching this logic.
  const [permsExpanded, setPermsExpanded] = useState(false);
  // P1.8-revert.12 (2026-05-14) - cold-grant share panel + Done button
  // removed. Grant success now optimistically flips the rail into
  // INVITED, which causes the persistent share panel (driven by
  // `state === 'INVITED' && member.appAccessInviteToken`) to render
  // immediately. Single render path; status header reflects truth
  // (Invited tag + Resend/Cancel buttons) the moment the grant returns
  // 200. No more "claim invite sent but tag says No access" mismatch.
  // P2.0.2 (2026-05-15) - Step 3 picker state. Replaces the legacy
  // 3-radio (Auto / Link / Both) with the same 5-channel checkbox UX
  // used by AccessResendModal. Stored outside the antd Form because the
  // picker is a controlled component, not a Form.Item field. Submit
  // converts the selection → `channels[]` for the BE DTO; legacy
  // `sendMethod` is still sent (set to 'auto') for backwards compat
  // with the dispatcher's pre-channels fallback.
  const [grantChannels, setGrantChannels] = useState<AccessChannelSelection>(() =>
    defaultAccessChannelSelection({
      isWarm: false,
      memberEmail: member.email,
      memberMobile: member.mobile,
    }),
  );
  const grantRoleId = Form.useWatch('rbacRoleId', grantForm) as string | undefined;
  const grantSelectedRole = useMemo(
    () => roles.find((r) => r._id === grantRoleId) ?? null,
    [roles, grantRoleId],
  );

  // ── P1.8.4 (2026-05-14) - NONE-state context fetch ─────────────────────
  // Branches the rail's NONE rendering between cold / warm (registered) /
  // conflict copy + recommended action. Fired only when state === 'NONE'
  // to keep the rail lean; INVITED / ACTIVE already own their lifecycle
  // and don't need the grant context. Re-runs when the member object
  // identity changes (e.g. after an offboard/restore round trip).
  const [grantCtx, setGrantCtx] = useState<GrantContext | null>(null);
  useEffect(() => {
    if (state !== 'NONE' || !workspaceId || !member?.id) {
      // Defer the clear so it is not a synchronous setState in the effect
      // body (react-hooks/set-state-in-effect); microtasks still flush
      // before paint, so there is no visible difference.
      queueMicrotask(() => setGrantCtx(null));
      return;
    }
    let cancelled = false;
    getGrantContext(workspaceId, member.id)
      .then((res) => {
        if (cancelled) return;
        setGrantCtx(res);
        // Seed the inline form with the canonical Member role + existing
        // saved overrides + a delivery default appropriate to the path.
        // Warm (registered) → 'link' (in-app fires automatically; no SMS
        // spend). Cold → 'auto' (SMS + email). Owner can override.
        const preferredRoleId =
          res.defaultRoleId ?? roles.find((r) => r.name === 'Member')?._id ?? roles[0]?._id ?? null;
        if (preferredRoleId) {
          grantForm.setFieldValue('rbacRoleId', preferredRoleId);
        }
        grantForm.setFieldValue('sendMethod', res.inviteeStatus === 'registered' ? 'link' : 'auto');
        // P2.0.2 (2026-05-15) - picker defaults are warm-aware: in_app
        // pre-checked when the invitee already has a manekhr account
        // (otherwise disabled), email + SMS pre-checked when the
        // directory record has those identifiers. Owner can adjust.
        setGrantChannels(
          defaultAccessChannelSelection({
            isWarm: res.inviteeStatus === 'registered',
            memberEmail: member.email,
            memberMobile: member.mobile,
          }),
        );
        const existingOverrides = res.customOverrides ?? [];
        // Seed the GridDraft from the stored flat overrides (no path overrides in grantCtx).
        const seedDraft: GridDraft = {
          flatByCell: Object.fromEntries(
            existingOverrides.map((o) => [
              `${o.module}.${o.action}`,
              o.allowed ? { allowed: true as const, scope: o.scope } : { allowed: false as const },
            ]),
          ),
          pathByCell: {},
        };
        setGrantOverrides(seedDraft);
        // Auto-expand Step 2 when the directory already holds custom
        // overrides for this employee - otherwise the owner sees a
        // "Customized: 3 overrides" pill but no matrix and has to click
        // to discover them, which is exactly the friction we just fixed.
        setPermsExpanded(existingOverrides.length > 0);
      })
      .catch(() => {
        // Silent - the generic NONE copy is a safe fallback. Submit will
        // surface any auth/network error when the owner clicks Grant.
        if (cancelled) return;
        setGrantCtx(null);
      });
    return () => {
      cancelled = true;
    };
  }, [state, workspaceId, member?.id, roles, grantForm]);

  async function handleInlineGrant(vals: GrantAccessPayload) {
    if (state !== 'NONE') return;
    if (grantCtx?.inviteeStatus === 'conflict' || grantCtx?.inviteeStatus === 'already_granted') {
      return;
    }
    setGranting(true);
    try {
      // Persist overrides first if owner edited the matrix. On partial
      // failure (overrides save, invite fails) the overrides survive for
      // the next retry - correct semantics: the invite-row doesn't yet
      // exist, but the directory entry's perm overrides are durable.
      const ctxOverrides = grantCtx?.customOverrides ?? [];
      // Final coherence guard (mirror of PermissionOverridesMatrix.handleSave):
      // normalise before building the payload so the grant's overrides always
      // satisfy the BE edit-implies-view / dep invariants. Idempotent.
      const { draft: coherentGrantDraft } = normaliseGridDraft(
        grantOverrides,
        registry,
        (grantSelectedRole?.permissionPaths ?? []) as GrantedPath[],
      );
      const { overrides: flatOverrides, pathOverrides: pathOvr } = buildOverridesPayload({
        draft: coherentGrantDraft,
      });
      const overridesChanged =
        flatOverrides.length !== ctxOverrides.length ||
        pathOvr.length > 0 ||
        flatOverrides.some((d) => {
          const orig = ctxOverrides.find((o) => o.module === d.module && o.action === d.action);
          return !orig || orig.allowed !== d.allowed || (orig.scope ?? null) !== (d.scope ?? null);
        });
      if (overridesChanged) {
        const updatedMember = await setTeamPermissionOverrides(workspaceId, member.id, {
          overrides: flatOverrides as TeamMemberPermissionOverride[],
          pathOverrides: pathOvr,
        });
        onMemberChange(updatedMember);
      }

      // P1.8-revert.9 (2026-05-14) - auto-forward both identifiers from
      // the directory record. BE's workspaces.service.inviteMember
      // requires email OR mobile to set the invite row's identifier +
      // pick channels; relying solely on a form `email` field broke the
      // sendMethod=link path which has no email input. The directory
      // entry is the source of truth; the owner edits the member's
      // profile to change either identifier.
      // P2.0.2 (2026-05-15) - translate the picker selection into the BE
      // `channels[]` shape (in_app / email / sms). WhatsApp is a FE-only
      // share - fired below after the grant returns the rotated token.
      const dispatchChannels: ('email' | 'sms' | 'in_app')[] = [];
      if (grantChannels.inApp) dispatchChannels.push('in_app');
      if (grantChannels.email) dispatchChannels.push('email');
      if (grantChannels.sms) dispatchChannels.push('sms');
      const res = await inviteTeamMember(workspaceId, member.id, {
        rbacRoleId: vals.rbacRoleId,
        // Legacy `sendMethod` kept set for BE callers that haven't yet
        // wired the channels[] fallback (defensive - current BE prefers
        // channels[] when present).
        sendMethod: vals.sendMethod ?? 'auto',
        email: member.email,
        mobile: member.mobile,
        channels: dispatchChannels,
      });

      // P1.8-revert.12 (2026-05-14) - optimistic rail flip on grant
      // success. BE returned a token → invite IS persisted → reflect
      // that in the status header immediately (Invited tag + Resend +
      // Cancel buttons) so the owner can revoke without first
      // dismissing a "Done" dialog. The persistent share panel (keyed
      // on `state === 'INVITED' && member.appAccessInviteToken`) takes
      // over rendering of the link + Copy + WhatsApp + SMS + Email
      // surface - one render path, no duplicate cold-grant green block.
      // onRefresh follows to reconcile rbacRole / expiry / grantedBy
      // from the BE response.
      const pickedRole = roles.find((r) => r._id === vals.rbacRoleId);
      const optimistic = {
        ...member,
        appAccessStatus: 'invited' as const,
        appAccessInviteToken: res?.inviteToken ?? member.appAccessInviteToken,
        appAccessInviteExpiry: res?.inviteToken
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : member.appAccessInviteExpiry,
        rbacRole: pickedRole
          ? {
              id: pickedRole._id,
              name: pickedRole.name,
              color: (pickedRole as { color?: string }).color ?? '#6B7280',
            }
          : member.rbacRole,
      };
      onMemberChange(optimistic);
      if (grantCtx?.inviteeStatus === 'registered') {
        messageApi.success(
          t('team.grantWarmSuccessToast', {
            name: grantCtx.matchedUser?.name ?? member.name,
          }),
        );
      } else {
        messageApi.success(t('team.inviteCreated'));
      }
      // P2.0.2 (2026-05-15) - WhatsApp share is a FE-only side-effect.
      // BE doesn't auto-send WhatsApp; we open wa.me with a prefilled
      // message + the freshly-rotated invite URL so the owner only has
      // to click Send. Skips silently when no mobile or no token.
      if (grantChannels.whatsapp && member.mobile && res?.inviteToken) {
        const inviteUrl = `${window.location.origin}/invite?token=${res.inviteToken}&type=team`;
        const text = encodeURIComponent(
          `You've been invited to join our team on manekhr. Tap to set up access: ${inviteUrl}`,
        );
        const phone = member.mobile.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener');
      }
      // Reconcile from BE in the background. Optimistic state is
      // already correct enough to render - the refetch just refreshes
      // any populated rbacRole + grantedByName fields that the BE
      // computes.
      void onRefresh?.();
    } catch (e) {
      const msg = parseApiError(e);
      // P1.8-revert.10 (2026-05-14) - when BE reports "already invited" we
      // know an earlier grant succeeded server-side but the FE didn't see
      // the happy-path response (network blip, prior dispatcher crash,
      // double-click). Trigger a parent refetch so the rail flips into
      // INVITED with the real expiry + role + identifier instead of
      // stranding the owner on a generic error toast.
      if (/already invited|already a member|already has an active/i.test(msg)) {
        messageApi.info(t('team.grantAlreadyInvitedRefreshing'));
        await onRefresh?.();
      } else {
        messageApi.error(msg);
      }
    } finally {
      setGranting(false);
    }
  }

  const expiryDays = useMemo(() => {
    if (!member.appAccessInviteExpiry) return null;
    const d = dayjs(member.appAccessInviteExpiry).diff(dayjs(), 'day');
    return d >= 0 ? d : null;
  }, [member.appAccessInviteExpiry]);

  const grantedAtLabel = member.appAccessGrantedAt
    ? dayjs(member.appAccessGrantedAt).format('DD MMM YYYY')
    : null;

  const activeRole = roles.find((r) => r._id === member.rbacRole?.id);

  async function handleRevoke() {
    // P1.8-revert.15 (2026-05-14) - disable Cancel + dismiss paths while
    // the revoke API call is inflight. Antd's modal.confirm doesn't
    // gate Cancel automatically when onOk returns a promise; we update
    // the modal handle imperatively to set cancelButtonProps.disabled
    // and disable the mask/keyboard escape routes.
    const confirmHandle = modal.confirm({
      title: t('team.accessRevokeConfirmTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('team.accessRevokeConfirmContent'),
      okText: t('team.accessRevokeConfirmOk'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        confirmHandle.update({
          cancelButtonProps: { disabled: true },
          mask: { closable: false },
          keyboard: false,
          closable: false,
        });
        setBusy('revoke');
        try {
          const updated = await revokeTeamAccess(workspaceId, member.id, {
            hardRevoke: true,
          });
          onMemberChange(updated);
          messageApi.success(t('team.accessRevokeSuccess'));
        } catch (e) {
          messageApi.error((e as Error).message || t('team.accessRevokeFailed'));
        } finally {
          setBusy(null);
        }
      },
    });
  }

  async function handleResendConfirm(opts: {
    channels: ('email' | 'sms' | 'in_app')[];
    whatsapp: boolean;
    justRotate: boolean;
  }) {
    try {
      // BE always rotates token now (no sendMethod-conditional rotation -
      // that's the point of Resend). The channels array is the source of
      // truth for fan-out. Legacy `sendMethod` is set to satisfy the DTO
      // contract but is overridden by `channels` on the BE side.
      const res = await resendTeamInvite(workspaceId, member.id, {
        sendMethod: 'auto',
        forceRegenerate: true,
        channels: opts.channels,
      });
      if (res?.inviteToken) {
        const newUrl = `${window.location.origin}/invite/${res.inviteToken}`;
        // Propagate rotated token into the member so the persistent
        // share panel re-renders with the new URL.
        onMemberChange({
          ...member,
          appAccessInviteToken: res.inviteToken,
          appAccessInviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        // WhatsApp fan-out is FE-only - there's no programmatic
        // WhatsApp send from the BE. Open wa.me with the rotated link
        // in a new tab so the owner finishes the share gesture.
        if (opts.whatsapp && member.mobile) {
          const text = encodeURIComponent(
            t('team.grantAccessSuccess.shareMessage', { name: member.name, url: newUrl }),
          );
          window.open(
            `https://wa.me/${member.mobile.replace(/\D/g, '')}?text=${text}`,
            '_blank',
            'noopener,noreferrer',
          );
        }
      }
      void onRefresh?.();
      messageApi.success(t('team.accessResendSuccess'));
      setResendOpen(false);
      return res;
    } catch (e) {
      messageApi.error((e as Error).message || t('team.accessResendFailed'));
      throw e;
    }
  }

  async function handleChangeRoleConfirm(newRoleId: string) {
    try {
      const updated = await changeTeamAccessRole(workspaceId, member.id, {
        rbacRoleId: newRoleId,
      });
      onMemberChange(updated);
      messageApi.success(t('team.accessRoleChangedSuccess'));
      setChangeRoleOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || t('team.accessRoleChangeFailed'));
      throw e;
    }
  }

  // Same-session safety net for the editor-is-affected-user case. The
  // focus-based revalidate in DashboardLayout covers cross-tab; this one
  // forces a fresh fetch immediately after the save returns, regardless
  // of the freshness window. Uses `invalidate` (not `revalidate`) so the
  // next `useMyPermissions` consumer re-runs `ensure()` against an empty
  // cache and receives the new permission set.
  const invalidatePermissions = usePermissionsStore((s) => s.invalidate);

  async function handleSaveOverrides(payload: {
    overrides: TeamMemberPermissionOverride[];
    pathOverrides: PathOverride[];
  }) {
    try {
      const updated = await setTeamPermissionOverrides(workspaceId, member.id, {
        overrides: payload.overrides,
        pathOverrides: payload.pathOverrides,
      });
      onMemberChange(updated);
      invalidatePermissions(workspaceId);
      messageApi.success(t('team.accessOverridesSaved'));
    } catch (e) {
      messageApi.error(parseApiError(e) ?? t('team.accessOverridesSaveFailed'));
      throw e; // re-throw so the matrix knows save failed (its own try/finally then resets `saving`)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Status header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <KeyOutlined className="text-gray-500" />
          <h2 className="m-0 font-display text-[18px] font-bold text-gray-900">
            {t('team.accessSectionTitle')}
          </h2>
          {state === 'NONE' && <Tag color="default">{t('team.accessStatusNone')}</Tag>}
          {state === 'INVITED' && <Tag color="warning">{t('team.accessStatusInvited')}</Tag>}
          {state === 'ACTIVE' && <Tag color="success">{t('team.accessStatusActive')}</Tag>}
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
          {state === 'NONE' && (
            <>
              {/* P1.8.4 (2026-05-14) - context-aware NONE copy.
                  Warm (registered) → instant in-app delivery banner.
                  Conflict          → blocking warning + recommended fix.
                  Cold              → original generic copy (default).
                  Falls back to cold copy when context fetch fails. */}
              {grantCtx?.inviteeStatus === 'registered' && grantCtx.matchedUser && (
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <CheckCircleOutlined className="mt-0.5 text-green-700" />
                  <div className="min-w-0 text-[12px]">
                    <p className="m-0 font-semibold text-green-900">
                      {t('team.accessNoneWarmTitle')}
                    </p>
                    <p className="m-0 text-green-800">
                      {t('team.accessNoneWarmDesc', {
                        name: grantCtx.matchedUser.name,
                      })}
                    </p>
                  </div>
                </div>
              )}
              {grantCtx?.inviteeStatus === 'conflict' && grantCtx.conflictWith && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <WarningOutlined className="mt-0.5 text-amber-700" />
                  <div className="min-w-0 text-[12px]">
                    <p className="m-0 font-semibold text-amber-900">
                      {t('team.accessNoneConflictTitle')}
                    </p>
                    <p className="m-0 text-amber-800">
                      {t('team.accessNoneConflictDesc', {
                        identifier: member.mobile || member.email || '',
                        name: grantCtx.conflictWith.name,
                      })}
                    </p>
                  </div>
                </div>
              )}
              {(!grantCtx || grantCtx.inviteeStatus === 'none') && (
                <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <UserOutlined className="mt-0.5 text-gray-500" />
                  <p className="m-0 text-[12px] text-gray-700">
                    {t('team.accessNoneColdDesc', {
                      identifier: member.mobile || member.email || t('team.thisEmployee'),
                    })}
                  </p>
                </div>
              )}
            </>
          )}
          {state === 'INVITED' && (
            <>
              <p className="m-0">{t('team.accessStatusInvitedDesc')}</p>
              {expiryDays !== null && (
                <p className="m-0 text-xs text-gray-500">
                  {t('team.accessExpiryCountdown', { days: expiryDays })}
                </p>
              )}
            </>
          )}
          {state === 'ACTIVE' && (
            <>
              <p className="m-0">
                {t('team.accessStatusActiveDesc', {
                  role: activeRole?.name ?? member.rbacRole?.name ?? '-',
                })}
              </p>
              {grantedAtLabel &&
                (member.appAccessGrantedByName ? (
                  <p className="m-0 text-xs text-gray-500">
                    {t('team.accessGrantedBy', {
                      name: member.appAccessGrantedByName,
                      date: grantedAtLabel,
                    })}
                  </p>
                ) : (
                  <p className="m-0 text-xs text-gray-500">
                    {t('team.accessGrantedOn', { date: grantedAtLabel })}
                  </p>
                ))}
            </>
          )}
        </div>

        {/* Action row */}
        <div className="mt-4 flex flex-wrap gap-2">
          {state === 'NONE' && grantCtx?.inviteeStatus === 'conflict' && (
            <Can module="team" action="edit">
              <Tooltip title={t('team.accessNoneConflictCtaHint')}>
                <Button icon={<WarningOutlined />} disabled>
                  {t('team.accessNoneConflictCta')}
                </Button>
              </Tooltip>
            </Can>
          )}
          {/* NONE-state grant action lives in the inline form card below
              (not here). Conflict is the only NONE variant with a button
              in this row because there's nothing for owner to configure
              until they fix the identifier collision. */}
          {state === 'INVITED' && (
            <Can module="team" action="edit">
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => setResendOpen(true)}>
                {t('team.accessResendBtn')}
              </Button>
              <Tooltip title={t('team.accessRevokeInviteTooltip')}>
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={busy === 'revoke'}
                  onClick={() => void handleRevoke()}
                >
                  {t('team.accessRevokeInviteBtn')}
                </Button>
              </Tooltip>
            </Can>
          )}
          {state === 'ACTIVE' && (
            <Can module="team" action="edit">
              <Button icon={<TeamOutlined />} onClick={() => setChangeRoleOpen(true)}>
                {t('team.accessChangeRoleBtn')}
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                loading={busy === 'revoke'}
                onClick={() => void handleRevoke()}
              >
                {t('team.accessRevokeBtn')}
              </Button>
            </Can>
          )}
        </div>
      </div>

      {/* ── INVITED-state persistent share panel ────────────────────────
          Renders any time the rail is in INVITED state AND the BE
          returned the raw invite token (P1.8-revert.11). Lets owner
          copy / WhatsApp / SMS / email the invite link well after the
          initial grant - e.g. invitee never received the SMS, owner
          wants to nudge them via WhatsApp. Same buttons as the cold-
          grant success panel; no Done button (the Resend + Cancel
          actions in the status header own state transitions). */}
      {state === 'INVITED' && member.appAccessInviteToken && (
        <Can module="team" action="edit">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="mb-3 flex items-start gap-2">
              <KeyOutlined className="mt-0.5 text-blue-700" />
              <div className="min-w-0">
                <h3 className="m-0 font-display text-[16px] font-bold text-blue-900">
                  {t('team.invitedShare.title')}
                </h3>
                <p className="m-0 text-[12px] text-blue-800">
                  {t('team.invitedShare.description', { name: member.name })}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-[12px] font-medium text-gray-700">
                {t('team.grantAccessSuccess.linkLabel')}
              </label>
              <div className="flex gap-2">
                <Input
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${member.appAccessInviteToken}`}
                  readOnly
                />
                <Tooltip title={t('team.grantAccessSuccess.copy')}>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={async () => {
                      const url = `${window.location.origin}/invite/${member.appAccessInviteToken}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        messageApi.success(t('team.grantAccessSuccess.copied'));
                      } catch {
                        messageApi.error(t('team.grantAccessSuccess.copyFailed'));
                      }
                    }}
                  />
                </Tooltip>
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[12px] font-medium text-gray-700">
                {t('team.grantAccessSuccess.shareLabel')}
              </label>
              <div className="flex flex-wrap gap-2">
                {member.mobile && (
                  <a
                    href={`https://wa.me/${member.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(
                      t('team.grantAccessSuccess.shareMessage', {
                        name: member.name,
                        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${member.appAccessInviteToken}`,
                      }),
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button icon={<WhatsAppOutlined />}>
                      {t('team.grantAccessSuccess.whatsapp')}
                    </Button>
                  </a>
                )}
                {member.mobile && (
                  <a
                    href={`sms:${member.mobile}?body=${encodeURIComponent(
                      t('team.grantAccessSuccess.shareMessage', {
                        name: member.name,
                        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${member.appAccessInviteToken}`,
                      }),
                    )}`}
                  >
                    <Button icon={<MessageOutlined />}>{t('team.grantAccessSuccess.sms')}</Button>
                  </a>
                )}
                <a
                  href={`mailto:${member.email ?? ''}?subject=${encodeURIComponent(
                    t('team.grantAccessSuccess.emailSubject'),
                  )}&body=${encodeURIComponent(
                    t('team.grantAccessSuccess.shareMessage', {
                      name: member.name,
                      url: `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${member.appAccessInviteToken}`,
                    }),
                  )}`}
                >
                  <Button icon={<MailOutlined />}>{t('team.grantAccessSuccess.email')}</Button>
                </a>
              </div>
            </div>

            <p className="m-0 text-[11px] text-muted">{t('team.grantAccessSuccess.expiryNote')}</p>
          </div>
        </Can>
      )}

      {/* P1.8-revert.12 (2026-05-14) - cold-grant green panel removed.
          Single share panel (the blue INVITED-state block above) now
          handles every post-grant render. Status header flips to
          INVITED optimistically in handleInlineGrant so this branch is
          reached the moment the grant returns 200. */}

      {/* ── Inline Configure Access - single card, numbered steps ─────
          NONE / non-conflict / non-already-granted only. Owner reads
          top-to-bottom: ① role → ② permissions → ③ delivery → Grant
          button. Bundling matrix + button inside ONE card kills the
          previous "is this matrix separate from the button?" confusion. */}
      {state === 'NONE' &&
        grantCtx &&
        grantCtx.inviteeStatus !== 'conflict' &&
        grantCtx.inviteeStatus !== 'already_granted' && (
          <Can module="team" action="edit">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-1">
                <h3 className="m-0 font-display text-[16px] font-bold text-gray-900">
                  {t('team.grantInlineFormTitle')}
                </h3>
                <p className="m-0 text-[12px] text-muted">{t('team.grantInlineFormSubtitle')}</p>
              </div>

              {roles.length === 0 && (
                <Alert
                  type="info"
                  showIcon
                  className="mb-4"
                  title={t('team.grantAccessEmpty.title')}
                  description={
                    <div>
                      <p className="m-0 mb-2 text-[12px]">
                        {t('team.grantAccessEmpty.description')}
                      </p>
                      <Link
                        href="/dashboard/roles"
                        className="text-[12px] font-medium text-blue-600 hover:underline"
                      >
                        {t('team.grantAccessEmpty.cta')}
                      </Link>
                    </div>
                  }
                />
              )}

              <Form
                form={grantForm}
                layout="vertical"
                onFinish={handleInlineGrant}
                requiredMark={false}
                disabled={granting}
              >
                {/* ── Step 1 - Role ─────────────────────────────────── */}
                <StepLabel index={1} label={t('team.grantStep1Role')} />
                <Form.Item
                  name="rbacRoleId"
                  rules={[{ required: true, message: t('team.selectRole') }]}
                >
                  <Select placeholder={t('team.selectRole')} disabled={roles.length === 0}>
                    {roles.map((r) => (
                      <Option key={r._id} value={r._id}>
                        {r.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* ── Step 2 - Customize permissions (collapsed by default) ─
                    Most grants stick to role defaults; surfacing the matrix
                    upfront makes a simple flow look intimidating. Collapsed
                    state shows a short summary + Customize trigger. Expanded
                    state shows the matrix + Reset+Collapse. Auto-expanded
                    when existing overrides are loaded so owner doesn't have
                    to click to discover prior customizations.
                    Future: wrap the expanded block in a FeatureGate when
                    custom permissions becomes a paid tier. */}
                <StepLabel index={2} label={t('team.grantStep2Permissions')} optional />
                {grantSelectedRole ? (
                  <div className="mb-5 flex flex-col gap-2">
                    {!permsExpanded ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="m-0 text-[12px] text-gray-700">
                          {Object.keys(grantOverrides.flatByCell).length === 0 &&
                          Object.keys(grantOverrides.pathByCell).length === 0
                            ? t('team.grantStep2DefaultsHint', {
                                role: grantSelectedRole.name,
                              })
                            : t('team.grantStep2CustomizedHint', {
                                role: grantSelectedRole.name,
                                count:
                                  Object.keys(grantOverrides.flatByCell).length +
                                  Object.keys(grantOverrides.pathByCell).length,
                              })}
                        </p>
                        <Button
                          size="small"
                          onClick={() => setPermsExpanded(true)}
                          disabled={granting}
                        >
                          {Object.keys(grantOverrides.flatByCell).length === 0 &&
                          Object.keys(grantOverrides.pathByCell).length === 0
                            ? t('team.grantStep2CustomizeCta')
                            : t('team.grantStep2ReviewCta')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <PermissionOverridesMatrix
                          role={grantSelectedRole}
                          registry={registry}
                          overrides={grantCtx.customOverrides ?? []}
                          pathOverrides={[]}
                          value={grantOverrides}
                          onChange={setGrantOverrides}
                          disabled={granting}
                          embedded
                        />
                        <button
                          type="button"
                          className="self-start text-[12px] font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={granting}
                          onClick={() => {
                            setGrantOverrides(EMPTY_GRID_DRAFT);
                            setPermsExpanded(false);
                          }}
                        >
                          {t('team.grantStep2CollapseCta')}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="mb-5 text-[12px] text-muted">{t('team.grantStep2NeedRole')}</p>
                )}

                {/* ── Step 3 - Delivery ─────────────────────────────── */}
                {/* P2.0.2 (2026-05-15) - replaced 3-radio (Auto / Link /
                    Both) with the same 5-channel picker the Resend modal
                    uses. Owners see the same mental model whether they're
                    granting fresh access or re-sending an existing invite.
                    `showJustRotate=false` - there is no token to rotate on
                    first grant; "no channels checked" already covers the
                    generate-only path. */}
                <StepLabel index={3} label={t('team.grantStep3Delivery')} />
                <div className="mb-4">
                  <p className="mb-2 text-[12px] text-muted">
                    {grantCtx.inviteeStatus === 'registered'
                      ? t('team.grantDeliveryWarmHelper')
                      : t('team.grantDeliveryColdHelper')}
                  </p>
                  <AccessChannelPicker
                    value={grantChannels}
                    onChange={setGrantChannels}
                    isWarm={grantCtx.inviteeStatus === 'registered'}
                    memberEmail={member.email}
                    memberMobile={member.mobile}
                  />
                </div>
                {/* Hidden sendMethod kept in the form so the existing
                    legacy submit path stays type-safe; we always overwrite
                    it with 'auto' at submit-time since `channels[]` is
                    authoritative on the BE. */}
                <Form.Item name="sendMethod" hidden initialValue="auto">
                  <input type="hidden" />
                </Form.Item>

                {/* P1.8-revert.9 (2026-05-14) - Step 4 (Email override)
                    removed. Identifiers always sourced from the directory
                    record (member.email / member.mobile) at submit time.
                    Owner edits the member profile to change either field. */}

                <Divider className="!my-4" />

                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<KeyOutlined />}
                  loading={granting}
                  disabled={!grantRoleId}
                  size="large"
                  block
                >
                  {grantCtx.inviteeStatus === 'registered'
                    ? t('team.grantWarmCta')
                    : t('team.sendInvite')}
                </Button>
              </Form>
            </div>
          </Can>
        )}

      {/* ── Post-grant standalone matrix (INVITED / ACTIVE) ──────────
          Owns its own draft + Save row. Saves apply immediately on the
          BE (revocationService.revoke forces session re-resolve within
          ≤5 min, so the user sees new perms on their next API call). */}
      {state !== 'NONE' && activeRole && (
        <Can module="team" action="edit">
          <PermissionOverridesMatrix
            key={`${JSON.stringify(member.permissionOverrides ?? [])}|${JSON.stringify(member.permissionPathOverrides ?? [])}`}
            role={activeRole}
            registry={registry}
            overrides={member.permissionOverrides ?? []}
            pathOverrides={(member.permissionPathOverrides as PathOverride[] | undefined) ?? []}
            onSave={handleSaveOverrides}
          />
        </Can>
      )}

      <AccessResendModal
        open={resendOpen}
        memberEmail={member.email}
        memberMobile={member.mobile}
        isWarm={resendIsWarm}
        onCancel={() => setResendOpen(false)}
        onConfirm={handleResendConfirm}
      />

      <AccessChangeRoleModal
        open={changeRoleOpen}
        roles={roles}
        currentRoleId={member.rbacRole?.id}
        onCancel={() => setChangeRoleOpen(false)}
        onConfirm={handleChangeRoleConfirm}
      />
    </div>
  );
}
