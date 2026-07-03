'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { App, Segmented } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Briefcase,
  ChevronRight,
  Gauge,
  Globe,
  GraduationCap,
  Info,
  LayoutDashboard,
  Languages,
  Layers,
  Package,
  PenSquare,
  Settings,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
} from 'lucide-react';
import { ConnectPage, Composer, Rail, RailPanel, useAnnouncer } from '@/components/connect';
import { KpiCard, KpiStrip } from '@/components/connect/KpiStrip';
import AdSlot from '@/components/connect/AdSlot';
// First-party promoted-listing boost card for the rail (placement
// `company_manage`). Resolved server-side in app/connect/pages/[id]/page.tsx;
// sits between the Google connect.right.top slot and a house promo. This
// previously bare rail now mirrors the storefront-manage rail's ad inventory.
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '../marketplace/PromotedListingAdCard';
// Mobile inline ad: the manage rail is hidden below xl, so render the same boost
// + Google slot in the content column for phone/tablet.
import MobileAdInline from '../ads/MobileAdInline';
import DsButton from '@/components/ui/DsButton';
import { useShellTitle } from '@/lib/shell-title';
import { parseApiError } from '@/lib/utils';
import CompanyPageManageHeader from './CompanyPageManageHeader';
import CompanyPageShareCard from './CompanyPageShareCard';
import CompanyPageSetupChecklist, { buildSetupSteps } from './CompanyPageSetupChecklist';
import CompanyPagePostsList from './CompanyPagePostsList';
import CompanyJobsManager from './CompanyJobsManager';
import CompanyPageStoreTab from './CompanyPageStoreTab';
import CredentialRequestsPanel from './CredentialRequestsPanel';
import InviteStudentsPanel from './InviteStudentsPanel';
import DeletePageConfirmModal from './DeletePageConfirmModal';
import { languageLabel } from './company-labels';
import { categoryLabel } from '../search.types';
import { updateCompanyPage, deleteCompanyPage } from './company-page.actions';
import type {
  CompanyPage,
  CompanyPageStat,
  Storefront,
  PendingCredentialRequest,
  PageInviteSummary,
} from './entities.types';
import type { HydratedFeedPage } from '../feed.types';
import type { Job } from '../jobs/jobs.types';
import './ManageCompanyPageScreen.css';

// 'credentials' (the institute credential-review queue) + 'students' (the bulk
// invite flow) are institute-only tabs (Institutes Phase 2, Feature 3); the
// 'students' key matches the W2 "Invite students" CTA deep-link.
type ManageTab =
  | 'overview'
  | 'about'
  | 'store'
  | 'posts'
  | 'jobs'
  | 'credentials'
  | 'students'
  | 'settings';

interface Props {
  page: CompanyPage;
  /** This page's real KPI row (followers / 30-day posts / open jobs). */
  stat?: CompanyPageStat;
  /** All of the owner's pages (drives the header switcher). */
  pages?: { id: string; name: string }[];
  postsPage?: HydratedFeedPage;
  jobs?: Job[];
  /** The storefront attached to this page (owner view, any visibility), or null.
   *  SSR-fed from the route loader so the Store tab has no fetch flash. */
  store?: Storefront | null;
  /** Institute-only (Phase 2 Feature 3): the pending credential-confirmation
   *  requests, SSR-fed so the Credentials tab has no fetch flash. Empty on a
   *  business page or when the load degraded. */
  credentialRequests?: PendingCredentialRequest[];
  /** Institute-only (Phase 2 Feature 3): the first-touch student-invite roll-up
   *  (joined + pending), SSR-fed. Defaults to zeros on a business page or a
   *  degraded load. */
  inviteSummary?: PageInviteSummary;
  /** First-party promoted-listing boost for the rail, or null on a no-fill. */
  promoted?: PromotedListingResolved | null;
}

/**
 * ManageCompanyPageScreen - the Company Page management console. A header card
 * (cover + logo + status + switcher + public URL + actions), a KPI strip of the
 * three REAL page metrics (followers, 30-day posts, open jobs), and Segmented
 * tabs: Overview (setup checklist + share + needs-attention), About (read-only
 * spec grid with an edit link), Posts (compose + list), Jobs (compose + list),
 * and Settings (edit link + delete). Products live in the storefront, so the
 * console links out to it rather than managing products here. No fabricated
 * stats - every number and checklist state is real page data.
 */
export default function ManageCompanyPageScreen({
  page,
  stat,
  pages = [],
  postsPage,
  jobs = [],
  store = null,
  credentialRequests = [],
  inviteSummary = { joinedCount: 0, pendingCount: 0 },
  promoted = null,
}: Props) {
  // Institute-only tabs (credential review + student invite) only ever appear /
  // mount when the page is an institute; a business page never sees them.
  const isInstitute = page.kind === 'institute';
  const t = useTranslations('connect.companyPageAdmin');
  const tPanel = useTranslations('connect.companyPage');
  const tCat = useTranslations('connect.search.listing.category');
  // House promo copy for the rail ad floor (shared connect.ads.house keys).
  const tAds = useTranslations('connect.ads.house');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { announce, announcer } = useAnnouncer();
  const setShellTitle = useShellTitle((s) => s.setTitle);
  // Honor a `?tab=` deep-link (e.g. the public company page's "Manage in Jobs ->"
  // opens `?tab=jobs`) when it names a real tab; otherwise default to Overview.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  // Institute-only tab keys are honored from `?tab=` only on an institute page, so
  // a `?tab=students` deep-link on a business page degrades to Overview.
  const allowedTabs: readonly ManageTab[] = isInstitute
    ? ['overview', 'about', 'store', 'posts', 'jobs', 'credentials', 'students', 'settings']
    : ['overview', 'about', 'store', 'posts', 'jobs', 'settings'];
  const initialTab: ManageTab = allowedTabs.includes(requestedTab as ManageTab)
    ? (requestedTab as ManageTab)
    : 'overview';
  const [tab, setTab] = useState<ManageTab>(initialTab);
  const pathname = usePathname();
  // Switch tab AND mirror it into the URL (`?tab=`), so navigating into a
  // sub-route (a job, the edit page, a post) and pressing Back restores the tab
  // the user was on instead of snapping to Overview. replace (not push) keeps
  // tab clicks out of the history stack; overview drops the param for a clean URL.
  const changeTab = (next: ManageTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const [deleting, setDeleting] = useState(false);
  // Type-to-confirm delete guard, shared by both delete entry points (the
  // header More-menu and the Settings tab button) so deletion is never one
  // unguarded click. The modal lives at the bottom of the screen render.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const editHref = `/connect/pages/${page._id}/edit`;
  const publicPath = `/company/${page.slug}`;
  // `jobs` is now this page's FULL history (all statuses, from
  // getCompanyPageJobsForOwner), so the open-jobs KPI counts open rows only; with
  // no list loaded it falls back to the stat row.
  const openJobs = jobs.length
    ? jobs.filter((j) => j.status === 'open').length
    : (stat?.openJobs ?? 0);
  const followers = stat?.followers ?? 0;
  const posts30d = stat?.posts ?? 0;

  // The top-bar shell title shows a FIXED label (not page.name) while on this
  // screen: company/institute names can be long and overflow the top bar. The
  // actual page name still appears in the breadcrumb + the page hero below.
  useEffect(() => {
    setShellTitle(isInstitute ? t('shellTitleInstitute') : t('shellTitle'));
    return () => setShellTitle(null);
  }, [isInstitute, t, setShellTitle]);

  // Restore whether the owner already shared this page's link (drives the
  // "share your link" setup step + share-rail emphasis).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(`cn:page-shared:${page._id}`) === '1') {
        setHasShared(true);
      }
    } catch {
      /* storage blocked - share step stays open */
    }
  }, [page._id]);

  const markShared = () => {
    setHasShared(true);
    try {
      window.localStorage.setItem(`cn:page-shared:${page._id}`, '1');
    } catch {
      /* storage blocked - in-memory only */
    }
  };

  // Share button / setup share-step: jump to Overview and focus the share rail.
  const goToShare = () => {
    changeTab('overview');
    requestAnimationFrame(() => {
      shareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const steps = buildSetupSteps({
    page,
    openJobs,
    hasShared,
    editHref,
    onGoToJobs: () => changeTab('jobs'),
    onShare: goToShare,
  });
  // Honest "needs attention" = the still-open setup steps (no fabricated alerts).
  const needs = steps.filter((s) => !s.done);

  // Make a hidden / draft page live (public). The honest counterpart to
  // Unpublish: a draft has no separate status, so going live is just flipping
  // visibility to 'public'.
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await updateCompanyPage(page._id, { visibility: 'public' });
      if (!res.ok) {
        message.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      void message.success(t('makeLiveSuccess'));
      announce(t('makeLiveSuccess'));
      router.refresh();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    try {
      const res = await updateCompanyPage(page._id, { visibility: 'hidden' });
      if (!res.ok) {
        message.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      void message.success(t('unpublishSuccess'));
      announce(t('unpublishSuccess'));
      router.refresh();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setUnpublishing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteCompanyPage(page._id);
      if (!res.ok) {
        message.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      void message.success(t('deleteSuccess'));
      announce(t('deleteSuccess'));
      router.push('/connect/pages');
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  const cardStyle: CSSProperties = {
    border: '1px solid var(--cr-border)',
    borderRadius: 'var(--cr-radius-lg)',
    background: 'var(--cr-surface)',
    padding: 'var(--cr-space-lg)',
  };

  const panel = page.industryPanel;
  const hasPanel =
    !!panel &&
    ((panel.specialization?.length ?? 0) > 0 ||
      !!panel.machineCapacity?.trim() ||
      !!panel.production?.trim() ||
      (panel.languages?.length ?? 0) > 0);

  // Each tab is icon + label, with a live count chip on the two tabs that carry
  // numbers (real data: 30-day posts, open jobs). The count is omitted at zero so
  // the bar stays calm until there is something to show.
  const tabLabel = (icon: ReactNode, text: string, count?: number): ReactNode => (
    <span className="cn-tab">
      <span className="cn-tab-ico" aria-hidden>
        {icon}
      </span>
      {text}
      {count ? <span className="cn-tab-count">{count}</span> : null}
    </span>
  );

  const tabOptions = useMemo(
    () => [
      {
        label: tabLabel(<LayoutDashboard size={15} />, t('tabs.overview')),
        value: 'overview' as const,
      },
      { label: tabLabel(<Info size={15} />, t('tabs.about')), value: 'about' as const },
      { label: tabLabel(<Store size={15} />, tPanel('tabs.store')), value: 'store' as const },
      {
        label: tabLabel(<PenSquare size={15} />, t('tabs.posts'), posts30d),
        value: 'posts' as const,
      },
      {
        label: tabLabel(<Briefcase size={15} />, t('tabs.jobs'), openJobs),
        value: 'jobs' as const,
      },
      // Institute-only tabs (Phase 2 Feature 3): the credential-review queue (with
      // a pending-count chip) and the bulk student-invite flow. Appended only on
      // an institute page so a business console is unchanged.
      ...(isInstitute
        ? [
            {
              label: tabLabel(
                <GraduationCap size={15} />,
                t('tabs.credentials'),
                credentialRequests.length,
              ),
              value: 'credentials' as const,
            },
            {
              label: tabLabel(<UserPlus size={15} />, t('tabs.students')),
              value: 'students' as const,
            },
          ]
        : []),
      { label: tabLabel(<Settings size={15} />, t('tabs.settings')), value: 'settings' as const },
    ],
    [t, tPanel, posts30d, openJobs, isInstitute, credentialRequests.length],
  );

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {announcer}

        {/* Breadcrumb - the escape route back to the hub. */}
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1 text-[12.5px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          <Link
            href="/connect/pages"
            className="no-underline"
            style={{ color: 'var(--cr-primary)' }}
          >
            {t('hubTitle')}
          </Link>
          <ChevronRight size={13} aria-hidden />
          <span className="truncate">{page.name}</span>
        </nav>

        <CompanyPageManageHeader
          page={page}
          pages={pages}
          editHref={editHref}
          publicPath={publicPath}
          unpublishing={unpublishing}
          onPostAsPage={() => setComposerOpen(true)}
          onShare={goToShare}
          onUnpublish={handleUnpublish}
          // Both delete paths route through the type-to-confirm modal below.
          onRequestDelete={() => setConfirmDeleteOpen(true)}
        />

        {/* Draft banner - a hidden page is not visible to buyers, so surface a
            prominent "make it live" call to action (the only way to publish). */}
        {page.visibility === 'hidden' && (
          <div
            className="mt-4 flex flex-wrap items-center gap-3 p-4"
            style={{
              background: 'var(--cr-accent-light)',
              border: '1px solid var(--cr-gold-400)',
              borderRadius: 'var(--cr-radius-lg)',
            }}
          >
            <Globe size={20} aria-hidden style={{ color: 'var(--cr-gold-700)', flex: 'none' }} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
                {t('draftBannerTitle')}
              </div>
              <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-3)' }}>
                {t('draftBannerBody')}
              </p>
            </div>
            <DsButton
              dsVariant="primary"
              onClick={() => void handlePublish()}
              loading={publishing}
              icon={<Globe size={15} aria-hidden />}
            >
              {t('makeLive')}
            </DsButton>
          </div>
        )}

        {/* KPI strip - the three REAL page metrics. No page-views / impressions /
            search-appearances (not tracked). */}
        <KpiStrip className="mt-4">
          <KpiCard icon={Users} tone="indigo" value={followers} label={t('kpiFollowers')} />
          <KpiCard icon={PenSquare} tone="gold" value={posts30d} label={t('kpiPosts30d')} />
          <KpiCard icon={Briefcase} tone="green" value={openJobs} label={t('kpiOpenJobs')} />
        </KpiStrip>

        <div className="mt-5 mb-5 overflow-x-auto pb-1">
          <Segmented<ManageTab>
            className="cn-manage-tabs"
            size="large"
            value={tab}
            onChange={changeTab}
            aria-label={t('overviewTitle')}
            options={tabOptions}
          />
        </div>

        {tab === 'overview' && (
          <div className="flex flex-col gap-5">
            <CompanyPageSetupChecklist steps={steps} cardStyle={cardStyle} />

            {/* Products live in the storefront (locked model). The page attaches
                ONE store via the Store tab; this Overview card just points there
                instead of managing products here. Repointed from the old
                link-out-to-/connect/stores to keep the attach flow on-page. */}
            <section style={cardStyle}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 place-items-center"
                    style={{
                      borderRadius: 'var(--cr-radius-md)',
                      background: 'var(--cr-accent-light)',
                      color: 'var(--cr-gold-700)',
                    }}
                  >
                    <Store size={17} aria-hidden />
                  </span>
                  <div>
                    <h2 className="m-0 text-[15px] font-bold" style={{ color: 'var(--cr-text)' }}>
                      {t('productsTitle')}
                    </h2>
                    <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
                      {store
                        ? tPanel('storeOverviewAttached', { name: store.name })
                        : t('productsHint')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => changeTab('store')}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 border-0 bg-transparent text-[13px] font-semibold"
                  style={{ color: 'var(--cr-primary)' }}
                >
                  {store ? tPanel('manageStore') : tPanel('attachStoreCta')}{' '}
                  <ArrowRight size={14} aria-hidden />
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'about' && (
          <section style={cardStyle}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
                {t('aboutTitle')}
              </h2>
              <Link
                href={editHref}
                className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline"
                style={{ color: 'var(--cr-primary)' }}
              >
                <PenSquare size={14} aria-hidden /> {t('editSection')}
              </Link>
            </div>

            {page.about?.trim() ? (
              <p
                className="m-0 mb-4 text-[14px] leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--cr-text-3)' }}
              >
                {page.about}
              </p>
            ) : (
              <p className="m-0 mb-4 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('aboutEmpty')}
              </p>
            )}

            {hasPanel && (
              <dl
                className="m-0 grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-2"
                style={{
                  background: 'var(--cr-divider)',
                  border: '1px solid var(--cr-divider)',
                  borderRadius: 'var(--cr-radius-md)',
                }}
              >
                {(panel?.specialization?.length ?? 0) > 0 && (
                  <SpecCell icon={Layers} label={tPanel('specialization')}>
                    <div className="flex flex-wrap gap-1.5">
                      {panel?.specialization.map((s) => (
                        <span
                          key={s}
                          className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                          style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' }}
                        >
                          {categoryLabel(s, tCat)}
                        </span>
                      ))}
                    </div>
                  </SpecCell>
                )}
                {panel?.machineCapacity?.trim() && (
                  <SpecCell icon={Gauge} label={tPanel('machineCapacity')}>
                    {panel.machineCapacity}
                  </SpecCell>
                )}
                {panel?.production?.trim() && (
                  <SpecCell icon={Package} label={tPanel('production')}>
                    {panel.production}
                  </SpecCell>
                )}
                {(panel?.languages?.length ?? 0) > 0 && (
                  <SpecCell icon={Languages} label={tPanel('languages')}>
                    {panel?.languages.map((l) => languageLabel(l, locale)).join(', ')}
                  </SpecCell>
                )}
              </dl>
            )}

            {page.erpWorkspaceId && (
              <div
                className="mt-4 flex items-start gap-3 p-4"
                style={{
                  background: 'var(--cr-wash-indigo)',
                  border: '1px solid var(--cr-primary-border)',
                  borderRadius: 'var(--cr-radius-md)',
                }}
              >
                <ShieldCheck
                  size={18}
                  aria-hidden
                  style={{ color: 'var(--cr-primary)', flex: 'none', marginTop: 1 }}
                />
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                    {t('erpLinkedTitle')}
                  </div>
                  <p
                    className="m-0 mt-1 text-[12.5px] leading-relaxed"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    {t('erpLinkedHint')}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Store tab - attach/switch/unlink the one storefront linked to this page.
            Products stay in the storefront console (CompanyPageStoreTab links out). */}
        {tab === 'store' && <CompanyPageStoreTab page={page} store={store} />}

        {tab === 'posts' && (
          <section>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
                  {t('postsTitle')}
                </h2>
                {/* Cross-module: posting as the page publishes into the Connect
                    feed (feed module); it does not stay only on this page. */}
                <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('postsManageHint')}
                </p>
              </div>
              <DsButton
                dsVariant="primary"
                dsSize="sm"
                onClick={() => setComposerOpen(true)}
                icon={<PenSquare size={15} aria-hidden />}
              >
                {t('postAsPage')}
              </DsButton>
            </div>
            <CompanyPagePostsList
              key={`${page._id}-${postsPage?.posts[0]?._id ?? 'empty'}-${postsPage?.posts.length ?? 0}`}
              pageId={page._id}
              name={page.name}
              initialPage={postsPage ?? { posts: [], nextCursor: null, caughtUp: true }}
              manage
              // The manage console is owner-only, so the viewer IS the page owner.
              viewerId={page.ownerUserId}
            />
          </section>
        )}

        {/* The page-scoped job history + management (all statuses + status filter).
            Distinct from the public CompanyJobsSection (open-only). Owns its own
            JobComposer + close flow; rows link to the job detail for edit/review. */}
        {tab === 'jobs' && (
          <CompanyJobsManager pageId={page._id} pageName={page.name} jobs={jobs} />
        )}

        {/* Institute credential-review queue (Phase 2 Feature 3) - owner confirms
            or declines a student's training claim; the empty state forwards to the
            sibling Invite tab. Only mounts on an institute page. */}
        {tab === 'credentials' && isInstitute && (
          <CredentialRequestsPanel
            pageId={page._id}
            initialRequests={credentialRequests}
            onGoToInvite={() => changeTab('students')}
          />
        )}

        {/* Bulk student-invite flow (Phase 2 Feature 3) - the deep-link target of
            every "Invite students" empty-state CTA. Only mounts on an institute. */}
        {tab === 'students' && isInstitute && (
          <InviteStudentsPanel
            pageId={page._id}
            pageName={page.name}
            initialSummary={inviteSummary}
          />
        )}

        {tab === 'settings' && (
          <section style={cardStyle}>
            <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('settingsTitle')}
            </h2>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('settingsBody')}
            </p>
            <div className="mt-3">
              <DsButton
                dsVariant="primary"
                href={editHref}
                icon={<PenSquare size={15} aria-hidden />}
              >
                {t('editPage')}
              </DsButton>
            </div>

            <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--cr-border)' }}>
              <h3
                className="m-0 text-[14px] font-bold"
                style={{ color: 'var(--cr-error, #b42318)' }}
              >
                {t('dangerZone')}
              </h3>
              <p className="m-0 mt-1 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('deleteConfirmBody')}
              </p>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleting}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold disabled:opacity-60"
                style={{
                  border: '1px solid var(--cr-error, #b42318)',
                  background: 'transparent',
                  color: 'var(--cr-error, #b42318)',
                  cursor: 'pointer',
                }}
              >
                {deleting ? t('deleting') : t('deletePage')}
              </button>
            </div>
          </section>
        )}
        {/* Mobile-only ad (same boost + Google slot as the rail, hidden below xl). */}
        <MobileAdInline promoted={promoted} />
      </main>

      {/* Type-to-confirm delete guard for both entry points (header + Settings).
          onConfirm runs the real deleteCompanyPage; on error the modal stays
          open (handleDelete only navigates away on success). */}
      <DeletePageConfirmModal
        open={confirmDeleteOpen}
        pageName={page.name}
        deleting={deleting}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        companyPageId={page._id}
        onPosted={() => {
          void message.success(t('postPublished'));
          announce(t('postPublished'));
          // router.refresh updates the server-rendered KPI/badge; the Posts list
          // is a React Query cache (staleTime Infinity), so invalidate it too or
          // the new post only shows after a hard reload.
          void queryClient.invalidateQueries({
            queryKey: ['connect-company-page-posts', page._id],
          });
          router.refresh();
        }}
      />

      {/* footer={false}: this dense manage console stays footer-free (a footer
          would add noise + lengthen the sticky rail). The page-bottom footer is
          also hidden here via the shell HideOnPaths. */}
      <Rail side="right" footer={false}>
        <div className="flex flex-col" style={{ gap: 16 }} ref={shareRef}>
          {/* Share - the canonical share surface: public URL + WhatsApp + copy +
              a real QR (downloadable PNG). */}
          <RailPanel title={t('shareTitle')} padded={false}>
            <CompanyPageShareCard slug={page.slug} name={page.name} onShared={markShared} />
          </RailPanel>

          {/* Needs your attention - the open setup steps, only when there are gaps. */}
          {needs.length > 0 && (
            <RailPanel title={t('needsTitle')}>
              <ul className="m-0 flex list-none flex-col p-0">
                {needs.map((nd, i) => (
                  <li
                    key={nd.key}
                    style={{ borderTop: i > 0 ? '1px solid var(--cr-border-light)' : undefined }}
                  >
                    {nd.href ? (
                      <Link
                        href={nd.href}
                        className="flex items-center gap-3 py-2.5 no-underline"
                        style={{ color: 'inherit' }}
                      >
                        <span
                          aria-hidden
                          className="shrink-0"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: 'var(--cr-gold-400)',
                          }}
                        />
                        <span
                          className="min-w-0 flex-1 text-[12.5px]"
                          style={{ color: 'var(--cr-text-2)' }}
                        >
                          {t(`${nd.key}.title`)}
                        </span>
                        <span
                          className="shrink-0 text-[12px] font-semibold"
                          style={{ color: 'var(--cr-primary)' }}
                        >
                          {t('setupFix')}
                        </span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={nd.onAction}
                        className="flex w-full items-center gap-3 py-2.5 text-left"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        <span
                          aria-hidden
                          className="shrink-0"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: 'var(--cr-gold-400)',
                          }}
                        />
                        <span
                          className="min-w-0 flex-1 text-[12.5px]"
                          style={{ color: 'var(--cr-text-2)' }}
                        >
                          {t(`${nd.key}.title`)}
                        </span>
                        <span
                          className="shrink-0 text-[12px] font-semibold"
                          style={{ color: 'var(--cr-primary)' }}
                        >
                          {t('setupFix')}
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </RailPanel>
          )}

          {/* People live on the public page (auto-added team members). The console
              does not manage them - a quiet pointer keeps the model clear. */}
          <RailPanel title={t('peopleTitle')}>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
              <Users size={13} aria-hidden className="mr-1 inline" />
              {t('peopleBody')}
            </p>
          </RailPanel>

          {/* Ad engine: Google / house ad slots (render nothing until wired) +
              the first-party promoted listing (boost) + a house promo between
              them. The boost renders nothing on a no-fill (placement
              `company_manage`); resolved in app/connect/pages/[id]/page.tsx.
              Mirrors the storefront-manage rail's ad inventory. */}
          <AdSlot placement="connect.right.top" />
          {promoted ? <PromotedListingAdCard {...promoted} /> : null}
          <RailPanel title={tAds('title')}>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
              {tAds('body')}
            </p>
            <Link
              href="/connect/marketplace/new"
              className="mt-2.5 inline-block text-[12.5px] font-semibold no-underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              {tAds('cta')}
            </Link>
          </RailPanel>
          <AdSlot placement="connect.right.mid" />
        </div>
      </Rail>
    </ConnectPage>
  );
}

/** One labelled cell in the About spec-grid (icon + uppercase label + the real
 *  value). Hairline separators come from the grid's `gap-px` + divider bg. */
function SpecCell({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Layers;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--cr-surface)', padding: '13px 15px' }}>
      <div
        className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <Icon size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
        {label}
      </div>
      <div
        className="mt-1.5 text-[13px] font-semibold"
        style={{ color: 'var(--cr-text)', lineHeight: 1.5 }}
      >
        {children}
      </div>
    </div>
  );
}
