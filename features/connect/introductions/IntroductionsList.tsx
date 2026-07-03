'use client';

/**
 * IntroductionsList - the Broker Introductions home body (anti-gaming core,
 * Slice 2). Three sections:
 *   1. "To confirm" - introductions where the current user is a party and their
 *      OWN side is not yet confirmed (from listPendingIntroductions). Each row
 *      has Confirm + Decline, which call confirmIntroduction / declineIntroduction
 *      then drop the row in place and refetch the broker list (so a confirm shows
 *      up there too).
 *   2. "Introductions I made" - the broker's own introductions (from
 *      listMyIntroductions), each showing its status pill.
 *   3. "Introductions you received" - the caller's CONFIRMED introductions where
 *      they are a party (from listReceivedIntroductions). Each row offers a
 *      "Review {broker}" button that opens BrokerReviewModal for that confirmed
 *      introduction (Slice 3wB - the verified-but-anonymous broker review write).
 * It also hosts the Introduce trigger (broker-only, gated by the page) + the
 * IntroduceComposer modal + the BrokerReviewModal.
 *
 * Cross-module links:
 *  - mirrors components/connect/SellerReviews.tsx (in-place list + AntApp toast +
 *    useAuthStore current-user idiom + honest empty states).
 *  - server actions in introductions.actions.ts wrap /connect/introductions.
 *  - IntroduceComposer is the create modal; `people` are the broker's connections
 *    hydrated by the page from network.actions (listConnections + getPeople).
 *  - BrokerReviewModal (broker-reviews module) is the review write surface opened
 *    from the "received" section; the broker is derived from the introduction
 *    BE-side, so the row only passes introductionId + the broker's name.
 *
 * Watch: a "To confirm" row is keyed off the OTHER party (the BE populates
 * userLow/userHigh/brokerUserId); the partySummary helper normalizes the
 * populated-object-or-id-string union from introductions.types.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { App as AntApp, Alert } from 'antd';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import BrokerReviewModal from '@/features/connect/broker-reviews/BrokerReviewModal';
import IntroduceComposer, { type IntroducePerson } from './IntroduceComposer';
import {
  confirmIntroduction,
  declineIntroduction,
  listMyIntroductions,
  listPendingIntroductions,
} from './introductions.actions';
import type {
  Introduction,
  IntroductionParty,
  IntroductionRole,
  IntroductionStatus,
  ReceivedIntroduction,
} from './introductions.types';

interface IntroductionsListProps {
  /** Server-fetched pending-to-confirm queue (warm start). */
  initialPending: Introduction[];
  /** Server-fetched broker contact book (warm start). */
  initialMine: Introduction[];
  /** Server-fetched confirmed introductions the caller received (warm start). */
  initialReceived: ReceivedIntroduction[];
  /** Whether the current user is a self-declared broker (gates the Introduce trigger). */
  isBroker: boolean;
  /** The broker's connections, offered in the composer's two pickers. */
  people: IntroducePerson[];
}

/** Normalize the populated-object-or-id-string party union to a plain identity. */
function partySummary(p: IntroductionParty | string): { _id: string; name?: string } {
  if (typeof p === 'string') return { _id: p };
  return { _id: p._id, name: p.name };
}

function initial(name?: string): string {
  return (name?.trim()?.[0] ?? '?').toUpperCase();
}

/** The first character of a name, for the fallback avatar. */
function Avatar({ name, src }: { name?: string; src?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ''}
        width={40}
        height={40}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--cr-surface-2, #eef2ff)',
        color: 'var(--cr-primary, #4f46e5)',
        fontWeight: 700,
        fontSize: 16,
      }}
    >
      {initial(name)}
    </span>
  );
}

export default function IntroductionsList({
  initialPending,
  initialMine,
  initialReceived,
  isBroker,
  people,
}: IntroductionsListProps) {
  const t = useTranslations('connect.introductions');
  const { message } = AntApp.useApp();

  const currentUserId = useAuthStore((s) => s.user?._id ?? null);

  const [pending, setPending] = useState<Introduction[]>(initialPending);
  const [mine, setMine] = useState<Introduction[]>(initialMine);
  const [received] = useState<ReceivedIntroduction[]>(initialReceived);
  // The received introduction currently open in the broker-review modal (null =
  // closed). Carries the introductionId the review is anchored to + the broker's
  // name (the broker id is derived from the introduction BE-side on submit).
  const [reviewing, setReviewing] = useState<ReceivedIntroduction | null>(null);
  // Per-row in-flight guard so a double-click can't fire two confirms/declines.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // Screen-reader announcement for the confirm/decline outcome (aria-live).
  const [announce, setAnnounce] = useState('');
  // A confirm/decline already refetches; keep a flag so the row drop is instant.
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  // Refresh both lists from the server (after a write). The broker list reflects
  // a freshly-confirmed status, the pending list drops the row.
  const refresh = useCallback(async () => {
    const [p, m] = await Promise.all([listPendingIntroductions(), listMyIntroductions()]);
    if (!liveRef.current) return;
    if (p.ok) setPending(p.data);
    if (m.ok) setMine(m.data);
  }, []);

  const onCreated = useCallback(() => {
    void refresh();
  }, [refresh]);

  const confirm = useCallback(
    async (id: string) => {
      setBusyId(id);
      const res = await confirmIntroduction(id);
      setBusyId(null);
      if (!res.ok) {
        message.error(res.error);
        return;
      }
      message.success(t('confirmSuccess'));
      setAnnounce(t('confirmSuccess'));
      // Drop the confirmed row from the to-confirm queue immediately, then sync.
      setPending((prev) => prev.filter((x) => x._id !== id));
      await refresh();
    },
    [message, t, refresh],
  );

  const decline = useCallback(
    async (id: string) => {
      setBusyId(id);
      const res = await declineIntroduction(id);
      setBusyId(null);
      if (!res.ok) {
        message.error(res.error);
        return;
      }
      message.success(t('declineSuccess'));
      setAnnounce(t('declineSuccess'));
      setPending((prev) => prev.filter((x) => x._id !== id));
      await refresh();
    },
    [message, t, refresh],
  );

  // The broker may or may not be the current user in a "To confirm" row, but the
  // broker is the actor for "Introductions I made". For a to-confirm row, show
  // both introduced parties + the broker who made it.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* aria-live region: confirm/decline outcomes announce to screen readers. */}
      <p
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announce}
      </p>

      {/* Privacy-reassurance callout: shown at the top of the list so anyone with a
          pending/received introduction is calmed before they confirm or review.
          Mirrors the AntD v6 Alert (title/description/showIcon/icon) used in
          components/connect/OverLimitBanner.tsx; ShieldCheck (lucide) is aria-hidden
          so screen readers read the title + body, not the decorative glyph. Keep the
          copy in sync with the brokerReviews privacy lines (review modal + section). */}
      <Alert
        type="info"
        showIcon
        icon={<ShieldCheck size={18} aria-hidden />}
        style={{
          borderRadius: 'var(--cr-radius-md, 10px)',
          border: '1px solid var(--cr-border-light, #e5e7eb)',
        }}
        title={
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cr-text)' }}>
            {t('privacy.title')}
          </span>
        }
        description={
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--cr-text-3, #6b7280)' }}>
            {t('privacy.body')}
          </span>
        }
      />

      {/* Header + Introduce trigger (broker-only; the page hides it otherwise). */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--cr-text)' }}>
            {t('pageTitle')}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cr-text-3, #6b7280)' }}>
            {t('pageSubtitle')}
          </p>
        </div>
        {isBroker ? (
          <DsButton dsVariant="primary" onClick={() => setComposerOpen(true)}>
            {t('introduce')}
          </DsButton>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--cr-text-4, #9ca3af)', maxWidth: 280 }}>
            {t('brokerOnlyHint')}
          </span>
        )}
      </header>

      {/* Section 1: To confirm */}
      <section aria-label={t('toConfirmTitle')} style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>{t('toConfirmTitle')}</h2>
        {pending.length === 0 ? (
          <p style={emptyStyle}>{t('toConfirmEmpty')}</p>
        ) : (
          <ul style={listStyle}>
            {pending.map((row) => {
              const broker = partySummary(row.brokerUserId);
              const low = partySummary(row.userLow);
              const high = partySummary(row.userHigh);
              // The other introduced party (relative to the current user) is the
              // person this row introduces them to; fall back to showing both.
              const other =
                currentUserId && low._id === currentUserId
                  ? high
                  : currentUserId && high._id === currentUserId
                    ? low
                    : null;
              const counterpart = other ?? low;
              const isBusy = busyId === row._id;
              return (
                <li key={row._id} style={rowStyle}>
                  <Avatar name={counterpart.name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cr-text)' }}>
                      {other
                        ? t('introducedToYou', { name: counterpart.name ?? t('aMember') })
                        : t('introducedPair', {
                            a: low.name ?? t('aMember'),
                            b: high.name ?? t('aMember'),
                          })}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--cr-text-3, #6b7280)' }}>
                      {t('madeBy', { broker: broker.name ?? t('aBroker') })}
                      {row.note ? ` · ${row.note}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <DsButton
                      dsVariant="primary"
                      dsSize="sm"
                      loading={isBusy}
                      onClick={() => confirm(row._id)}
                    >
                      {t('confirm')}
                    </DsButton>
                    <DsButton
                      dsVariant="ghost"
                      dsSize="sm"
                      disabled={isBusy}
                      onClick={() => decline(row._id)}
                    >
                      {t('decline')}
                    </DsButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 2: Introductions I made */}
      <section aria-label={t('mineTitle')} style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>{t('mineTitle')}</h2>
        {mine.length === 0 ? (
          <p style={emptyStyle}>{t('mineEmpty')}</p>
        ) : (
          <ul style={listStyle}>
            {mine.map((row) => {
              const low = partySummary(row.userLow);
              const high = partySummary(row.userHigh);
              return (
                <li key={row._id} style={rowStyle}>
                  <Avatar name={low.name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cr-text)' }}>
                      {t('introducedPair', {
                        a: low.name ?? t('aMember'),
                        b: high.name ?? t('aMember'),
                      })}
                    </div>
                    {row.note && (
                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--cr-text-3, #6b7280)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {row.note}
                      </div>
                    )}
                  </div>
                  <StatusPill status={row.status} roleOfLow={row.roleOfLow} t={t} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 3: Introductions you received (review the broker who made them).
          These are CONFIRMED introductions where the current user is a party, so
          each carries a broker the caller can review (Slice 3wB). The broker id is
          derived from the introduction BE-side; the row only passes the id + name. */}
      <section aria-label={t('receivedTitle')} style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>{t('receivedTitle')}</h2>
        {received.length === 0 ? (
          <p style={emptyStyle}>{t('receivedEmpty')}</p>
        ) : (
          <ul style={listStyle}>
            {received.map((row) => {
              const broker = partySummary(row.brokerUserId);
              const low = partySummary(row.userLow);
              const high = partySummary(row.userHigh);
              // The other introduced party (relative to the current user) is the
              // person this introduction connected them to; fall back to the pair.
              const other =
                currentUserId && low._id === currentUserId
                  ? high
                  : currentUserId && high._id === currentUserId
                    ? low
                    : null;
              const brokerName = broker.name ?? t('aBroker');
              return (
                <li key={row._id} style={rowStyle}>
                  <Avatar name={brokerName} src={brokerAvatar(row.brokerUserId)} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cr-text)' }}>
                      {t('madeBy', { broker: brokerName })}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--cr-text-3, #6b7280)' }}>
                      {other
                        ? t('introducedYouTo', { name: other.name ?? t('aMember') })
                        : t('introducedPair', {
                            a: low.name ?? t('aMember'),
                            b: high.name ?? t('aMember'),
                          })}
                    </div>
                  </div>
                  <DsButton
                    dsVariant="ghost"
                    dsSize="sm"
                    onClick={() => setReviewing(row)}
                    style={{ flexShrink: 0 }}
                  >
                    {t('reviewBroker', { broker: brokerName })}
                  </DsButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isBroker && (
        <IntroduceComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          people={people}
          onCreated={onCreated}
        />
      )}

      {reviewing && (
        <BrokerReviewModal
          open={!!reviewing}
          introductionId={reviewing._id}
          brokerName={partySummary(reviewing.brokerUserId).name ?? t('aBroker')}
          onClose={() => setReviewing(null)}
          onSaved={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

/** The broker's avatar URL when the ref was populated (else undefined). */
function brokerAvatar(p: IntroductionParty | string): string | undefined {
  return typeof p === 'string' ? undefined : p.profilePicture;
}

/** Status badge for a broker's own introduction (pending / confirmed / declined). */
function StatusPill({
  status,
  roleOfLow,
  t,
}: {
  status: IntroductionStatus;
  roleOfLow: IntroductionRole;
  t: ReturnType<typeof useTranslations>;
}) {
  const tone =
    status === 'confirmed'
      ? { bg: 'var(--cr-success-bg, #ecfdf5)', fg: 'var(--cr-success, #047857)' }
      : status === 'declined'
        ? { bg: 'var(--cr-surface-2, #f3f4f6)', fg: 'var(--cr-text-4, #9ca3af)' }
        : { bg: 'var(--cr-warning-bg, #fffbeb)', fg: 'var(--cr-warning, #b45309)' };
  // roleOfLow is referenced so the pill stays in step with the stored pair; not
  // shown as copy here (kept for future "buyer/seller" labelling), so void it.
  void roleOfLow;
  return (
    <span
      style={{
        flexShrink: 0,
        alignSelf: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--cr-radius-full, 999px)',
        fontSize: 12,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {t(`status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

const sectionStyle = { display: 'flex', flexDirection: 'column' as const, gap: 12 };
const sectionHeadingStyle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--cr-text)',
};
const emptyStyle = {
  margin: 0,
  fontSize: 13,
  color: 'var(--cr-text-4, #9ca3af)',
  padding: '14px 0',
};
const listStyle = {
  listStyle: 'none' as const,
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
};
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  borderRadius: 'var(--cr-radius-md, 10px)',
  border: '1px solid var(--cr-border-light, #e5e7eb)',
  background: 'var(--cr-surface, #fff)',
};
