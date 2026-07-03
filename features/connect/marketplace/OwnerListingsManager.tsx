'use client';

/**
 * OwnerListingsManager - the seller's product manager inside a storefront's
 * Products tab.
 *
 * Toolbar: search, status filter (incl. a "Needs photo" cross-cut the Overview
 * rail deep-links into), category filter, sort, a grid/list view toggle
 * (persisted per browser - grid default, since these are visual textile goods),
 * a Select mode for bulk Pause / Delete / Change-category, and the single
 * "Add product" CTA. Each product renders as a rich card (grid) or row (list):
 * prominent photo (or an inline "Add photo" slot that opens a focused upload
 * modal - no navigating away), display-weight price, an edge status pill, a
 * visible "Needs photo" warning, the rejection reason when rejected, and
 * Edit / Preview primary with Boost / Pause / Publish / Edit-photos / Delete
 * behind a per-row overflow menu. Mutations call the server action then
 * `router.refresh()` so the host re-fetches (no optimistic divergence).
 */

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckSquare,
  Eye,
  Layers,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MoreHorizontal,
  PackagePlus,
  Plus,
  Search,
  Square,
} from 'lucide-react';
import { Alert, Dropdown, Input, Modal, Select, type MenuProps } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState } from '@/components/connect';
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
import { LISTING_CATEGORIES, categoryLabel } from '../search.types';
import type { ActionResult } from '../profile.types';
import type { ListingCategory, OwnerListing } from './marketplace.types';
import { deleteListing, pauseListing, publishListing, updateListing } from './marketplace.actions';
import { addCollectionProducts } from '../entities/collection.actions';
// Additive boost-CTA funnel telemetry. Keyless-safe (no-op without analytics keys).
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import { SuppressedBadge } from '@/components/connect/SuppressedBadge';
import {
  listingDisplayStatus,
  isLive,
  needsDetails,
  hasPhoto,
  type ListingDisplayStatus,
} from './listing-status';
import './OwnerListingsManager.css';

type ViewMode = 'grid' | 'list';
// The filterable subset of the shared display status (`live` = visible to
// buyers, `needsPhoto` = the only thing blocking visibility). `pending`/`expired`
// are valid statuses but rare, so they are reachable via "All" rather than their
// own filter chip.
type StatusFilter = 'all' | 'live' | 'needsPhoto' | 'draft' | 'paused' | 'rejected';
type SortKey = 'newest' | 'oldest' | 'priceHigh' | 'priceLow' | 'views' | 'name';

const VIEW_STORAGE_KEY = 'cn:listings-view';
const STATUS_FILTERS: StatusFilter[] = ['all', 'live', 'needsPhoto', 'draft', 'paused', 'rejected'];

const STATUS_TONE: Record<ListingDisplayStatus, { bg: string; fg: string }> = {
  live: { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
  needsPhoto: { bg: 'var(--cr-warning-bg, #fef3c7)', fg: 'var(--cr-warning, #b45309)' },
  pending: { bg: 'var(--cr-wash-indigo)', fg: 'var(--cr-primary)' },
  paused: { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-3)' },
  draft: { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-3)' },
  rejected: { bg: 'var(--cr-error-bg)', fg: 'var(--cr-error)' },
  expired: { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-4)' },
};

const btnStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--cr-primary)',
  padding: '4px 11px',
  borderRadius: 'var(--cr-radius-sm)',
  border: '1px solid var(--cr-border-light)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--cr-surface)',
};

const pillStyle = (tone: { bg: string; fg: string }): CSSProperties => ({
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 9px',
  borderRadius: 'var(--cr-radius-full)',
  background: tone.bg,
  color: tone.fg,
  boxShadow: '0 1px 2px rgba(16,24,40,0.12)',
});

interface OwnerListingsManagerProps {
  listings: OwnerListing[];
  /** The "Add product" link (storefront-scoped when embedded in a shop). */
  addHref: string;
  /** Per-listing 7-day view counts (listingId -> views), shown on each card. */
  viewsByListing?: Record<string, number>;
  /**
   * Push a status filter in from outside (the Overview rail's "needs photo"
   * fix-it deep-links here). `seedNonce` bumps on each request so the same
   * filter can be re-applied; we never re-apply on a plain re-render.
   */
  seedFilter?: StatusFilter | null;
  seedNonce?: number;
  /**
   * The shop's collections (id + title + optional live count). Drives the
   * collection shelf (the in-Products filter chips) + the per-card membership
   * line + the bulk "Add to collection" action. Empty / omitted (a shop with no
   * collections) hides the shelf chips. `count` shows on each chip when present.
   */
  collections?: { id: string; title: string; count?: number }[];
  /**
   * Opens the collection manager (the create/edit/reorder/assign CRUD, now a
   * drawer owned by the storefront console rather than a separate tab). When
   * provided, the shelf shows a "Manage collections" / "New collection" entry.
   * Omitted on surfaces that do not host the drawer.
   */
  onManageCollections?: () => void;
}

export default function OwnerListingsManager({
  listings,
  addHref,
  viewsByListing,
  seedFilter = null,
  seedNonce,
  collections = [],
  onManageCollections,
}: OwnerListingsManagerProps) {
  const t = useTranslations('connect.marketplace.mine');
  const tStatus = useTranslations('connect.marketplace.mine.status');
  const tCat = useTranslations('connect.search.listing.category');
  const router = useRouter();

  // id -> title lookup for the filter labels + the per-card membership line.
  const collectionTitle = useMemo(
    () => new Map(collections.map((c) => [c.id, c.title])),
    [collections],
  );

  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<ListingCategory | 'all'>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyBulk, setBusyBulk] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Keep a row's spinner on through the post-mutation `router.refresh()` (the
  // server re-fetch), not just the action call - otherwise the button flips back
  // to its old label with no feedback during the refetch. `refreshingId` marks
  // the row whose refresh is in flight; `isRefreshing` is the transition's
  // pending flag, cleared when the fresh data lands.
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<ListingCategory | undefined>(undefined);
  const [addCollectionOpen, setAddCollectionOpen] = useState(false);
  const [bulkCollection, setBulkCollection] = useState<string | undefined>(undefined);
  const [photoModal, setPhotoModal] = useState<{ id: string; images: string[] } | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  // Persist the grid/list choice per browser (visual sellers default to grid).
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'grid' || saved === 'list') setView(saved);
  }, []);
  const pickView = (next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* storage blocked - in-memory only */
    }
  };

  // Apply an externally-seeded filter (rail "needs photo" deep-link) only when
  // the nonce actually changes - never on an incidental re-render.
  const lastSeed = useRef(seedNonce);
  useEffect(() => {
    if (seedNonce === undefined || seedNonce === lastSeed.current) return;
    lastSeed.current = seedNonce;
    if (seedFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter(seedFilter);
      setSelectMode(false);
    }
  }, [seedNonce, seedFilter]);

  const inr = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  const priceOf = (l: OwnerListing): number | null =>
    typeof l.priceMin === 'number' ? l.priceMin : null;

  const priceLabel = (l: OwnerListing): string | null =>
    l.priceType === 'negotiable'
      ? t('priceNegotiable')
      : l.priceType === 'range' && typeof l.priceMin === 'number' && typeof l.priceMax === 'number'
        ? `${inr(l.priceMin)} - ${inr(l.priceMax)}`
        : typeof l.priceMin === 'number'
          ? inr(l.priceMin)
          : null;

  const listedDate = (l: OwnerListing): string | null =>
    l.createdAt
      ? new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(l.createdAt))
      : null;

  // Filter + sort the working set.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
      // Collection membership lives on the product (`collectionIds`); filter to
      // the products in the chosen collection.
      if (collectionFilter !== 'all' && !(l.collectionIds ?? []).includes(collectionFilter))
        return false;
      // Filter on the seller-facing display status (Live / Incomplete / Draft /
      // Paused / Rejected) so the dropdown matches the pills on the cards.
      if (statusFilter !== 'all' && listingDisplayStatus(l) !== statusFilter) return false;
      return true;
    });
    const byDate = (l: OwnerListing) => (l.createdAt ? new Date(l.createdAt).getTime() : 0);
    const views = (l: OwnerListing) => viewsByListing?.[l._id] ?? 0;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return byDate(a) - byDate(b);
        case 'priceHigh':
          return (priceOf(b) ?? -1) - (priceOf(a) ?? -1);
        case 'priceLow':
          return (priceOf(a) ?? Number.MAX_SAFE_INTEGER) - (priceOf(b) ?? Number.MAX_SAFE_INTEGER);
        case 'views':
          return views(b) - views(a);
        case 'name':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return byDate(b) - byDate(a);
      }
    });
    return sorted;
  }, [listings, search, categoryFilter, collectionFilter, statusFilter, sort, viewsByListing]);

  // A row is "busy" while EITHER its action is in flight OR its post-action
  // server refetch is. Drives the per-row spinner so Pause/Resume/Publish/Delete
  // show continuous feedback through both phases. `refreshingId` is only read
  // while `isRefreshing` is true, so a stale value after the transition settles
  // is harmless (no clearing effect needed).
  const rowBusy = (id: string) => busyId === id || (refreshingId === id && isRefreshing);

  const run = async (id: string, action: (id: string) => Promise<ActionResult<unknown>>) => {
    setBusyId(id);
    setErrorMsg(null);
    const res = await action(id);
    setBusyId(null);
    if (res.ok) {
      // Hold the spinner over the refetch via a transition (its `isRefreshing`
      // stays true until the re-rendered server data lands).
      setRefreshingId(id);
      startRefresh(() => router.refresh());
    } else {
      setErrorMsg(res.error);
    }
  };

  const runBulk = async (ids: string[], action: (id: string) => Promise<ActionResult<unknown>>) => {
    if (ids.length === 0) return;
    setBusyBulk(true);
    setErrorMsg(null);
    const results = await Promise.all(ids.map((id) => action(id)));
    setBusyBulk(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      setErrorMsg(failed.error);
      return;
    }
    setSelected(new Set());
    setSelectMode(false);
    router.refresh();
  };

  const selectedIds = useMemo(() => [...selected], [selected]);
  const selectedListings = useMemo(
    () => visible.filter((l) => selected.has(l._id)),
    [visible, selected],
  );
  // Only genuinely-live products can be paused (mirrors the per-row toggle); a
  // not-live one (needs photo / draft) has nothing to pause.
  const pausableIds = selectedListings.filter((l) => isLive(l)).map((l) => l._id);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAllVisible = () => setSelected(new Set(visible.map((l) => l._id)));
  const clearSelection = () => setSelected(new Set());
  const exitSelect = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const openPhotoModal = (l: OwnerListing) => {
    setErrorMsg(null);
    setPhotoUrls(l.images ?? []);
    setPhotoModal({ id: l._id, images: l.images ?? [] });
  };

  const savePhotos = async () => {
    if (!photoModal) return;
    setBusyBulk(true);
    setErrorMsg(null);
    const res = await updateListing(photoModal.id, { images: photoUrls });
    setBusyBulk(false);
    if (res.ok) {
      setPhotoModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.error);
    }
  };

  const applyBulkCategory = async () => {
    if (!bulkCategory) return;
    setCategoryModalOpen(false);
    await runBulk(selectedIds, (id) => updateListing(id, { category: bulkCategory }));
    setBulkCategory(undefined);
  };

  // Bulk add the selected products to one collection (a single union call, not a
  // per-product loop - mirrors the backend `addProductsBulk`).
  const applyBulkAddCollection = async () => {
    if (!bulkCollection || selectedIds.length === 0) return;
    setBusyBulk(true);
    setErrorMsg(null);
    const res = await addCollectionProducts(bulkCollection, selectedIds);
    setBusyBulk(false);
    if (res.ok) {
      setAddCollectionOpen(false);
      setBulkCollection(undefined);
      setSelected(new Set());
      setSelectMode(false);
      router.refresh();
    } else {
      setErrorMsg(res.error);
    }
  };

  // Whole-shop empty state (no products at all yet).
  if (listings.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<PackagePlus size={24} aria-hidden />}
        title={t('emptyTitle')}
        description={t('emptyBody')}
        primaryAction={{ label: t('listCta'), href: addHref }}
      />
    );
  }

  const statusFilterLabel = (s: StatusFilter) => (s === 'all' ? t('filterStatusAll') : tStatus(s));

  const menuItemsFor = (listing: OwnerListing): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      {
        key: 'photos',
        label: hasPhoto(listing) ? t('editPhotos') : t('addPhoto'),
        onClick: () => openPhotoModal(listing),
      },
      ...(listing.moderationStatus === 'approved'
        ? [
            {
              key: 'boost',
              label: t('boost'),
              onClick: () => {
                // Additive funnel telemetry: boost CTA clicked (listing) before
                // navigating to the composer. Keyless-safe (no-op without keys).
                trackEvent(ConnectEvents.boostCtaClicked, { subject: 'listing' });
                router.push(`/connect/boost/listing/${listing._id}`);
              },
            },
          ]
        : []),
      // Pause / Resume / Publish are NOT here - they surface as a visible quick
      // toggle in RowActions (StatusToggle) so a status change is one obvious
      // click, not buried behind the overflow.
      { type: 'divider' as const, key: 'd' },
      {
        key: 'delete',
        danger: true,
        label: t('delete'),
        onClick: () => setConfirmingId(listing._id),
      },
    ];
    return items;
  };

  // A selection checkbox overlay (shown only in select mode).
  const SelectBox = ({ id }: { id: string }) => {
    const on = selected.has(id);
    return (
      <button
        type="button"
        onClick={() => toggleSelect(id)}
        aria-label={t('selectItem')}
        aria-pressed={on}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          border: 'none',
          background: on ? 'var(--cr-primary)' : 'rgba(255,255,255,0.92)',
          borderRadius: 6,
          color: on ? '#fff' : 'var(--cr-text-3)',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(16,24,40,0.25)',
        }}
      >
        {on ? <CheckSquare size={18} aria-hidden /> : <Square size={18} aria-hidden />}
      </button>
    );
  };

  const RejectionNote = ({ listing }: { listing: OwnerListing }) =>
    listing.status === 'rejected' && listing.rejectionReason ? (
      <div
        style={{
          marginTop: 6,
          padding: '6px 10px',
          borderRadius: 'var(--cr-radius-sm)',
          background: 'var(--cr-error-bg)',
          color: 'var(--cr-error)',
          fontSize: 12,
        }}
      >
        <strong style={{ display: 'block', fontWeight: 700 }}>{t('rejectionTitle')}</strong>
        {listing.rejectionReason}
      </div>
    ) : null;

  // The empty thumbnail IS the fix-it: an amber dropzone-style slot carrying the
  // warning copy + tap-to-add, so there is one CTA for the missing photo (no
  // separate warning chip + "Add photo" row).
  const PhotoSlot = ({ listing, variant }: { listing: OwnerListing; variant: 'grid' | 'list' }) => (
    <button
      type="button"
      className="cn-photo-slot"
      onClick={() => openPhotoModal(listing)}
      aria-label={t('addPhoto')}
      style={
        variant === 'grid'
          ? {
              // Round all corners to the card radius so the dashed border reads
              // as a clean rounded box, not rounded-top / square-bottom.
              width: '100%',
              aspectRatio: '4 / 3',
              borderRadius: 'var(--cr-radius-lg)',
            }
          : { flexShrink: 0, width: 72, height: 72, borderRadius: 'var(--cr-radius-sm)' }
      }
    >
      <span style={{ padding: 4 }}>
        <AlertTriangle size={variant === 'grid' ? 20 : 16} aria-hidden />
        <span
          style={{
            display: 'block',
            fontSize: variant === 'grid' ? 12 : 9.5,
            fontWeight: 700,
            marginTop: variant === 'grid' ? 4 : 2,
            lineHeight: 1.2,
          }}
        >
          {t('needsPhoto')}
        </span>
      </span>
    </button>
  );

  // The visible quick status control: one contextual button per row so a status
  // change is immediate (live -> Pause, paused -> Resume, draft -> Publish).
  // Rejected / expired / in-review carry no seller-driven transition, so none.
  const StatusToggle = ({ listing }: { listing: OwnerListing }) => {
    const busy = rowBusy(listing._id);
    let label: string | null = null;
    let action: ((id: string) => Promise<ActionResult<unknown>>) | null = null;
    if (isLive(listing)) {
      // "Pause" is offered ONLY for a genuinely LIVE product (visible to buyers).
      // A raw-active but not-live listing ("Needs photo") would contradict its
      // badge if it showed "Pause"; the fix there is adding a photo (Edit), not a
      // pause - so no toggle shows for it.
      label = t('pause');
      action = pauseListing;
    } else if (listing.status === 'paused') {
      label = t('resume');
      action = publishListing;
    } else if (listing.status === 'draft') {
      label = t('publish');
      action = publishListing;
    }
    if (!label || !action) return null;
    const act = action;
    return (
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void run(listing._id, act)}
        style={{ ...btnStyle, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.75 : 1 }}
      >
        {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
        {label}
      </button>
    );
  };

  const RowActions = ({ listing }: { listing: OwnerListing }) => {
    const busy = rowBusy(listing._id);
    // "Preview" always opens the owner-scoped preview route: the seller clicked
    // it from their own manager, so they get the seller chrome (the "how buyers
    // see it" banner + back-to-edit), never the buyer's "Back to marketplace".
    // Works for any status, live included.
    const previewHref = `/connect/marketplace/listing/${listing._id}/preview`;
    const editHref = `/connect/marketplace/listing/${listing._id}/edit`;
    if (confirmingId === listing._id) {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span style={{ fontSize: 12.5, color: 'var(--cr-text-2)' }}>{t('deleteConfirm')}</span>
          <DsButton dsVariant="ghost" dsSize="sm" autoFocus onClick={() => setConfirmingId(null)}>
            {t('deleteKeep')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            disabled={busy}
            loading={busy}
            onClick={() => {
              setConfirmingId(null);
              void run(listing._id, deleteListing);
            }}
          >
            {t('deleteConfirmYes')}
          </DsButton>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={editHref}
          aria-label={t('editAria', { title: listing.title })}
          className="no-underline"
          style={btnStyle}
        >
          {t('edit')}
        </Link>
        <Link
          href={previewHref}
          aria-label={t('preview')}
          className="no-underline"
          style={btnStyle}
        >
          <Eye size={13} aria-hidden /> {t('preview')}
        </Link>
        <StatusToggle listing={listing} />
        <Dropdown
          menu={{ items: menuItemsFor(listing) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <button
            type="button"
            aria-label={t('moreActions')}
            disabled={busy}
            style={{ ...btnStyle, cursor: 'pointer', color: 'var(--cr-text-3)' }}
          >
            <MoreHorizontal size={15} aria-hidden />
          </button>
        </Dropdown>
      </div>
    );
  };

  const MetaLine = ({ listing }: { listing: OwnerListing }) => {
    const price = priceLabel(listing);
    const date = listedDate(listing);
    const views = viewsByListing?.[listing._id] ?? 0;
    // The shop collections this product is filed in (titles resolved from ids;
    // unknown ids - e.g. a stale ref - are skipped).
    const memberTitles = (listing.collectionIds ?? [])
      .map((id) => collectionTitle.get(id))
      .filter((title): title is string => !!title);
    return (
      <div
        style={{
          margin: '4px 0 0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px 8px',
          fontSize: 12,
          color: 'var(--cr-text-4)',
        }}
      >
        <span>{categoryLabel(listing.category, tCat)}</span>
        <span>&middot; {t('views', { count: views })}</span>
        {date && <span>&middot; {t('listed', { date })}</span>}
        {price && (
          <span
            style={{
              flexBasis: '100%',
              marginTop: 2,
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--cr-text)',
            }}
          >
            {price}
          </span>
        )}
        {memberTitles.length > 0 && (
          <span
            aria-label={t('inCollections', { names: memberTitles.join(', ') })}
            style={{
              flexBasis: '100%',
              marginTop: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              color: 'var(--cr-text-4)',
            }}
          >
            <Layers size={12} aria-hidden />
            <span>{memberTitles.join(', ')}</span>
          </span>
        )}
        {/* Soft, non-blocking nudge: the product is LIVE but could carry a price
            or description. Quiet (not the amber "needs photo" warning) - it does
            not change the Live status, just suggests a richer listing. */}
        {needsDetails(listing) && (
          <Link
            href={`/connect/marketplace/listing/${listing._id}/edit`}
            className="no-underline"
            style={{
              flexBasis: '100%',
              marginTop: 1,
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--cr-primary)',
            }}
          >
            {t('addDetails')}
          </Link>
        )}
      </div>
    );
  };

  // ── Grid card ────────────────────────────────────────────────────────────
  const renderCard = (listing: OwnerListing) => {
    const cover = listing.images?.[0];
    const dStatus = listingDisplayStatus(listing);
    const tone = STATUS_TONE[dStatus];
    // When the amber photo slot is showing it already carries the incomplete
    // warning - so drop the redundant edge pill in that case (one signal).
    const showPill = !(dStatus === 'needsPhoto' && !cover);
    return (
      <div
        key={listing._id}
        className={`cn-prod-card ${selected.has(listing._id) ? 'cn-prod-card--selected' : ''}`}
      >
        <div style={{ position: 'relative' }}>
          {cover ? (
            <div
              aria-hidden
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                background: `center / cover no-repeat url(${JSON.stringify(cover)})`,
              }}
            />
          ) : (
            <PhotoSlot listing={listing} variant="grid" />
          )}
          {showPill && (
            <span style={{ position: 'absolute', top: 8, right: 8, ...pillStyle(tone) }}>
              {dStatus === 'needsPhoto' && <AlertTriangle size={10} aria-hidden />}
              {tStatus(dStatus)}
            </span>
          )}
          {/* Over-limit (hide_newest): hidden from public view; owner still sees it.
              Invisible under the default freeze policy. */}
          {listing.suppressed && (
            <span style={{ position: 'absolute', bottom: 8, left: 8 }}>
              <SuppressedBadge />
            </span>
          )}
          {selectMode && (
            <span style={{ position: 'absolute', top: 8, left: 8 }}>
              <SelectBox id={listing._id} />
            </span>
          )}
        </div>

        <div style={{ padding: 'var(--cr-space-sm) var(--cr-space-md)', flex: 1 }}>
          <h3
            className="m-0 truncate"
            style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--cr-text)' }}
          >
            {listing.title}
          </h3>
          <MetaLine listing={listing} />
          <RejectionNote listing={listing} />
        </div>

        <div
          style={{
            padding: '0 var(--cr-space-md) var(--cr-space-sm)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <RowActions listing={listing} />
        </div>
      </div>
    );
  };

  // ── List row ─────────────────────────────────────────────────────────────
  const renderRow = (listing: OwnerListing) => {
    const cover = listing.images?.[0];
    const dStatus = listingDisplayStatus(listing);
    const tone = STATUS_TONE[dStatus];
    // The 72px amber slot already flags incomplete-no-photo; skip the edge pill.
    const showPill = !(dStatus === 'needsPhoto' && !cover);
    return (
      <div
        key={listing._id}
        className={`cn-prod-row ${selected.has(listing._id) ? 'cn-prod-row--selected' : ''}`}
      >
        {selectMode && (
          <div className="flex items-center">
            <SelectBox id={listing._id} />
          </div>
        )}
        {cover ? (
          <div
            aria-hidden
            style={{
              flexShrink: 0,
              width: 72,
              height: 72,
              borderRadius: 'var(--cr-radius-sm)',
              background: `center / cover no-repeat url(${JSON.stringify(cover)})`,
            }}
          />
        ) : (
          <PhotoSlot listing={listing} variant="list" />
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-start justify-between gap-2">
            <h3
              className="m-0 truncate"
              style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--cr-text)' }}
            >
              {listing.title}
            </h3>
            {showPill && (
              <span style={pillStyle(tone)}>
                {dStatus === 'needsPhoto' && <AlertTriangle size={10} aria-hidden />}
                {tStatus(dStatus)}
              </span>
            )}
          </div>
          {/* Over-limit (hide_newest): this product is hidden from public view
              because the owner is over their plan limit. Invisible under freeze. */}
          {listing.suppressed && <SuppressedBadge className="mt-1" />}
          <MetaLine listing={listing} />
          <RejectionNote listing={listing} />
          <div style={{ marginTop: 8 }}>
            <RowActions listing={listing} />
          </div>
        </div>
      </div>
    );
  };

  const selectControl = (
    <button
      type="button"
      className={`cn-seg-btn ${selectMode ? 'cn-seg-btn--active' : ''}`}
      onClick={() => {
        setSelectMode((m) => !m);
        clearSelection();
      }}
      style={{ border: '1px solid var(--cr-border)', borderRadius: 'var(--cr-radius-md)' }}
    >
      <CheckSquare size={15} aria-hidden /> {selectMode ? t('selectDone') : t('select')}
    </button>
  );

  return (
    <div>
      {errorMsg && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setErrorMsg(null)}
          style={{ marginBottom: 'var(--cr-space-md)' }}
          message={t('actionErrorTitle')}
          description={errorMsg}
        />
      )}

      {/* Collection shelf -- the merged Products + Collections surface. A visible
          chip row (one accent on the active chip, mirroring the public store's
          collection tabs) that drives the collection filter, plus a quiet
          "Manage collections" entry that opens the collection CRUD drawer
          (owned by the storefront console). Renders only when the shop has
          collections or the manage entry is wired. */}
      {(collections.length > 0 || onManageCollections) && (
        <div className="cn-col-shelf" role="group" aria-label={t('collectionsShelfAria')}>
          {collections.length > 0 && (
            <>
              <button
                type="button"
                className={`cn-col-chip ${collectionFilter === 'all' ? 'cn-col-chip--active' : ''}`}
                aria-pressed={collectionFilter === 'all'}
                onClick={() => setCollectionFilter('all')}
              >
                {t('collectionAll')}
                <span className="cn-col-chip-count">{listings.length}</span>
              </button>
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cn-col-chip ${collectionFilter === c.id ? 'cn-col-chip--active' : ''}`}
                  aria-pressed={collectionFilter === c.id}
                  onClick={() => setCollectionFilter(c.id)}
                >
                  {c.title}
                  {typeof c.count === 'number' && (
                    <span className="cn-col-chip-count">{c.count}</span>
                  )}
                </button>
              ))}
            </>
          )}
          {onManageCollections && (
            <button
              type="button"
              className={`cn-col-manage ${collections.length === 0 ? 'cn-col-manage--solo' : ''}`}
              onClick={onManageCollections}
            >
              <Layers size={13} aria-hidden />
              {collections.length > 0 ? t('manageCollections') : t('newCollection')}
            </button>
          )}
        </div>
      )}

      {/* Toolbar: search · status · category · sort · view · select · add. */}
      <div className="cn-lm-toolbar">
        <Input
          className="cn-lm-search"
          allowClear
          size="middle"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          prefix={<Search size={14} aria-hidden style={{ color: 'var(--cr-text-4)' }} />}
          aria-label={t('searchPlaceholder')}
        />
        <Select<StatusFilter>
          size="middle"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ minWidth: 116 }}
          aria-label={t('filterStatus')}
          options={STATUS_FILTERS.map((s) => ({ value: s, label: statusFilterLabel(s) }))}
        />
        <Select<ListingCategory | 'all'>
          size="middle"
          value={categoryFilter}
          onChange={setCategoryFilter}
          style={{ minWidth: 132 }}
          aria-label={t('filterCategory')}
          options={[
            { value: 'all', label: t('filterCategoryAll') },
            ...LISTING_CATEGORIES.map((c) => ({ value: c, label: tCat(c) })),
          ]}
        />
        {/* Collection filtering moved OUT of this dropdown to the visible shelf
            above (the merged Products + Collections surface). */}
        <Select<SortKey>
          size="middle"
          value={sort}
          onChange={setSort}
          style={{ minWidth: 138 }}
          aria-label={t('sortLabel')}
          options={[
            { value: 'newest', label: t('sortNewest') },
            { value: 'oldest', label: t('sortOldest') },
            { value: 'priceHigh', label: t('sortPriceHigh') },
            { value: 'priceLow', label: t('sortPriceLow') },
            { value: 'views', label: t('sortViews') },
            { value: 'name', label: t('sortName') },
          ]}
        />

        <div className="cn-lm-spacer" />

        {selectControl}
        <DsButton dsVariant="primary" dsSize="sm" href={addHref}>
          <Plus size={15} aria-hidden /> {t('listCta')}
        </DsButton>
        <div className="cn-seg" role="group" aria-label={t('viewLabel')}>
          <button
            type="button"
            className={`cn-seg-btn ${view === 'grid' ? 'cn-seg-btn--active' : ''}`}
            onClick={() => pickView('grid')}
            aria-pressed={view === 'grid'}
            aria-label={t('viewGrid')}
            title={t('viewGrid')}
          >
            <LayoutGrid size={15} aria-hidden />
          </button>
          <button
            type="button"
            className={`cn-seg-btn ${view === 'list' ? 'cn-seg-btn--active' : ''}`}
            onClick={() => pickView('list')}
            aria-pressed={view === 'list'}
            aria-label={t('viewList')}
            title={t('viewList')}
          >
            <ListIcon size={15} aria-hidden />
          </button>
        </div>
      </div>

      <p className="m-0 mb-2 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('resultsCount', { count: visible.length })}
      </p>

      {/* Results. */}
      {visible.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-lg px-4 py-10 text-center"
          style={{ border: '1px dashed var(--cr-border)' }}
        >
          <p className="m-0 text-[13.5px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
            {t('noMatch')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
            className="text-[12.5px] font-semibold"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--cr-primary)',
            }}
          >
            {t('noMatchClear')}
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="cn-prod-grid">
          {visible.map(renderCard)}
          {/* Always close the grid with an add affordance so the surface never
              looks empty with a single product. */}
          {!selectMode && (
            <Link
              href={addHref}
              className="cn-add-tile cn-add-tile--grid"
              aria-label={t('listCta')}
            >
              <span className="cn-add-tile-icon" aria-hidden>
                <Plus size={24} />
              </span>
              <span className="cn-add-tile-title">{t('listCta')}</span>
              <span className="cn-add-tile-hint">{t('addProductHint')}</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="cn-prod-list" aria-label={t('listAria')}>
          {visible.map(renderRow)}
          {!selectMode && (
            <Link
              href={addHref}
              className="cn-add-tile cn-add-tile--list"
              aria-label={t('listCta')}
            >
              <Plus size={16} aria-hidden /> {t('listCta')}
            </Link>
          )}
        </div>
      )}

      {/* Sticky bulk-action bar: visible the moment Select mode is on, so the
          available actions are previewed (ghosted/disabled) and simply enable on
          the first check. */}
      {selectMode && (
        <div className="cn-bulk-bar">
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: selected.size > 0 ? 'var(--cr-text)' : 'var(--cr-text-3)',
            }}
          >
            {selected.size > 0 ? t('selectedCount', { count: selected.size }) : t('selectHint')}
          </span>
          <button type="button" onClick={selectAllVisible} className="cn-link-btn">
            {t('selectAll')}
          </button>
          <div className="cn-lm-spacer" />
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            disabled={busyBulk || pausableIds.length === 0}
            loading={busyBulk}
            onClick={() => void runBulk(pausableIds, pauseListing)}
          >
            {t('bulkPause')}
          </DsButton>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            disabled={busyBulk || selected.size === 0}
            onClick={() => setCategoryModalOpen(true)}
          >
            {t('bulkCategory')}
          </DsButton>
          {collections.length > 0 && (
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              disabled={busyBulk || selected.size === 0}
              onClick={() => setAddCollectionOpen(true)}
            >
              {t('bulkAddCollection')}
            </DsButton>
          )}
          <DsButton
            dsVariant="danger"
            dsSize="sm"
            disabled={busyBulk || selected.size === 0}
            loading={busyBulk}
            onClick={() => setBulkDeleteOpen(true)}
          >
            {t('bulkDelete')}
          </DsButton>
          <DsButton dsVariant="ghost" dsSize="sm" disabled={busyBulk} onClick={exitSelect}>
            {t('cancel')}
          </DsButton>
        </div>
      )}

      {/* Inline photo fix-it (reuses the proven uploader; no navigation). */}
      <Modal
        open={!!photoModal}
        onCancel={() => setPhotoModal(null)}
        title={t('addPhotoTitle')}
        okText={t('addPhotoSave')}
        cancelText={t('cancel')}
        onOk={() => void savePhotos()}
        confirmLoading={busyBulk}
        destroyOnHidden
      >
        <p className="m-0 mb-3 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('addPhotoBody')}
        </p>
        {photoModal && (
          <MediaUploadGrid
            key={photoModal.id}
            mediaKind="image"
            max={10}
            initialUrls={photoModal.images}
            onChange={setPhotoUrls}
          />
        )}
      </Modal>

      {/* Bulk change-category. */}
      <Modal
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
        title={t('bulkCategoryTitle', { count: selected.size })}
        okText={t('bulkCategoryApply')}
        cancelText={t('cancel')}
        okButtonProps={{ disabled: !bulkCategory }}
        onOk={() => void applyBulkCategory()}
        confirmLoading={busyBulk}
        destroyOnHidden
      >
        <Select<ListingCategory>
          style={{ width: '100%' }}
          value={bulkCategory}
          onChange={setBulkCategory}
          placeholder={t('filterCategory')}
          options={LISTING_CATEGORIES.map((c) => ({ value: c, label: tCat(c) }))}
        />
      </Modal>

      {/* Bulk add-to-collection. */}
      <Modal
        open={addCollectionOpen}
        onCancel={() => setAddCollectionOpen(false)}
        title={t('bulkAddCollectionTitle', { count: selected.size })}
        okText={t('bulkAddCollectionApply')}
        cancelText={t('cancel')}
        okButtonProps={{ disabled: !bulkCollection }}
        onOk={() => void applyBulkAddCollection()}
        confirmLoading={busyBulk}
        destroyOnHidden
      >
        <Select<string>
          style={{ width: '100%' }}
          value={bulkCollection}
          onChange={setBulkCollection}
          placeholder={t('bulkAddCollectionPlaceholder')}
          options={collections.map((c) => ({ value: c.id, label: c.title }))}
        />
      </Modal>

      {/* Bulk delete confirm. */}
      <Modal
        open={bulkDeleteOpen}
        onCancel={() => setBulkDeleteOpen(false)}
        title={t('bulkDelete')}
        okText={t('deleteConfirmYes')}
        cancelText={t('deleteKeep')}
        okButtonProps={{ danger: true }}
        confirmLoading={busyBulk}
        onOk={() => {
          setBulkDeleteOpen(false);
          void runBulk(selectedIds, deleteListing);
        }}
        destroyOnHidden
      >
        <p className="m-0 text-[13.5px]" style={{ color: 'var(--cr-text-2)' }}>
          {t('bulkDeleteConfirm', { count: selected.size })}
        </p>
      </Modal>
    </div>
  );
}
