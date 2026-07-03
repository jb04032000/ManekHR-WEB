'use client';

/**
 * StartConversationButton -- the inbox handoff entry point (Phase 7, I4).
 *
 * The mediator surfaces (marketplace inquiry, job application, RFQ quote) stay
 * board-only, but once two people are acting on the same thing they can take the
 * conversation on-platform. This button resolves (find-or-create, idempotent) a
 * context-bound thread via `startInboxContextThread` -- acting on the platform is
 * consent to be contacted about that thing, so those threads skip any quarantine
 * -- and routes to it. With no `context` it opens a plain DM.
 *
 * Self-hides until the inbox module's phase is reached (mirrors the nav gate), so
 * dropping it onto a screen is safe before the inbox goes live.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { message } from 'antd';
import { MessageCircle } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { isConnectModuleEnabled } from '@/lib/connect/flags';
import { startInboxContextThread, startInboxDm } from './inbox.actions';
import type { InboxContextEntityType } from './inbox.types';

interface StartConversationButtonProps {
  recipientUserId: string;
  /** Bind the thread to a live entity. Omit for a free DM. */
  context?: { type: InboxContextEntityType; id: string };
  /** Visible label. Defaults to a generic "Message". */
  label?: string;
  /** The other party's name -- builds a distinct accessible name when several
   *  "Message" buttons share a screen. Ignored if `ariaLabel` is given. */
  partyName?: string;
  ariaLabel?: string;
  dsVariant?: 'primary' | 'ghost';
  dsSize?: 'sm' | 'md';
  /** Render just the icon (compact, for dense rows). The label still drives the
   *  accessible name. */
  iconOnly?: boolean;
}

export default function StartConversationButton({
  recipientUserId,
  context,
  label,
  partyName,
  ariaLabel,
  dsVariant = 'ghost',
  dsSize = 'sm',
  iconOnly = false,
}: StartConversationButtonProps) {
  const t = useTranslations('connect.inbox');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Phased rollout: no inbox yet -> no handoff button (the route + nav unlock
  // together at the inbox phase).
  if (!isConnectModuleEnabled('inbox')) return null;

  const text = label ?? t('start.message');
  const aria = ariaLabel ?? (partyName ? t('start.messageAria', { name: partyName }) : text);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = context
        ? await startInboxContextThread(recipientUserId, context.type, context.id)
        : await startInboxDm(recipientUserId);
      if (res.ok) {
        // The unified inbox opens by PERSON; the thread we just resolved still
        // exists (its context card surfaces in that person's timeline). Keep
        // `busy` so the button stays disabled through the route transition.
        router.push(`/connect/inbox?person=${recipientUserId}`);
        return;
      }
      message.error(
        res.error === 'MESSAGING_RATE_LIMITED'
          ? t('start.rateLimited')
          : res.error || t('start.failed'),
      );
    } catch {
      message.error(t('start.failed'));
    }
    setBusy(false);
  };

  return (
    <DsButton
      dsVariant={dsVariant}
      dsSize={dsSize}
      loading={busy}
      onClick={() => void open()}
      aria-label={aria}
    >
      {iconOnly ? (
        <MessageCircle size={15} aria-hidden />
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle size={15} aria-hidden />
          {text}
        </span>
      )}
    </DsButton>
  );
}
