'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Modal, message, Input, Select } from 'antd';
import {
  Store,
  Star,
  Check,
  Circle,
  ArrowRight,
  Plus,
  Search,
  Settings2,
  ExternalLink,
  Package,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
import EntityHubCard from '@/components/connect/EntityHubCard';
import { KpiStrip, KpiCard } from '@/components/connect/KpiStrip';
import { ConnectPage, RailPanel, useAnnouncer } from '@/components/connect';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
// EntityAdRail bundles the first-party promoted listing (boost) + the Google
// connect.right.* slots above/below an optional floor panel. Reused here so the
// hub rail carries an ad like the marketplace/company/storefront rails do.
import EntityAdRail from '../ads/EntityAdRail';
// Mobile inline ad: the rail is hidden below xl, so render the same boost +
// Google slot in the content column for phone/tablet.
import MobileAdInline from '../ads/MobileAdInline';
import type { PromotedListingResolved } from '../marketplace/PromotedListingAdCard';
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import { ConnectUsageMeter } from '@/components/connect/ConnectUsageMeter';
import { OverLimitBanner } from '@/components/connect/OverLimitBanner';
import { BoostNudgeSlot } from '@/components/connect/BoostNudgeSlot';
import { parseApiError } from '@/lib/utils';
import StorefrontForm from './StorefrontForm';
import {
  createStorefront,
  setPrimaryStorefront,
  unsetPrimaryStorefront,
} from './storefront.actions';
import type {
  Storefront,
  StorefrontStat,
  CreateStorefrontPayload,
  EntityVisibility,
} from './entities.types';
import './StoresHub.css';

const EMPTY_STAT = (id: string): StorefrontStat => ({
  storefrontId: id,
  products: 0,
  live: 0,
  inquiries: 0,
});

type SortKey = 'newest' | 'name' | 'products';
type VisFilter = 'all' | 'public' | 'hidden';

// Visibility -> status-pill tone, identical to the Company Pages hub so both
// owner hubs read the same. public -> green, connections -> brand, hidden -> neutral.
const VISIBILITY_TONE: Record<EntityVisibility, 'success' | 'brand' | 'neutral'> = {
  public: 'success',
  connections: 'brand',
  hidden: 'neutral',
};

/** Comma-join the non-empty parts of a storefront location (city, district, state). */
function locationLine(loc: Storefront['location']): string {
  return [loc?.city, loc?.district, loc?.state]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * One owned storefront, rendered with the shared `EntityHubCard` so the hub
 * matches the Company Pages hub card-for-card (cover band, overlapping logo,
 * status pill, real stat row, public-address copy-row, Manage / View actions).
 * The store-only primary-star toggle rides the card's `cornerAction` slot, and
 * the primary card carries the featured `highlighted` ring.
 */
function StoreCard({
  store,
  stat,
  pending,
  onSetPrimary,
  onUnsetPrimary,
  onCopyLink,
  t,
}: {
  store: Storefront;
  stat: StorefrontStat;
  pending: boolean;
  onSetPrimary: (s: Storefront) => void;
  onUnsetPrimary: (s: Storefront) => void;
  onCopyLink: (s: Storefront) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const isPrimary = !!store.isPrimary;
  return (
    <li>
      <EntityHubCard
        name={store.name}
        logo={store.logo || undefined}
        banner={store.banner || undefined}
        location={locationLine(store.location)}
        badge={store.erpWorkspaceId ? <TrustBadgeRow badges={['erp']} /> : undefined}
        highlighted={isPrimary}
        statusPill={{
          label: t(`badge.${store.visibility}`),
          tone: VISIBILITY_TONE[store.visibility],
        }}
        stats={[
          { label: t('stat.products'), value: stat.products },
          { label: t('stat.live'), value: stat.live },
          { label: t('stat.inquiries'), value: stat.inquiries },
        ]}
        publicHref={`/store/${store.slug}`}
        publicLabel={`/store/${store.slug}`}
        onCopyLink={() => onCopyLink(store)}
        copyLinkAria={t('copyLink')}
        primaryHref={`/connect/stores/${store._id}`}
        primaryLabel={t('manage')}
        primaryIcon={<Settings2 size={15} aria-hidden />}
        secondaryHref={`/store/${store.slug}`}
        secondaryLabel={t('viewPublic')}
        secondaryIcon={<ExternalLink size={14} aria-hidden />}
        cornerAction={
          <button
            type="button"
            onClick={() => (isPrimary ? onUnsetPrimary(store) : onSetPrimary(store))}
            disabled={pending}
            aria-pressed={isPrimary}
            aria-label={
              isPrimary
                ? t('unsetPrimaryAria', { name: store.name })
                : t('setPrimaryAria', { name: store.name })
            }
            title={isPrimary ? t('unsetPrimary') : t('setPrimary')}
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-full"
            style={{
              background: 'var(--cr-surface)',
              color: isPrimary ? '#f59e0b' : 'var(--cr-text-3)',
            }}
          >
            <Star size={15} fill={isPrimary ? 'currentColor' : 'none'} aria-hidden />
          </button>
        }
      />
    </li>
  );
}

function AddAnotherCard({
  onClick,
  t,
}: {
  onClick: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <li className="flex">
      <button
        type="button"
        onClick={onClick}
        className="cn-add-card flex w-full flex-col items-center justify-center gap-1.5 p-5 text-center"
        style={{
          minHeight: 168,
          border: '1px dashed var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          background: 'transparent',
          color: 'var(--cr-text-3)',
          cursor: 'pointer',
        }}
      >
        <Plus size={20} aria-hidden />
        <span className="text-[13.5px] font-semibold">{t('addAnotherTitle')}</span>
        <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('addAnotherBody')}
        </span>
      </button>
    </li>
  );
}

/** The signed-in owner's storefronts hub (list + stats + create + primary pin). */
export default function StoresHub({
  initialStores,
  initialStats,
  promoted = null,
}: {
  initialStores: Storefront[];
  initialStats: StorefrontStat[];
  /** First-party promoted-listing boost for the rail, or null on a no-fill. */
  promoted?: PromotedListingResolved | null;
}) {
  const t = useTranslations('connect.storefrontAdmin');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const { announce, announcer } = useAnnouncer();
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<Storefront[]>(initialStores);
  const [pendingPrimary, setPendingPrimary] = useState<string | null>(null);

  // Toolbar (shown only past a handful of storefronts - see showToolbar).
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [vis, setVis] = useState<VisFilter>('all');

  const statsMap = useMemo(() => {
    const m = new Map<string, StorefrontStat>();
    initialStats.forEach((s) => m.set(s.storefrontId, s));
    return m;
  }, [initialStats]);
  const statFor = (id: string): StorefrontStat => statsMap.get(id) ?? EMPTY_STAT(id);

  // KPI totals over the CURRENT stores so they stay correct after any change.
  const totals = useMemo(() => {
    let products = 0;
    let live = 0;
    let inquiries = 0;
    for (const s of stores) {
      const st = statsMap.get(s._id);
      products += st?.products ?? 0;
      live += st?.live ?? 0;
      inquiries += st?.inquiries ?? 0;
    }
    return { stores: stores.length, products, live, inquiries };
  }, [stores, statsMap]);

  const showToolbar = stores.length > 3;

  const visible = useMemo(() => {
    let list = [...stores];
    if (showToolbar) {
      const q = query.trim().toLowerCase();
      if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
      if (vis !== 'all') {
        list = list.filter((s) =>
          vis === 'public' ? s.visibility === 'public' : s.visibility !== 'public',
        );
      }
    }
    list.sort((a, b) => {
      // Primary is always pinned to the front.
      if (!!a.isPrimary !== !!b.isPrimary) return a.isPrimary ? -1 : 1;
      if (!showToolbar) return 0; // keep the server order for a small list
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'products')
        return (statsMap.get(b._id)?.products ?? 0) - (statsMap.get(a._id)?.products ?? 0);
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? ''); // newest
    });
    return list;
  }, [stores, query, vis, sort, showToolbar, statsMap]);

  const steps = useMemo(() => {
    const hasStore = stores.length > 0;
    const hasProduct = totals.products > 0;
    const hasLinkedCompany = stores.some((s) => !!s.companyPageId);
    const hasPrimary = stores.some((s) => !!s.isPrimary);
    const firstId = stores[0]?._id;
    const items: { key: string; done: boolean; ctaKey?: string; ctaHref?: string }[] = [
      { key: 'createStore', done: hasStore },
      {
        key: 'addProduct',
        done: hasProduct,
        ctaKey: 'addProductCta',
        ctaHref: '/connect/marketplace/new',
      },
      {
        key: 'linkCompany',
        done: hasLinkedCompany,
        ctaKey: 'linkCompanyCta',
        ctaHref: firstId ? `/connect/stores/${firstId}` : undefined,
      },
    ];
    if (stores.length > 1) items.push({ key: 'setPrimary', done: hasPrimary });
    return {
      items,
      allDone: items.every((i) => i.done),
      firstOpen: items.findIndex((i) => !i.done),
    };
  }, [stores, totals.products]);

  const copyLink = async (store: Storefront) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/store/${store.slug}`);
      void msgApi.success(t('linkCopied'));
      announce(t('linkCopied'));
    } catch {
      // Clipboard blocked (no permission / insecure context) -- silent, non-fatal.
    }
  };

  // Plan-limit upgrade prompt for a blocked storefront create.
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();

  const handleCreate = async (payload: CreateStorefrontPayload) => {
    setSaving(true);
    try {
      const res = await createStorefront(payload);
      if (!res.ok) {
        // Plan-limit block shows the shared upgrade dialog, not a toast.
        if (handleLimited(res)) return;
        msgApi.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      void msgApi.success(t('createSuccess'));
      setCreateOpen(false);
      router.push(`/connect/stores/${res.data._id}`);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (store: Storefront) => {
    if (store.isPrimary) return;
    const prev = stores;
    setPendingPrimary(store._id);
    setStores((list) => list.map((s) => ({ ...s, isPrimary: s._id === store._id })));
    const res = await setPrimaryStorefront(store._id);
    setPendingPrimary(null);
    if (!res.ok) {
      setStores(prev);
      msgApi.error(t('setPrimaryError'));
      announce(t('setPrimaryError'), { assertive: true });
      return;
    }
    void msgApi.success(t('setPrimarySuccess', { name: store.name }));
    announce(t('setPrimarySuccess', { name: store.name }));
  };

  // Clears primary on a store that is currently primary. Mirrors handleSetPrimary's optimistic pattern.
  const handleUnsetPrimary = async (store: Storefront) => {
    if (!store.isPrimary) return;
    const prev = stores;
    setPendingPrimary(store._id);
    setStores((list) => list.map((s) => (s._id === store._id ? { ...s, isPrimary: false } : s)));
    const res = await unsetPrimaryStorefront(store._id);
    setPendingPrimary(null);
    if (!res.ok) {
      setStores(prev);
      msgApi.error(t('unsetPrimaryError'));
      announce(t('unsetPrimaryError'), { assertive: true });
      return;
    }
    void msgApi.success(t('unsetPrimarySuccess', { name: store.name }));
    announce(t('unsetPrimarySuccess', { name: store.name }));
  };

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {ctx}
        {announcer}
        {limitDialog}
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('hubTitle')}
            </h1>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {stores.length === 0 ? t('hubSubtitleEmpty') : t('hubSubtitle')}
            </p>
          </div>
          <DsButton dsVariant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden /> {t('createCta')}
          </DsButton>
        </header>

        {/* Traction nudge: if one of the owner's listings is getting real
            attention and can be boosted now, surface a calm "boost it" prompt.
            Owner-scoped + globally rate-limited server-side (BoostNudgeSlot). */}
        <BoostNudgeSlot kind="listing" className="mb-4 max-w-xl" />

        {/* Over-limit (grandfathering) notice when the person is over the shops
            cap. Policy-aware + dismissable per session; invisible under the
            default freeze policy unless actually over limit. */}
        <OverLimitBanner kind="storefront" className="mb-4 max-w-xl" />
        {/* Person-wide shops usage vs plan cap (GET /me/connect/usage).
            At-cap heads-up now rides on the meter's info icon, not a banner. */}
        <ConnectUsageMeter kind="storefront" surface="stores" className="mb-5 max-w-sm" />

        {stores.length === 0 ? (
          <ConnectEmptyState
            icon={<Store size={24} aria-hidden />}
            title={t('emptyTitle')}
            description={t('emptyBody')}
            primaryAction={{ label: t('createCta'), onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <>
            <KpiStrip className="mb-5">
              <KpiCard icon={Store} tone="indigo" value={totals.stores} label={t('kpiStores')} />
              <KpiCard
                icon={Package}
                tone="gold"
                value={totals.products}
                label={t('stat.products')}
              />
              <KpiCard
                icon={CheckCircle2}
                tone="green"
                value={totals.live}
                label={t('stat.live')}
              />
              <KpiCard
                icon={MessageSquare}
                tone="amber"
                value={totals.inquiries}
                label={t('stat.inquiries')}
              />
            </KpiStrip>

            {showToolbar && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Input
                  allowClear
                  prefix={<Search size={14} aria-hidden style={{ color: 'var(--cr-text-4)' }} />}
                  placeholder={t('toolbar.searchPlaceholder')}
                  aria-label={t('toolbar.searchAria')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: 220 }}
                />
                <Select<SortKey>
                  value={sort}
                  onChange={setSort}
                  style={{ width: 168 }}
                  aria-label={t('toolbar.sortLabel')}
                  options={[
                    { value: 'newest', label: t('toolbar.sortNewest') },
                    { value: 'name', label: t('toolbar.sortName') },
                    { value: 'products', label: t('toolbar.sortProducts') },
                  ]}
                />
                <Select<VisFilter>
                  value={vis}
                  onChange={setVis}
                  style={{ width: 132 }}
                  options={[
                    { value: 'all', label: t('toolbar.filterAll') },
                    { value: 'public', label: t('toolbar.filterPublic') },
                    { value: 'hidden', label: t('toolbar.filterHidden') },
                  ]}
                />
              </div>
            )}

            {visible.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('toolbar.noMatch')}
              </p>
            ) : (
              <ul
                className="m-0 grid list-none gap-3 p-0"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
              >
                {visible.map((s) => (
                  <StoreCard
                    key={s._id}
                    store={s}
                    stat={statFor(s._id)}
                    pending={pendingPrimary === s._id}
                    onSetPrimary={handleSetPrimary}
                    onUnsetPrimary={handleUnsetPrimary}
                    onCopyLink={copyLink}
                    t={t}
                  />
                ))}
                <AddAnotherCard onClick={() => setCreateOpen(true)} t={t} />
              </ul>
            )}
          </>
        )}

        <Modal
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          title={<span className="font-display font-bold">{t('createCta')}</span>}
          footer={null}
          width={680}
          // centered + capped body so on a phone the dialog sits mid-screen and
          // the tall storefront form scrolls inside, not the whole modal.
          centered
          destroyOnHidden
          styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        >
          <StorefrontForm
            submitLabel={t('create')}
            submitting={saving}
            onSubmit={handleCreate}
            cancelHref="/connect/stores"
          />
        </Modal>
        {/* Mobile-only ad (same boost + Google slot as the rail, hidden below xl). */}
        <MobileAdInline promoted={promoted} />
      </main>

      {/* EntityAdRail = promoted boost + Google slots stacked over a floor panel.
          The hub's setup checklist (or all-set note) is the floor content, so the
          rail keeps its existing guidance AND now carries an ad above it. The rail
          stays hidden below xl (EntityAdRail/ConnectRightRail own that gating). */}
      <EntityAdRail
        promoted={promoted}
        floorPanel={
          steps.allDone ? (
            <RailPanel title={t('nextSteps.allSetTitle')}>
              <p
                className="m-0 text-[12.5px] leading-relaxed"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {t('nextSteps.allSetBody')}
              </p>
              <Link
                href="/connect/marketplace"
                className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold no-underline"
                style={{ color: 'var(--cr-primary)' }}
              >
                {t('nextSteps.allSetCta')} <ArrowRight size={13} aria-hidden />
              </Link>
            </RailPanel>
          ) : (
            <RailPanel title={t('nextSteps.title')}>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {steps.items.map((item, i) => (
                  <li key={item.key} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 shrink-0">
                      {item.done ? (
                        <Check size={15} style={{ color: 'var(--cr-success)' }} />
                      ) : (
                        <Circle size={15} style={{ color: 'var(--cr-text-4)' }} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <span
                        className="text-[12.5px] leading-snug"
                        style={{
                          color: item.done ? 'var(--cr-text-4)' : 'var(--cr-text-2)',
                          textDecoration: item.done ? 'line-through' : 'none',
                        }}
                      >
                        {t(`nextSteps.${item.key}`)}
                      </span>
                      {!item.done && i === steps.firstOpen && item.ctaKey && item.ctaHref && (
                        <Link
                          href={item.ctaHref}
                          className="mt-1 block text-[12px] font-semibold no-underline"
                          style={{ color: 'var(--cr-primary)' }}
                        >
                          {t(`nextSteps.${item.ctaKey}`)}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </RailPanel>
          )
        }
      />
    </ConnectPage>
  );
}
