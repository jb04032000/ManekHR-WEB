'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App, Dropdown, Modal, type MenuProps } from 'antd';
import {
  ChevronDown,
  Copy,
  Check,
  Circle,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ArrowDown,
  ImageOff,
  MessageSquare,
  Inbox as InboxIcon,
  Eye,
  Package,
  LineChart,
  Globe,
} from 'lucide-react';
import { ConnectPage, Rail, RailPanel } from '@/components/connect';
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import { ConnectUsageMeter } from '@/components/connect/ConnectUsageMeter';
import { OverLimitBanner } from '@/components/connect/OverLimitBanner';
import DsDrawer from '@/components/ui/DsDrawer';
import AdSlot from '@/components/connect/AdSlot';
import StorefrontSettings from './StorefrontSettings';
import StorefrontShareCard from './StorefrontShareCard';
import StorefrontForm from './StorefrontForm';
import CollectionsManager from './CollectionsManager';
import OwnerListingsManager from '../marketplace/OwnerListingsManager';
// First-party promoted-listing boost card for the rail (placement
// `storefront_manage`). Resolved server-side in app/connect/stores/[id]/page.tsx;
// sits between the Google connect.right.top slot and the house promo.
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '../marketplace/PromotedListingAdCard';
// Mobile inline ad: the manage rail is hidden below xl, so render the same boost
// + Google slot in the content column for phone/tablet.
import MobileAdInline from '../ads/MobileAdInline';
import { isLive, isNeedsPhoto } from '../marketplace/listing-status';
import { createStorefront } from './storefront.actions';
import { getReceivedInquiries } from '../marketplace/marketplace.actions';
import DsButton from '@/components/ui/DsButton';
import type { StorefrontViewSummary } from '../views.actions';
import type { Storefront, CreateStorefrontPayload } from './entities.types';
import type { CollectionWithCount } from './collections.types';
import type { OwnerListing, InquiryListItem } from '../marketplace/marketplace.types';
import './ManageStorefrontScreen.css';

// Collections is no longer a top-level tab - it merged into Products (the shelf
// + the "Manage collections" drawer). Kept out of the union so stale `?tab=`
// links fall back to Overview.
type Tab = 'overview' | 'products' | 'inquiries' | 'settings';

interface Props {
  store: Storefront;
  listings: OwnerListing[];
  views: StorefrontViewSummary | null;
  /** First page of the seller inbox, already filtered to THIS shop's listings. */
  inquiries: InquiryListItem[];
  /** Raw (unfiltered, all-shops) keyset cursor for the next inbox page; null when
   *  the seller has no more received inquiries. Drives the Inquiries "Load more". */
  inquiriesNextCursor: string | null;
  stores: { id: string; name: string }[];
  collections: CollectionWithCount[];
  /** First-party promoted-listing boost for the rail, or null on a no-fill. */
  promoted?: PromotedListingResolved | null;
}

/** A compact number + label tile for the always-visible glance strip. An
 *  optional `action` renders below the label (turns a metric into its fix). */
function StatTile({
  value,
  label,
  icon,
  action,
}: {
  value: number | string;
  label: string;
  /** A small leading glyph that anchors the tile and aids scannability. */
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex h-full flex-col rounded-lg p-3.5"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="cn-stat-icon" aria-hidden>
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className="leading-none font-bold"
            style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', color: 'var(--cr-text)' }}
          >
            {value}
          </span>
          <span className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {label}
          </span>
        </div>
      </div>
      {/* Pinned to the foot so a tile with an action stays the same height as
          its siblings (the grid stretches them equal). */}
      {action && <div className="mt-auto pt-2.5">{action}</div>}
    </div>
  );
}

/** A flat-area sparkline of the daily view series (zero-safe, honest flat line). */
function Sparkline({ series }: { series: { date: string; count: number }[] }) {
  const w = 300;
  const h = 44;
  const pad = 2;
  const max = Math.max(1, ...series.map((p) => p.count));
  const n = series.length;
  const points = series
    .map((p, i) => {
      const x = pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
      const y = h - pad - (p.count / max) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ display: 'block' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--cr-primary)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A bordered rail card: an all-caps eyebrow header (with an optional count) +
 *  a body. The body manages its own padding so a card can be full-bleed (e.g.
 *  the public-page preview). */
function RailCard({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden"
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
      }}
    >
      <header
        className="flex items-center gap-1.5 px-4"
        style={{ minHeight: 42, borderBottom: '1px solid var(--cr-border-light)' }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
          }}
        >
          {label}
        </span>
        {typeof count === 'number' && count > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cr-text-4)' }}>
            &middot; {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

// PAUSED 2026-06-05 - Public page preview: helper paused alongside the "Public
// page" preview RailCard (its only caller), commented out per owner request.
// Revive together with that block.
// Coarse relative time ("2 hours ago"). Rendered client-only (gated on a
// post-mount value) so it never mismatches the server paint.
// function relativeTimeFrom(iso: string): string {
//   const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
//   const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
//   if (min < 60) return rtf.format(-Math.max(min, 0), 'minute');
//   const hr = Math.round(min / 60);
//   if (hr < 24) return rtf.format(-hr, 'hour');
//   return rtf.format(-Math.round(hr / 24), 'day');
// }

export default function ManageStorefrontScreen({
  store,
  listings,
  views,
  inquiries: initialInquiries,
  inquiriesNextCursor,
  stores,
  collections,
  promoted = null,
}: Props) {
  const t = useTranslations('connect.storefrontAdmin');
  const tm = useTranslations('connect.storefrontAdmin.console');
  const tAds = useTranslations('connect.ads.house');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { message } = App.useApp();

  // The seller inbox loads more on demand. It is keyset-paginated across ALL the
  // seller's shops, so each fetched page is filtered to THIS shop's listing ids
  // before appending; the cursor tracks the raw (unfiltered) position so paging
  // never stalls when a page holds no rows for this shop. (Inbox source =
  // marketplace getReceivedInquiries -> backend keyset envelope.)
  const shopListingIds = useMemo(() => new Set(listings.map((l) => l._id)), [listings]);
  const [inquiries, setInquiries] = useState<InquiryListItem[]>(initialInquiries);
  const [inquiryCursor, setInquiryCursor] = useState<string | null>(inquiriesNextCursor);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const loadMoreInquiries = async () => {
    if (!inquiryCursor || loadingInquiries) return;
    setLoadingInquiries(true);
    try {
      const res = await getReceivedInquiries(inquiryCursor);
      if (!res.ok) {
        message.error(res.error);
        return;
      }
      const fresh = res.data.items.filter((q) => shopListingIds.has(q.listingId));
      setInquiries((prev) => {
        // De-dupe by id so a re-fetch never doubles a row.
        const seen = new Set(prev.map((q) => q._id));
        return [...prev, ...fresh.filter((q) => !seen.has(q._id))];
      });
      setInquiryCursor(res.data.nextCursor);
    } finally {
      setLoadingInquiries(false);
    }
  };

  // Create-storefront modal: the switcher's "New storefront" opens this in place
  // (same form + action as the Storefronts hub) instead of bouncing to the hub.
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  // Collections moved from a tab into a drawer opened from the Products shelf.
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  // Plan-limit upgrade prompt for a blocked storefront create.
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();
  const handleCreate = async (payload: CreateStorefrontPayload) => {
    setCreating(true);
    try {
      const res = await createStorefront(payload);
      if (!res.ok) {
        // Plan-limit block shows the shared upgrade dialog, not a toast.
        if (handleLimited(res)) return;
        message.error(res.error);
        return;
      }
      void message.success(t('createSuccess'));
      setCreateOpen(false);
      router.push(`/connect/stores/${res.data._id}`);
    } finally {
      setCreating(false);
    }
  };

  // Open on the tab named in `?tab=` (e.g. landing here right after publishing a
  // product opens Products), else the default Overview.
  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get('tab');
    const known: Tab[] = ['overview', 'products', 'inquiries', 'settings'];
    return known.includes(requested as Tab) ? (requested as Tab) : 'overview';
  });
  // Keep the active tab in the URL (`?tab=`) so navigating away to preview a
  // product and pressing Back returns to the SAME tab (e.g. Products), not the
  // default Overview. The `current === tab` guard makes our own replace a no-op
  // on re-run, so there is no loop.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get('tab') ?? 'overview';
    if (current === tab) return;
    if (tab === 'overview') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tab, router, pathname, searchParams]);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [hasShared, setHasShared] = useState(false);
  // Push a filter into the Products tab from the rail (the "needs photo"
  // fix-it deep-links to the needs-photo filter). The nonce re-triggers it.
  const [productsSeed, setProductsSeed] = useState<'needsPhoto' | null>(null);
  const [productsSeedNonce, setProductsSeedNonce] = useState(0);

  // The top-bar shell title is left to the route-derived label ("Storefronts")
  // on purpose: the shop name already appears in the breadcrumb + the page H1, so
  // overriding the header with it duplicated the name (and a long shop name does
  // not fit the fixed header). The header now shows the stable section title.

  // The absolute share URL is client-only (unknown during SSR). Also restore
  // whether this shop was already shared (collapses the duplicate share CTAs).
  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      if (window.localStorage.getItem(`cn:shared:${store._id}`) === '1') setHasShared(true);
    } catch {
      /* storage blocked - share CTAs stay prominent */
    }
  }, [store._id]);

  const markShared = () => {
    setHasShared(true);
    try {
      window.localStorage.setItem(`cn:shared:${store._id}`, '1');
    } catch {
      /* storage blocked - in-memory only */
    }
  };

  const addHref = `/connect/marketplace/new?storefrontId=${store._id}`;
  const publicPath = `/store/${store.slug}`;
  const shareUrl = origin ? `${origin}${publicPath}` : '';
  const waHref = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${tm('shareWaText', { name: store.name })} ${shareUrl}`)}`
    : '#';

  // Derived dashboard signals.
  const productsCount = listings.length;
  const views7d = views?.views7d ?? 0;
  const series = useMemo(() => views?.series ?? [], [views]);
  // The series is the 30-day daily trend; sum it for the headline 30-day count.
  const views30d = useMemo(() => series.reduce((sum, p) => sum + p.count, 0), [series]);
  const viewsByListing = useMemo(
    () => Object.fromEntries((views?.byListing ?? []).map((b) => [b.listingId, b.views7d])),
    [views],
  );
  const unanswered = useMemo(
    () => inquiries.filter((q) => q.status === 'sent' || q.status === 'viewed').length,
    [inquiries],
  );
  // "Needs photo" = active + approved but no cover photo: the ONLY thing that
  // blocks buyer visibility, and the actionable gap the rail nudges fix. (Missing
  // price/description does NOT block visibility - that is a soft on-card nudge in
  // OwnerListingsManager, not a dashboard alarm.)
  const needsPhotoCount = useMemo(() => listings.filter(isNeedsPhoto).length, [listings]);
  // Products genuinely visible to buyers - the SAME `isLive` gate the product
  // cards, the public store grid, and the backend `live` stat use, so every
  // surface shows one consistent count. Drives the glance strip + the shop's
  // "Live vs Setup" pill.
  const liveCount = useMemo(() => listings.filter(isLive).length, [listings]);

  // A brand-new / quiet shop sees an activation checklist instead of a wall of
  // zeros; once it has any views or inquiries, the dashboard takes over.
  const isQuiet = views7d === 0 && inquiries.length === 0;
  const hasProducts = productsCount > 0;
  // Jump to the Products tab pre-filtered to the products that need a photo
  // (their amber photo slot is the fix). Shared by the photo setup-step, the
  // setup strip, and the rail nudge so they all land on the actual fix.
  const goToNeedsPhoto = () => {
    setProductsSeed('needsPhoto');
    setProductsSeedNonce((n) => n + 1);
    setTab('products');
  };
  const steps: {
    key: string;
    done: boolean;
    target: 'products' | 'settings';
    onAction: () => void;
  }[] = [
    {
      key: 'stepPublish',
      done: hasProducts,
      target: 'products',
      onAction: () => setTab('products'),
    },
    ...(hasProducts
      ? [
          {
            key: 'stepPhoto',
            done: needsPhotoCount === 0,
            target: 'products' as const,
            onAction: goToNeedsPhoto,
          },
        ]
      : []),
    {
      key: 'stepDescription',
      done: !!store.description?.trim(),
      target: 'settings',
      onAction: () => setTab('settings'),
    },
    { key: 'stepLogo', done: !!store.logo, target: 'settings', onAction: () => setTab('settings') },
    {
      key: 'stepBanner',
      done: !!store.banner,
      target: 'settings',
      onAction: () => setTab('settings'),
    },
  ];
  const stepsDone = steps.filter((s) => s.done).length;
  const setupComplete = stepsDone >= steps.length;
  // The first unfinished step drives the setup strip's inline next-action.
  const nextStep = steps.find((s) => !s.done);
  // The first product blocking visibility for lack of a photo (drives the rail nudge).
  const firstNeedsPhoto = listings.find(isNeedsPhoto);

  // Needs-attention (rail) - rich items (icon + title + subtitle + chevron),
  // each tagged with the tab that fixes it so we hide it while that tab is open
  // (the gap is already visible inline there).
  type NeedItem = {
    key: string;
    tab: Tab;
    tone: 'warning' | 'neutral';
    icon: ReactNode;
    title: string;
    subtitle: string;
    onAction: () => void;
  };
  const allNeeds: NeedItem[] = [];
  if (needsPhotoCount > 0) {
    // A photo is the only thing blocking buyer visibility, so this is the rail's
    // one actionable product nudge (price/description are soft on-card nudges).
    const title =
      needsPhotoCount === 1 && firstNeedsPhoto
        ? tm('needsItemPhoto', { name: firstNeedsPhoto.title })
        : tm('needsNoPhoto', { count: needsPhotoCount });
    allNeeds.push({
      key: 'p',
      tab: 'products',
      tone: 'warning',
      icon: <ImageOff size={15} aria-hidden />,
      title,
      subtitle: tm('needsItemSub'),
      onAction: goToNeedsPhoto,
    });
  }
  if (inquiries.length === 0) {
    allNeeds.push({
      key: 'i0',
      tab: 'inquiries',
      tone: 'neutral',
      icon: <MessageSquare size={15} aria-hidden />,
      title: tm('needsNoInqTitle'),
      subtitle: tm('needsNoInqSub'),
      onAction: () => setTab('inquiries'),
    });
  } else if (unanswered > 0) {
    allNeeds.push({
      key: 'iw',
      tab: 'inquiries',
      tone: 'neutral',
      icon: <MessageSquare size={15} aria-hidden />,
      title: tm('needsWaitingTitle', { count: unanswered }),
      subtitle: tm('needsWaitingSub'),
      onAction: () => setTab('inquiries'),
    });
  }
  const needs = allNeeds.filter((n) => n.tab !== tab);

  const visKey =
    store.visibility === 'public'
      ? 'public'
      : store.visibility === 'connections'
        ? 'connections'
        : 'hidden';

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked - no-op */
    }
  };

  // Shop switcher: every shop the owner has (current one marked), then a
  // create-new entry - so the menu reads as a complete switcher even with one
  // shop, rather than a lone "create" item.
  const switcherItems: MenuProps['items'] = [
    ...stores.map((s) => ({
      key: s.id,
      label: (
        <span className="flex items-center gap-2">
          {s.id === store._id ? (
            <Check size={13} aria-hidden style={{ color: 'var(--cr-primary)' }} />
          ) : (
            <span aria-hidden style={{ width: 13 }} />
          )}
          <span className={s.id === store._id ? 'font-semibold' : undefined}>{s.name}</span>
        </span>
      ),
      onClick: () => {
        if (s.id !== store._id) router.push(`/connect/stores/${s.id}`);
      },
    })),
    { type: 'divider' as const, key: 'div' },
    { key: 'create', label: t('createCta'), onClick: () => setCreateOpen(true) },
  ];

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: tm('tab.overview') },
    { key: 'products', label: tm('tab.products'), count: productsCount },
    { key: 'inquiries', label: tm('tab.inquiries'), count: inquiries.length },
    { key: 'settings', label: tm('tab.settings') },
  ];

  const dateFmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
        new Date(iso),
      );
    } catch {
      return '';
    }
  };

  // The rail share card is the canonical share surface. The in-body CTAs here
  // (Overview activation, Inquiries empty) start prominent, then fade to a quiet
  // "share again" link once the seller has shared once - so the action appears
  // at full weight in exactly one place at a time.
  const shareButtons = hasShared ? (
    <a
      href={waHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={markShared}
      className="inline-flex items-center gap-1 text-[12.5px] font-semibold no-underline"
      style={{ color: 'var(--cr-primary)' }}
    >
      {tm('shareAgain')} <ArrowRight size={13} aria-hidden />
    </a>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={markShared}
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-[13px] font-semibold text-white no-underline"
        style={{ background: '#25D366' }}
      >
        {tm('shareWhatsapp')}
      </a>
      <button
        type="button"
        onClick={() => {
          void copyLink();
          markShared();
        }}
        className="cn-quiet-btn"
        style={{ padding: '7px 12px' }}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        {copied ? tm('copied') : tm('copyLink')}
      </button>
    </div>
  );

  const InquiryRow = ({ q }: { q: InquiryListItem }) => {
    const isNew = q.status === 'sent' || q.status === 'viewed';
    // Deep-link straight to the conversation; fall back to the inquiry channel
    // when the thread id could not be resolved.
    const href = q.threadId
      ? `/connect/inbox?thread=${q.threadId}`
      : '/connect/inbox?channel=inquiry';
    const cover = q.listing?.coverImage;
    return (
      <li>
        <Link
          href={href}
          className="flex items-start gap-3 rounded-lg p-3 no-underline transition-colors hover:bg-[var(--cr-surface-2)]"
          style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
        >
          {/* Product thumbnail (so the seller sees WHICH product before opening);
              falls back to the inbox glyph when the listing has no photo. */}
          <span
            aria-hidden
            className="grid shrink-0 place-items-center overflow-hidden"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: cover
                ? `center / cover no-repeat url(${JSON.stringify(cover)})`
                : 'var(--cr-surface-2)',
              color: isNew ? 'var(--cr-primary)' : 'var(--cr-text-4)',
            }}
          >
            {!cover && <InboxIcon size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate text-[13.5px] font-semibold"
                style={{ color: 'var(--cr-text)' }}
              >
                {q.party?.name ?? '-'}
              </span>
              {isNew && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: 'var(--cr-primary)', color: '#fff' }}
                >
                  {tm('inquiriesNewTag')}
                </span>
              )}
              <span
                className="ml-auto shrink-0 text-[11.5px]"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {dateFmt(q.createdAt)}
              </span>
            </div>
            {q.listing?.title && (
              <p className="m-0 mt-0.5 truncate text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                {tm('inquiriesRe', { title: q.listing.title })}
              </p>
            )}
            {q.message && (
              <p
                className="m-0 mt-1 text-[12.5px]"
                style={{
                  color: 'var(--cr-text-3)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {q.message}
              </p>
            )}
          </div>
        </Link>
      </li>
    );
  };

  const cardStyle: CSSProperties = {
    border: '1px solid var(--cr-border)',
    borderRadius: 'var(--cr-radius-lg)',
    background: 'var(--cr-surface)',
    padding: 'var(--cr-space-lg)',
  };

  return (
    <ConnectPage className="flex gap-5">
      {limitDialog}
      <main className="min-w-0 flex-1">
        {/* Breadcrumb - the escape route back to the list. */}
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1 text-[12.5px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          <Link
            href="/connect/stores"
            className="no-underline"
            style={{ color: 'var(--cr-primary)' }}
          >
            {t('hubTitle')}
          </Link>
          <ChevronRight size={13} aria-hidden />
          <span className="truncate">{store.name}</span>
        </nav>

        {/* Header: name + shop switcher · status pill. Delete lives in Settings. */}
        <header className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Dropdown menu={{ items: switcherItems }} trigger={['click']}>
            <button
              type="button"
              className="flex items-center gap-1.5"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <h1
                className="m-0 text-[24px] font-bold tracking-tight"
                style={{ color: 'var(--cr-text)' }}
              >
                {store.name}
              </h1>
              <ChevronDown size={20} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
            </button>
          </Dropdown>

          <button
            type="button"
            onClick={() => setTab('settings')}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{
              border: '1px solid var(--cr-border)',
              background: 'var(--cr-surface)',
              cursor: 'pointer',
              color: 'var(--cr-text-3)',
            }}
            title={t('visibilityLabel')}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background:
                  store.visibility === 'public'
                    ? liveCount > 0
                      ? 'var(--cr-success)'
                      : 'var(--cr-warning, #d97706)'
                    : 'var(--cr-text-4)',
              }}
            />
            {/* A public shop with no live products is not really "Live" for
                buyers - show "Setup" until at least one product is publishable.
                "Live" matches the activation copy + product status (one word). */}
            {visKey === 'public'
              ? liveCount > 0
                ? tm('shopLive')
                : tm('shopSetup')
              : t(`badge.${visKey}`)}
          </button>
        </header>

        {/* Public address + actions. The URL and its copy button read as one
            control (an address field), with "View public page" a separate
            button beside it - instead of three loose items at the same weight. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="cn-url-field">
            <Globe size={13} aria-hidden className="cn-url-icon" />
            <span className="cn-url-path font-mono">
              <span className="cn-url-prefix">/store/</span>
              <span className="cn-url-slug">{store.slug}</span>
            </span>
            <button
              type="button"
              onClick={copyLink}
              className={`cn-url-copy${copied ? 'cn-url-copy--done' : ''}`}
              title={copied ? tm('copied') : tm('copyLink')}
              aria-label={copied ? tm('copied') : tm('copyLink')}
            >
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            </button>
          </div>
          <Link
            href={publicPath}
            className="cn-quiet-btn no-underline"
            style={{ height: 34, color: 'var(--cr-primary)', fontWeight: 600 }}
          >
            <ExternalLink size={13} aria-hidden /> {t('viewPublic')}
          </Link>
        </div>

        {/* Glance strip - persistent across every tab so the seller always has
            their headline metrics (the Overview activation card handles the
            quiet-shop guidance separately, Overview-only). */}
        <div
          className="mb-4 grid items-stretch gap-3"
          // min(100%, 168px) floor: stat tiles shrink to 100% rather than overflowing
          // the strip on a narrow phone.
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 168px), 1fr))' }}
          aria-label={t('stat.products')}
        >
          {/* Live-products count. The inline "Make <name> live" CTA was removed
              per owner request; the same fix is still reachable from the rail's
              "needs attention" item, the Overview setup checklist, and each
              incomplete product's own card. */}
          <StatTile value={liveCount} label={t('stat.live')} icon={<Eye size={17} aria-hidden />} />
          <StatTile
            value={productsCount}
            label={t('stat.products')}
            icon={<Package size={17} aria-hidden />}
          />
          <StatTile
            value={views7d}
            label={t('stat.views7d')}
            icon={<LineChart size={17} aria-hidden />}
          />
          <StatTile
            value={unanswered}
            label={t('stat.newInquiries')}
            icon={<MessageSquare size={17} aria-hidden />}
          />
        </div>

        {/* Tabs. */}
        <div className="cn-tabs mb-5" role="tablist">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              className={`cn-tab ${tab === tb.key ? 'cn-tab--active' : ''}`}
              onClick={() => setTab(tb.key)}
            >
              {tb.label}
              {typeof tb.count === 'number' && <span className="cn-tab-count">{tb.count}</span>}
            </button>
          ))}
        </div>

        {/* Setup strip - on every non-Overview tab until all steps are done.
            Names where the action goes: "Fix below" when the next step is fixable
            on the current tab (filters / scrolls here), else "Go to setup" which
            opens the Overview checklist. Progress sits on the right. */}
        {tab !== 'overview' && !setupComplete && nextStep && (
          <button
            type="button"
            onClick={nextStep.target === tab ? nextStep.onAction : () => setTab('overview')}
            className="mb-4 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12.5px]"
            style={{
              border: '1px solid var(--cr-warning, #d97706)',
              background: 'var(--cr-warning-bg, #fffbeb)',
              color: 'var(--cr-warning, #b45309)',
              cursor: 'pointer',
            }}
          >
            <span className="inline-flex items-center gap-1 font-semibold">
              {tm(nextStep.key)}
              <span style={{ fontWeight: 500, opacity: 0.8 }}>
                &middot; {nextStep.target === tab ? tm('fixBelow') : tm('goToSetup')}
              </span>
              {nextStep.target === tab ? (
                <ArrowDown size={13} aria-hidden />
              ) : (
                <ArrowRight size={13} aria-hidden />
              )}
            </span>
            <span className="ml-auto shrink-0" style={{ opacity: 0.85 }}>
              {tm('setupProgress', { done: stepsDone, total: steps.length })}
            </span>
          </button>
        )}

        {tab === 'overview' &&
          (isQuiet ? (
            // Activation-first: a setup checklist + the "share to get visitors"
            // reasoning, instead of a wall of zeros. (The active-state dashboard
            // below carries the numbers once the shop has any traffic.)
            <div className="flex flex-col gap-5">
              <section style={cardStyle}>
                <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
                  {tm('activationTitle')}
                </h2>
                <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                  {tm('shareReason', { views: views7d })}
                </p>
                <div className="mt-3">{shareButtons}</div>

                <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--cr-border)' }}>
                  <p
                    className="m-0 mb-2 text-[13px] font-semibold"
                    style={{ color: 'var(--cr-text-2)' }}
                  >
                    {tm('activationBody')}
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {steps.map((s) => (
                      <li key={s.key} className="flex items-center gap-2">
                        <span aria-hidden className="shrink-0">
                          {s.done ? (
                            <span
                              className="grid place-items-center"
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                background: 'var(--cr-success)',
                                color: '#fff',
                              }}
                            >
                              <Check size={12} />
                            </span>
                          ) : (
                            <Circle size={18} style={{ color: 'var(--cr-text-4)' }} />
                          )}
                        </span>
                        <span
                          className="text-[13.5px]"
                          style={{
                            color: s.done ? 'var(--cr-text-4)' : 'var(--cr-text-2)',
                            textDecoration: s.done ? 'line-through' : 'none',
                          }}
                        >
                          {tm(s.key)}
                        </span>
                        {!s.done && (
                          <button
                            type="button"
                            onClick={s.onAction}
                            className="ml-auto inline-flex items-center gap-0.5 text-[12.5px] font-semibold"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--cr-primary)',
                            }}
                          >
                            {t('editSection')} <ArrowRight size={13} aria-hidden />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          ) : (
            // Dashboard: trend + recent inquiries. (The headline numbers live in
            // the persistent glance strip above, shared with every tab.)
            <div className="flex flex-col gap-5">
              <RailPanel title={tm('viewsTrend')}>
                <Sparkline series={series} />
              </RailPanel>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                    {tm('recentTitle')}
                  </h2>
                  {inquiries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('inquiries')}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--cr-primary)',
                      }}
                    >
                      {tm('tab.inquiries')} <ArrowRight size={13} aria-hidden />
                    </button>
                  )}
                </div>
                {inquiries.length === 0 ? (
                  <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                    {tm('inquiriesEmpty')}
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {inquiries.slice(0, 3).map((q) => (
                      <InquiryRow key={q._id} q={q} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

        {/* Products stays mounted (display-toggled) so the rail's "needs photo"
            deep-link can seed its filter and so filter/scroll state survives tab
            switches. Its toolbar owns the single "Add product" CTA. */}
        <section id="products" style={{ display: tab === 'products' ? 'block' : 'none' }}>
          {/* Over-limit (grandfathering) notice when over the products cap.
              Policy-aware + dismissable per session; invisible under freeze. */}
          <OverLimitBanner kind="listing" className="mb-4 max-w-xl" />
          {/* Person-wide products usage vs plan cap (GET /me/connect/usage). The
              at-cap heads-up now rides on the meter's info icon, not a banner. The
              cap spans all the owner's shops, not just this one. */}
          <ConnectUsageMeter kind="listing" surface="products" className="mb-4 max-w-sm" />
          <OwnerListingsManager
            listings={listings}
            addHref={addHref}
            viewsByListing={viewsByListing}
            seedFilter={productsSeed}
            seedNonce={productsSeedNonce}
            collections={collections.map((c) => ({
              id: c.collection._id,
              title: c.collection.title,
              count: c.productCount,
            }))}
            onManageCollections={() => setCollectionsOpen(true)}
          />
        </section>

        {tab === 'inquiries' && (
          <section>
            {inquiries.length === 0 ? (
              <div
                className="flex flex-col items-center gap-3 rounded-lg px-4 py-10 text-center"
                style={{ border: '1px dashed var(--cr-border)' }}
              >
                <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                  {tm('inquiriesEmpty')}
                </h2>
                <p className="m-0 max-w-[360px] text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                  {tm('inquiriesEmptyBody')}
                </p>
                <p
                  className="m-0 max-w-[360px] text-[12.5px]"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {tm('inquiriesEmptyHint')}
                </p>
                <div className="mt-1">{shareButtons}</div>
              </div>
            ) : (
              <>
                <div className="mb-3 flex justify-end">
                  <Link
                    href="/connect/inbox?channel=inquiry"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold no-underline"
                    style={{ color: 'var(--cr-primary)' }}
                  >
                    {tm('inquiriesOpen')} <ArrowRight size={13} aria-hidden />
                  </Link>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {inquiries.map((q) => (
                    <InquiryRow key={q._id} q={q} />
                  ))}
                </ul>
                {/* Load more: keyset-paginates the seller inbox (filtered to this
                    shop). Hidden once the cursor runs out. */}
                {inquiryCursor && (
                  <div className="mt-3 flex justify-center">
                    <DsButton
                      dsVariant="ghost"
                      dsSize="sm"
                      loading={loadingInquiries}
                      onClick={() => void loadMoreInquiries()}
                    >
                      {loadingInquiries ? tm('inquiriesLoadingMore') : tm('inquiriesLoadMore')}
                    </DsButton>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Collections CRUD - merged out of its own tab into a drawer opened
            from the Products shelf's "Manage collections". The manager component
            is reused verbatim; only its host changed (tab -> drawer). */}
        <DsDrawer
          open={collectionsOpen}
          onClose={() => setCollectionsOpen(false)}
          title={tm('collectionsDrawerTitle')}
        >
          <div style={{ padding: 'var(--cr-space-lg)' }}>
            <CollectionsManager
              storefrontId={store._id}
              collections={collections}
              products={listings}
            />
          </div>
        </DsDrawer>

        {tab === 'settings' && <StorefrontSettings storefront={store} />}

        {/* Create a new storefront in place (switcher "New storefront"), mirroring
            the Storefronts hub modal so the seller never has to leave to add one. */}
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
            submitting={creating}
            onSubmit={handleCreate}
            cancelHref={`/connect/stores/${store._id}`}
          />
        </Modal>
        {/* Mobile-only ad (same boost + Google slot as the rail, hidden below xl). */}
        <MobileAdInline promoted={promoted} />
      </main>

      {/* Operational rail: bordered cards (eyebrow header + body), 16px gap,
          sticky (Rail owns the sticky behaviour). */}
      {/* footer={false}: this dense manage console stays footer-free (a footer
          would add noise + lengthen the sticky rail). The page-bottom footer is
          also hidden here via the shell HideOnPaths. */}
      <Rail side="right" footer={false}>
        <div className="flex flex-col" style={{ gap: 16 }}>
          {/* Share - WhatsApp + copy/email/more + QR for packaging. */}
          <RailCard label={tm('shareTitle')}>
            <StorefrontShareCard slug={store.slug} name={store.name} onShared={markShared} />
          </RailCard>

          {/* Needs your attention - rich items, only when there are gaps. */}
          {needs.length > 0 && (
            <RailCard label={tm('needsTitle')} count={needs.length}>
              <ul className="m-0 list-none p-0">
                {needs.map((nd, i) => (
                  <li
                    key={nd.key}
                    style={{ borderTop: i > 0 ? '1px solid var(--cr-border-light)' : undefined }}
                  >
                    <button
                      type="button"
                      onClick={nd.onAction}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <span
                        className="grid shrink-0 place-items-center"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          background:
                            nd.tone === 'warning'
                              ? 'var(--cr-warning-bg, #fffbeb)'
                              : 'var(--cr-surface-2)',
                          color:
                            nd.tone === 'warning'
                              ? 'var(--cr-warning, #b45309)'
                              : 'var(--cr-text-3)',
                        }}
                      >
                        {nd.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-[13.5px] font-semibold"
                          style={{ color: 'var(--cr-text)' }}
                        >
                          {nd.title}
                        </span>
                        <span
                          className="block text-[12px] leading-snug"
                          style={{ color: 'var(--cr-text-4)' }}
                        >
                          {nd.subtitle}
                        </span>
                      </span>
                      <ChevronRight
                        size={16}
                        aria-hidden
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--cr-text-4)' }}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </RailCard>
          )}

          {/* PAUSED 2026-06-05 - "Public page" preview RailCard (clickable 16:9
              preview + public URL + "updated" time) commented out per owner
              request. Revive via `rg "PAUSED 2026-06-05 - Public page preview"`;
              the `relativeTimeFrom` helper it uses is paused alongside. The rest
              of the rail (Share, Needs attention, Performance, Ads) is unchanged. */}
          {/* PAUSED 2026-06-05 - Public page preview
          <RailCard label={tm('previewTitle')}>
            <Link
              href={publicPath}
              className="relative block no-underline"
              aria-label={tm('previewOpen')}
            >
              <div
                className="relative grid place-items-center text-center"
                style={{
                  aspectRatio: '16 / 9',
                  background: store.banner
                    ? `center / cover no-repeat url(${JSON.stringify(store.banner)})`
                    : 'linear-gradient(135deg, #1a2150, #0e1230)',
                }}
              >
                {!store.banner && (
                  <span className="px-4">
                    <span className="block text-[20px] font-bold" style={{ color: '#fff' }}>
                      Zari<span style={{ color: '#d4a843' }}>360</span>
                    </span>
                    <span
                      className="mt-1 block text-[11px] font-semibold tracking-wide uppercase"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                      {store.name} &middot; {tm('storefrontTag')}
                    </span>
                  </span>
                )}
                <span
                  className="absolute grid place-items-center"
                  style={{
                    top: 10,
                    right: 10,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.45)',
                    color: '#fff',
                  }}
                  aria-hidden
                >
                  <ExternalLink size={14} />
                </span>
              </div>
            </Link>
            <div
              className="flex items-center justify-between gap-2 px-4 py-3"
              style={{ borderTop: '1px solid var(--cr-border-light)' }}
            >
              <span
                className="inline-flex min-w-0 items-center gap-2 truncate text-[12.5px] font-semibold"
                style={{ color: 'var(--cr-text-2)' }}
              >
                <span
                  className="shrink-0"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background:
                      store.visibility === 'public' ? 'var(--cr-success)' : 'var(--cr-text-4)',
                  }}
                  aria-hidden
                />
                <span className="truncate">
                  {origin ? `${origin.replace(/^https?:\/\//, '')}${publicPath}` : publicPath}
                </span>
              </span>
              {origin && store.updatedAt && (
                <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                  {tm('lastUpdated', { time: relativeTimeFrom(store.updatedAt) })}
                </span>
              )}
            </div>
          </RailCard>
          */}

          {/* Performance - hidden entirely until there is something to show. */}
          {(views30d > 0 || inquiries.length > 0) && (
            <RailCard label={tm('perfTitle')}>
              <div className="p-4">
                <Sparkline series={series} />
                <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: 'var(--cr-text-3)' }}>
                  {tm('perfSummary', { views: views30d, inquiries: inquiries.length })}
                </p>
              </div>
            </RailCard>
          )}

          {/* Ad engine: Google / house ad slots (render nothing until wired) +
              the first-party promoted listing (boost) + a house promo between
              them. The boost renders nothing on a no-fill (placement
              `storefront_manage`); resolved in app/connect/stores/[id]/page.tsx. */}
          <AdSlot placement="connect.right.top" />
          {promoted ? <PromotedListingAdCard {...promoted} /> : null}
          <RailCard label={tAds('title')}>
            <div className="p-4">
              <p
                className="m-0 text-[12.5px] leading-relaxed"
                style={{ color: 'var(--cr-text-3)' }}
              >
                {tAds('body')}
              </p>
              <Link
                href="/connect/marketplace/new"
                className="mt-2.5 inline-block text-[12.5px] font-semibold no-underline"
                style={{ color: 'var(--cr-primary)' }}
              >
                {tAds('cta')}
              </Link>
            </div>
          </RailCard>
          <AdSlot placement="connect.right.mid" />
        </div>
      </Rail>
    </ConnectPage>
  );
}
