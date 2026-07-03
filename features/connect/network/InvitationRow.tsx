'use client';

/**
 * InvitationRow - one connection request in the Invitations tab.
 *
 * Built on `PersonCard` (the canonical person presentation) plus the parts a
 * card does not own: the optional request note, an answered-status chip on the
 * Archive box, and the box-specific actions (Accept / Ignore on Received,
 * Withdraw on Sent). `React.memo` keeps a row stable while sibling rows act.
 */

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { PersonCard } from '@/components/connect';
import DsButton from '@/components/ui/DsButton';
import type { ConnectionRequest, ConnectionRequestStatus, InvitationBox } from '../network.types';
import { toConnectPerson, type PeopleIndex } from './hydrate';

interface InvitationRowProps {
  request: ConnectionRequest;
  box: InvitationBox;
  /** The OTHER person's id from the viewer's seat (already resolved upstream). */
  userId: string;
  people: PeopleIndex;
  fallbackName: string;
  /** An action for this row is in flight. */
  busy: boolean;
  onAccept: () => void;
  onIgnore: () => void;
  onWithdraw: () => void;
}

/** Map an archived request's status to its display chip. */
const STATUS_CHIP: Record<ConnectionRequestStatus, { key: string; bg: string; fg: string } | null> =
  {
    pending: null,
    accepted: { key: 'statusAccepted', bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
    ignored: { key: 'statusIgnored', bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
    withdrawn: { key: 'statusWithdrawn', bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
  };

function InvitationRowImpl({
  request,
  box,
  userId,
  people,
  fallbackName,
  busy,
  onAccept,
  onIgnore,
  onWithdraw,
}: InvitationRowProps) {
  const t = useTranslations('connect.network.invitations');
  const person = toConnectPerson(userId, people, fallbackName);
  const chip = STATUS_CHIP[request.status];

  // The action cluster (buttons / chip) sits INLINE to the end of the identity
  // row, vertically centred - the LinkedIn invitation pattern. The previous
  // "stacked on its own row below" layout left a large empty dead-zone on the
  // wide network column and read as buttons floating detached from the person.
  // Here the identity grows to fill, actions stay intrinsic-width at the end,
  // and the flex-wrap row drops them onto their own (still end-aligned) line
  // only when the viewport is genuinely too narrow (mobile). `marginInlineStart`
  // keeps the end-alignment correct under the RTL-capable gu/hi locales.
  let actions: React.ReactNode = null;
  if (box === 'received') {
    actions = (
      <>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={onIgnore} disabled={busy}>
          {t('ignore')}
        </DsButton>
        <DsButton dsVariant="primary" dsSize="sm" onClick={onAccept} loading={busy}>
          {t('accept')}
        </DsButton>
      </>
    );
  } else if (box === 'sent') {
    actions = (
      <DsButton dsVariant="ghost" dsSize="sm" onClick={onWithdraw} loading={busy}>
        {t('withdraw')}
      </DsButton>
    );
  } else if (chip) {
    actions = (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: 'var(--cr-radius-full)',
          fontSize: 11,
          fontWeight: 600,
          background: chip.bg,
          color: chip.fg,
          whiteSpace: 'nowrap',
        }}
      >
        {t(chip.key as Parameters<typeof t>[0])}
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 'var(--cr-space-md)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 'var(--cr-space-md)',
          rowGap: 10,
        }}
      >
        {/* Identity grows to fill the row; `minWidth: 0` lets the name ellipsis
            kick in instead of shoving the actions off the card. */}
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <PersonCard person={person} />
        </div>
        {actions && (
          <div
            style={{
              flexShrink: 0,
              marginInlineStart: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {actions}
          </div>
        )}
      </div>
      {request.note && (
        <p
          style={{
            margin: 0,
            marginInlineStart: 52,
            padding: '8px 12px',
            background: 'var(--cr-surface-2)',
            borderRadius: 'var(--cr-radius-md)',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--cr-text-2)',
          }}
        >
          <span
            style={{
              display: 'block',
              fontWeight: 600,
              marginBottom: 2,
              color: 'var(--cr-text-4)',
            }}
          >
            {t('noteLabel')}
          </span>
          {request.note}
        </p>
      )}
    </div>
  );
}

const InvitationRow = memo(InvitationRowImpl);
export default InvitationRow;
