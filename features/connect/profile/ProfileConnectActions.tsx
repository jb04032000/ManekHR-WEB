'use client';

/**
 * ProfileConnectActions - the relationship controls on a `/connect/u/[slug]`
 * (and public `/u/[slug]`) profile header for a signed-in non-owner viewer.
 *
 * Every relationship state is ACTIONABLE (no dead pills):
 *   - connected        → "Connected" pill → Popconfirm → Remove connection
 *   - incoming request → inline Accept / Ignore (acted on in place)
 *   - outgoing request → "Pending" pill → Popconfirm → Withdraw
 *   - none             → Connect
 *   - Follow / Following toggle is always available alongside.
 *
 * All logic lives in the shared `useRelationship` hook (same one the people
 * cards use) so the behaviour is identical everywhere; this component only
 * renders. `onChanged` runs `router.refresh()` to re-sync the SSR relationship.
 * The owner's own view (`relationship.self`) and a logged-out viewer (no
 * relationship resolved → the page passes nothing) render no actions.
 */

import { useRouter } from 'next/navigation';
import { Popconfirm } from 'antd';
import { Check, ChevronDown, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import { useRelationship } from '../network/useRelationship';
import type { RelationshipState } from '../network.types';

interface ProfileConnectActionsProps {
  /** The profile owner's `User` id. */
  userId: string;
  /** The viewer's current relationship to that user (server-loaded). */
  relationship: RelationshipState;
}

export default function ProfileConnectActions({
  userId,
  relationship,
}: ProfileConnectActionsProps) {
  const t = useTranslations('connect.profile.actions');
  const tInv = useTranslations('connect.network.invitations');
  const router = useRouter();

  const rel = useRelationship(
    userId,
    {
      connected: relationship.connected,
      outgoingRequest: relationship.outgoingRequest,
      incomingRequest: relationship.incomingRequest,
      following: relationship.following,
      outgoingRequestId: relationship.outgoingRequestId,
      incomingRequestId: relationship.incomingRequestId,
    },
    () => router.refresh(),
  );

  // Viewing one's own profile - no relationship actions apply.
  if (relationship.self) return null;

  /** A pill-shaped button used as a Popconfirm trigger (Connected / Pending). */
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
    <div className="flex items-center gap-2">
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
      ) : rel.incoming ? (
        <span className="flex items-center gap-2">
          <DsButton dsVariant="primary" dsSize="sm" loading={rel.busyManage} onClick={rel.accept}>
            {tInv('accept')}
          </DsButton>
          <DsButton dsVariant="ghost" dsSize="sm" disabled={rel.busyManage} onClick={rel.ignore}>
            {tInv('ignore')}
          </DsButton>
        </span>
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
        // Secondary (outline), not a second filled primary: the header already
        // has one filled navy CTA (the "Message" button in ProfileView). Two
        // filled navy buttons side by side read as competing primaries. Message
        // stays the single primary across every relationship state (it is always
        // present); Connect / Follow / Share are the outline secondary tier. The
        // UserPlus icon keeps Connect distinct from the plain Follow button.
        <DsButton dsVariant="ghost" dsSize="sm" loading={rel.busyConnect} onClick={rel.connect}>
          <UserPlus size={14} aria-hidden /> {t('connect')}
        </DsButton>
      )}

      {/* Follow is independent of the connection - you can follow without
          connecting, and unfollow a connection while staying connected. */}
      <DsButton dsVariant="ghost" dsSize="sm" loading={rel.busyFollow} onClick={rel.toggleFollow}>
        {rel.following ? t('following') : t('follow')}
      </DsButton>
    </div>
  );
}
