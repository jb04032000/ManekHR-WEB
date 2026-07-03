'use client';

/**
 * PersonCardActions - the Connect / Follow control cluster for a person across
 * every people surface (Network Suggestions, Search results, the feed
 * "People to follow" rail).
 *
 * Relationship model (grounded in LinkedIn):
 *  - **Connect** = mutual, needs acceptance. Primary action for individual
 *    members (our whole network today). Optimistic → "Pending" pill, which is
 *    itself actionable: Popconfirm → Withdraw.
 *  - **Follow** = one-way, instant, idempotent. Secondary action in `full`
 *    mode; the SOLE action in `followOnly` mode (the feed "add to your feed"
 *    rail).
 *  - **Connected** = "Connected" pill → Popconfirm → Remove connection.
 *
 * All logic lives in the shared `useRelationship` hook (same one the profile
 * header uses), so a card and the profile behave identically. State is
 * optimistic: Suggestions / Search pre-exclude existing connections, so the
 * default (not connected, not following) is correct without a per-card
 * relationship round-trip; the hook captures the created request id on Connect
 * so Withdraw works immediately on the card.
 *
 * Which action is primary is, on LinkedIn, the TARGET's "make follow primary"
 * setting - a creator/brand posture. Our network is all individuals today, so
 * Connect is primary everywhere; the Follow-primary flip arrives with Company
 * Pages (Phase 6).
 */

import { Popconfirm } from 'antd';
import { Check, ChevronDown, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import { useRelationship } from './useRelationship';

export interface PersonCardActionsProps {
  /** The person this control acts on. */
  userId: string;
  /** `full` = Connect primary + Follow secondary. `followOnly` = Follow alone. */
  mode?: 'full' | 'followOnly';
  /** Known relationship at render time. Optional - surfaces that pre-exclude
   *  connections omit these and rely on the optimistic flow. */
  initialConnected?: boolean;
  initialFollowing?: boolean;
  initialOutgoingRequest?: boolean;
}

export default function PersonCardActions({
  userId,
  mode = 'full',
  initialConnected = false,
  initialFollowing = false,
  initialOutgoingRequest = false,
}: PersonCardActionsProps) {
  const t = useTranslations('connect.profile.actions');
  const tInv = useTranslations('connect.network.invitations');
  const rel = useRelationship(userId, {
    connected: initialConnected,
    following: initialFollowing,
    outgoingRequest: initialOutgoingRequest,
  });

  const followButton = (
    <DsButton dsVariant="ghost" dsSize="sm" loading={rel.busyFollow} onClick={rel.toggleFollow}>
      {rel.following ? t('following') : t('follow')}
    </DsButton>
  );

  // Feed "People to follow" rail - one-way, so Follow is the only control.
  if (mode === 'followOnly') return followButton;

  /** Pill-shaped Popconfirm trigger for the Connected / Pending states. */
  const pillButton = (label: string, withCheck: boolean) => (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold"
      style={{
        padding: '5px 11px',
        borderRadius: 'var(--cr-radius-full)',
        background: 'var(--cr-surface-2)',
        color: 'var(--cr-text-4)',
        border: '1px solid var(--cr-border)',
      }}
    >
      {withCheck && <Check size={13} aria-hidden />}
      {label}
      <ChevronDown size={12} aria-hidden />
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {rel.connected ? (
        <Popconfirm
          title={t('removeConfirm')}
          okText={t('removeConnection')}
          cancelText={t('cancel')}
          okButtonProps={{ danger: true, loading: rel.busyManage }}
          onConfirm={rel.removeConnection}
        >
          {pillButton(t('connected'), true)}
        </Popconfirm>
      ) : rel.requested ? (
        <Popconfirm
          title={t('withdrawConfirm')}
          okText={tInv('withdraw')}
          cancelText={t('cancel')}
          okButtonProps={{ danger: true, loading: rel.busyManage }}
          onConfirm={rel.withdraw}
        >
          {pillButton(t('requested'), false)}
        </Popconfirm>
      ) : (
        <DsButton dsVariant="primary" dsSize="sm" loading={rel.busyConnect} onClick={rel.connect}>
          <UserPlus size={14} aria-hidden /> {t('connect')}
        </DsButton>
      )}
      {/* Already-connected members implicitly follow each other, so Follow only
          shows while not connected (incl. the pending state). */}
      {!rel.connected && followButton}
    </div>
  );
}
