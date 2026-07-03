'use client';

/**
 * BoostComposer - the Boost configurator UI, restyled to the canonical
 * `connect-boost` prototype (step cards + sticky checkout rail).
 *
 * Rendered by /connect/boost/listing/[listingId], /connect/boost/job/[jobId]
 * and /connect/boost/post/[postId] (Server Components) after the owner-guard
 * passes. Handles the full
 * compose-to-launch flow:
 *   goal -> audience targeting -> daily budget -> duration -> wallet checkout.
 *
 * Connect is PERSON-CENTRIC. No workspaceId, no advertiserId, no <Can>.
 * The advertiser identity is derived from the JWT on the backend.
 *
 * HONEST DATA CONTRACT:
 *   - Audience size is REAL: `estimateAudience(targeting)` returns the live
 *     count of members who match the targeting. Labelled "N members match".
 *   - Reach + inquiry/application bands are clearly-labelled ESTIMATES, derived
 *     from the real audience + the chosen daily budget + duration by the pure
 *     `buildBoostEstimate(...)` helper (never recomputed inline here).
 *   - Checkout is the ads WALLET (credits), not a per-boost GST invoice: the
 *     order total is `daily x days` credits, compared to the wallet balance,
 *     with a Razorpay top-up affordance when short.
 *
 * MONEY UNIT: all budget / balance values are WHOLE CREDITS (rupees). The
 * budget chips and the custom field are the DAILY budget; the backend contract
 * takes a TOTAL, so we send `daily x days`. No paise conversion.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Eye,
  FileText,
  ImageOff,
  Info,
  Loader2,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Package,
  Receipt,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import useAnnouncer from '@/components/connect/useAnnouncer';
import { ConnectPage } from '@/components/connect';
import { categoryLabel } from '../search.types';
import { formatRupees } from '../marketplace/format';
import {
  createListingBoost,
  createJobBoost,
  createPostBoost,
  createOpenToWorkBoost,
  createHiringBoost,
  createRfqBoost,
  estimateAudience,
} from './ads.actions';
import {
  purchaseWalletTopup,
  CheckoutDismissedError,
  CheckoutFailedError,
} from './wallet-topup-checkout';
import {
  buildListingBoostInput,
  buildJobBoostInput,
  buildPostBoostInput,
  buildOpenToWorkBoostInput,
  buildHiringBoostInput,
  buildRfqBoostInput,
  parseBudgetInput,
  parseDurationInput,
  spendableCredits,
  BOOST_DURATION_PRESETS,
  BOOST_DURATION_MIN,
  BOOST_DURATION_MAX,
  BOOST_MIN_BUDGET,
  type BoostFormState,
  type BoostObjective,
} from './boost-composer-logic';
import { buildBoostEstimate } from './boost-estimate.helpers';
import { BOOST_LAUNCH_ENABLED, WALLET_TOPUP_ENABLED } from './checkout-gate';
// Additive boost funnel telemetry (flow_started on mount + submitted on launch).
// Keyless-safe: trackEvent no-ops without analytics keys. Catalog is read-only.
import { ConnectEvents, trackEvent, bucketRupees } from '@/lib/analytics-events';
import { BOOST_ROLES } from './boost-targeting';
import AudienceGeoTradeFields from './AudienceGeoTradeFields';
import type {
  ListingBoostTarget,
  JobBoostTarget,
  PostBoostTarget,
  ProfileBoostTarget,
  RfqBoostTarget,
  ReachEstimate,
  WalletView,
} from './ads.types';
import type { ConnectOnboardingIntent } from '../profile.types';

// ---------------------------------------------------------------------------
// Props + local types
// ---------------------------------------------------------------------------

interface BoostComposerProps {
  /**
   * The boost target. Exactly one of these is set:
   *   - listing:    a marketplace listing (objectives reach / inquiries).
   *   - job:        a job opening (objectives reach / applications).
   *   - post:       a regular feed post (objectives reach / profile_visits).
   *   - openToWork: the caller's own profile, promoted to employers
   *                 (objectives reach / profile_visits, feed_promoted_profile slot).
   *   - hiring:     the caller's own profile, promoted to workers (same objectives).
   *   - rfq:        a request-for-quote, promoted to suppliers (reach / quotes,
   *                 rfq_board slot).
   * The eligibility/ownership gate lives in the route Server Component; the
   * backend re-enforces it on submit.
   */
  listing?: ListingBoostTarget;
  job?: JobBoostTarget;
  post?: PostBoostTarget;
  openToWork?: ProfileBoostTarget;
  hiring?: ProfileBoostTarget;
  rfq?: RfqBoostTarget;
  wallet: WalletView | null;
  /** Viewer display name, used to prefill the Razorpay top-up sheet. Optional. */
  viewerName?: string;
}

/** The kind of object being boosted - drives objective options, preview chrome,
 *  and the per-kind submit action. Derived once from which target prop is set. */
type BoostTargetKind = 'listing' | 'job' | 'post' | 'open_to_work' | 'hiring' | 'rfq';

type EstimateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: ReachEstimate }
  | { status: 'error' };

/** Daily-budget quick-pick amounts in whole credits (prototype: 150/300/600). */
const DAILY_BUDGET_PRESETS = [150, 300, 600] as const;

// Two shared switches from ./checkout-gate (imported at the top): BOOST_LAUNCH_ENABLED
// (the real "Launch boost" button, ON now - spends wallet credits) and
// WALLET_TOPUP_ENABLED (self-serve "Add credits", OFF until the payment gateway
// lands - credits are added by the team/admin for now). Same source drives the
// composer, the standalone wallet page, and the Boosts-hub top-up drawer (no
// drift). See checkout-gate.ts for the full rationale.

// ---------------------------------------------------------------------------
// Form state. `budget` here is the DAILY budget (the prototype model); the
// backend takes a TOTAL, so submit sends `daily x days`.
// ---------------------------------------------------------------------------

const DEFAULT_STATE: BoostFormState = {
  objective: 'reach',
  roles: [],
  sectors: [],
  districts: [],
  budget: 300,
  days: 7,
  spotlight: false,
};

type FormAction =
  | { type: 'SET_OBJECTIVE'; value: BoostObjective }
  | { type: 'SET_ROLE_ONLY'; value: string }
  | { type: 'SET_ROLE_ALL' }
  | { type: 'SET_SECTORS'; value: string[] }
  | { type: 'SET_DISTRICTS'; value: string[] }
  | { type: 'SET_BUDGET'; value: number }
  | { type: 'SET_DAYS'; value: number }
  | { type: 'SET_SPOTLIGHT'; value: boolean };

function formReducer(state: BoostFormState, action: FormAction): BoostFormState {
  switch (action.type) {
    case 'SET_OBJECTIVE':
      return { ...state, objective: action.value };
    case 'SET_ROLE_ONLY':
      // "Show to" is a single-select segment: one role replaces the whole set.
      return { ...state, roles: [action.value] };
    case 'SET_ROLE_ALL':
      return { ...state, roles: [] };
    // Location + trade are managed by <AudienceGeoTradeFields>, which owns the
    // selection UI and hands back the full arrays (not per-item toggles).
    case 'SET_SECTORS':
      return { ...state, sectors: action.value };
    case 'SET_DISTRICTS':
      return { ...state, districts: action.value };
    case 'SET_BUDGET':
      return { ...state, budget: action.value };
    case 'SET_DAYS':
      return { ...state, days: action.value };
    case 'SET_SPOTLIGHT':
      return { ...state, spotlight: action.value };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Indian-grouped integer formatter for reach / inquiry / audience counts.
// ---------------------------------------------------------------------------

const COUNT_FMT = new Intl.NumberFormat('en-IN');
function fmtCount(n: number): string {
  return COUNT_FMT.format(Math.round(n));
}

// ---------------------------------------------------------------------------
// BoostComposer
// ---------------------------------------------------------------------------

export default function BoostComposer({
  listing,
  job,
  post,
  openToWork,
  hiring,
  rfq,
  wallet,
  viewerName,
}: BoostComposerProps) {
  // Target-kind discriminator. Exactly one target prop is set; precedence:
  // post -> job -> openToWork -> hiring -> rfq -> listing (default).
  const targetKind: BoostTargetKind = post
    ? 'post'
    : job
      ? 'job'
      : openToWork
        ? 'open_to_work'
        : hiring
          ? 'hiring'
          : rfq
            ? 'rfq'
            : 'listing';
  const isJob = targetKind === 'job';
  const isPost = targetKind === 'post';
  const isProfileBoost = targetKind === 'open_to_work' || targetKind === 'hiring';
  const isRfq = targetKind === 'rfq';
  // The two profile boosts share one preview shape (the caller's own profile).
  const profileTarget = openToWork ?? hiring;
  // RFQ carries an id; profile boosts have none (the backend derives the caller's
  // own profile from the JWT). listing/job/post ids feed their builders.
  const targetId = listing?._id ?? job?._id ?? post?._id ?? rfq?._id ?? '';

  // Per-kind presentational config (icon + i18n keys + the secondary objective +
  // the rail CTA + the back link), centralized so the JSX references one source
  // instead of 6-way ternaries at every site. listing/job/post values reproduce
  // the previously inlined behavior exactly.
  const kindUi: {
    icon: LucideIcon;
    typeKey: string;
    kickerKey: string;
    secondary: BoostObjective;
    ctaKey: string;
    ctaIcon: LucideIcon;
    backHref: string;
  } = (() => {
    switch (targetKind) {
      case 'post':
        return {
          icon: Newspaper,
          typeKey: 'step1.typePost',
          kickerKey: 'step1.kickerPost',
          secondary: 'profile_visits',
          ctaKey: 'rail.previewView',
          ctaIcon: Eye,
          backHref: '/connect/feed',
        };
      case 'job':
        return {
          icon: Briefcase,
          typeKey: 'step1.typeJob',
          kickerKey: 'step1.kickerJob',
          secondary: 'applications',
          ctaKey: 'rail.previewApply',
          ctaIcon: Briefcase,
          backHref: '/connect/jobs',
        };
      case 'open_to_work':
        return {
          icon: UserCheck,
          typeKey: 'step1.typeOpenToWork',
          kickerKey: 'step1.kickerOpenToWork',
          secondary: 'profile_visits',
          ctaKey: 'rail.previewViewProfile',
          ctaIcon: Eye,
          backHref: '/connect/feed',
        };
      case 'hiring':
        return {
          icon: UserPlus,
          typeKey: 'step1.typeHiring',
          kickerKey: 'step1.kickerHiring',
          secondary: 'profile_visits',
          ctaKey: 'rail.previewViewProfile',
          ctaIcon: Eye,
          backHref: '/connect/feed',
        };
      case 'rfq':
        return {
          icon: FileText,
          typeKey: 'step1.typeRfq',
          kickerKey: 'step1.kickerRfq',
          secondary: 'quotes',
          ctaKey: 'rail.previewQuote',
          ctaIcon: MessageCircle,
          backHref: '/connect/rfq',
        };
      default:
        return {
          icon: Package,
          typeKey: 'step1.typeProduct',
          kickerKey: 'step1.kickerProduct',
          secondary: 'inquiries',
          ctaKey: 'rail.previewMessage',
          ctaIcon: MessageCircle,
          backHref: '/connect/marketplace/mine',
        };
    }
  })();

  // Each kind offers reach plus one secondary objective (kindUi.secondary).
  const objectiveOptions = ['reach', kindUi.secondary] as readonly [BoostObjective, BoostObjective];
  // Capitalized aliases so the kind icon can be rendered as a JSX element.
  const KindIcon = kindUi.icon;

  const t = useTranslations('connect.boosts.cfg');
  const tCat = useTranslations('connect.search.listing.category');
  const router = useRouter();
  const { message } = AntApp.useApp();
  const { announce, announcer } = useAnnouncer();

  const [form, dispatch] = useReducer(formReducer, DEFAULT_STATE);
  const [estimate, setEstimate] = useState<EstimateState>({ status: 'idle' });
  const [isPending, startTransition] = useTransition();

  // Local wallet view, seeded from the server prop and refreshed after a
  // successful top-up so the rail balance + affordability update without a
  // full re-mount (router.refresh() then reconciles the rest of the page).
  const [walletView, setWalletView] = useState<WalletView | null>(wallet);
  const [topupPending, setTopupPending] = useState(false);

  // Custom daily-budget input state.
  const [customBudgetRaw, setCustomBudgetRaw] = useState('');
  const [customBudgetMode, setCustomBudgetMode] = useState(false);
  const [customBudgetError, setCustomBudgetError] = useState<
    'empty' | 'not_a_number' | 'below_min' | null
  >(null);

  // Custom duration (days) input state - parity with the custom budget field.
  const [customDurationRaw, setCustomDurationRaw] = useState('');
  const [customDurationMode, setCustomDurationMode] = useState(false);
  const [customDurationError, setCustomDurationError] = useState<
    'empty' | 'not_a_number' | 'out_of_range' | null
  >(null);

  // Stable IDs for a11y wiring.
  const goalHeadingId = useId();
  const audienceHeadingId = useId();
  const roleLabelId = useId();
  const dailyBudgetLabelId = useId();
  const durationLabelId = useId();
  const customBudgetInputId = useId();
  const customBudgetErrorId = useId();
  const customDurationInputId = useId();
  const customDurationErrorId = useId();

  // Stale-response guard for the debounced audience estimate.
  const estimateSeqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Targeting derived from form state (the same fields used for submission).
  // Memoized on the targeting dims only, so its identity is stable across
  // budget / duration / objective changes (which must not refire the estimate).
  const targeting = useMemo(
    () => ({
      roles: form.roles,
      sectors: form.sectors,
      districts: form.districts,
      companySizes: [] as string[],
    }),
    [form.roles, form.sectors, form.districts],
  );

  // Fetch the real audience size for a targeting snapshot, guarded by `seq` so
  // a stale (superseded) response is ignored.
  const runEstimate = useCallback((target: typeof targeting, seq: number) => {
    setEstimate({ status: 'loading' });
    void estimateAudience(target).then((res) => {
      if (estimateSeqRef.current !== seq) return;
      if (res.ok) setEstimate({ status: 'done', data: res.data });
      else setEstimate({ status: 'error' });
    });
  }, []);

  // Debounced audience estimate - fires ~400ms after the last targeting change.
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const seq = ++estimateSeqRef.current;
    debounceTimerRef.current = setTimeout(() => {
      if (estimateSeqRef.current !== seq) return;
      runEstimate(targeting, seq);
    }, 400);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [targeting, runEstimate]);

  const retryEstimate = useCallback(() => {
    const seq = ++estimateSeqRef.current;
    runEstimate(targeting, seq);
  }, [runEstimate, targeting]);

  // Additive funnel telemetry: emit boost flow_started ONCE when the composer
  // mounts (the boost flow has begun). targetKind already maps to the catalog
  // subject union 'post'|'listing'|'job'. Empty deps = fire once per mount.
  // Keyless-safe (trackEvent no-ops without analytics keys).
  useEffect(() => {
    trackEvent(ConnectEvents.boostFlowStarted, { subject: targetKind });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Budget handlers ──────────────────────────────────────────────────────

  const selectPresetBudget = useCallback((amount: number) => {
    dispatch({ type: 'SET_BUDGET', value: amount });
    setCustomBudgetMode(false);
    setCustomBudgetRaw('');
    setCustomBudgetError(null);
  }, []);

  const enterCustomBudget = useCallback(() => {
    setCustomBudgetMode(true);
  }, []);

  const handleCustomBudgetChange = useCallback((raw: string) => {
    setCustomBudgetRaw(raw);
    if (raw.trim() === '') {
      setCustomBudgetError(null);
      return;
    }
    const parsed = parseBudgetInput(raw);
    setCustomBudgetError(parsed.error);
    if (parsed.error === null && parsed.value !== null) {
      dispatch({ type: 'SET_BUDGET', value: parsed.value });
    }
  }, []);

  const customInputInvalid =
    customBudgetMode && customBudgetRaw.trim() !== '' && customBudgetError !== null;

  // ── Duration handlers ─────────────────────────────────────────────────────

  const selectPresetDuration = useCallback((count: number) => {
    dispatch({ type: 'SET_DAYS', value: count });
    setCustomDurationMode(false);
    setCustomDurationRaw('');
    setCustomDurationError(null);
  }, []);

  const enterCustomDuration = useCallback(() => {
    setCustomDurationMode(true);
  }, []);

  const handleCustomDurationChange = useCallback((raw: string) => {
    setCustomDurationRaw(raw);
    if (raw.trim() === '') {
      setCustomDurationError(null);
      return;
    }
    const parsed = parseDurationInput(raw);
    setCustomDurationError(parsed.error);
    if (parsed.error === null && parsed.value !== null) {
      dispatch({ type: 'SET_DAYS', value: parsed.value });
    }
  }, []);

  const customDurationInvalid =
    customDurationMode && customDurationRaw.trim() !== '' && customDurationError !== null;

  // ── Derived totals (wallet checkout: total credits = daily x days) ────────

  const dailyBudget = form.budget;
  const days = form.days;
  const totalCredits = dailyBudget * days;
  // CN-ADS-4: the affordability figure is the SPENDABLE total (purchased balance
  // + expiring grant credits), matching the submit gate + the backend's
  // grant-first reserve. Displaying `balance` alone would disagree with the gate
  // and falsely read "short" for a user whose credits sit in the grant bucket.
  const balance = walletView !== null ? spendableCredits(walletView) : null;
  const short = balance !== null && balance < totalCredits;
  const belowMin = dailyBudget < BOOST_MIN_BUDGET;

  const audienceSize = estimate.status === 'done' ? estimate.data.reach : 0;
  const belowFloor = estimate.status === 'done' && estimate.data.belowFloor;

  // Reach + inquiry/application bands from the SHARED pure helper (not inline).
  const forecast = useMemo(
    () => buildBoostEstimate({ audienceSize, budget: dailyBudget, days }),
    [audienceSize, dailyBudget, days],
  );
  const hasForecast = forecast.reachHigh > 0;

  // The "secondary outcome" band label depends on the secondary objective:
  // profile_visits (post / profile boosts), applications (job), quotes (rfq),
  // inquiries (listing).
  const outcomeLabelKey =
    kindUi.secondary === 'profile_visits'
      ? 'estimate.profileVisits'
      : kindUi.secondary === 'applications'
        ? 'estimate.applications'
        : kindUi.secondary === 'quotes'
          ? 'estimate.quotes'
          : 'estimate.inquiries';

  // Best-in-industry feedback (Meta / LinkedIn / Indeed pattern): the estimate
  // panel speaks in the chosen goal's currency. A "reach" goal headlines reach;
  // the secondary objective (applications / inquiries / profile visits) headlines
  // its own band and demotes reach to a supporting line. Same honest forecast
  // numbers, just reframed - the preview card stays the same (the goal changes
  // who sees it, not the creative).
  const outcomeNoun = t(outcomeLabelKey as Parameters<typeof t>[0]);
  const goalIsReach = form.objective === 'reach';

  // ── Submit ───────────────────────────────────────────────────────────────

  const submitDisabled = belowMin || short || customInputInvalid || isPending;

  const handleSubmit = useCallback(() => {
    if (submitDisabled) return;
    // Additive funnel telemetry: emit boost submitted on submit INTENT (after
    // the disabled gate, not gated on server success) so the funnel captures
    // attempts. budgetBucket is the coarse band of totalCredits (daily x days);
    // we never send the exact rupee amount. Keyless-safe (trackEvent no-ops).
    trackEvent(ConnectEvents.boostSubmitted, {
      subject: targetKind,
      budgetBucket: bucketRupees(totalCredits),
    });
    // The backend contract takes a TOTAL budget; the composer holds a DAILY
    // budget, so reconstruct the total before building the input.
    const totalForm: BoostFormState = { ...form, budget: dailyBudget * days };
    startTransition(async () => {
      // Route to the per-kind create action. All return the shared BoostCreated
      // shape, so the success path below is identical. Profile boosts take no id
      // (the backend derives the caller's own profile from the JWT).
      const res =
        targetKind === 'open_to_work'
          ? await createOpenToWorkBoost(buildOpenToWorkBoostInput(totalForm))
          : targetKind === 'hiring'
            ? await createHiringBoost(buildHiringBoostInput(totalForm))
            : targetKind === 'rfq'
              ? await createRfqBoost(buildRfqBoostInput(targetId, totalForm))
              : isPost
                ? await createPostBoost(buildPostBoostInput(targetId, totalForm))
                : isJob
                  ? await createJobBoost(buildJobBoostInput(targetId, totalForm))
                  : await createListingBoost(buildListingBoostInput(targetId, totalForm));
      if (res.ok) {
        void message.success(t('toast.launched'));
        announce(t('toast.launched'));
        // Land on the Boosts list with the results drawer open for the new
        // campaign (a target can be boosted repeatedly, each a campaign). The
        // list reads `?boost=<id>` and opens BoostResultsDrawer on mount, so the
        // report sits in context instead of on a sparse standalone page.
        router.push(`/connect/boosts?boost=${res.data.id}`);
      } else {
        void message.error(res.error);
        announce(res.error, { assertive: true });
      }
    });
  }, [
    submitDisabled,
    form,
    dailyBudget,
    days,
    message,
    isJob,
    isPost,
    targetId,
    router,
    t,
    announce,
    targetKind,
    totalCredits,
  ]);

  // ── Top-up (reuses the wallet Razorpay flow) ─────────────────────────────

  const onTopUp = useCallback(async () => {
    if (topupPending) return;
    setTopupPending(true);
    try {
      const updated = await purchaseWalletTopup({
        amountRupees: Math.max(totalCredits, BOOST_MIN_BUDGET),
        prefill: viewerName ? { name: viewerName } : undefined,
      });
      setWalletView(updated);
      message.success(t('wallet.topupSuccess'));
      announce(t('wallet.topupSuccess'));
      router.refresh();
    } catch (err) {
      if (err instanceof CheckoutDismissedError) {
        message.info(t('wallet.topupDismissed'));
      } else if (err instanceof CheckoutFailedError) {
        message.error(t('wallet.topupFailed'));
        announce(t('wallet.topupFailed'), { assertive: true });
      } else {
        const msg = err instanceof Error && err.message ? err.message : t('wallet.topupFailed');
        message.error(msg);
        announce(msg, { assertive: true });
      }
    } finally {
      setTopupPending(false);
    }
  }, [topupPending, totalCredits, viewerName, message, t, announce, router]);

  // ── Checkout gate ────────────────────────────────────────────────────────
  // While BOOST_CHECKOUT_ENABLED is false the boost module is not open for
  // self-serve purchase, so the checkout button makes no payment/boost call - it
  // just surfaces the notice. Kept as a tiny handler so re-enabling is a one-line
  // flag flip with the real onTopUp / handleSubmit paths untouched.
  const onGatedCheckout = useCallback(() => {
    message.info(t('summary.gatedNotice'));
    announce(t('summary.gatedNotice'));
  }, [message, t, announce]);

  // ── Order-summary helpers ────────────────────────────────────────────────

  // Title: listing/job/post/rfq carry their own; the two profile boosts use the
  // caller's name (the ad unit is their own profile).
  const targetTitle =
    listing?.title ?? job?.title ?? post?.title ?? rfq?.title ?? profileTarget?.name ?? '';
  // The secondary descriptor under the title. categoryLabel humanizes a custom
  // (non-preset) listing/job/rfq category; a post / profile shows a generic
  // descriptor (the profile's headline when present, else the kicker).
  const targetCategoryLabel = isProfileBoost
    ? profileTarget?.headline?.trim() || t(kindUi.kickerKey as Parameters<typeof t>[0])
    : isRfq
      ? categoryLabel(rfq!.category, tCat)
      : isPost
        ? t('step1.kickerPost')
        : isJob
          ? categoryLabel(job!.category, tCat)
          : categoryLabel(listing!.category, tCat);
  // Only a listing has a cover image; everything else uses the kind icon.
  const targetCover = targetKind === 'listing' ? listing!.images?.[0] : undefined;

  // districts now hold human district NAMES from the india-geo picker, so they
  // render directly (no per-district i18n key lookup).
  const districtSummary =
    form.districts.length === 0
      ? t('summary.allAreas')
      : form.districts.slice(0, 2).join(', ') +
        (form.districts.length > 2 ? t('summary.more', { n: form.districts.length - 2 }) : '');

  const budgetErrorMessage = customInputInvalid
    ? customBudgetError === 'below_min'
      ? t('budget.errorBelowMin', { min: BOOST_MIN_BUDGET })
      : customBudgetError === 'empty'
        ? t('budget.errorEmpty')
        : t('budget.errorInvalid')
    : null;

  const durationErrorMessage = customDurationInvalid
    ? customDurationError === 'out_of_range'
      ? t('duration.errorRange', { min: BOOST_DURATION_MIN, max: BOOST_DURATION_MAX })
      : customDurationError === 'empty'
        ? t('duration.errorEmpty')
        : t('duration.errorInvalid')
    : null;

  return (
    <ConnectPage>
      {announcer}

      {/* ── Header ── */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {t('title')}
          </h1>
          <p
            className="m-0 mt-1 max-w-[640px] text-[13px] leading-relaxed"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {t('lede')}
          </p>
        </div>
        <Link
          href={kindUi.backHref}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-3 text-[13px] font-semibold no-underline"
          style={{
            border: '1px solid var(--cr-border)',
            background: 'var(--cr-surface)',
            color: 'var(--cr-text-2)',
          }}
        >
          <ArrowLeft size={15} aria-hidden /> {t('cancel')}
        </Link>
      </header>

      {/* ── Two-column: configurator + sticky checkout rail ── */}
      <div className="bz-grid grid items-start gap-5">
        {/* LEFT: configurator */}
        <div className="min-w-0">
          {/* STEP 1 - target preview */}
          <StepCard n={1} title={t('step1.title')} subtitle={t('step1.subtitle')}>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              <span
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold"
                style={{
                  background: 'var(--cr-primary)',
                  color: 'var(--cr-primary-on)',
                  border: '1px solid var(--cr-primary)',
                }}
              >
                <KindIcon size={15} aria-hidden />
                {t(kindUi.typeKey as Parameters<typeof t>[0])}
              </span>
            </div>
            <TargetPreview
              kicker={t(kindUi.kickerKey as Parameters<typeof t>[0])}
              title={targetTitle}
              category={targetCategoryLabel}
              // Only a listing carries a cover image; every other kind uses the icon.
              cover={targetCover}
              icon={kindUi.icon}
            />
          </StepCard>

          {/* STEP 2 - goal */}
          <StepCard n={2} title={t('step2.title')} subtitle={t('step2.subtitle')}>
            <div
              role="radiogroup"
              aria-labelledby={goalHeadingId}
              className="goal-grid grid gap-2.5"
            >
              <span id={goalHeadingId} className="sr-only">
                {t('step2.title')}
              </span>
              {objectiveOptions.map((obj) => (
                <GoalCard
                  key={obj}
                  selected={form.objective === obj}
                  icon={
                    obj === 'reach'
                      ? Eye
                      : obj === 'profile_visits'
                        ? TrendingUp
                        : obj === 'applications'
                          ? Briefcase
                          : obj === 'quotes'
                            ? Receipt
                            : MessageCircle
                  }
                  title={t(`goal.${obj}.label` as Parameters<typeof t>[0])}
                  help={t(`goal.${obj}.help` as Parameters<typeof t>[0])}
                  onSelect={() => dispatch({ type: 'SET_OBJECTIVE', value: obj })}
                />
              ))}
            </div>
          </StepCard>

          {/* STEP 3 - audience */}
          <StepCard n={3} title={t('step3.title')} subtitle={t('step3.subtitle')}>
            <span id={audienceHeadingId} className="sr-only">
              {t('step3.title')}
            </span>

            {/* Location (State -> District, all-India) + trade targeting.
                Replaces the old hardcoded Gujarat district chips + fixed trade
                chips: any state's districts + custom/multiple trades. Values are
                matched case-insensitively + separator-agnostically by the
                backend, so they hit today's free-text profiles. */}
            <AudienceGeoTradeFields
              districts={form.districts}
              sectors={form.sectors}
              onDistrictsChange={(value) => dispatch({ type: 'SET_DISTRICTS', value })}
              onSectorsChange={(value) => dispatch({ type: 'SET_SECTORS', value })}
            />

            {/* Role segment - single-select "Show to" (Everyone + each role) */}
            <fieldset className="m-0 border-0 p-0">
              <legend
                id={roleLabelId}
                className="m-0 mb-2.5 text-[11px] font-bold tracking-[0.06em] uppercase"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {t('audience.showTo')}
              </legend>
              <div
                role="radiogroup"
                aria-labelledby={roleLabelId}
                className="flex flex-wrap gap-1.5"
              >
                <SegChip
                  label={t('audience.everyone')}
                  selected={form.roles.length === 0}
                  onSelect={() => dispatch({ type: 'SET_ROLE_ALL' })}
                />
                {BOOST_ROLES.map((role: ConnectOnboardingIntent) => {
                  const selected = form.roles.length === 1 && form.roles[0] === role;
                  return (
                    <SegChip
                      key={role}
                      label={t(`audience.roles.${role}`)}
                      selected={selected}
                      // Re-selecting the active role clears back to Everyone.
                      onSelect={() =>
                        dispatch(
                          selected
                            ? { type: 'SET_ROLE_ALL' }
                            : { type: 'SET_ROLE_ONLY', value: role },
                        )
                      }
                    />
                  );
                })}
              </div>
            </fieldset>

            {/* REAL audience readout from estimateAudience. */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mt-4 flex items-center gap-2.5 rounded-[var(--cr-radius-md)] px-3.5 py-3"
              style={{
                background: 'var(--cr-success-50)',
                border: '1px solid var(--cr-success)',
              }}
            >
              {estimate.status === 'loading' ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                    aria-hidden
                    style={{ color: 'var(--cr-success)' }}
                  />
                  <span className="text-[12.5px]" style={{ color: 'var(--cr-text-2)' }}>
                    {t('audience.calculating')}
                  </span>
                </>
              ) : estimate.status === 'error' ? (
                <>
                  <Target size={16} aria-hidden style={{ color: 'var(--cr-success)' }} />
                  <span className="text-[12.5px]" style={{ color: 'var(--cr-text-2)' }}>
                    {t('audience.estimateError')}{' '}
                    <button
                      type="button"
                      onClick={retryEstimate}
                      className="font-bold underline"
                      style={{ color: 'var(--cr-primary)' }}
                    >
                      {t('audience.retry')}
                    </button>
                  </span>
                </>
              ) : estimate.status === 'done' ? (
                <>
                  <Target size={16} aria-hidden style={{ color: 'var(--cr-success)' }} />
                  <span className="text-[12.5px]" style={{ color: 'var(--cr-text-2)' }}>
                    {t.rich('audience.matchCount', {
                      count: estimate.data.reach,
                      b: (chunks) => (
                        <b
                          className="font-extrabold tabular-nums"
                          style={{ color: 'var(--cr-success)' }}
                        >
                          {chunks}
                        </b>
                      ),
                    })}
                  </span>
                </>
              ) : (
                <>
                  <Target size={16} aria-hidden style={{ color: 'var(--cr-success)' }} />
                  <span className="text-[12.5px]" style={{ color: 'var(--cr-text-2)' }}>
                    {t('audience.idle')}
                  </span>
                </>
              )}
            </div>
            {belowFloor && (
              <p
                role="status"
                className="m-0 mt-2 text-[11.5px]"
                style={{ color: 'var(--cr-warning)' }}
              >
                {t('audience.belowFloor')}
              </p>
            )}
          </StepCard>

          {/* STEP 4 - optional Spotlight upgrade (Phase 2). Recommended add-on, off
              by default; placed ABOVE Budget so the LAST step the seller lands on is
              Budget + the live estimate (owner UX, 2026-06-18). Toggling on reveals
              WHERE it shows + the premium-rate note; adds the spotlight_rail
              placement + premium bid server-side. */}
          <StepCard n={4} title={t('spotlight.stepTitle')} subtitle={t('spotlight.stepSubtitle')}>
            <button
              type="button"
              role="switch"
              aria-checked={form.spotlight}
              onClick={() => dispatch({ type: 'SET_SPOTLIGHT', value: !form.spotlight })}
              className="flex w-full items-start gap-3 rounded-[var(--cr-radius-md)] p-3.5 text-start transition-colors"
              style={{
                background: form.spotlight ? 'var(--cr-wash-indigo)' : 'var(--cr-surface)',
                border: form.spotlight
                  ? '1.5px solid var(--cr-primary)'
                  : '1.5px solid var(--cr-border)',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[var(--cr-radius-md)]"
                style={{
                  background: form.spotlight ? 'var(--cr-primary)' : 'var(--cr-primary-light)',
                  color: form.spotlight ? 'var(--cr-primary-on)' : 'var(--cr-primary)',
                }}
              >
                <Sparkles size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
                    {t('spotlight.title')}
                  </b>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] uppercase"
                    style={{
                      background: form.spotlight ? 'var(--cr-primary)' : 'var(--cr-gold-100)',
                      color: form.spotlight ? 'var(--cr-primary-on)' : 'var(--cr-gold-700)',
                    }}
                  >
                    {form.spotlight ? t('spotlight.on') : t('spotlight.recommended')}
                  </span>
                </span>
                <span
                  className="mt-1 block text-[12px]"
                  style={{ color: 'var(--cr-text-4)', lineHeight: 1.5 }}
                >
                  {t('spotlight.benefit')}
                </span>
              </span>
              {/* on/off pill indicator */}
              <span
                aria-hidden
                className="relative mt-1 h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
                style={{ background: form.spotlight ? 'var(--cr-primary)' : 'var(--cr-border)' }}
              >
                <span
                  className="absolute top-[3px] h-[16px] w-[16px] rounded-full transition-all"
                  style={{ left: form.spotlight ? '19px' : '3px', background: 'var(--cr-surface)' }}
                />
              </span>
            </button>

            {/* Placement preview - ALWAYS shown, even when the toggle is off, so the
                seller sees WHAT Spotlight does + its premium cost BEFORE turning it
                on (owner UX, 2026-06-18). The box lights up (indigo) when on and
                stays a neutral "this is what you'd get" preview when off; the mock +
                copy illustrate the prime side-panel spot either way. */}
            <div
              className="mt-3 rounded-[var(--cr-radius-md)] p-3"
              style={{
                border: form.spotlight
                  ? '1px solid var(--cr-primary-light)'
                  : '1px solid var(--cr-border)',
                background: form.spotlight ? 'var(--cr-wash-indigo)' : 'var(--cr-surface-2)',
              }}
            >
              <SpotlightPlacementMock
                feedLabel={t('spotlight.previewFeed')}
                spotlightLabel={t('spotlight.previewLabel')}
                active={form.spotlight}
              />
              <p
                className="m-0 mt-2.5 flex items-start gap-1.5 text-[11.5px] font-medium"
                style={{ color: 'var(--cr-text-2)' }}
              >
                <Info size={13} aria-hidden style={{ flex: 'none', marginTop: 1 }} />{' '}
                {t('spotlight.where')}
              </p>
              <p className="m-0 mt-1.5 text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('spotlight.help')}
              </p>
            </div>
          </StepCard>

          {/* STEP 5 - budget + duration (final step before launch) */}
          <StepCard n={5} title={t('step4.title')} subtitle={t('step4.subtitle')}>
            <p
              id={dailyBudgetLabelId}
              className="m-0 mb-2.5 text-[11px] font-bold tracking-[0.06em] uppercase"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {t('budget.dailyLabel')}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={dailyBudgetLabelId}
              className="flex flex-wrap gap-2"
            >
              {DAILY_BUDGET_PRESETS.map((amount) => (
                <PickTile
                  key={amount}
                  big={formatRupees(amount)}
                  small={t('budget.perDay')}
                  selected={!customBudgetMode && form.budget === amount}
                  onSelect={() => selectPresetBudget(amount)}
                />
              ))}
              <PickTile
                big={t('budget.customBig')}
                small={t('budget.customSmall')}
                selected={customBudgetMode}
                onSelect={enterCustomBudget}
              />
            </div>

            {customBudgetMode && (
              // pb-3 keeps the field off the DURATION title below: sibling margins
              // collapse (mt-[18px] would win alone), so padding adds real space.
              <div className="mt-3 max-w-[260px] pb-3">
                <label
                  htmlFor={customBudgetInputId}
                  className="mb-1.5 block text-[11px] font-bold tracking-[0.06em] uppercase"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {t('budget.customLabel')}
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-[38px] flex-1 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-3"
                    style={{
                      border: budgetErrorMessage
                        ? '1px solid var(--cr-error)'
                        : '1px solid var(--cr-border)',
                      background: 'var(--cr-surface)',
                    }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: 'var(--cr-text-4)' }}>
                      ₹
                    </span>
                    <input
                      id={customBudgetInputId}
                      type="text"
                      inputMode="numeric"
                      value={customBudgetRaw}
                      onChange={(e) => handleCustomBudgetChange(e.target.value)}
                      placeholder={t('budget.customPlaceholder')}
                      aria-describedby={budgetErrorMessage ? customBudgetErrorId : undefined}
                      aria-invalid={budgetErrorMessage ? 'true' : undefined}
                      className="w-full border-0 bg-transparent text-[14px] font-bold tabular-nums outline-none"
                      style={{ color: 'var(--cr-text)' }}
                    />
                  </div>
                  <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                    {t('budget.perDay')}
                  </span>
                </div>
                {budgetErrorMessage && (
                  <p
                    id={customBudgetErrorId}
                    role="alert"
                    className="m-0 mt-1.5 text-[12px]"
                    style={{ color: 'var(--cr-error)' }}
                  >
                    {budgetErrorMessage}
                  </p>
                )}
              </div>
            )}

            <p
              id={durationLabelId}
              className="m-0 mt-[18px] mb-2.5 text-[11px] font-bold tracking-[0.06em] uppercase"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {t('duration.label')}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={durationLabelId}
              className="flex flex-wrap gap-2"
            >
              {BOOST_DURATION_PRESETS.map((count) => (
                <PickTile
                  key={count}
                  big={String(count)}
                  small={t('duration.daysUnit')}
                  selected={!customDurationMode && form.days === count}
                  onSelect={() => selectPresetDuration(count)}
                />
              ))}
              <PickTile
                big={t('duration.customBig')}
                small={t('duration.customSmall')}
                selected={customDurationMode}
                onSelect={enterCustomDuration}
              />
            </div>

            {customDurationMode && (
              <div className="mt-3 max-w-[260px]">
                <label
                  htmlFor={customDurationInputId}
                  className="mb-1.5 block text-[11px] font-bold tracking-[0.06em] uppercase"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {t('duration.customLabel')}
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-[38px] flex-1 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-3"
                    style={{
                      border: durationErrorMessage
                        ? '1px solid var(--cr-error)'
                        : '1px solid var(--cr-border)',
                      background: 'var(--cr-surface)',
                    }}
                  >
                    <input
                      id={customDurationInputId}
                      type="text"
                      inputMode="numeric"
                      value={customDurationRaw}
                      onChange={(e) => handleCustomDurationChange(e.target.value)}
                      placeholder={t('duration.customPlaceholder')}
                      aria-describedby={durationErrorMessage ? customDurationErrorId : undefined}
                      aria-invalid={durationErrorMessage ? 'true' : undefined}
                      className="w-full border-0 bg-transparent text-[14px] font-bold tabular-nums outline-none"
                      style={{ color: 'var(--cr-text)' }}
                    />
                  </div>
                  <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                    {t('duration.daysUnit')}
                  </span>
                </div>
                {durationErrorMessage && (
                  <p
                    id={customDurationErrorId}
                    role="alert"
                    className="m-0 mt-1.5 text-[12px]"
                    style={{ color: 'var(--cr-error)' }}
                  >
                    {durationErrorMessage}
                  </p>
                )}
              </div>
            )}

            {/* Estimated result - clearly an ESTIMATE, from buildBoostEstimate. */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mt-4 rounded-[var(--cr-radius-md)] px-4 py-3.5"
              style={{
                border: '1px solid var(--cr-primary-light)',
                background: 'var(--cr-wash-indigo)',
              }}
            >
              <div
                className="flex items-center gap-2 text-[11px] font-bold tracking-[0.05em] uppercase"
                style={{ color: 'var(--cr-primary-hover)' }}
              >
                <TrendingUp size={14} aria-hidden />{' '}
                {goalIsReach
                  ? t('estimate.titleReach')
                  : t('estimate.titleOutcome', { outcome: outcomeNoun })}
              </div>
              {hasForecast ? (
                goalIsReach ? (
                  <>
                    <div
                      className="mt-1.5 text-[24px] font-extrabold tracking-[-0.01em] tabular-nums"
                      style={{ color: 'var(--cr-primary-hover)' }}
                    >
                      {t('estimate.reachRange', {
                        low: fmtCount(forecast.reachLow),
                        high: fmtCount(forecast.reachHigh),
                      })}
                    </div>
                    <div className="mt-1 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                      {t.rich('estimate.sub', {
                        days,
                        low: fmtCount(forecast.inquiriesLow),
                        high: fmtCount(forecast.inquiriesHigh),
                        outcome: outcomeNoun,
                        b: (chunks) => (
                          <b className="font-bold" style={{ color: 'var(--cr-text)' }}>
                            {chunks}
                          </b>
                        ),
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Goal = secondary objective: its outcome band is the headline,
                        reach drops to the supporting line (Meta/LinkedIn pattern). */}
                    <div
                      className="mt-1.5 text-[24px] font-extrabold tracking-[-0.01em] tabular-nums"
                      style={{ color: 'var(--cr-primary-hover)' }}
                    >
                      {t('estimate.outcomeRange', {
                        low: fmtCount(forecast.inquiriesLow),
                        high: fmtCount(forecast.inquiriesHigh),
                        outcome: outcomeNoun,
                      })}
                    </div>
                    <div className="mt-1 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                      {t.rich('estimate.reachSub', {
                        days,
                        low: fmtCount(forecast.reachLow),
                        high: fmtCount(forecast.reachHigh),
                        b: (chunks) => (
                          <b className="font-bold" style={{ color: 'var(--cr-text)' }}>
                            {chunks}
                          </b>
                        ),
                      })}
                    </div>
                  </>
                )
              ) : (
                <div className="mt-1.5 text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
                  {t('estimate.empty')}
                </div>
              )}
              <p
                className="m-0 mt-2.5 flex items-start gap-1.5 text-[11px]"
                style={{ color: 'var(--cr-text-4)' }}
              >
                <Info size={13} aria-hidden style={{ flex: 'none', marginTop: 1 }} />
                {t('estimate.note')}
              </p>
            </div>
          </StepCard>
        </div>

        {/* RIGHT: sticky checkout rail */}
        <aside className="bz-rail flex flex-col gap-3.5">
          {/* Promoted preview */}
          <RailCard title={t('rail.previewTitle')}>
            <div className="p-4">
              <PromotedPreview
                title={targetTitle}
                category={targetCategoryLabel}
                cover={targetCover}
                promotedLabel={t('rail.promoted')}
                // Per-kind CTA: post -> View, job -> Apply, listing -> Message,
                // profile boosts -> View profile, rfq -> Send quote.
                ctaLabel={t(kindUi.ctaKey as Parameters<typeof t>[0])}
                ctaIcon={kindUi.ctaIcon}
                icon={kindUi.icon}
              />
            </div>
          </RailCard>

          {/* Order summary - WALLET credits, NO GST invoice. */}
          <RailCard title={t('rail.orderTitle')}>
            <div className="px-4 pt-1.5 pb-3.5">
              <OrderRow icon={Target} label={t('summary.audience')}>
                <span className="block tabular-nums">
                  {estimate.status === 'done'
                    ? t('summary.members', { count: estimate.data.reach })
                    : t('summary.membersPending')}
                </span>
                <small
                  className="mt-0.5 block text-[10.5px] font-medium"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {districtSummary} · {targetCategoryLabel}
                </small>
              </OrderRow>
              <OrderRow icon={Calendar} label={t('summary.duration')}>
                <span className="tabular-nums">{t('duration.daysValue', { count: days })}</span>
              </OrderRow>
              <OrderRow icon={Rocket} label={t('summary.dailyBudget')} divider={form.spotlight}>
                <span className="tabular-nums">{t('summary.perDay', { amount: dailyBudget })}</span>
              </OrderRow>
              {form.spotlight && (
                <OrderRow icon={Sparkles} label={t('summary.spotlight')} divider={false}>
                  <span>{t('summary.spotlightOn')}</span>
                </OrderRow>
              )}

              <div
                className="mt-2 flex items-center justify-between pt-2.5 text-[15px] font-extrabold"
                style={{ borderTop: '1.5px solid var(--cr-border)', color: 'var(--cr-text)' }}
              >
                <span>{t('summary.totalCredits')}</span>
                <span className="tabular-nums" style={{ color: 'var(--cr-primary-hover)' }}>
                  {t('summary.credits', { amount: totalCredits })}
                </span>
              </div>

              {/* Wallet balance + affordability. */}
              <div
                className="mt-3 flex items-center justify-between rounded-[var(--cr-radius-md)] px-3 py-2.5"
                style={{ background: 'var(--cr-surface-2)' }}
              >
                <span
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  style={{ color: 'var(--cr-text-3)' }}
                >
                  <Wallet size={14} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
                  {t('summary.walletBalance')}
                </span>
                {balance === null ? (
                  <span className="text-[12px] italic" style={{ color: 'var(--cr-text-4)' }}>
                    {t('summary.walletUnavailable')}
                  </span>
                ) : (
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{ color: short ? 'var(--cr-warning)' : 'var(--cr-text)' }}
                  >
                    {t('summary.credits', { amount: balance })}
                  </span>
                )}
              </div>

              {/* Affordability hints apply once launching is live. The shortBy copy
                  explains that the team adds credits (no self-serve top-up yet). */}
              {BOOST_LAUNCH_ENABLED && short && (
                <p
                  role="status"
                  className="m-0 mt-2 text-[12px]"
                  style={{ color: 'var(--cr-warning)' }}
                >
                  {t('summary.shortBy', { amount: totalCredits - (balance ?? 0) })}
                </p>
              )}
              {BOOST_LAUNCH_ENABLED && belowMin && (
                <p
                  role="alert"
                  className="m-0 mt-2 text-[12px]"
                  style={{ color: 'var(--cr-error)' }}
                >
                  {t('budget.errorBelowMin', { min: BOOST_MIN_BUDGET })}
                </p>
              )}
            </div>

            <div
              className="px-4 py-3.5"
              style={{
                borderTop: '1px solid var(--cr-divider)',
                background: 'var(--cr-surface-2)',
              }}
            >
              {/* Checkout action, three states:
                  - launch off (kill-switch): notice + muted button, no API call.
                  - short balance + self-serve top-up live: the Razorpay add-credits
                    button (only when the payment gateway is on).
                  - otherwise: the real "Launch boost" (spends wallet credits;
                    disabled when short / belowMin / invalid / pending - the shortBy
                    note above explains the team adds credits while top-up is off). */}
              {!BOOST_LAUNCH_ENABLED ? (
                <>
                  <p
                    role="status"
                    className="m-0 mb-2.5 flex items-start gap-1.5 rounded-[var(--cr-radius-md)] px-3 py-2.5 text-[12px] leading-relaxed"
                    style={{
                      border: '1px solid var(--cr-border)',
                      background: 'var(--cr-surface)',
                      color: 'var(--cr-text-3)',
                    }}
                  >
                    <Info size={13} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
                    {t('summary.gatedNotice')}
                  </p>
                  <button
                    type="button"
                    onClick={onGatedCheckout}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--cr-radius-md)] text-[14px] font-bold"
                    style={{
                      border: 'none',
                      background: 'var(--cr-border)',
                      color: 'var(--cr-text-4)',
                      cursor: 'pointer',
                    }}
                  >
                    <Rocket size={16} aria-hidden />
                    {t('summary.launch')}
                  </button>
                </>
              ) : short && WALLET_TOPUP_ENABLED ? (
                <button
                  type="button"
                  onClick={() => void onTopUp()}
                  disabled={topupPending}
                  aria-busy={topupPending}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--cr-radius-md)] text-[14px] font-bold"
                  style={{
                    border: 'none',
                    background: 'var(--cr-primary)',
                    color: 'var(--cr-primary-on)',
                    cursor: topupPending ? 'not-allowed' : 'pointer',
                    opacity: topupPending ? 0.7 : 1,
                  }}
                >
                  {topupPending ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Wallet size={16} aria-hidden />
                  )}
                  {t('summary.addCredits')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitDisabled}
                  aria-disabled={submitDisabled}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--cr-radius-md)] text-[14px] font-bold"
                  style={{
                    border: 'none',
                    background: submitDisabled ? 'var(--cr-border)' : 'var(--cr-primary)',
                    color: submitDisabled ? 'var(--cr-text-4)' : 'var(--cr-primary-on)',
                    cursor: submitDisabled ? 'not-allowed' : 'pointer',
                    opacity: submitDisabled ? 0.8 : 1,
                  }}
                >
                  {isPending ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Rocket size={16} aria-hidden />
                  )}
                  {t('summary.launch')}
                </button>
              )}
              {/* Wallet terms shown whenever launching is live. mt-4 keeps a
                  standard gap below the Launch button (was mt-2.5, too tight). */}
              {BOOST_LAUNCH_ENABLED && (
                <p
                  className="m-0 mt-4 flex items-start gap-1.5 pt-3 text-[10.5px] leading-relaxed"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  <Receipt size={13} aria-hidden style={{ flex: 'none', marginTop: 1 }} />
                  {t('summary.walletNote')}
                </p>
              )}
            </div>
          </RailCard>

          {/* How boosts work */}
          <RailCard title={t('rail.howTitle')}>
            <p
              className="m-0 px-4 py-3.5 text-[11.5px] leading-relaxed"
              style={{ color: 'var(--cr-text-3)' }}
            >
              {t('rail.howBody')}
            </p>
          </RailCard>
        </aside>
      </div>

      {/* Component-scoped grid: 1fr + 340px rail, collapses under 1024px. */}
      <style jsx>{`
        .bz-grid {
          grid-template-columns: minmax(0, 1fr) 340px;
        }
        .goal-grid {
          grid-template-columns: 1fr 1fr;
        }
        .bz-rail {
          position: sticky;
          top: 78px;
        }
        @media (max-width: 1024px) {
          .bz-grid {
            grid-template-columns: 1fr;
          }
          .bz-rail {
            position: static;
          }
        }
        @media (max-width: 560px) {
          .goal-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </ConnectPage>
  );
}

// ===========================================================================
// Presentational sub-components (raw HTML + cr- tokens, prototype-faithful)
// ===========================================================================

/**
 * A tiny schematic of the page shown when Spotlight is ON, so the user SEES where
 * their boost lands: a feed column (grey lines) + a side panel whose top slot is
 * highlighted as "Your Spotlight". Decorative (aria-hidden); the adjacent text
 * carries the meaning for assistive tech.
 */
function SpotlightPlacementMock({
  feedLabel,
  spotlightLabel,
  active,
}: {
  feedLabel: string;
  spotlightLabel: string;
  /** When false (toggle off) the Spotlight slot reads as an available preview
   *  (dashed, slightly muted); when true it is a solid "this spot is yours". */
  active: boolean;
}) {
  return (
    <div aria-hidden style={{ display: 'flex', gap: 8, height: 92 }}>
      {/* Feed column */}
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 8,
          borderRadius: 'var(--cr-radius-sm)',
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-5)',
          }}
        >
          {feedLabel}
        </span>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ height: 8, borderRadius: 4, background: 'var(--cr-surface-3)' }} />
        ))}
      </div>
      {/* Side panel with the highlighted Spotlight slot on top */}
      <div style={{ width: 96, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            flex: 'none',
            padding: 8,
            borderRadius: 'var(--cr-radius-sm)',
            background: active ? 'var(--cr-primary-light)' : 'var(--cr-surface)',
            border: active ? '1.5px solid var(--cr-primary)' : '1.5px dashed var(--cr-primary)',
            opacity: active ? 1 : 0.85,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9,
              fontWeight: 800,
              color: 'var(--cr-primary)',
            }}
          >
            <Sparkles size={9} aria-hidden /> {spotlightLabel}
          </span>
          <span
            style={{
              display: 'block',
              marginTop: 5,
              height: 6,
              width: '80%',
              borderRadius: 3,
              background: 'var(--cr-primary)',
              opacity: active ? 0.45 : 0.3,
            }}
          />
        </div>
        <div
          style={{
            flex: 1,
            borderRadius: 'var(--cr-radius-sm)',
            background: 'var(--cr-surface-2)',
            border: '1px solid var(--cr-border)',
          }}
        />
      </div>
    </div>
  );
}

/** Numbered step card with a header band + body. */
function StepCard({
  n,
  title,
  subtitle,
  children,
}: {
  n: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-4 overflow-hidden rounded-[var(--cr-radius-lg)]"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <div
        className="flex items-center gap-3 px-[18px] py-3.5"
        style={{ borderBottom: '1px solid var(--cr-divider)' }}
      >
        <span
          aria-hidden
          className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
          style={{ background: 'var(--cr-primary)', color: 'var(--cr-primary-on)' }}
        >
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="m-0 text-[15px] font-bold tracking-[-0.01em]"
            style={{ color: 'var(--cr-text)' }}
          >
            {title}
          </h2>
          <p className="m-0 mt-px text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="px-[18px] py-4">{children}</div>
    </section>
  );
}

/** Read-only target preview row (cover/icon + kicker + title + category). */
function TargetPreview({
  kicker,
  title,
  category,
  cover,
  icon: Icon,
}: {
  kicker: string;
  title: string;
  category: string;
  cover?: string;
  icon: LucideIcon;
}) {
  return (
    <div
      className="flex gap-3 rounded-[var(--cr-radius-md)] p-3"
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface-2)' }}
    >
      <span
        aria-hidden
        className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-[var(--cr-radius-md)]"
        style={{
          background: cover
            ? `center / cover no-repeat url(${JSON.stringify(cover)})`
            : 'var(--cr-accent-light)',
          color: 'var(--cr-gold-700)',
        }}
      >
        {!cover && <Icon size={30} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <span
          className="text-[10px] font-bold tracking-[0.05em] uppercase"
          style={{ color: 'var(--cr-gold-700)' }}
        >
          {kicker}
        </span>
        <h3
          className="m-0 mt-1 text-[14px] font-bold"
          style={{
            color: 'var(--cr-text)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </h3>
        <div className="mt-1 text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
          {category}
        </div>
      </div>
    </div>
  );
}

/** Selectable goal card (icon tile + title + help), single-select radio. */
function GoalCard({
  selected,
  icon: Icon,
  title,
  help,
  onSelect,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  help: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex items-start gap-3 rounded-[var(--cr-radius-md)] p-3 text-start transition-colors"
      style={{
        border: selected ? '1.5px solid var(--cr-primary)' : '1.5px solid var(--cr-border)',
        background: selected ? 'var(--cr-wash-indigo)' : 'var(--cr-surface)',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden
        className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[var(--cr-radius-md)]"
        style={{
          background: selected ? 'var(--cr-primary)' : 'var(--cr-primary-light)',
          color: selected ? 'var(--cr-primary-on)' : 'var(--cr-primary)',
        }}
      >
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0">
        <b className="block text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {title}
        </b>
        <span className="text-[11.5px]" style={{ color: 'var(--cr-text-4)', lineHeight: 1.45 }}>
          {help}
        </span>
      </span>
    </button>
  );
}

/** Single-select segmented chip (filled when selected). */
function SegChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="inline-flex h-8 items-center rounded-[var(--cr-radius-md)] px-3 text-[12px] font-semibold transition-colors"
      style={{
        border: selected ? '1px solid var(--cr-primary)' : '1px solid var(--cr-border)',
        background: selected ? 'var(--cr-primary)' : 'var(--cr-surface)',
        color: selected ? 'var(--cr-primary-on)' : 'var(--cr-text-2)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/** Stacked pick tile (big value over small unit) for budget + duration. */
function PickTile({
  big,
  small,
  selected,
  onSelect,
}: {
  big: string;
  small: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex h-[54px] min-w-[84px] flex-1 flex-col items-center justify-center gap-px rounded-[var(--cr-radius-md)] transition-colors"
      style={{
        border: selected ? '1.5px solid var(--cr-primary)' : '1.5px solid var(--cr-border)',
        background: selected ? 'var(--cr-wash-indigo)' : 'var(--cr-surface)',
        cursor: 'pointer',
      }}
    >
      <b
        className="text-[15px] font-extrabold tabular-nums"
        style={{ color: selected ? 'var(--cr-primary-hover)' : 'var(--cr-text)' }}
      >
        {big}
      </b>
      <span className="text-[10.5px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
        {small}
      </span>
    </button>
  );
}

/** Rail card with an uppercase title header band. */
function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="overflow-hidden rounded-[var(--cr-radius-lg)]"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        boxShadow: 'var(--cr-shadow-card)',
      }}
    >
      <h3
        className="m-0 px-4 py-3 text-[10.5px] font-bold tracking-[0.07em] uppercase"
        style={{ color: 'var(--cr-text-4)', borderBottom: '1px solid var(--cr-divider)' }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A single order-summary row: icon + label on the left, value on the right. */
function OrderRow({
  icon: Icon,
  label,
  children,
  divider = true,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  /** Bottom divider. Off for the LAST row so it doesn't double up with the
   *  Total's own top border (which already separates the total). */
  divider?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-2 text-[12.5px]"
      style={{
        color: 'var(--cr-text-3)',
        borderBottom: divider ? '1px solid var(--cr-divider)' : undefined,
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon size={13} aria-hidden style={{ color: 'var(--cr-text-5)' }} />
        {label}
      </span>
      <span className="text-end font-bold" style={{ color: 'var(--cr-text)' }}>
        {children}
      </span>
    </div>
  );
}

/**
 * Compact promoted-card preview, styled after PromotedListingAdCard: a
 * "Promoted" disclosure strip, the cover (or an icon placeholder), the title +
 * category, and a CTA footer. Mirrors how the listing will read in the rail.
 */
function PromotedPreview({
  title,
  category,
  cover,
  promotedLabel,
  ctaLabel,
  ctaIcon: CtaIcon = MessageCircle,
  icon: Icon,
}: {
  title: string;
  category: string;
  cover?: string;
  promotedLabel: string;
  ctaLabel: string;
  /** The CTA-row glyph. Listings/jobs use Message; a post uses Eye (View). */
  ctaIcon?: LucideIcon;
  icon: LucideIcon;
}) {
  return (
    <div
      className="overflow-hidden rounded-[var(--cr-radius-md)]"
      style={{ border: '1px solid var(--cr-border)' }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-bold tracking-[0.03em]"
        style={{ background: 'var(--cr-gold-100)', color: 'var(--cr-gold-700)' }}
      >
        <Rocket size={12} aria-hidden /> {promotedLabel}
      </div>
      {cover ? (
        <div
          aria-hidden
          className="h-24"
          style={{ background: `center / cover no-repeat url(${JSON.stringify(cover)})` }}
        />
      ) : (
        <div
          aria-hidden
          className="grid h-24 place-items-center"
          style={{ background: 'var(--cr-accent-light)', color: 'var(--cr-gold-400)' }}
        >
          {Icon === Package ? <ImageOff size={28} aria-hidden /> : <Icon size={28} aria-hidden />}
        </div>
      )}
      <div className="px-3 pt-2.5 pb-2">
        <h4
          className="m-0 text-[12.5px] font-bold"
          style={{
            color: 'var(--cr-text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </h4>
        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
          {category}
        </div>
      </div>
      <div
        className="flex items-center justify-end px-3 py-2.5"
        style={{ borderTop: '1px solid var(--cr-divider)', background: 'var(--cr-surface-2)' }}
      >
        <span
          className="inline-flex items-center gap-1.5 text-[12px] font-bold"
          style={{ color: 'var(--cr-primary)' }}
        >
          <CtaIcon size={13} aria-hidden /> {ctaLabel}
        </span>
      </div>
    </div>
  );
}
