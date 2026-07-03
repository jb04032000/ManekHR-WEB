'use client';

/**
 * The Jobs hub: a KPI strip + tabbed surface (Find work / My applications / Saved
 * / Jobs I posted). The Find ("Open") tab is now SERVER-DRIVEN: results come from
 * GET /connect/jobs/board (paged, Load more appends) and the rail/role-strip
 * counts from GET /connect/jobs/board/facets, both via useBoardFilters. The URL is
 * the source of truth (history.replaceState, no SSR re-run per tap). The other
 * three tabs stay client-rendered from their SSR-seeded arrays.
 *
 * Cross-module links:
 * - features/connect/jobs/useBoardFilters.ts owns the Open-tab fetch + URL sync.
 * - features/connect/jobs/JobFilterRail.tsx is the Phase 2 counted multi-select
 *   rail; it edits BoardFilters directly via setFilter (desktop = live; mobile =
 *   staged in a Drawer, applied once via "Show N jobs").
 * - app/connect/jobs/page.tsx SSR-seeds filters/initialResults/initialFacets.
 *
 * Gotcha: the rail/strip render counts from `facets`, which reflect the WHOLE
 * matching set (not just the loaded page), so they stay correct once only page 1
 * is loaded. The old in-memory useState filtering of the board was removed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Drawer, Segmented, Select, message } from 'antd';
// NOTE (band removal): the dismissible "how hiring works" band above the search
// was removed at the owner's request. The right-rail RailPanel ("How hiring
// works") below is a SEPARATE surface and is intentionally kept.
import {
  type LucideIcon,
  Bookmark,
  Briefcase,
  Brush,
  Cog,
  LayoutGrid,
  List,
  PenTool,
  PlusCircle,
  Scissors,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectPage, ConnectRightRail, RailPanel } from '@/components/connect';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import { ConnectUsageMeter } from '@/components/connect/ConnectUsageMeter';
import { OverLimitBanner } from '@/components/connect/OverLimitBanner';
import { BoostNudgeSlot } from '@/components/connect/BoostNudgeSlot';
import { KpiStrip, KpiCard } from '@/components/connect/KpiStrip';
import { parseApiError } from '@/lib/utils';
import { track } from '@/lib/analytics';
import JobCard from './JobCard';
import JobCardSkeleton from './JobCardSkeleton';
import PromotedJobs from './PromotedJobs';
// Mobile inline ad (Google-only here): boosted jobs already serve in the main
// column on all widths; this surfaces the Google connect.right.top slot (which
// lives in the xl ConnectRightRail) for phone/tablet without duplicating it.
import MobileAdInline from '../ads/MobileAdInline';
import MyApplicationCard from './MyApplicationCard';
import JobComposer from './JobComposer';
import JobFilterRail from './JobFilterRail';
import { createJob, listPromotedJobs } from './jobs.actions';
import { useBoardFilters } from './useBoardFilters';
import { useBoardEmployers } from './useBoardEmployers';
// JOB_ROLE_PRESETS (runtime value) labels known role slugs in the active chips;
// custom slugs fall back to humanize. Mirrors the rail's role labelling.
import { JOB_ROLE_PRESETS } from './jobs.types';
import type {
  Job,
  MyApplicationView,
  JobRole,
  JobStatus,
  CreateJobPayload,
  BoardFilters,
  BoardFacets,
  BoardStats,
} from './jobs.types';

type Tab = 'board' | 'mine' | 'myApplications' | 'saved';
type Sort = 'recent' | 'openings' | 'closing';
type MineFilter = 'all' | JobStatus;
// My applications tab sort: newest-applied (server default) or grouped by status.
type AppsSort = 'recent' | 'status';
// "By status" ordering - most actionable / positive first. viewed maps to applied.
const APPS_STATUS_ORDER: Record<string, number> = {
  shortlisted: 0,
  accepted: 1,
  applied: 2,
  declined: 3,
  withdrawn: 4,
};

const ROLES: Array<{ key: JobRole; icon: LucideIcon }> = [
  { key: 'karigar', icon: Brush },
  { key: 'operator', icon: Cog },
  { key: 'designer', icon: PenTool },
  { key: 'supervisor', icon: Users },
  { key: 'helper', icon: Scissors },
];

// Below this many results the List/Grid toggle is hidden - a grid layout adds no
// value at low counts and just clutters the toolbar. List stays the default view.
const GRID_TOGGLE_MIN = 6;

interface Props {
  /** The Open-tab filters parsed from the URL (page.tsx); seeds useBoardFilters. */
  filters: BoardFilters;
  /** The active tab, parsed from `?tab=` (page.tsx), so it survives leaving +
   *  returning and back/forward. 'board' (Open jobs) is the default. */
  initialTab: Tab;
  /** SSR page-1 board results for the active filters. */
  initialResults: Job[];
  /** SSR facet counts for the active filters (null on a fetch failure). */
  initialFacets: BoardFacets | null;
  /** SSR promoted (boosted) jobs for the active filters (BE caps at K). Shown in
   *  a labelled block above the organic list; de-duped out of `results`. */
  initialPromoted: Job[];
  mine: Job[];
  /** The viewer's own applications, enriched (job snapshot + employer + viewedAt). */
  myApplications: MyApplicationView[];
  stats: BoardStats;
  /** The viewer's own skills - drives the "matches your skills" ribbon on the
   *  Find work board (JobCard.matchedSkills). Empty when logged-out / no skills. */
  viewerSkills?: string[];
  /** The viewer's own user id - JobCard hides Save/Apply on the viewer's own jobs
   *  (owner-on-own-job). Empty string when unknown. */
  viewerId?: string;
  /** The viewer's already-applied job ids - JobCard renders a disabled "Applied"
   *  state for these (no second tap). */
  appliedJobIds?: string[];
  /** The viewer's saved job ids - seeds JobCard's filled-bookmark state. */
  savedJobIds?: string[];
  /** The viewer's bookmarked jobs (the "Saved" tab). Newest-saved first. */
  saved?: Job[];
}

export default function JobBoard({
  filters: initialFilters,
  initialTab,
  initialResults,
  initialFacets,
  initialPromoted,
  mine,
  myApplications,
  stats,
  viewerSkills = [],
  viewerId = '',
  appliedJobIds = [],
  savedJobIds = [],
  saved = [],
}: Props) {
  const t = useTranslations('connect.jobs');
  const tCat = useTranslations('connect.search.listing.category');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  // Seed from the LIVE URL on the client, the SSR initialTab on the server. On a
  // browser-back re-mount the App Router may restore a cached render whose
  // initialTab is stale, but the address bar still carries the `?tab=` we wrote, so
  // reading window.location here restores the right tab (no flash). First load:
  // initialTab already equals the URL parse, so SSR + client agree (no hydration
  // mismatch).
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return initialTab;
    const u = new URLSearchParams(window.location.search).get('tab');
    return u === 'mine' || u === 'myApplications' || u === 'saved' ? u : 'board';
  });
  // Tab switch = a navigation concern: mirror it into `?tab=` (preserving any board
  // filters already in the URL) so leaving the page and coming back - or browser
  // back/forward - restores the tab the user was on instead of resetting to Open
  // jobs. history.replaceState (not router) keeps it shallow, matching useBoardFilters.
  // 'board' is the default, so it drops the param (clean URL). Non-board tabs do not
  // change filters, so the filter hook never clobbers this.
  const selectTab = useCallback((next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === 'board') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, []);
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  // Plan-limit upgrade prompt for a blocked job post.
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();
  const [mineFilter, setMineFilter] = useState<MineFilter>('all');

  // My applications held in state (seeded from SSR) so a quick apply from a board
  // card reflects LIVE in the My applications tab + count + KPI without a reload.
  // JobCard -> JobApplyConfirm bubbles the created (enriched) application here.
  const [myApps, setMyApps] = useState<MyApplicationView[]>(myApplications);
  const [appsSort, setAppsSort] = useState<AppsSort>('recent');
  const handleApplied = (application: MyApplicationView) => {
    setMyApps((prev) =>
      prev.some((a) => a.jobId === application.jobId)
        ? prev.map((a) => (a.jobId === application.jobId ? application : a))
        : [application, ...prev],
    );
  };
  // Withdraw from the My applications list: flip the row to 'withdrawn' in place
  // (the card already toasted + called the BE). Keeps the count/badges consistent.
  const handleWithdrawn = (id: string) => {
    setMyApps((prev) => prev.map((a) => (a._id === id ? { ...a, status: 'withdrawn' } : a)));
  };
  // 'recent' = the SSR/prepend order (newest applied first). 'status' groups the
  // most actionable first (shortlisted -> ... -> withdrawn), createdAt desc tiebreak.
  const sortedApps = useMemo(() => {
    if (appsSort === 'recent') return myApps;
    return [...myApps].sort((a, b) => {
      const d = (APPS_STATUS_ORDER[a.status] ?? 9) - (APPS_STATUS_ORDER[b.status] ?? 9);
      return d !== 0 ? d : (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [myApps, appsSort]);
  const shortlistedCount = useMemo(
    () => myApps.filter((a) => a.status === 'shortlisted').length,
    [myApps],
  );

  // Server-driven Open tab: results + facet counts + the URL-synced filter state.
  const {
    filters,
    facets,
    results,
    total,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMoreError,
    setFilter,
    clearAll,
    loadMore,
    retry,
  } = useBoardFilters(initialFilters, initialResults, initialFacets);

  // Infinite scroll: auto-load the next board page when the bottom nears (mirrors
  // the marketplace). The BE pagination already exists (loadMore appends); this
  // just removes the manual tap. The "Load more" button stays as a fallback / the
  // error-retry affordance. Skips while loading or after an error.
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || tab !== 'board' || !hasMore || loadingMore || loadMoreError) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, hasMore, loadingMore, loadMoreError, loadMore]);

  // Search box is COMMIT-on-submit, not search-as-you-type: typing only updates
  // this local draft; the API call (setFilter -> hook fetch) fires on the Search
  // button or Enter. Avoids one request per keystroke at scale. The draft
  // re-syncs to the committed query whenever it changes externally (the "q"
  // active-filter chip, Clear all, or the mobile drawer). Mirrors RfqBoard.
  const [queryDraft, setQueryDraft] = useState(initialFilters.q ?? '');
  useEffect(() => {
    setQueryDraft(filters.q ?? '');
  }, [filters.q]);
  const commitSearch = () => setFilter({ q: queryDraft.trim() || undefined });
  const clearSearch = () => {
    setQueryDraft('');
    setFilter({ q: undefined });
  };

  const sort: Sort = filters.sort ?? 'recent';
  const view: 'list' | 'grid' = filters.view === 'grid' ? 'grid' : 'list';

  // ------- List / Grid view toggle (Phase 4) -------
  // The chosen layout for the Open tab. Links: filters.view round-trips through
  // the URL via useBoardFilters (history.replaceState writes `?view=`); we ALSO
  // persist it to localStorage so a returning user keeps their layout across
  // sessions / fresh visits with no `?view=` in the URL.
  //
  // Resolution order on load: `?view=` from SSR filters wins; absent -> default
  // `list`; then on mount we reconcile from localStorage - if storage has a value
  // and the URL did NOT carry one, we apply it via setFilter (which writes the URL
  // to match). One-shot guarded by reconciledViewRef so the reconcile never loops
  // (setFilter -> filters change -> effect re-run) and never fights an explicit URL.
  //
  // Gotcha: the control is HIDDEN below md (a grid is pointless on a phone and a
  // persisted grid must never break a narrow screen - see the grid container,
  // which also forces a single column on phones regardless of view).
  const reconciledViewRef = useRef(false);
  const onViewChange = useCallback(
    (next: 'list' | 'grid') => {
      setFilter({ view: next });
      // Analytics: which board layout candidates prefer (list vs grid). Fires only
      // on an explicit user toggle here, never on the localStorage reconcile effect.
      track('connect.jobs.view_toggled', { view: next });
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('connect.jobs.view', next);
        } catch {
          // Ignore a persistence failure; the URL still carries the choice.
        }
      }
    },
    [setFilter],
  );

  useEffect(() => {
    if (reconciledViewRef.current) return;
    reconciledViewRef.current = true;
    // Only apply the stored value when the URL did NOT specify a view (initial
    // filters had none). An explicit `?view=` always wins over localStorage.
    if (initialFilters.view) return;
    if (typeof window === 'undefined') return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem('connect.jobs.view');
    } catch {
      stored = null;
    }
    if (stored === 'grid' || stored === 'list') {
      setFilter({ view: stored });
    }
  }, [initialFilters.view, setFilter]);

  // Role-strip counts come from the facet aggregation (whole matching set), not
  // the loaded page. value -> count lookup.
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of facets?.role ?? []) counts[f.value] = f.count;
    return counts;
  }, [facets]);

  // Selected-skills array (filters.skills is csv on the wire; the chips/rail use
  // the parsed array). Used by both the rail and the active-filter chips.
  const selectedSkills = useMemo(
    () => (filters.skills ? filters.skills.split(',').filter(Boolean) : []),
    [filters.skills],
  );

  // Selected-roles array. Unified control: the role STRIP and the rail ROLE
  // section both read/write filters.roles (plural). The old singular filters.role
  // was retired from the board to avoid a dual-control desync (BE
  // plural-supersedes-singular). Used by the strip, the rail, and the active chips.
  const selectedRoles = useMemo(() => filters.roles ?? [], [filters.roles]);

  // -------- Promoted (boosted) jobs block (Phase 5) --------
  // First-party, NON-billing: the BE resolver returns up to K open,
  // filter-matching boosted jobs (default 3). We seed from SSR (initialPromoted)
  // for the first paint, then REFETCH client-side whenever the committed filters
  // change so the promoted set stays consistent with the active view. The refetch
  // sends the same facet-safe param set (sort/limit/skip stripped in the action),
  // so it does not pick up the layout-only `view` change. A monotonic request id
  // drops stale responses (fast filter taps).
  //
  // Gotcha: hidden entirely when there is an active text search (`filters.q`) - a
  // query should rank by relevance, not surface ads. We skip the visibility gate
  // by clearing the local list when `q` is set, so no stale promoted lingers.
  const [promoted, setPromoted] = useState<Job[]>(initialPromoted);
  const promotedReqRef = useRef(0);
  // Serialize the filter set the action actually keys on (everything but the
  // layout-only `view`, sort, and paging) so the effect refetches only when a
  // real filter changes - not on a list/grid toggle.
  const promotedFilterKey = useMemo(() => {
    const rest: Record<string, unknown> = { ...filters };
    delete rest.view;
    delete rest.sort;
    delete rest.limit;
    delete rest.skip;
    return JSON.stringify(rest);
  }, [filters]);
  const didMountPromotedRef = useRef(false);
  useEffect(() => {
    // First run reuses the SSR seed (initialPromoted already matches the SSR
    // filters); only refetch on a SUBSEQUENT filter change.
    if (!didMountPromotedRef.current) {
      didMountPromotedRef.current = true;
      return;
    }
    // No promoted block while a text search is active; clear and skip the call.
    if (filters.q?.trim()) {
      setPromoted([]);
      return;
    }
    const reqId = ++promotedReqRef.current;
    void (async () => {
      const res = await listPromotedJobs(filters);
      // Drop a stale response (a newer filter change has superseded this one).
      if (reqId !== promotedReqRef.current) return;
      setPromoted(res.ok ? res.data : []);
    })();
    // promotedFilterKey captures the relevant filter slice; `filters` is read
    // inside but intentionally excluded so a `view` toggle does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotedFilterKey]);

  // Show the promoted block ONLY on the Open tab, with NO active text search, and
  // only when the resolver returned something. (Page-1-only is implicit: promoted
  // is never appended on Load more.)
  const showPromoted = tab === 'board' && !filters.q?.trim() && promoted.length > 0;
  // De-dupe: a promoted job must never also appear in the organic list below. Keep
  // promoted as-is and filter its ids OUT of the organic results when the block
  // is visible.
  const promotedIds = useMemo(
    () => (showPromoted ? new Set(promoted.map((j) => j._id)) : new Set<string>()),
    [showPromoted, promoted],
  );
  const organicResults = useMemo(
    () => (promotedIds.size ? results.filter((j) => !promotedIds.has(j._id)) : results),
    [results, promotedIds],
  );

  // Analytics: a promoted block was actually shown (>=1 boosted job) for a given
  // filter set. Fires ONCE per distinct filter set (keyed on promotedFilterKey) so
  // a list/grid toggle or a re-render does not re-count the same impression. Pairs
  // with connect.jobs.promoted_click (fired from the card open below).
  const promotedImpressionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showPromoted || promoted.length === 0) return;
    if (promotedImpressionKeyRef.current === promotedFilterKey) return;
    promotedImpressionKeyRef.current = promotedFilterKey;
    track('connect.jobs.promoted_impression', { count: promoted.length });
  }, [showPromoted, promoted.length, promotedFilterKey]);

  // A promoted card was opened (its title link tapped). { jobId } so boost
  // performance is measurable against impressions. Passed into PromotedJobs ->
  // JobCard's onOpen (only wired for the promoted block, never the organic list).
  const onPromotedClick = useCallback((jobId: string) => {
    track('connect.jobs.promoted_click', { jobId });
  }, []);

  // Batch employer identity for the board cards (page name+logo / person name).
  // Resolves only NEW ids on Load more and merges (see useBoardEmployers). We feed
  // BOTH the organic results and the promoted jobs so a boosted card that is not in
  // the organic page still gets its employer row resolved.
  const employerInput = useMemo(
    () => (promoted.length ? [...promoted, ...results] : results),
    [promoted, results],
  );
  const employers = useBoardEmployers(employerInput);

  // O(1) membership lookups for the Save / Apply card states. Seeded from SSR
  // (appliedJobIds) UNION the live myApps, so a card just applied-to via the modal
  // immediately reads as "Applied" everywhere it appears (organic + saved tabs).
  const appliedSet = useMemo(
    () => new Set<string>([...appliedJobIds, ...myApps.map((a) => a.jobId)]),
    [appliedJobIds, myApps],
  );
  const savedSet = useMemo(() => new Set(savedJobIds), [savedJobIds]);

  // -------- Mobile filter drawer (staged) --------
  // Below the md breakpoint the rail lives in a Drawer; toggling a filter there
  // STAGES locally (no fetch per tap) and is applied in ONE batch via "Show N
  // jobs". This matters on slow-3G where a round-trip per tap is painfully slow;
  // desktop keeps apply-on-change for the instant-feedback feel. While the drawer
  // is closed, staged === null and the rail (desktop) drives the live hook.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [staged, setStaged] = useState<BoardFilters | null>(null);

  const openDrawer = useCallback(() => {
    setStaged(filters);
    setDrawerOpen(true);
  }, [filters]);

  const stageFilter = useCallback((patch: Partial<BoardFilters>) => {
    setStaged((prev) => ({ ...(prev ?? {}), ...patch }));
  }, []);

  const applyStaged = useCallback(() => {
    if (staged) {
      // setFilter merges, so a field the user CLEARED in the drawer (absent from
      // `staged`) would otherwise survive from the live filters. Build an explicit
      // patch over EVERY filter field (incl. the non-rail q/role/category/pay so a
      // drawer "Clear all" actually clears them), defaulting cleared ones to
      // undefined - applying the staged set is then a true replacement, not a merge.
      setFilter({
        q: staged.q,
        category: staged.category,
        role: staged.role,
        roles: staged.roles,
        wageType: staged.wageType,
        districts: staged.districts,
        district: staged.district,
        employmentTypes: staged.employmentTypes,
        machineTypes: staged.machineTypes,
        skills: staged.skills,
        payMin: staged.payMin,
        payMax: staged.payMax,
        postedWithinDays: staged.postedWithinDays,
        includeFilled: staged.includeFilled,
        sort: staged.sort,
      });
    }
    setDrawerOpen(false);
  }, [staged, setFilter]);

  const clearStaged = useCallback(() => {
    setStaged((prev) => ({ sort: prev?.sort ?? 'recent', view: prev?.view }));
  }, []);

  // "Jobs I posted" history: status counts + the active-status slice (client side).
  const mineCounts = useMemo(() => {
    const c = { all: mine.length, open: 0, filled: 0, closed: 0 };
    for (const j of mine) c[j.status] += 1;
    return c;
  }, [mine]);
  const filteredMine = useMemo(
    () => (mineFilter === 'all' ? mine : mine.filter((j) => j.status === mineFilter)),
    [mine, mineFilter],
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    const humanize = (v: string) => v.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    const removeFrom = (arr: string[], v: string) => {
      const next = arr.filter((x) => x !== v);
      return next.length ? next : undefined;
    };
    // Category survives only as a deep-link param (removed from the rail Phase 2).
    if (filters.category)
      chips.push({
        key: 'category',
        label: tCat(filters.category),
        clear: () => setFilter({ category: undefined }),
      });
    // Role is now MULTI-select (unified strip + rail on filters.roles): one chip
    // per selected role, each removing just that role from the array.
    for (const r of selectedRoles)
      chips.push({
        key: `role-${r}`,
        label: (JOB_ROLE_PRESETS as readonly string[]).includes(r)
          ? t(`roleName.${r}`)
          : humanize(r),
        clear: () => setFilter({ roles: removeFrom(selectedRoles, r) }),
      });
    if (filters.wageType)
      chips.push({
        key: 'wageType',
        label: t(`workType.${filters.wageType}`),
        clear: () => setFilter({ wageType: undefined }),
      });
    for (const d of filters.districts ?? [])
      chips.push({
        key: `district-${d}`,
        label: humanize(d),
        clear: () => setFilter({ districts: removeFrom(filters.districts ?? [], d) }),
      });
    for (const e of filters.employmentTypes ?? [])
      chips.push({
        key: `emp-${e}`,
        label: t(`employmentTypeOpt.${e}`),
        clear: () => setFilter({ employmentTypes: removeFrom(filters.employmentTypes ?? [], e) }),
      });
    for (const m of filters.machineTypes ?? [])
      chips.push({
        key: `machine-${m}`,
        label: humanize(m),
        clear: () => setFilter({ machineTypes: removeFrom(filters.machineTypes ?? [], m) }),
      });
    for (const s of selectedSkills)
      chips.push({
        key: `skill-${s}`,
        label: s,
        clear: () => {
          const next = removeFrom(selectedSkills, s);
          setFilter({ skills: next ? next.join(',') : undefined });
        },
      });
    if (filters.postedWithinDays != null) {
      const postedKey =
        filters.postedWithinDays === 1
          ? 'filters.posted24h'
          : filters.postedWithinDays === 7
            ? 'filters.postedWeek'
            : 'filters.postedMonth';
      chips.push({
        key: 'posted',
        label: t(postedKey),
        clear: () => setFilter({ postedWithinDays: undefined }),
      });
    }
    if (filters.includeFilled === true)
      chips.push({
        key: 'includeFilled',
        label: t('filters.includesFilled'),
        clear: () => setFilter({ includeFilled: undefined }),
      });
    if (filters.q?.trim())
      chips.push({
        key: 'q',
        label: `"${filters.q.trim()}"`,
        clear: () => setFilter({ q: undefined }),
      });
    return chips;
  }, [filters, selectedSkills, selectedRoles, t, tCat, setFilter]);

  const handlePost = async (payload: CreateJobPayload) => {
    setPosting(true);
    try {
      const res = await createJob(payload);
      if (!res.ok) {
        // Plan-limit block shows the shared upgrade dialog, not a toast.
        if (handleLimited(res)) return;
        msgApi.error(res.error);
        return;
      }
      void msgApi.success(t('postSuccess'));
      setComposerOpen(false);
      router.push(`/connect/jobs/${res.data._id}`);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setPosting(false);
    }
  };

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'board', label: t('tabBoard'), count: stats.openTotal },
    { key: 'myApplications', label: t('tabMyApplications'), count: myApps.length },
    { key: 'saved', label: t('tabSaved'), count: saved.length },
    { key: 'mine', label: t('tabMine'), count: mine.length },
  ];

  // Truly-empty board (no jobs at all) vs over-filtered (filters yield 0). Derived
  // from the filters directly - NOT from activeChips - so a filter that is not
  // represented as a chip (the salary range was the bug) can never be mistaken for
  // "no filters" and wrongly trigger the full-screen "post a job" empty state that
  // hides the rail. Mirrors the rail's hasAny. Keep in sync with JobFilterRail.
  const anyFilterActive =
    (filters.districts?.length ?? 0) > 0 ||
    selectedRoles.length > 0 ||
    (filters.employmentTypes?.length ?? 0) > 0 ||
    (filters.machineTypes?.length ?? 0) > 0 ||
    selectedSkills.length > 0 ||
    filters.payMin != null ||
    filters.payMax != null ||
    filters.postedWithinDays != null ||
    filters.includeFilled != null ||
    Boolean(filters.q?.trim()) ||
    Boolean(filters.category) ||
    Boolean(filters.wageType);

  // md:min-h pushes the (global) Connect footer to the bottom of the viewport on a
  // sparse page (e.g. 1 application) instead of letting it float mid-screen.
  // Page-scoped (this ConnectPage instance only) so the inbox/console/ERP full-
  // height layouts are untouched. Offset ~ header + footer + gaps; tune if a sliver
  // of scroll appears. Desktop only - mobile flows under the fixed bottom nav.
  return (
    <ConnectPage className="flex gap-5 md:min-h-[calc(100dvh-12rem)]">
      {limitDialog}
      <main className="min-w-0 flex-1">
        {ctx}
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('boardTitle')}
            </h1>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('boardSubtitle')}
            </p>
          </div>
          <DsButton dsVariant="primary" onClick={() => setComposerOpen(true)}>
            <PlusCircle size={16} aria-hidden /> {t('postCta')}
          </DsButton>
        </header>

        {/* KPI strip - SEEKER-focused (this page is a candidate's job board): Open
            jobs / New today / Your applications / Saved. The employer "Jobs you
            posted" metric was removed - it duplicates the "My jobs" tab count and
            is not a seeker signal. Counts are real (board/stats + loaded lists). */}
        <KpiStrip className="mb-4">
          <KpiCard
            icon={Briefcase}
            tone="indigo"
            value={stats.openTotal}
            label={t('kpi.openJobs')}
          />
          <KpiCard icon={Sparkles} tone="amber" value={stats.newToday} label={t('kpi.newToday')} />
          <KpiCard
            icon={Send}
            tone="gold"
            value={myApps.length}
            label={t('kpi.yourApplications')}
          />
          <KpiCard icon={Bookmark} tone="green" value={saved.length} label={t('kpi.saved')} />
        </KpiStrip>

        {/* Underline tabs. Mobile: a single horizontally-scrollable row (no wrap) so
            4 labelled tabs + count chips never break onto two lines on a narrow
            screen - you swipe to reach overflow tabs. Each tab is shrink-0 +
            whitespace-nowrap; the scrollbar is hidden for polish. gap-x lifts to a
            roomier spacing once there is desktop width. */}
        <div
          role="tablist"
          aria-label={t('viewSwitcherAria')}
          className="mb-4 flex gap-x-1 gap-y-0 overflow-x-auto sm:gap-x-2 [&::-webkit-scrollbar]:hidden"
          style={{ borderBottom: '1px solid var(--cr-divider)', scrollbarWidth: 'none' }}
        >
          {tabs.map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(tb.key)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 sm:px-3.5"
                style={{
                  color: active ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                  borderBottom: `2px solid ${active ? 'var(--cr-primary)' : 'transparent'}`,
                  marginBottom: -1,
                  outlineColor: 'var(--cr-primary)',
                }}
              >
                {tb.label}
                <span
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums"
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

        {tab === 'board' &&
          (results.length === 0 && !anyFilterActive && !loading ? (
            <ConnectEmptyState
              icon={<Briefcase size={24} aria-hidden />}
              title={t('emptyBoardTitle')}
              description={t('emptyBoardBody')}
              primaryAction={{ label: t('postCta'), onClick: () => setComposerOpen(true) }}
            />
          ) : (
            <>
              {/* Search band - commit-on-submit: typing updates the draft, the
                  API call fires on the Search button or Enter (not per keystroke).
                  The X clears the box + the committed query. */}
              <div
                className="mb-3 flex items-center gap-2 rounded-[var(--cr-radius-lg)] py-1.5 pr-1.5 pl-3.5"
                style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
              >
                <Search size={18} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
                <input
                  value={queryDraft}
                  onChange={(e) => setQueryDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitSearch();
                    }
                  }}
                  aria-label={t('searchLabel')}
                  placeholder={t('searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[14px] outline-none"
                  style={{ color: 'var(--cr-text)' }}
                />
                {queryDraft && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label={t('clearSearchAria')}
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
                <DsButton dsVariant="primary" dsSize="sm" onClick={commitSearch}>
                  <Search size={14} aria-hidden /> {t('searchCta')}
                </DsButton>
              </div>

              {/* Role strip - MULTI-select, unified on filters.roles (the SAME
                  array the rail ROLE section drives). "All roles" clears the
                  array; each pill toggles its key in/out. Unified to avoid a
                  dual-control desync with the rail (BE plural-supersedes-singular,
                  so the old singular filters.role fought a rail roles pick).
                  Counts from the facet aggregation (whole matching set). */}
              <nav
                aria-label={t('roleStripAria')}
                className="mb-4 flex gap-2 overflow-x-auto pb-1.5"
              >
                <RolePill
                  icon={LayoutGrid}
                  label={t('allRoles')}
                  count={facets?.total ?? results.length}
                  active={!selectedRoles.length}
                  onClick={() => setFilter({ roles: undefined })}
                />
                {ROLES.map(({ key, icon }) => (
                  <RolePill
                    key={key}
                    icon={icon}
                    label={t(`roleName.${key}`)}
                    count={roleCounts[key] ?? 0}
                    active={selectedRoles.includes(key)}
                    onClick={() => setFilter({ roles: toggleRole(selectedRoles, key) })}
                  />
                ))}
              </nav>

              {/* Mobile: a "Filters (N)" button opens the staged drawer. The desktop
                  rail column is hidden below md; see the Drawer at the end of this tab. */}
              <div className="mb-3 md:hidden">
                <button
                  type="button"
                  onClick={openDrawer}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                  style={{
                    border: '1px solid var(--cr-border)',
                    background: 'var(--cr-surface)',
                    color: 'var(--cr-text-2)',
                    outlineColor: 'var(--cr-primary)',
                  }}
                >
                  <SlidersHorizontal size={15} aria-hidden />
                  {activeChips.length > 0
                    ? t('filters.filtersButtonCount', { count: activeChips.length })
                    : t('filters.filtersButton')}
                </button>
              </div>

              {/* grid-cols-1 base + min-w-0 results column: the bare `grid` with
                  only a md: column def falls back to a non-shrinkable `auto`
                  track on mobile, which the results content inflates past the
                  viewport. Same mobile-overflow guard as /connect/marketplace. */}
              <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[230px_minmax(0,1fr)]">
                {/* Desktop rail: live (apply-on-change). Hidden on mobile (drawer instead). */}
                <div className="hidden md:block">
                  <JobFilterRail
                    filters={filters}
                    facets={facets}
                    setFilter={setFilter}
                    onClearAll={clearAll}
                  />
                </div>
                <div className="min-w-0">
                  {/* Result header: "N jobs match your filters - {city}". City =
                      the active district only when EXACTLY one is selected (the
                      viewer's area is not plumbed to this page, so otherwise we
                      omit the city). total comes from the facet aggregation. */}
                  <h2
                    className="m-0 mb-2 text-[15px] font-bold"
                    style={{ color: 'var(--cr-text)' }}
                  >
                    {(filters.districts?.length ?? 0) === 1
                      ? t('resultHeaderCity', {
                          count: total,
                          city: humanizeCity(filters.districts![0]),
                        })
                      : t('resultHeader', { count: total })}
                  </h2>

                  {/* Results toolbar. The count was de-duped: the result count
                      lives ONLY in the h2 above ("N jobs match your filters - city");
                      the old secondary "N jobs" line here was removed. Controls are
                      right-aligned (justify-end) now that the left label is gone. */}
                  <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                    <div className="flex items-center gap-3">
                      {/* List / Grid segmented control. Hidden below md (a grid is
                          pointless on a phone) AND when total < 6 (a grid adds
                          nothing at low counts). 44px targets + focus-visible +
                          aria-pressed per option via the labelled buttons. */}
                      {total >= GRID_TOGGLE_MIN && (
                        <Segmented
                          className="hidden cursor-pointer md:inline-flex"
                          aria-label={t('viewToggleAria')}
                          value={view}
                          onChange={(v) => onViewChange(v as 'list' | 'grid')}
                          options={[
                            {
                              value: 'list',
                              label: (
                                <span
                                  role="button"
                                  aria-pressed={view === 'list'}
                                  aria-label={t('viewList')}
                                  className="inline-flex h-11 cursor-pointer items-center gap-1.5 px-1 text-[12.5px] font-semibold"
                                >
                                  <List size={15} aria-hidden /> {t('viewList')}
                                </span>
                              ),
                            },
                            {
                              value: 'grid',
                              label: (
                                <span
                                  role="button"
                                  aria-pressed={view === 'grid'}
                                  aria-label={t('viewGrid')}
                                  className="inline-flex h-11 cursor-pointer items-center gap-1.5 px-1 text-[12.5px] font-semibold"
                                >
                                  <LayoutGrid size={15} aria-hidden /> {t('viewGrid')}
                                </span>
                              ),
                            },
                          ]}
                        />
                      )}
                      {/* Sort: an AntD Select (was a native <select> whose browser
                          chevron crammed the right edge + clashed with the rail's
                          AntD controls). AntD gives the proper caret + padding and
                          matches the rest of the rail. Fixed width fits the longest
                          option ("Most recent") without truncation. */}
                      {/* Sort group: full-width on phones (the grid toggle is hidden
                          < md so this is the lone control) and fixed-width from sm up. */}
                      <div
                        className="flex w-full items-center gap-1.5 text-[12px] sm:w-auto"
                        style={{ color: 'var(--cr-text-4)' }}
                      >
                        <span>{t('sortLabel')}</span>
                        <Select
                          size="small"
                          value={sort}
                          onChange={(v) => setFilter({ sort: v as Sort })}
                          aria-label={t('sortLabel')}
                          // Fluid: fills the row on a phone, 150px from sm up (fits
                          // the longest option without truncation on desktop).
                          className="flex-1 sm:flex-none"
                          style={{ minWidth: 0, width: '100%', maxWidth: 150 }}
                          options={[
                            { value: 'recent', label: t('sortBy.recent') },
                            { value: 'openings', label: t('sortBy.openings') },
                            { value: 'closing', label: t('sortBy.closing') },
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active-filter chips */}
                  {activeChips.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2" aria-label={t('activeFiltersAria')}>
                      {activeChips.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={c.clear}
                          aria-label={t('removeFilterAria', { label: c.label })}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[12px] font-semibold"
                          style={{
                            background: 'var(--cr-primary-light)',
                            color: 'var(--cr-primary)',
                            border: '1px solid var(--cr-primary-border)',
                          }}
                        >
                          {c.label}
                          <X size={13} aria-hidden />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Promoted (boosted) jobs: a labelled block ABOVE the organic
                      list (Open tab + no text search; de-duped from results - see
                      organicResults). Renders nothing when empty. */}
                  {showPromoted && (
                    <PromotedJobs
                      jobs={promoted}
                      view={view}
                      viewerSkills={viewerSkills}
                      viewerId={viewerId}
                      savedSet={savedSet}
                      appliedSet={appliedSet}
                      employers={employers}
                      onJobOpen={onPromotedClick}
                      onApplied={handleApplied}
                    />
                  )}

                  {/* Facet/results fetch failure: retry affordance. */}
                  {error ? (
                    <ConnectEmptyState
                      variant="inline"
                      icon={<Briefcase size={24} aria-hidden />}
                      title={t('boardErrorTitle')}
                      description={error}
                      primaryAction={{ label: t('retry'), onClick: retry }}
                    />
                  ) : loading ? (
                    // Filter-change refetch in flight: show skeleton cards (a proper
                    // loader) instead of a blank/dimmed area. `loading` is the main
                    // refetch only - Load more uses loadingMore, so the real list
                    // stays put while paginating. Skeleton count + grid classes match
                    // the real list so the swap is shift-free.
                    <ul
                      className="m-0 grid list-none gap-3 p-0"
                      // Grid view = container-aware columns (auto-fill minmax), NOT
                      // viewport-keyed grid-cols: the results column is only ~560px
                      // wide here (a 230px filter rail sits left + the right rail), so
                      // xl:grid-cols-3 produced ~178px cards that crushed each card's
                      // header. Mirrors /connect/marketplace. Keep in sync with the
                      // real list below + PromotedJobs + JobCard's isGrid header.
                      style={
                        view === 'grid'
                          ? {
                              gridTemplateColumns:
                                'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
                            }
                          : undefined
                      }
                      aria-busy
                      aria-label={t('boardListAria')}
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <li key={i}>
                          <JobCardSkeleton />
                        </li>
                      ))}
                    </ul>
                  ) : organicResults.length === 0 ? (
                    // Suppress the "no jobs match" empty state while the promoted
                    // block is the only thing showing - the surface is not empty.
                    showPromoted ? null : (
                      <ConnectEmptyState
                        variant="inline"
                        icon={<Briefcase size={24} aria-hidden />}
                        title={t('emptyFilteredTitle')}
                        description={t('emptyFilteredBody')}
                        primaryAction={{ label: t('filters.clear'), onClick: clearAll }}
                      />
                    )
                  ) : (
                    <>
                      {/* List = single column; grid = responsive (single column on
                          phones regardless, so a persisted grid never breaks a
                          narrow screen). variant is passed to each JobCard so its
                          inner action row adapts (see JobCard variant prop). */}
                      <ul
                        className="m-0 grid list-none gap-3 p-0"
                        // Container-aware grid columns (see the skeleton ul above):
                        // auto-fill minmax keeps cards a usable width inside the
                        // narrow results column instead of squeezing 3 viewport-keyed
                        // columns into ~178px each.
                        style={
                          view === 'grid'
                            ? {
                                gridTemplateColumns:
                                  'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
                              }
                            : undefined
                        }
                        aria-label={t('boardListAria')}
                      >
                        {organicResults.map((j) => (
                          <li key={j._id}>
                            <JobCard
                              job={j}
                              variant={view}
                              matchedSkills={viewerSkills}
                              employer={employers[j._id]}
                              viewerId={viewerId}
                              initialSaved={savedSet.has(j._id)}
                              alreadyApplied={appliedSet.has(j._id)}
                              onApplied={handleApplied}
                            />
                          </li>
                        ))}
                      </ul>

                      {/* Load more: auto-loads when this nears the viewport (the
                          IntersectionObserver above watches the sentinel); the
                          button stays as a fallback + the error-retry. Appends;
                          never refetches facets. */}
                      {hasMore && (
                        <div
                          ref={loadMoreSentinelRef}
                          className="mt-4 flex flex-col items-center gap-2"
                        >
                          {loadMoreError && (
                            <span
                              role="alert"
                              className="text-[12.5px]"
                              style={{ color: 'var(--cr-error)' }}
                            >
                              {loadMoreError}
                            </span>
                          )}
                          <DsButton dsVariant="secondary" onClick={loadMore} disabled={loadingMore}>
                            {loadingMore ? t('loadingMore') : t('loadMore')}
                          </DsButton>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          ))}

        {tab === 'mine' &&
          (mine.length === 0 ? (
            <ConnectEmptyState
              icon={<Briefcase size={24} aria-hidden />}
              title={t('emptyMineTitle')}
              description={t('emptyMineBody')}
              primaryAction={{ label: t('postCta'), onClick: () => setComposerOpen(true) }}
            />
          ) : (
            <>
              {/* Traction nudge: surface a calm "boost it" prompt when one of the
                  owner's open jobs is getting real views. Owner-scoped + globally
                  rate-limited server-side (BoostNudgeSlot). */}
              <BoostNudgeSlot kind="job" className="mb-4 max-w-xl" />
              {/* Over-limit (grandfathering) notice when over the open-jobs cap.
                  Policy-aware + dismissable per session; invisible under freeze. */}
              <OverLimitBanner kind="job" className="mb-4 max-w-xl" />
              {/* Person-wide open-jobs usage vs plan cap (GET /me/connect/usage).
                  At-cap heads-up now rides on the meter's info icon, not a banner. */}
              <ConnectUsageMeter kind="job" surface="jobs" className="mb-4 max-w-sm" />
              {/* Status filter over the owner's full posting history. */}
              <div
                className="mb-4 flex flex-wrap gap-2"
                role="tablist"
                aria-label={t('mineFilterAria')}
              >
                {(
                  [
                    { key: 'all', label: t('statusAll') },
                    { key: 'open', label: t('status.open') },
                    { key: 'filled', label: t('status.filled') },
                    { key: 'closed', label: t('status.closed') },
                  ] as const
                ).map((f) => {
                  const active = mineFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setMineFilter(f.key)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
                      style={{
                        border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                        background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
                        color: active ? '#fff' : 'var(--cr-text-2)',
                      }}
                    >
                      {f.label}
                      <span
                        className="text-[11px]"
                        style={{ color: active ? 'rgba(255,255,255,0.75)' : 'var(--cr-text-4)' }}
                      >
                        {mineCounts[f.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {filteredMine.length === 0 ? (
                <p
                  className="m-0 py-6 text-center text-[13px]"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {t('mineNoneInStatus')}
                </p>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('mineListAria')}>
                  {filteredMine.map((j) => (
                    <li key={j._id}>
                      <JobCard job={j} showOwnerStats />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ))}

        {tab === 'myApplications' &&
          (myApps.length === 0 ? (
            // Real empty state with a way forward: a "Browse open jobs" CTA that
            // switches to the Open tab (no nav, just selectTab) so a seeker with no
            // applications is not stuck on a dead screen.
            <ConnectEmptyState
              icon={<Send size={24} aria-hidden />}
              title={t('emptyMyApplicationsTitle')}
              description={t('emptyMyApplicationsBody')}
              primaryAction={{ label: t('browseOpenJobs'), onClick: () => selectTab('board') }}
            />
          ) : (
            <>
              {/* Header: total count (+ shortlisted highlight) on the left, sort on
                  the right - mirrors the Open tab's result toolbar. */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                  <span className="font-bold" style={{ color: 'var(--cr-text-2)' }}>
                    {t('myApps.headerCount', { count: myApps.length })}
                  </span>
                  {shortlistedCount > 0 && (
                    <> · {t('myApps.headerShortlisted', { count: shortlistedCount })}</>
                  )}
                </p>
                {/* Sort group: full-width on phones (wraps under the count line via the
                    parent flex-wrap), fixed-width from sm up. */}
                <div
                  className="flex w-full items-center gap-1.5 text-[12px] sm:w-auto"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  <span>{t('sortLabel')}</span>
                  <Select
                    size="small"
                    value={appsSort}
                    onChange={(v) => setAppsSort(v as AppsSort)}
                    aria-label={t('sortLabel')}
                    // Fluid: fills the row on a phone, 160px from sm up.
                    className="flex-1 sm:flex-none"
                    style={{ minWidth: 0, width: '100%', maxWidth: 160 }}
                    options={[
                      { value: 'recent', label: t('myApps.sortRecent') },
                      { value: 'status', label: t('myApps.sortStatus') },
                    ]}
                  />
                </div>
              </div>
              <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('myApplicationsListAria')}>
                {sortedApps.map((a) => (
                  <li key={a._id}>
                    <MyApplicationCard application={a} onWithdrawn={handleWithdrawn} />
                  </li>
                ))}
              </ul>
            </>
          ))}

        {tab === 'saved' &&
          (saved.length === 0 ? (
            // "Browse open jobs" CTA switches to the Open tab (consistent with the
            // My-applications empty state). Bookmark icon matches the Save action.
            <ConnectEmptyState
              icon={<Bookmark size={24} aria-hidden />}
              title={t('emptySavedTitle')}
              description={t('emptySavedBody')}
              primaryAction={{ label: t('browseOpenJobs'), onClick: () => selectTab('board') }}
            />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('savedListAria')}>
              {saved.map((j) => (
                <li key={j._id}>
                  {/* Every job in this tab is saved, so seed the filled bookmark
                      (initialSaved). Also pass viewerId/alreadyApplied so the
                      Save/Apply states match the Open tab. */}
                  <JobCard
                    job={j}
                    matchedSkills={viewerSkills}
                    viewerId={viewerId}
                    initialSaved
                    alreadyApplied={appliedSet.has(j._id)}
                    onApplied={handleApplied}
                  />
                </li>
              ))}
            </ul>
          ))}

        <JobComposer
          open={composerOpen}
          submitting={posting}
          // "Start from a past job": the poster's own jobs (already fetched for the
          // "Jobs I posted" tab) seed the in-modal template picker - no extra fetch.
          templates={mine}
          onClose={() => setComposerOpen(false)}
          onSubmit={handlePost}
        />

        {/* Mobile staged-filter drawer. The rail edits `staged` (no fetch per tap);
            the sticky footer applies the whole staged set in ONE round-trip via
            setFilter. `destroyOnHidden` drops the staged subtree when closed.
            AntD v6: `open` + `size` (not visible/width). */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="bottom"
          size="large"
          destroyOnHidden
          title={t('filters.title')}
          // Drawer footer keeps the apply button pinned to the bottom (sticky) so
          // the staged set is always one tap away no matter how long the rail is.
          footer={
            <DsButton dsVariant="primary" fullWidth onClick={applyStaged}>
              {t('filters.showNJobs', { count: total })}
            </DsButton>
          }
        >
          {staged && (
            <JobFilterRail
              filters={staged}
              facets={facets}
              setFilter={stageFilter}
              onClearAll={clearStaged}
            />
          )}
        </Drawer>
        {/* Mobile-only Google unit (boosted jobs already serve in the column on
            all widths, so pass null = Google-only). The rail is hidden below xl. */}
        <MobileAdInline promoted={null} />
      </main>

      <ConnectRightRail>
        {/* How hiring works: a numbered 3-step explainer (matches the reference).
            Copy is the real flow (find -> shortlisted -> hired); no fabricated
            caller-ID claim. Steps live in i18n rail.s{1,2,3}{Title,Body}. */}
        <RailPanel title={t('rail.title')}>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                  style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
                >
                  {n}
                </span>
                <div className="min-w-0">
                  <p
                    className="m-0 text-[12.5px] font-semibold"
                    style={{ color: 'var(--cr-text-2)' }}
                  >
                    {t(`rail.s${n}Title`)}
                  </p>
                  <p
                    className="m-0 mt-0.5 text-[12px] leading-relaxed"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    {t(`rail.s${n}Body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </RailPanel>
      </ConnectRightRail>
    </ConnectPage>
  );
}

/** Humanize a district slug for the result header city (dashes/underscores to
 *  spaces, first letter capitalized). Mirrors the inline `humanize` used by the
 *  active-filter chips so the city label reads the same way. */
function humanizeCity(v: string): string {
  return v.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Toggle a role key in/out of the selected-roles array (add if absent, remove if
 *  present). Returns undefined when empty so filters.roles is cleared from the URL
 *  rather than carrying []. Shared by the role strip; the rail uses its own
 *  toggleIn but the contract is identical (filters.roles is the single source). */
function toggleRole(roles: string[], key: string): string[] | undefined {
  const next = roles.includes(key) ? roles.filter((r) => r !== key) : [...roles, key];
  return next.length ? next : undefined;
}

function RolePill({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
        background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
        color: active ? '#fff' : 'var(--cr-text-2)',
      }}
    >
      <Icon
        size={15}
        aria-hidden
        style={{ color: active ? 'var(--cr-gold-400)' : 'var(--cr-gold-700)' }}
      />
      {label}
      <span
        className="text-[11px]"
        // Inactive count bumped from --cr-text-5 (3.17:1, fails AA on white) to
        // --cr-text-4 (5.55:1) so the small count stays readable in sunlight.
        style={{ color: active ? 'rgba(255,255,255,0.85)' : 'var(--cr-text-4)' }}
      >
        {count}
      </span>
    </button>
  );
}
