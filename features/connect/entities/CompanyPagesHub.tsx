'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dropdown, Modal, message } from 'antd';
import {
  Briefcase,
  Building2,
  ExternalLink,
  FileText,
  MoreVertical,
  PlusCircle,
  Settings2,
  Users,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
import EntityHubCard from '@/components/connect/EntityHubCard';
import { ConnectPage, ConnectRightRail, RailPanel, useAnnouncer } from '@/components/connect';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
// First-party promoted-listing boost card for the rail (placement `pages_hub`).
// Resolved server-side in app/connect/pages/page.tsx; sits atop ConnectRightRail
// (which already owns the Google connect.right.* slots).
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '../marketplace/PromotedListingAdCard';
// Mobile inline ad: the rail is hidden below xl, so render the same boost +
// Google slot in the content column for phone/tablet.
import MobileAdInline from '../ads/MobileAdInline';
import { ConnectUsageMeter } from '@/components/connect/ConnectUsageMeter';
import { OverLimitBanner } from '@/components/connect/OverLimitBanner';
import { KpiStrip, KpiCard } from '@/components/connect/KpiStrip';
import { parseApiError } from '@/lib/utils';
import { deleteCompanyPage } from './company-page.actions';
import type {
  CompanyPage,
  CompanyPageStat,
  CompanyPageStatsResult,
  EntityVisibility,
} from './entities.types';

/** Comma-join the non-empty parts of a company page location. */
function locationLine(loc: CompanyPage['location']): string {
  return [loc?.city, loc?.district, loc?.state]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}

const VISIBILITY_TONE: Record<EntityVisibility, 'success' | 'brand' | 'neutral'> = {
  public: 'success',
  connections: 'brand',
  hidden: 'neutral',
};

/**
 * "Your company pages" hub: the owner's pages as a KPI strip + a grid of
 * EntityHubCards (real follower / 30-day post / open-job counts from the stats
 * endpoint), plus per-card copy-link / delete. Person-centric; a user may own
 * several. Create routes to the dedicated `/connect/pages/new` editor (a
 * sectioned form with a live preview), not an inline modal.
 */
export default function CompanyPagesHub({
  initialPages,
  stats,
  promoted = null,
}: {
  initialPages: CompanyPage[];
  stats: CompanyPageStatsResult;
  /** First-party promoted-listing boost for the rail, or null on a no-fill. */
  promoted?: PromotedListingResolved | null;
}) {
  const t = useTranslations('connect.companyPageAdmin');
  const [msgApi, ctx] = message.useMessage();
  const { announce, announcer } = useAnnouncer();
  const [pages, setPages] = useState(initialPages);
  const [deleteTarget, setDeleteTarget] = useState<CompanyPage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const statMap = useMemo(
    () => new Map<string, CompanyPageStat>(stats.pages.map((s) => [s.pageId, s])),
    [stats],
  );

  // KPI totals computed from the CURRENT pages so they stay correct after a delete.
  const kpis = useMemo(() => {
    let followers = 0;
    let posts = 0;
    let openJobs = 0;
    for (const p of pages) {
      const s = statMap.get(p._id);
      if (s) {
        followers += s.followers;
        posts += s.posts;
        openJobs += s.openJobs;
      }
    }
    return { pages: pages.length, followers, posts, openJobs };
  }, [pages, statMap]);

  const copyLink = async (p: CompanyPage) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/company/${p.slug}`);
      void msgApi.success(t('linkCopied'));
      announce(t('linkCopied'));
    } catch {
      // Clipboard blocked (no permission / insecure context) -- silent, non-fatal.
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteCompanyPage(deleteTarget._id);
      if (!res.ok) {
        msgApi.error(res.error);
        return;
      }
      setPages((list) => list.filter((p) => p._id !== deleteTarget._id));
      void msgApi.success(t('deleteSuccess'));
      announce(t('deleteSuccess'));
      setDeleteTarget(null);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {ctx}
        {announcer}
        {/* Mobile: stack the heading above a full-width Create button (the long
            "Your company pages" title + "Create a company page" CTA crammed
            side-by-side on a phone, wrapping the title to 3 lines). sm+ keeps the
            original heading-left / button-right row. */}
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('hubTitle')}
            </h1>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('hubSubtitle')}
            </p>
          </div>
          <DsButton
            dsVariant="primary"
            href="/connect/pages/new"
            className="w-full shrink-0 justify-center sm:w-auto"
          >
            <PlusCircle size={16} aria-hidden /> {t('createCta')}
          </DsButton>
        </header>

        {/* Over-limit (grandfathering) notice when over the company-pages cap.
            Policy-aware + dismissable per session; invisible under freeze. */}
        <OverLimitBanner kind="company_page" className="mb-4 max-w-xl" />
        {/* Person-wide company-pages usage vs plan cap (GET /me/connect/usage).
            At-cap heads-up now rides on the meter's info icon, not a banner. */}
        <ConnectUsageMeter kind="company_page" surface="pages" className="mb-5 max-w-sm" />

        {pages.length === 0 ? (
          <ConnectEmptyState
            icon={<Building2 size={24} aria-hidden />}
            title={t('emptyTitle')}
            description={t('emptyBody')}
            primaryAction={{ label: t('createCta'), href: '/connect/pages/new' }}
          />
        ) : (
          <>
            <KpiStrip className="mb-5">
              <KpiCard icon={Building2} tone="indigo" value={kpis.pages} label={t('kpiPages')} />
              <KpiCard icon={Users} tone="gold" value={kpis.followers} label={t('statFollowers')} />
              <KpiCard icon={FileText} tone="green" value={kpis.posts} label={t('kpiPosts')} />
              <KpiCard
                icon={Briefcase}
                tone="amber"
                value={kpis.openJobs}
                label={t('statOpenJobs')}
              />
            </KpiStrip>

            <ul
              className="m-0 grid list-none gap-3 p-0"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            >
              {pages.map((p) => {
                const s = statMap.get(p._id);
                return (
                  <li key={p._id}>
                    <EntityHubCard
                      name={p.name}
                      logo={p.logo}
                      banner={p.banner}
                      location={locationLine(p.location)}
                      badge={p.erpWorkspaceId ? <TrustBadgeRow badges={['erp']} /> : undefined}
                      statusPill={{
                        label: t(
                          `visibility${p.visibility.charAt(0).toUpperCase()}${p.visibility.slice(1)}`,
                        ),
                        tone: VISIBILITY_TONE[p.visibility],
                      }}
                      stats={[
                        { label: t('statFollowers'), value: s?.followers ?? 0 },
                        { label: t('statPosts'), value: s?.posts ?? 0 },
                        { label: t('statOpenJobs'), value: s?.openJobs ?? 0 },
                      ]}
                      publicHref={`/company/${p.slug}`}
                      publicLabel={`/company/${p.slug}`}
                      onCopyLink={() => void copyLink(p)}
                      copyLinkAria={t('copyLink')}
                      primaryHref={`/connect/pages/${p._id}`}
                      primaryLabel={t('manage')}
                      primaryIcon={<Settings2 size={15} aria-hidden />}
                      secondaryHref={`/company/${p.slug}`}
                      secondaryLabel={t('viewPublic')}
                      secondaryIcon={<ExternalLink size={14} aria-hidden />}
                      menu={
                        <Dropdown
                          trigger={['click']}
                          // Copy link already lives as the icon button in the
                          // public-address row, so the kebab only carries Delete.
                          menu={{
                            items: [
                              {
                                key: 'delete',
                                label: t('deletePage'),
                                danger: true,
                                onClick: () => setDeleteTarget(p),
                              },
                            ],
                          }}
                        >
                          <button
                            type="button"
                            aria-label={t('moreActions')}
                            className="grid h-7 w-7 cursor-pointer place-items-center rounded-full"
                            style={{ background: 'var(--cr-surface)', color: 'var(--cr-text-3)' }}
                          >
                            <MoreVertical size={15} aria-hidden />
                          </button>
                        </Dropdown>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Modal
          open={!!deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onOk={() => void confirmDelete()}
          okText={t('deleteConfirmOk')}
          okButtonProps={{ danger: true, loading: deleting }}
          title={t('deleteConfirmTitle')}
          destroyOnHidden
        >
          <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
            {t('deleteConfirmBody')}
          </p>
        </Modal>
        {/* Mobile-only ad (same boost + Google slot as the rail, hidden below xl). */}
        <MobileAdInline promoted={promoted} />
      </main>

      <ConnectRightRail>
        {/* First-party promoted listing (boost). Sits atop the rail, under the
            Google connect.right.top slot ConnectRightRail owns. Renders nothing
            on a no-fill. Resolved in app/connect/pages/page.tsx. */}
        {promoted ? <PromotedListingAdCard {...promoted} /> : null}
        <RailPanel title={t('rail.title')}>
          <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
            {t('rail.body')}
          </p>
        </RailPanel>
      </ConnectRightRail>
    </ConnectPage>
  );
}
