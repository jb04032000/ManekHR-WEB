'use client';

/**
 * BoostResultsCard + BoostResults - the per-campaign boost results view.
 *
 * BoostResultsCard is the reusable card body: header (title + lede + status
 * pill), the metric tiles (Reach / Views / Clicks), the taken-down Alert, and a
 * read-only "X days left" remaining-time line. It is hosted both by the
 * Boosts-list slide-over drawer (BoostResultsDrawer) and by the thin
 * BoostResults page wrapper below.
 *
 * BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel +
 * spend hidden from users; admin keeps control. The spend/budget block and the
 * Pause / Resume / Cancel controls are commented out (not deleted) below so they
 * can be re-enabled later; spend stays visible to ADMINS only (admin surfaces are
 * untouched). The card is now READ-ONLY for the user.
 *
 * Cross-module: BoostResultsDrawer (drawer host) + BoostsManagerScreen (the
 * list that opens the drawer). The host still passes an onChanged callback (a
 * no-op now there are no mutations) and an onClose so the drawer can dismiss.
 *
 * Connect is PERSON-CENTRIC: the campaign is scoped to the authenticated user
 * on the backend (read verifies ownership by JWT). No workspaceId, no
 * advertiserId, no ERP <Can>.
 *
 * MONEY UNIT: spent / left / total are whole RUPEES (admin-only now).
 */

import { useId, useState } from 'react';
import Link from 'next/link';
import { Alert } from 'antd';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
// import { useCallback } from 'react';
// import { useRouter } from 'next/navigation';
// import { App as AntApp, Popconfirm } from 'antd';
// import { Loader2, Pause, Play, XCircle } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import useAnnouncer from '@/components/connect/useAnnouncer';
// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
// formatRupees was only used by the now-hidden spend/budget block.
// import { formatRupees } from '../marketplace/format';
// import { cancelBoost, pauseBoost, resumeBoost } from './ads.actions';
import type { BoostStatus } from './ads.types';

/** Indian-grouped whole-number formatting for reach / views / clicks. */
function formatCount(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

/**
 * The metric + budget snapshot the card renders. Decoupled from the wire
 * BoostStatus so the drawer can map a list row (BoostListItem) into the same
 * shape without a fresh fetch.
 */
export interface BoostResultsCardData {
  status: string;
  /** Already spent on this boost, whole rupees. */
  spent: number;
  /** Budget still left on this boost, whole rupees. */
  left: number;
  /** Unique people reached. */
  reach: number;
  /** Times the boost was viewed. */
  views: number;
  /** Clicks on the boost. */
  clicks: number;
  /** Admin take-down reason (publish-then-moderate), or null. */
  moderationReason: string | null;
  /**
   * Campaign end (ISO) when the host knows it (drawer maps it from the list
   * row). Drives the read-only "X days left" line. Optional: the page-wrapper
   * path maps from BoostStatus, which has no end date, so the line is hidden
   * there. Cross-module: BoostResultsDrawer.toCardData -> BoostListItem.endAt.
   */
  endAt?: string;
}

/** Build the card data from the wire BoostStatus (page-wrapper path). */
function fromBoostStatus(s: BoostStatus): BoostResultsCardData {
  return {
    status: s.status,
    spent: s.spend,
    left: s.budgetRemaining,
    reach: s.reach,
    views: s.views,
    clicks: s.clicks,
    moderationReason: s.moderationReason,
    // BoostStatus has no end date, so the remaining-time line is hidden on the
    // page-wrapper path; the drawer host supplies endAt from the list row.
    endAt: undefined,
  };
}

/**
 * Whole days remaining until `endAt` (clamped at 0), or null when there is no
 * usable end date. Mirrors the BoostsManagerScreen daysLeft helper so the
 * read-only remaining-time line reads consistently across surfaces.
 */
function daysLeftFrom(endAt: string | undefined, nowMs: number): number | null {
  if (!endAt) return null;
  const end = Date.parse(endAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - nowMs) / 86_400_000));
}

type StatusTone = { bg: string; fg: string };

const STATUS_TONE: Record<string, StatusTone> = {
  active: { bg: 'var(--cr-success-50)', fg: 'var(--cr-success-700)' },
  paused: {
    bg: 'var(--cr-warning-50,var(--cr-surface-2))',
    fg: 'var(--cr-warning-700,var(--cr-text-3))',
  },
  pending_review: { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-3)' },
  completed: { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-3)' },
  rejected: {
    bg: 'var(--cr-error-50,var(--cr-surface-2))',
    fg: 'var(--cr-error-700,var(--cr-text-3))',
  },
  draft: { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-3)' },
};

interface BoostResultsCardProps {
  /** The campaign id (AdCampaign _id). */
  boostId: string;
  /** Status + metrics snapshot for this boost. */
  data: BoostResultsCardData;
  /**
   * Fired after a pause / resume / cancel succeeds, so the host can refetch the
   * list and reconcile the row + drawer. Optional (the page wrapper relies on
   * router.refresh instead).
   */
  onChanged?: () => void;
  /**
   * Fired when a terminal action (cancel) completes, so a drawer host can
   * dismiss itself. Optional. The page wrapper routes back to the hub instead.
   */
  onClose?: () => void;
}

/**
 * The reusable results card body (no page chrome). Owns the optimistic
 * pause/resume + confirmed-cancel behavior; tells the host via onChanged /
 * onClose so it can refresh + dismiss. Used by BoostResultsDrawer and the
 * BoostResults page wrapper below.
 */
export function BoostResultsCard({ boostId, data, onChanged, onClose }: BoostResultsCardProps) {
  const t = useTranslations('connect.ads.results');
  const { announcer } = useAnnouncer();

  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
  // The card is read-only now: no optimistic status state, no pending flag, no
  // pause/resume/cancel handlers. Status renders straight from the incoming
  // snapshot. `boostId`, `onChanged` and `onClose` are kept on the props so the
  // mutation chain can be switched back on without touching the call sites.
  // void the now-unused props so this lints clean while the controls are off.
  void boostId;
  void onChanged;
  void onClose;
  const status = data.status;
  //
  // const router = useRouter();
  // const { message } = AntApp.useApp();
  // const { announce } = useAnnouncer();
  //
  // // Status is local (optimistic) state, reconciled to the incoming snapshot
  // // whenever a fresh one arrives (after the host refetches). Adjusting state
  // // during render is React's recommended alternative to a setState-in-effect.
  // const [status, setStatus] = useState(data.status);
  // const [pending, setPending] = useState(false);
  // const [syncedStatus, setSyncedStatus] = useState(data.status);
  // if (data.status !== syncedStatus) {
  //   setSyncedStatus(data.status);
  //   setStatus(data.status);
  // }

  const statusLabelId = useId();

  const isPendingReview = status === 'pending_review';
  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
  // const isActive = status === 'active';
  // const isPaused = status === 'paused';
  // // Cancel is offered while the boost is still running or awaiting review; once
  // // completed/rejected there is nothing left to stop or refund.
  // const canCancel = isActive || isPaused || isPendingReview;
  //
  // const runTransition = useCallback(
  //   async (
  //     next: 'paused' | 'active',
  //     prev: 'active' | 'paused',
  //     action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
  //     successKey: 'toast.paused' | 'toast.resumed',
  //   ) => {
  //     if (pending) return;
  //     setStatus(next); // optimistic
  //     setPending(true);
  //     try {
  //       const res = await action();
  //       if (res.ok) {
  //         message.success(t(successKey));
  //         announce(t(successKey));
  //         // Host refetches the list (reconciles the row); page wrapper refreshes.
  //         if (onChanged) onChanged();
  //         else router.refresh();
  //       } else {
  //         setStatus(prev); // rollback
  //         const msg = res.error || t('actionError');
  //         message.error(msg);
  //         announce(msg, { assertive: true });
  //       }
  //     } catch {
  //       setStatus(prev); // rollback
  //       message.error(t('actionError'));
  //       announce(t('actionError'), { assertive: true });
  //     } finally {
  //       setPending(false);
  //     }
  //   },
  //   [pending, message, t, router, announce, onChanged],
  // );
  //
  // const onPause = useCallback(
  //   () => runTransition('paused', 'active', () => pauseBoost(boostId), 'toast.paused'),
  //   [runTransition, boostId],
  // );
  // const onResume = useCallback(
  //   () => runTransition('active', 'paused', () => resumeBoost(boostId), 'toast.resumed'),
  //   [runTransition, boostId],
  // );
  //
  // /**
  //  * Cancel this boost: the backend refunds the unused budget, frees the source
  //  * to be boosted again, and completes the campaign. Terminal, so on success we
  //  * tell the host to refresh + close (drawer) or route back to the hub (page).
  //  * No optimistic flip - the confirm gates it. Cross-module: cancelBoost -> BE
  //  * POST /connect/ads/boosts/:id/cancel.
  //  */
  // const onCancel = useCallback(async () => {
  //   if (pending) return;
  //   setPending(true);
  //   try {
  //     const res = await cancelBoost(boostId);
  //     if (res.ok) {
  //       message.success(t('toast.cancelled'));
  //       announce(t('toast.cancelled'));
  //       if (onChanged) onChanged();
  //       if (onClose) onClose();
  //       if (!onChanged && !onClose) {
  //         router.push('/connect/boosts');
  //         router.refresh();
  //       }
  //     } else {
  //       const msg = res.error || t('actionError');
  //       message.error(msg);
  //       announce(msg, { assertive: true });
  //       setPending(false);
  //     }
  //   } catch {
  //     message.error(t('actionError'));
  //     announce(t('actionError'), { assertive: true });
  //     setPending(false);
  //   }
  // }, [pending, boostId, message, t, announce, router, onChanged, onClose]);

  const tone = STATUS_TONE[status] ?? STATUS_TONE.draft;
  const statusLabel = t(`statusLabel.${status}` as Parameters<typeof t>[0]);

  // Read-only remaining-time: "X days left" until the campaign ends, or null
  // when the host has no end date (page-wrapper path). Replaces the hidden
  // spend/budget block as the at-a-glance lifecycle cue for the user. Capture
  // the wall-clock once (lazy state init) so the render stays pure -- mirrors
  // BoostsManagerScreen's loadedAtMs pattern.
  const [nowMs] = useState(() => Date.now());
  const daysLeft = daysLeftFrom(data.endAt, nowMs);
  const isDone = status === 'completed';

  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
  // The per-boost spend/budget figures stay visible to ADMINS only (admin
  // surfaces untouched); the user no longer sees "spent of total" or the bar.
  // const spent = data.spent;
  // const left = data.left;
  // const total = spent + left;
  // const spentPct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;

  // Engagement tiles (reach / views / clicks). Spend is intentionally NOT shown
  // to the user (admin-only); these three engagement counts are the user's view.
  const tiles: { key: string; label: string; value: string }[] = [
    { key: 'reach', label: t('stat.reach'), value: formatCount(data.reach) },
    { key: 'views', label: t('stat.views'), value: formatCount(data.views) },
    { key: 'clicks', label: t('stat.clicks'), value: formatCount(data.clicks) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {announcer}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--cr-text)' }}>
            {t('heading')}
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12.5,
              color: 'var(--cr-text-4)',
              lineHeight: 1.5,
            }}
          >
            {t('lede')}
          </p>
        </div>
        <span
          id={statusLabelId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            flex: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            borderRadius: 'var(--cr-radius-full)',
            fontSize: 12.5,
            fontWeight: 700,
            background: tone.bg,
            color: tone.fg,
          }}
        >
          {statusLabel}
        </span>
      </header>

      {/* Take-down banner (publish-then-moderate): when an admin takes a live
          boost down it flips to rejected and carries a reason. Show it clearly
          plus the refund note (leftover minus the review fee). v6 Alert uses
          `title` (never the deprecated `message`). Source: BE moderationReason. */}
      {status === 'rejected' && data.moderationReason && (
        <Alert
          type="warning"
          showIcon
          title={t('takenDown', { reason: data.moderationReason })}
          description={t('takenDownRefund')}
        />
      )}

      {/* BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
          The per-boost spend/budget block (spent-of-total + bar + "budget left")
          is hidden from the user; spend stays visible to ADMINS only. The
          read-only remaining-time line below replaces it for the user. */}
      {/* <div
        style={{
          background: 'var(--cr-surface-2)',
          borderRadius: 'var(--cr-radius-md)',
          padding: '14px 16px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
          }}
        >
          {t('budgetTitle')}
        </div>
        <div style={{ margin: '6px 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('spentOfTotal', { spent: formatRupees(spent), total: formatRupees(total) })}
        </div>
        <div
          style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--cr-surface-3)' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={spentPct}
        >
          <i style={{ display: 'block', height: '100%', width: `${spentPct}%`, background: 'var(--cr-primary)' }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-3)' }}>
          {t('budgetLeft', { amount: formatRupees(left) })}
        </div>
      </div> */}

      {/* Read-only remaining-time line (replaces the hidden spend/budget block
          for the user). Shows "X days left" or "Finished"; hidden when the host
          has no end date (page-wrapper path). Reuses the existing daysLeft /
          finished / endingSoon keys (shared with the manager row). */}
      {daysLeft !== null && (
        <div
          style={{
            background: 'var(--cr-surface-2)',
            borderRadius: 'var(--cr-radius-md)',
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--cr-text-3)',
          }}
        >
          {isDone
            ? t('finished')
            : daysLeft > 0
              ? t('daysLeft', { count: daysLeft })
              : t('endingSoon')}
        </div>
      )}

      {/* Engagement metrics */}
      <section
        aria-label={t('heading')}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
      >
        {tiles.map((tile) => (
          <StatTile key={tile.key} label={tile.label} value={tile.value} />
        ))}
      </section>

      {isPendingReview && (
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--cr-text-4)',
            background: 'var(--cr-wash-indigo)',
            borderRadius: 'var(--cr-radius-md)',
            padding: '10px 12px',
          }}
        >
          {t('pendingNote')}
        </p>
      )}

      {/* BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
          The user-facing Pause / Resume / Cancel controls are disabled; only an
          admin controls a live boost (admin take-down is a separate path, left
          untouched). The card is read-only for the user. Commented (not deleted)
          so the controls can be switched back on with their handlers/imports. */}
      {/* {isActive && (
        <button
          type="button"
          onClick={() => void onPause()}
          disabled={pending}
          aria-busy={pending}
          aria-label={t('pause')}
          style={controlButtonStyle(pending, 'var(--cr-warning,var(--cr-text-3))')}
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Pause size={16} aria-hidden />
          )}
          {pending ? t('pausing') : t('pause')}
        </button>
      )} */}

      {/* {isPaused && (
        <button
          type="button"
          onClick={() => void onResume()}
          disabled={pending}
          aria-busy={pending}
          aria-label={t('resume')}
          style={controlButtonStyle(pending, 'var(--cr-primary)')}
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Play size={16} aria-hidden />
          )}
          {pending ? t('resuming') : t('resume')}
        </button>
      )} */}

      {/* Cancel boost: confirmed first, then refunds the unused budget + frees
          the source to boost again (BE completes the campaign). Subtle danger
          tone so it never competes with Pause/Resume as the primary action. */}
      {/* {canCancel && (
        <Popconfirm
          title={t('cancel')}
          description={t('cancelConfirm')}
          okText={t('cancel')}
          cancelText={t('cancelKeep')}
          okButtonProps={{ danger: true, disabled: pending }}
          onConfirm={() => void onCancel()}
        >
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            aria-label={t('cancel')}
            style={cancelButtonStyle(pending)}
          >
            <XCircle size={16} aria-hidden />
            {t('cancel')}
          </button>
        </Popconfirm>
      )} */}
    </div>
  );
}

interface BoostResultsProps {
  /** The campaign id (AdCampaign _id). */
  boostId: string;
  /** Server-loaded status + metrics snapshot. */
  initial: BoostStatus;
}

/**
 * The standalone-page wrapper: page chrome (back link + contained section) around
 * the shared BoostResultsCard. Kept for any direct render of a single boost; the
 * canonical entry is now the Boosts-list drawer (BoostResultsDrawer). With no
 * onChanged/onClose the card falls back to router.refresh + route-to-hub.
 */
export default function BoostResults({ boostId, initial }: BoostResultsProps) {
  const t = useTranslations('connect.ads.results');

  return (
    <main className="w-full" style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 40px' }}>
      {/* Back to the boosts manager - this view is otherwise a dead-end. */}
      <Link
        href="/connect/boosts"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--cr-text-3)',
          textDecoration: 'none',
        }}
      >
        <ArrowLeft size={15} aria-hidden /> {t('backToBoosts')}
      </Link>

      {/* One contained panel so the page reads as a deliberate summary card. */}
      <section
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          padding: 20,
        }}
      >
        <BoostResultsCard boostId={boostId} data={fromBoostStatus(initial)} />
      </section>
    </main>
  );
}

// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
// cancelButtonStyle / controlButtonStyle only styled the now-disabled
// Pause / Resume / Cancel buttons. Commented out (not deleted) so they come back
// with the controls.
//
// /** Subtle, danger-tinted styling for the secondary Cancel-boost control. */
// function cancelButtonStyle(disabled: boolean): React.CSSProperties {
//   return {
//     display: 'inline-flex',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     alignSelf: 'flex-start',
//     minHeight: 38,
//     padding: '0 16px',
//     borderRadius: 'var(--cr-radius-full)',
//     border: '1px solid var(--cr-error,var(--cr-border))',
//     cursor: disabled ? 'not-allowed' : 'pointer',
//     opacity: disabled ? 0.6 : 1,
//     background: 'var(--cr-surface)',
//     color: 'var(--cr-error-700,var(--cr-text-3))',
//     fontSize: 13,
//     fontWeight: 600,
//   };
// }
//
// function controlButtonStyle(disabled: boolean, accent: string): React.CSSProperties {
//   return {
//     display: 'inline-flex',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     alignSelf: 'flex-start',
//     minHeight: 44,
//     padding: '0 22px',
//     borderRadius: 'var(--cr-radius-full)',
//     border: `1.5px solid ${accent}`,
//     cursor: disabled ? 'not-allowed' : 'pointer',
//     opacity: disabled ? 0.6 : 1,
//     background: 'var(--cr-surface)',
//     color: accent,
//     fontSize: 14,
//     fontWeight: 700,
//   };
// }
