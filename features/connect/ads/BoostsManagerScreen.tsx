'use client';

/**
 * BoostsManagerScreen - the boosts manager dashboard (`/connect/boosts`).
 *
 * A KPI strip + an underline tabbar (Active / Scheduled / Completed / Drafts)
 * over the caller's REAL boost campaigns. Every number is real: the KPIs come
 * from `getBoostStats`, each row's Reach / Clicks / Spend / CTR / CPC come from
 * the campaign's lifetime rollups (`listBoosts`). There is intentionally NO
 * inquiry / conversion column - that metric is not attributed anywhere, so the
 * honest call is to drop the prototype's conversion column rather than fake it.
 *
 * Status -> tab mapping (documented, single source = `tabForBoost`):
 *   - Active    : `active`, plus `paused` (shown with a Paused pill).
 *   - Scheduled : `pending_review`, or any non-terminal campaign whose `startAt`
 *                 is still in the future.
 *   - Completed : `completed`.
 *   - Drafts    : `draft`, plus `rejected` (shown with a Rejected pill).
 *
 * Per-row actions are READ-ONLY for a live boost: a user can no longer pause /
 * resume / cancel their own boost (owner decision 2026-06-20 -- only an admin
 * controls a live boost, via the separate admin take-down path). What remains is
 * "View report" (opens the read-only results drawer), "Boost again" for completed
 * campaigns (deep-links the existing composer for the same target), and "Finish
 * setup" for drafts. No "new boost" target picker is invented here - a boost is
 * always created from a listing or job, so the header offers wallet/billing.
 *
 * The per-boost row also hides money: it shows only the status pill + "X days
 * left" (no "spent of budget" line and no spend progress bar). Spend stays
 * visible to admins only (admin surfaces are untouched). The top KPI strip still
 * shows the caller's own aggregate spend-this-month figure as before.
 *
 * Connect is PERSON-CENTRIC: every action is scoped to the authenticated user
 * on the backend (JWT). No workspaceId, no advertiserId, no ERP <Can>.
 *
 * MONEY UNIT: totalBudget / budgetSpent / spend / costPerClick are whole RUPEES.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
// Referral nudge card: dismissed locally (no persistence). Gated on
// REFERRAL_ENABLED so it is entirely absent when the program is dark.
// Cross-module: referral-gate.ts / app/connect/referrals/page.tsx.
// Watch: local-dismiss state resets on page remount (no persistence needed
// per spec); upgrade to localStorage if persistence is required later.
import { REFERRAL_ENABLED } from '@/features/connect/referrals/referral-gate';
// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
// AntApp (App.useApp) only powered the toast `message` used by the disabled
// pause/resume/cancel handlers. Re-enable with the handlers.
// import { App as AntApp } from 'antd';
import {
  type LucideIcon,
  // BOOST-UI (owner 2026-06-19): BarChart3 only powered the removed per-row "View
  // report" button (now commented out). Commented (not deleted) to restore.
  // BarChart3,
  Briefcase,
  Calendar,
  Eye,
  Image as ImageIcon,
  MousePointerClick,
  Package,
  FileText,
  Pencil,
  Receipt,
  Rocket,
  Trophy,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { ConnectPage } from '@/components/connect';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import { KpiStrip, KpiCard } from '@/components/connect/KpiStrip';
import useAnnouncer from '@/components/connect/useAnnouncer';
import { formatRupees } from '../marketplace/format';
// Only read actions remain: a user can no longer pause/resume/cancel their own
// boost (owner decision 2026-06-20). The "View report" drawer is read-only.
import { getBoost, listBoosts } from './ads.actions';
import BoostResultsDrawer from './BoostResultsDrawer';
import HubWalletStrip from './HubWalletStrip';
import BoostsHowItWorks from './BoostsHowItWorks';
import BoostQuickStart from './BoostQuickStart';
import type {
  BoostableSummary,
  BoostKind,
  BoostListItem,
  BoostManagerStatus,
  BoostStatsView,
  ConnectPricingView,
  WalletView,
} from './ads.types';

type TabKey = 'active' | 'scheduled' | 'completed' | 'drafts';

const TAB_ORDER: TabKey[] = ['active', 'scheduled', 'completed', 'drafts'];

const TAB_ICON: Record<TabKey, LucideIcon> = {
  active: Rocket,
  scheduled: Calendar,
  completed: Trophy,
  drafts: Pencil,
};

/** Full Indian-grouped count (Reach / Clicks per row), e.g. `6,840`. */
function formatCount(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

/** Compact count for the KPI strip headline figure, e.g. `14.2K`. */
function formatCompactCount(n: number): string {
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(
    n,
  );
}

/** CTR is a 0..1 ratio from the backend; render as a one-decimal percentage. */
function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Whole days remaining until `endAt` (clamped at 0). A campaign auto-completes
 * when `endAt` passes, so a negative delta means it has effectively ended.
 */
function daysLeft(endAt: string, nowMs: number): number {
  const end = Date.parse(endAt);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - nowMs) / 86_400_000));
}

/** The documented status (+ schedule) -> tab mapping. Single source of truth. */
function tabForBoost(b: BoostListItem, nowMs: number): TabKey {
  if (b.status === 'completed') return 'completed';
  if (b.status === 'draft' || b.status === 'rejected') return 'drafts';
  if (b.status === 'active' || b.status === 'paused') return 'active';
  // pending_review, or any other non-terminal state: it is scheduled if its
  // start is still in the future, otherwise it sits in Scheduled awaiting go-live.
  const start = Date.parse(b.startAt);
  if (b.status === 'pending_review') return 'scheduled';
  if (!Number.isNaN(start) && start > nowMs) return 'scheduled';
  return 'active';
}

interface KindVisual {
  icon: LucideIcon;
  gold: boolean;
}

/** Icon + tint per campaign kind for the row thumbnail. */
const KIND_VISUAL: Record<BoostKind, KindVisual> = {
  boost_listing: { icon: Package, gold: true },
  boost_job: { icon: Briefcase, gold: false },
  boost_post: { icon: ImageIcon, gold: false },
  boost_open_to_work: { icon: UserCheck, gold: false },
  boost_hiring: { icon: UserPlus, gold: false },
  boost_rfq: { icon: FileText, gold: false },
};

/**
 * The detail-page href for the boosted item, by kind + matching source id. Lets
 * the row deep-link to what is actually being promoted. Returns null when no
 * route applies or the source id is missing, so the title renders as plain text
 * rather than a dead link. Canonical routes mirror the rest of Connect:
 *   listing -> /connect/marketplace/listing/[id]  (ContextCard, PromotedListingFeedCard)
 *   job     -> /connect/jobs/[id]
 *   rfq     -> /connect/rfq/[id]
 *   post    -> /connect/posts/[id]                  (feed permalink)
 *   open_to_work / hiring -> /connect/u/[userId]    (PromotedProfileAdCard)
 * Cross-module: keep in sync with those surfaces if a route ever moves.
 */
function boostTargetHref(b: BoostListItem): string | null {
  switch (b.kind) {
    case 'boost_listing':
      return b.sourceListingId ? `/connect/marketplace/listing/${b.sourceListingId}` : null;
    case 'boost_job':
      return b.sourceJobId ? `/connect/jobs/${b.sourceJobId}` : null;
    case 'boost_rfq':
      return b.sourceRfqId ? `/connect/rfq/${b.sourceRfqId}` : null;
    case 'boost_post':
      return b.sourcePostId ? `/connect/posts/${b.sourcePostId}` : null;
    case 'boost_open_to_work':
    case 'boost_hiring':
      return b.sourceProfileUserId ? `/connect/u/${b.sourceProfileUserId}` : null;
    default:
      return null;
  }
}

/** The kind kicker label key per campaign kind ("LISTING BOOST" etc.). */
const KIND_KICK_KEY: Record<BoostKind, string> = {
  boost_listing: 'kind.listing',
  boost_job: 'kind.job',
  boost_post: 'kind.post',
  boost_open_to_work: 'kind.open_to_work',
  boost_hiring: 'kind.hiring',
  boost_rfq: 'kind.rfq',
};

/** Status pill palette - mirrors the prototype's st-* tones in cr- tokens. */
const PILL_TONE: Record<BoostManagerStatus, { bg: string; fg: string; dot: string }> = {
  active: {
    bg: 'var(--cr-success-bg)',
    fg: 'var(--cr-success)',
    dot: 'var(--cr-success-solid)',
  },
  paused: {
    bg: 'var(--cr-warning-bg)',
    fg: 'var(--cr-warning)',
    dot: 'var(--cr-warning-solid)',
  },
  pending_review: {
    bg: 'var(--cr-primary-light)',
    fg: 'var(--cr-primary-hover)',
    dot: 'var(--cr-primary)',
  },
  completed: {
    bg: 'var(--cr-surface-3)',
    fg: 'var(--cr-text-4)',
    dot: 'var(--cr-text-5)',
  },
  draft: {
    bg: 'var(--cr-warning-bg)',
    fg: 'var(--cr-warning)',
    dot: 'var(--cr-warning-solid)',
  },
  rejected: {
    bg: 'var(--cr-error-50,var(--cr-surface-3))',
    fg: 'var(--cr-error-700,var(--cr-text-4))',
    dot: 'var(--cr-error,var(--cr-text-5))',
  },
};

interface Props {
  /** SSR-seeded campaign list (newest first). */
  boosts: BoostListItem[];
  /** SSR-seeded KPI aggregates, or null when the stats read failed. */
  stats: BoostStatsView | null;
  /** SSR-seeded ads wallet, or null when the read failed (inline strip). */
  wallet: WalletView | null;
  /** Viewer display name for the inline top-up checkout-sheet prefill. */
  viewerName: string;
  /** Live pricing levers (top-up presets/min + boost min budget), or null. */
  pricing: ConnectPricingView | null;
  /** The caller's boostable items + intents for the quick-start, or null. */
  boostable: BoostableSummary | null;
  /**
   * Optional `?boost=<id>` from the URL: open the results drawer for this boost
   * on mount (post-launch redirect + deep links land here). Resolved against the
   * loaded list first, then a getBoost fetch if the row is absent.
   */
  initialBoostId?: string;
}

export default function BoostsManagerScreen({
  boosts: initialBoosts,
  stats,
  wallet,
  viewerName,
  pricing,
  boostable,
  initialBoostId,
}: Props) {
  const t = useTranslations('connect.boosts.mgr');
  const tRef = useTranslations('connect.referrals');
  const router = useRouter();
  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
  // `message` (toasts) + `announce` (a11y live region) were only used by the
  // disabled row pause/resume/cancel handlers. Kept `announcer` (the live-region
  // node) mounted. Re-enable these with the handlers below.
  // const { message } = AntApp.useApp();
  // const { announce } = useAnnouncer();
  const { announcer } = useAnnouncer();

  const [boosts, setBoosts] = useState<BoostListItem[]>(initialBoosts);
  const [tab, setTab] = useState<TabKey>('active');
  // Local-dismiss for the referral nudge card. Resets on remount; upgrade to
  // localStorage persistence later if retention data shows it is needed.
  const [referralNudgeDismissed, setReferralNudgeDismissed] = useState(false);
  // The wall-clock captured when the current list was loaded. Held as state (set
  // on mount + every refresh) so the days-left + schedule mapping stay stable
  // across rows and refresh whenever the data does - without an impure
  // `Date.now()` read during render.
  const [loadedAtMs, setLoadedAtMs] = useState(() => Date.now());

  // Results slide-over: the id of the boost whose report is open (null = closed).
  // Seeded from the `?boost=` URL param so a post-launch redirect / deep link
  // opens the drawer on the list. Cross-module: BoostResultsDrawer hosts the card.
  const [openBoostId, setOpenBoostId] = useState<string | null>(initialBoostId ?? null);
  // A row fetched on demand for `?boost=<id>` when it is not in the loaded list
  // (e.g. a just-launched boost the SSR list predates). Held separately so it
  // does not pollute the tabbed list; the drawer prefers the live list row.
  const [fallbackBoost, setFallbackBoost] = useState<BoostListItem | null>(null);

  const grouped = useMemo(() => {
    const buckets: Record<TabKey, BoostListItem[]> = {
      active: [],
      scheduled: [],
      completed: [],
      drafts: [],
    };
    for (const b of boosts) buckets[tabForBoost(b, loadedAtMs)].push(b);
    return buckets;
  }, [boosts, loadedAtMs]);

  /**
   * Refetch the list so status / metrics reconcile to the server truth. Used by
   * the `?boost=` deep-link path (a just-launched boost the SSR list predates).
   * router.refresh() re-runs the Server Component, but we also pull the fresh
   * list directly so the client state updates without a full re-mount.
   */
  const refresh = useCallback(async () => {
    const res = await listBoosts();
    if (res.ok) {
      setBoosts(res.data);
      setLoadedAtMs(Date.now());
    }
    router.refresh();
  }, [router]);

  // The boost the drawer shows: prefer the live list row (so it reconciles after
  // a refetch), else the on-demand fallback fetched for a `?boost=` deep link.
  const openBoost = useMemo<BoostListItem | null>(() => {
    if (!openBoostId) return null;
    return (
      boosts.find((b) => b.id === openBoostId) ??
      (fallbackBoost?.id === openBoostId ? fallbackBoost : null)
    );
  }, [openBoostId, boosts, fallbackBoost]);

  // `?boost=<id>` target not in the loaded list (e.g. a just-launched boost the
  // SSR list predates): fetch it once and hold it as the fallback. getBoost is
  // JWT-scoped on the backend, so a missing/foreign id resolves to no drawer
  // rather than a leak. Maps the BoostStatus to the card-relevant BoostListItem
  // fields (kind/source ids are not needed by the report card).
  useEffect(() => {
    if (!openBoostId) return;
    if (boosts.some((b) => b.id === openBoostId)) return;
    if (fallbackBoost?.id === openBoostId) return;
    let cancelled = false;
    void getBoost(openBoostId).then((res) => {
      if (cancelled || !res.ok) return;
      const s = res.data;
      // Synthetic row carrying only what the report card reads; the remaining
      // list-row fields get inert defaults (the drawer never shows them).
      setFallbackBoost({
        id: openBoostId,
        kind: 'boost_post',
        objective: s.objective,
        status: s.status as BoostListItem['status'],
        moderationReason: s.moderationReason,
        totalBudget: s.spend + s.budgetRemaining,
        budgetSpent: s.spend,
        startAt: '',
        endAt: '',
        sourceListingId: null,
        sourceJobId: null,
        sourcePostId: null,
        sourceRfqId: null,
        sourceProfileUserId: null,
        sourceTitle: null,
        sourceImage: null,
        impressions: s.reach,
        clicks: s.clicks,
        spend: s.spend,
        ctr: 0,
        costPerClick: 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [openBoostId, boosts, fallbackBoost]);

  // BOOST-UI (owner 2026-06-19): the per-row "View report" button is removed
  // (redundant; the row already shows the same metrics). The drawer now opens
  // ONLY via the `?boost=` deep link (post-launch redirect / shared link), which
  // is driven by initialBoostId -> openBoostId, not by this callback. Commented
  // (not deleted) so re-adding the button only needs this + the ReportButton back.
  // const onReport = useCallback((id: string) => setOpenBoostId(id), []);

  // Close the drawer. Also clears any `?boost=` from the URL so a reload / share
  // does not re-open it, without a full navigation (shallow replace).
  const onCloseDrawer = useCallback(() => {
    setOpenBoostId(null);
    if (typeof window !== 'undefined' && window.location.search.includes('boost=')) {
      window.history.replaceState(null, '', '/connect/boosts');
    }
  }, []);

  // A pause/resume/cancel inside the drawer succeeded: refetch so the row + the
  // drawer reconcile (cancel also flips the boost to Completed). The drawer fires
  // onClose itself on a terminal cancel.
  const onDrawerChanged = useCallback(() => {
    void refresh();
  }, [refresh]);

  // Boosts now go live instantly, so nothing schedules; the Scheduled tab only
  // lingers for legacy in-review boosts. Hide it when empty so the common case
  // shows just Active / Completed / Drafts. The other three are always visible.
  const visibleTabs: TabKey[] = TAB_ORDER.filter(
    (key) => key !== 'scheduled' || grouped.scheduled.length > 0,
  );

  // Guard the selected tab: if it just became hidden (e.g. the last scheduled
  // boost was cancelled while viewing it), fall back to Active. Adjusting state
  // during render is React's recommended alternative to a setState-in-effect.
  if (!visibleTabs.includes(tab)) setTab('active');

  const tabs: Array<{ key: TabKey; label: string; count: number }> = visibleTabs.map((key) => ({
    key,
    label: t(`tab.${key}`),
    count: grouped[key].length,
  }));

  const rows = grouped[tab];

  return (
    <ConnectPage>
      {announcer}

      {/* No separate "Wallet and credits" button here: the inline wallet strip
          below owns balance + Add-credits (and the full /connect/boost/wallet
          page is still reachable directly), so we don't show two entry points. */}
      <header className="mb-5">
        <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('title')}
        </h1>
        <p
          className="m-0 mt-1 max-w-[620px] text-[13px] leading-relaxed"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('lede')}
        </p>
      </header>

      {/* Inline wallet (balance + reserved + Add-credits slide-over) so a routine
          top-up needs no trip to the full wallet page. Low-balance nudge keyed to
          the minimum boost budget. */}
      <HubWalletStrip
        wallet={wallet}
        viewerName={viewerName}
        presets={pricing?.walletTopupPresets}
        minTopup={pricing?.walletTopupMinAmount}
        minBoostBudget={pricing?.boostMinBudget}
      />

      {/* Referral nudge card. Gate: REFERRAL_ENABLED (dark by default).
          Keys: connect.referrals.boostNudge.{title,body,cta} (Phase 9).
          Cross-module: referral-gate.ts / app/connect/referrals/page.tsx.
          Watch: dismissal is local state only; no server or localStorage write. */}
      {REFERRAL_ENABLED && !referralNudgeDismissed && (
        <div
          role="region"
          aria-label={tRef('boostNudge.title')}
          className="mb-4 flex items-center justify-between gap-3 rounded-[var(--cr-radius-md)] px-4 py-3"
          style={{
            background: 'var(--cr-primary-light)',
            border: '1px solid var(--cr-primary-border)',
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-semibold" style={{ color: 'var(--cr-primary)' }}>
              {tRef('boostNudge.title')}
            </p>
            <p className="m-0 mt-0.5 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
              {tRef('boostNudge.body')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/connect/referrals"
              className="inline-flex h-8 items-center rounded-[var(--cr-radius-md)] px-3 text-[12.5px] font-semibold no-underline"
              style={{
                background: 'var(--cr-primary)',
                color: 'var(--cr-primary-on)',
              }}
            >
              {tRef('boostNudge.cta')}
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setReferralNudgeDismissed(true)}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[18px] leading-none"
              style={{ color: 'var(--cr-text-4)' }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Dismissible "how boosting works" explainer; prominent for a new user,
          collapses to a link once there is any boost activity. */}
      <BoostsHowItWorks hasActivity={boosts.length > 0} />

      {/* "Boost something" quick-start: only the caller's own eligible listings +
          jobs (+ intent nudges). The empty-state CTA scrolls here. */}
      {boostable && <BoostQuickStart data={boostable} />}

      {/* KPI strip - REAL aggregates. No inquiry KPI (not attributed). */}
      <KpiStrip className="mb-5">
        <KpiCard
          icon={Rocket}
          tone="green"
          value={stats?.activeCount ?? 0}
          label={t('kpi.active')}
        />
        <KpiCard
          icon={Eye}
          tone="indigo"
          value={stats?.reach30d ?? 0}
          displayValue={formatCompactCount(stats?.reach30d ?? 0)}
          label={t('kpi.reach30d')}
        />
        <KpiCard
          icon={MousePointerClick}
          tone="amber"
          value={stats?.clicks30d ?? 0}
          displayValue={formatCompactCount(stats?.clicks30d ?? 0)}
          label={t('kpi.clicks30d')}
        />
        <KpiCard
          icon={Receipt}
          tone="gold"
          value={stats?.spendThisMonth ?? 0}
          displayValue={formatRupees(stats?.spendThisMonth ?? 0)}
          label={t('kpi.spendThisMonth')}
        />
      </KpiStrip>

      {!stats && (
        <p
          role="status"
          className="mb-4 rounded-[var(--cr-radius-md)] px-3.5 py-2.5 text-[12.5px]"
          style={{
            background: 'var(--cr-warning-bg)',
            color: 'var(--cr-warning)',
            border: '1px solid var(--cr-warning-border,var(--cr-border))',
          }}
        >
          {t('statsUnavailable')}
        </p>
      )}

      {/* Underline tabbar (matches the Jobs board pattern). */}
      {/* Tablist scrolls horizontally on narrow screens but hides the scrollbar
          chrome (matches the Jobs board pattern: scrollbar-width none + the
          webkit pseudo). No scrollbar shows on desktop when the four tabs fit. */}
      <div
        role="tablist"
        aria-label={t('tabsAria')}
        className="mb-5 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ borderBottom: '1px solid var(--cr-divider)' }}
      >
        {tabs.map((tb) => {
          const active = tab === tb.key;
          const Icon = TAB_ICON[tb.key];
          return (
            <button
              key={tb.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(tb.key)}
              className="inline-flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold"
              style={{
                color: active ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                borderBottom: `2px solid ${active ? 'var(--cr-primary)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              <Icon size={15} aria-hidden style={{ opacity: 0.85 }} />
              {tb.label}
              <span
                className="rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                style={{
                  background: active ? 'var(--cr-primary-light)' : 'var(--cr-surface-3)',
                  color: active ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                }}
              >
                {tb.count}
              </span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyForTab tab={tab} t={t} hasAny={boosts.length > 0} />
      ) : (
        <ul
          className="m-0 grid list-none gap-3 p-0"
          aria-label={t(`tab.${tab}`)}
          aria-live="polite"
        >
          {/* BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
              The row's pause/resume/cancel props (pending / onPause / onResume /
              onCancel) are not passed -- those callbacks + the in-flight pendingId
              state are commented out in this component. The row is read-only
              ("View report" only). Re-add these props + the handlers below to
              re-enable. */}
          {rows.map((b) => (
            <li key={b.id}>
              <BoostRow
                boost={b}
                nowMs={loadedAtMs}
                // pending={pendingId === b.id}
                // onPause={() => void onPause(b)}
                // onResume={() => void onResume(b)}
                // onCancel={() => void onCancel(b)}
                // BOOST-UI (owner 2026-06-19): the per-row "View report" button is
                // removed (redundant; metrics are already in the row). The drawer
                // now opens ONLY via the `?boost=` deep link (initialBoostId), so
                // the row no longer needs an onReport callback. Commented (not
                // deleted) to restore the button.
                // onReport={() => onReport(b.id)}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Results slide-over: opened by "View report" on a row or a `?boost=`
          deep link. Mutations inside it refetch the list (onDrawerChanged) so the
          row + drawer reconcile; a terminal cancel also closes it. */}
      <BoostResultsDrawer
        open={openBoostId !== null}
        boost={openBoost}
        onClose={onCloseDrawer}
        onChanged={onDrawerChanged}
      />
    </ConnectPage>
  );
}

type Translate = ReturnType<typeof useTranslations>;

/**
 * The row thumbnail: the boosted item's image when the BE resolved one, else the
 * tinted kind icon (the prior generic visual). Sized as the old 48px square so
 * the row layout is unchanged. Decorative (aria-hidden) - the adjacent title /
 * Link carries the accessible name. Reuses the Connect `<img>` thumbnail pattern.
 */
function RowThumb({
  boost,
  visual,
  KindIcon,
}: {
  boost: BoostListItem;
  visual: KindVisual;
  KindIcon: LucideIcon;
}) {
  if (boost.sourceImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded thumbnail of unknown dimensions; established Connect pattern is <img> + object-cover, no LCP concern in this list.
      <img
        src={boost.sourceImage}
        alt=""
        aria-hidden
        className="h-12 w-12 shrink-0 rounded-[var(--cr-radius-md)] object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--cr-radius-md)]"
      style={{
        background: visual.gold ? 'var(--cr-accent-light)' : 'var(--cr-primary-light)',
        color: visual.gold ? 'var(--cr-gold-700)' : 'var(--cr-primary)',
      }}
    >
      <KindIcon size={22} />
    </span>
  );
}

function BoostRow({
  boost,
  nowMs,
  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
  // pending,
  // onPause,
  // onResume,
  // onCancel,
  // BOOST-UI (owner 2026-06-19): per-row "View report" button removed (redundant).
  // The drawer opens via the `?boost=` deep link only now. Commented to restore.
  // onReport,
  t,
}: {
  boost: BoostListItem;
  nowMs: number;
  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): row pause/resume/cancel props are disabled. Commented (not deleted) to re-enable later.
  // pending: boolean;
  // onPause: () => void;
  // onResume: () => void;
  // onCancel: () => void;
  // BOOST-UI (owner 2026-06-19): onReport disabled with the per-row button. Commented to restore.
  // onReport: () => void;
  t: Translate;
}) {
  const visual = KIND_VISUAL[boost.kind] ?? KIND_VISUAL.boost_post;
  const KindIcon = visual.icon;
  const pill = PILL_TONE[boost.status] ?? PILL_TONE.draft;

  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
  // spentPct only drove the now-hidden spend progress bar.
  // const spentPct =
  //   boost.totalBudget > 0
  //     ? Math.min(100, Math.round((boost.budgetSpent / boost.totalBudget) * 100))
  //     : 0;
  const isDone = boost.status === 'completed';
  const days = daysLeft(boost.endAt, nowMs);

  // The kind kicker label ("LISTING BOOST" etc.), by kind. Now covers every
  // kind (profile + RFQ boosts were falling through to the post label before).
  const kickKey = KIND_KICK_KEY[boost.kind] ?? 'kind.post';

  // What is actually being boosted: the BE-resolved item name (sourceTitle) is
  // the row's primary title; the objective ("More reach") drops to a muted
  // sub-line. When the source is gone (null title) we fall back to the
  // kind/objective label so the row still reads sensibly.
  const objectiveLabel = t(`objective.${boost.objective}` as Parameters<Translate>[0]);
  const itemTitle = boost.sourceTitle ?? objectiveLabel;
  // Deep-link target for the boosted item (null = render the title as plain text,
  // never a dead link). Also suppressed when the source name is gone.
  const href = boost.sourceTitle ? boostTargetHref(boost) : null;

  const statsCells: Array<{ key: string; value: string; muted?: boolean; good?: boolean }> = [
    { key: 'reach', value: formatCount(boost.impressions) },
    { key: 'clicks', value: formatCount(boost.clicks), good: boost.clicks > 0 },
    { key: 'spend', value: formatRupees(boost.spend) },
    { key: 'ctr', value: formatPct(boost.ctr), muted: boost.impressions === 0 },
    { key: 'cpc', value: formatRupees(boost.costPerClick), muted: boost.clicks === 0 },
  ];

  return (
    <article
      className="rounded-[var(--cr-radius-lg)] p-4 transition-shadow"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <div className="flex flex-wrap items-start gap-4">
        {/* Thumb: the boosted item's image when the BE resolved one, else the
            kind icon. Wrapped in a Link to the item's detail page when there is
            a resolvable target; a Link never wraps the row's action buttons. */}
        {href ? (
          <Link
            href={href}
            aria-label={t('action.viewItem', { title: itemTitle })}
            className="shrink-0 no-underline"
          >
            <RowThumb boost={boost} visual={visual} KindIcon={KindIcon} />
          </Link>
        ) : (
          <RowThumb boost={boost} visual={visual} KindIcon={KindIcon} />
        )}

        {/* Target + objective + spend bar. flexBasis 0 (was 240) so on a phone the
            column shrinks with the row instead of forcing a 240px floor that squeezes
            the thumbnail + actions; flex-1 still lets it take the remaining width. */}
        <div className="min-w-0 flex-1" style={{ flexBasis: 0 }}>
          <span
            className="text-[10px] font-bold tracking-[0.05em] uppercase"
            style={{ color: 'var(--cr-gold-700)' }}
          >
            {t(kickKey)}
          </span>
          {/* The item name is the bold title; it links to the detail page when a
              target resolves, otherwise it is plain non-clickable text. */}
          {href ? (
            <Link
              href={href}
              aria-label={t('action.viewItem', { title: itemTitle })}
              className="block no-underline"
            >
              <h3
                className="m-0 mt-1 truncate text-[14px] font-bold hover:underline"
                style={{ color: 'var(--cr-text)' }}
              >
                {itemTitle}
              </h3>
            </Link>
          ) : (
            <h3
              className="m-0 mt-1 truncate text-[14px] font-bold"
              style={{ color: 'var(--cr-text)' }}
            >
              {itemTitle}
            </h3>
          )}
          {/* Objective demoted to a muted descriptor below the item name. */}
          <p className="m-0 mt-0.5 truncate text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            {objectiveLabel}
          </p>

          {/* Remaining-time only: the user sees how long the boost runs, not the
              money. BOOST-USER-CONTROLS-OFF (owner 2026-06-19): the "spent of
              budget" line + the spend progress bar are hidden from users (spend
              stays visible to ADMINS only); they are commented out (not deleted)
              just below so they can be switched back on. */}
          <div className="mt-2.5 max-w-[300px]">
            <div className="text-[11px]">
              <span style={{ color: 'var(--cr-text-5)' }}>
                {isDone
                  ? t('finished')
                  : days > 0
                    ? t('daysLeft', { count: days })
                    : t('endingSoon')}
              </span>
            </div>
            {/* BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later. */}
            {/* <span style={{ color: 'var(--cr-text-4)' }}>
              {t('spentOfBudget', {
                spent: formatRupees(boost.budgetSpent),
                budget: formatRupees(boost.totalBudget),
              })}
            </span>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full"
              style={{ background: 'var(--cr-surface-3)' }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={spentPct}
              aria-label={t('spendProgressAria')}
            >
              <i
                className="block h-full rounded-full"
                style={{
                  width: `${spentPct}%`,
                  background: isDone ? 'var(--cr-text-5)' : 'var(--cr-primary)',
                }}
              />
            </div> */}
          </div>

          {/* Take-down reason (publish-then-moderate): a rejected boost taken down
              by an admin carries a reason the advertiser sees here, alongside the
              Rejected pill. Source: BE BoostListItem.moderationReason. */}
          {boost.moderationReason && (
            <p
              className="m-0 mt-2 max-w-[300px] text-[11.5px] leading-relaxed"
              style={{ color: 'var(--cr-error-700,var(--cr-text-4))' }}
            >
              {t('takenDown', { reason: boost.moderationReason })}
            </p>
          )}
        </div>

        {/* REAL metrics: Reach / Clicks / Spend / CTR / CPC. No inquiries. */}
        <dl className="m-0 flex flex-wrap gap-x-5 gap-y-2">
          {statsCells.map((cell) => (
            <div key={cell.key} className="text-center">
              <dd
                className="m-0 text-[16px] leading-none font-extrabold tabular-nums"
                style={{
                  color: cell.muted
                    ? 'var(--cr-text-5)'
                    : cell.good
                      ? 'var(--cr-success)'
                      : 'var(--cr-text)',
                }}
              >
                {cell.value}
              </dd>
              <dt
                className="mt-1 text-[9.5px] font-semibold tracking-[0.04em] uppercase"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {t(`stat.${cell.key}`)}
              </dt>
            </div>
          ))}
        </dl>

        {/* Status pill + actions */}
        <div className="ml-auto flex shrink-0 flex-col items-end gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
            style={{ background: pill.bg, color: pill.fg }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: pill.dot }}
            />
            {t(`status.${boost.status}`)}
          </span>
          <RowActions
            boost={boost}
            // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
            // pending={pending}
            // onPause={onPause}
            // onResume={onResume}
            // onCancel={onCancel}
            // BOOST-UI (owner 2026-06-19): per-row "View report" button removed; no onReport. Commented to restore.
            // onReport={onReport}
            t={t}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * Per-row actions. The user view is READ-ONLY for a live boost:
 *   - active / paused     -> View report only
 *   - completed           -> View report + Boost again (deep-links the composer)
 *   - draft / rejected    -> Finish setup / Edit and resubmit (deep-links composer)
 *   - pending_review      -> View report only
 *
 * BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel +
 * spend hidden from users; admin keeps control. The Pause / Resume / Cancel
 * controls are commented out (not deleted) below so they can be re-enabled. Only
 * an admin controls a live boost (admin take-down is a separate path, untouched).
 */
function RowActions({
  boost,
  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): pause/resume/cancel props disabled. Commented (not deleted) to re-enable later.
  // pending,
  // onPause,
  // onResume,
  // onCancel,
  // BOOST-UI (owner 2026-06-19): per-row "View report" button removed; onReport no
  // longer consumed by any branch. Commented (not deleted) to restore.
  // onReport,
  t,
}: {
  boost: BoostListItem;
  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): pause/resume/cancel props disabled. Commented (not deleted) to re-enable later.
  // pending: boolean;
  // onPause: () => void;
  // onResume: () => void;
  // onCancel: () => void;
  // BOOST-UI (owner 2026-06-19): onReport disabled with the per-row button. Commented to restore.
  // onReport: () => void;
  t: Translate;
}) {
  // The composer entry for "Boost again" / "Finish setup" - only meaningful when
  // we know the target. A listing, job, or post target deep-links its composer;
  // without a resolvable source id we render no re-boost action (never a dead
  // link). sourcePostId is surfaced by the backend list mapper alongside the
  // listing/job source ids.
  const composerHref =
    boost.kind === 'boost_listing' && boost.sourceListingId
      ? `/connect/boost/listing/${boost.sourceListingId}`
      : boost.kind === 'boost_job' && boost.sourceJobId
        ? `/connect/boost/job/${boost.sourceJobId}`
        : boost.kind === 'boost_post' && boost.sourcePostId
          ? `/connect/boost/post/${boost.sourcePostId}`
          : null;

  if (boost.status === 'active' || boost.status === 'paused') {
    // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
    // The user view is read-only now. The Pause / Resume button + the Cancel
    // control are commented out below.
    // const paused = boost.status === 'paused';
    // BOOST-UI (owner 2026-06-19): the per-row "View report" button is redundant
    // (the row already shows Reach/Clicks/Spend/CTR/CPC + status + days-left, and
    // the drawer shows the SAME metrics). Removed; the only unique drawer value
    // (the admin take-down reason) now shows inline in the row above. The drawer +
    // the post-launch `?boost=` deep link still work. An active/paused row now has
    // no user action, so return null. Re-add <ReportButton onReport={onReport} t={t} />
    // (and wrap in the action row) to restore.
    return null;
  }

  if (boost.status === 'completed') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {/* BOOST-UI (owner 2026-06-19): redundant "View report" button removed
            (metrics already in the row; drawer/deep-link unchanged). Commented
            (not deleted) to restore. */}
        {/* <ReportButton onReport={onReport} t={t} /> */}
        {composerHref && (
          <Link
            href={composerHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-2.5 text-[12.5px] font-semibold no-underline"
            style={{
              border: '1px solid var(--cr-primary)',
              background: 'var(--cr-primary)',
              color: 'var(--cr-primary-on)',
            }}
          >
            <Rocket size={14} aria-hidden /> {t('action.boostAgain')}
          </Link>
        )}
      </div>
    );
  }

  if (boost.status === 'draft' || boost.status === 'rejected') {
    if (!composerHref) {
      // No resolvable source target (missing source id) - render nothing rather
      // than a dead placeholder action.
      return null;
    }
    return (
      <Link
        href={composerHref}
        className="inline-flex h-8 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-2.5 text-[12.5px] font-semibold no-underline"
        style={{
          border: '1px solid var(--cr-primary)',
          background: 'var(--cr-primary)',
          color: 'var(--cr-primary-on)',
        }}
      >
        <Pencil size={14} aria-hidden />{' '}
        {boost.status === 'rejected' ? t('action.editAndResubmit') : t('action.finishSetup')}
      </Link>
    );
  }

  // pending_review (scheduled): read-only for the user now. BOOST-USER-CONTROLS-OFF
  // (owner 2026-06-19) -- the Cancel control is disabled (commented out below);
  // an admin still controls the boost.
  if (boost.status === 'pending_review') {
    // BOOST-UI (owner 2026-06-19): redundant per-row "View report" button removed
    // (see the active/paused branch). With the Cancel control already off, a
    // pending_review row has no user action, so return null. The drawer + the
    // `?boost=` deep link still work. Re-add <ReportButton .../> to restore.
    // {/* <CancelAction pending={pending} onCancel={onCancel} t={t} /> */}
    return null;
  }

  // Any other non-terminal state: nothing to mutate.
  // BOOST-UI (owner 2026-06-19): redundant per-row "View report" button removed.
  // return <ReportButton onReport={onReport} t={t} />;
  return null;
}

// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel + spend hidden from users; admin keeps control. Commented (not deleted) to re-enable later.
// CancelAction is the user-facing "Cancel boost" confirm control; it is disabled
// (no longer rendered by RowActions). Commented out (not deleted) so it returns
// with the controls. Used Popconfirm + XCircle (both now off in this file).
//
// /**
//  * Subtle, danger-tinted "Cancel" control wrapped in a confirm. Confirming stops
//  * the boost, refunds the unused budget, and frees the source to boost again.
//  * Used for active / paused / pending_review rows. AntD v6 Popconfirm.
//  */
// function CancelAction({
//   pending,
//   onCancel,
//   t,
// }: {
//   pending: boolean;
//   onCancel: () => void;
//   t: Translate;
// }) {
//   return (
//     <Popconfirm
//       title={t('action.cancel')}
//       description={t('cancelConfirm')}
//       okText={t('action.cancel')}
//       cancelText={t('cancelKeep')}
//       okButtonProps={{ danger: true, disabled: pending }}
//       onConfirm={onCancel}
//     >
//       <button
//         type="button"
//         disabled={pending}
//         aria-busy={pending}
//         aria-label={t('action.cancel')}
//         className="inline-flex h-8 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-2.5 text-[12.5px] font-semibold"
//         style={{
//           border: '1px solid var(--cr-error,var(--cr-border))',
//           background: 'var(--cr-surface)',
//           color: 'var(--cr-error-700,var(--cr-text-2))',
//           cursor: pending ? 'not-allowed' : 'pointer',
//           opacity: pending ? 0.6 : 1,
//         }}
//       >
//         <XCircle size={14} aria-hidden /> {t('action.cancel')}
//       </button>
//     </Popconfirm>
//   );
// }

// BOOST-UI (owner 2026-06-19): the per-row "View report" button is removed. It was
// redundant -- the row already shows the same Reach / Clicks / Spend / CTR / CPC
// metrics, and the drawer showed nothing extra except the admin take-down reason,
// which the row now surfaces inline (see BoostRow's moderationReason block). The
// BoostResultsDrawer + the post-launch `?boost=` deep link are untouched. The
// component below is commented out (not deleted) so re-adding the button only
// needs this + the onReport plumbing + the BarChart3 import restored.
//
// /**
//  * "View report" - opens the results slide-over for this row (was a link to the
//  * standalone /connect/boost/results/:id page). Cross-module: onReport -> screen
//  * openBoostId -> BoostResultsDrawer.
//  */
// function ReportButton({ onReport, t }: { onReport: () => void; t: Translate }) {
//   return (
//     <button
//       type="button"
//       onClick={onReport}
//       className="inline-flex h-8 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-2.5 text-[12.5px] font-semibold"
//       style={{
//         border: '1px solid var(--cr-border)',
//         background: 'var(--cr-surface)',
//         color: 'var(--cr-text-2)',
//         cursor: 'pointer',
//       }}
//     >
//       <BarChart3 size={14} aria-hidden /> {t('action.viewReport')}
//     </button>
//   );
// }

function EmptyForTab({ tab, t, hasAny }: { tab: TabKey; t: Translate; hasAny: boolean }) {
  // The global empty state (no campaigns at all) gets a richer explainer; the
  // per-tab empties are quiet "nothing here yet" notes so a seller with active
  // boosts is not nagged on the Drafts tab.
  if (tab === 'active' && !hasAny) {
    // Active CTA (not a passive "no boosts yet"): "Start a boost" scrolls to the
    // quick-start section above, where the caller's own boostable items live.
    return (
      <ConnectEmptyState
        icon={<Rocket size={24} aria-hidden />}
        title={t('empty.allTitle')}
        description={t('empty.allBody')}
        primaryAction={{ label: t('empty.startCta'), href: '#boost-quick-start' }}
      />
    );
  }
  const Icon = TAB_ICON[tab];
  return (
    <ConnectEmptyState
      variant="inline"
      icon={tab === 'completed' ? <Trophy size={22} aria-hidden /> : <Icon size={22} aria-hidden />}
      title={t(`empty.${tab}Title`)}
      description={t(`empty.${tab}Body`)}
    />
  );
}
