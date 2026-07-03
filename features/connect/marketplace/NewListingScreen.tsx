'use client';

/**
 * NewListingScreen - the create wrapper around the shared ListingForm
 * (/connect/marketplace/new, M1.6.3 + M1.6.4).
 *
 * Owns the create action call + result UI: a "listing is live" success panel
 * (moderation is off, so a new listing publishes immediately), the soft
 * listing-cap prompt (`CONNECT_LISTING_LIMIT_REACHED`, naming the plan limit +
 * linking to manage), and a generic error. The field set + image upload live in
 * ListingForm.
 *
 * It also owns the seller-assist layer that only makes sense on create:
 *  - storefront-aware navigation (Back / Cancel / success return to the shop the
 *    seller came from, not the generic marketplace);
 *  - a local autosave so an accidental nav-away never loses typing;
 *  - a contextual rail (fill progress + a live preview + tips that react to what
 *    is still missing);
 *  - "duplicate from an existing product" and "save and add another" for sellers
 *    listing many similar products.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, App as AntApp, Modal, Select } from 'antd';
import { ArrowLeft, CheckCircle2, Circle, CopyPlus, ImageOff } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectPage, RailPanel } from '@/components/connect';
import { announceGlobal } from '@/components/connect/globalAnnouncer';
// Shared plan-limit upgrade prompt (replaces the old bespoke inline warning), so
// a blocked create shows the same dialog as every other Connect create flow.
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import EntityAdRail from '../ads/EntityAdRail';
import { formatRupees } from './format';
import { categoryLabel } from '../search.types';
import type { PromotedListingResolved } from './PromotedListingAdCard';
import type { CreateListingInput } from './marketplace.types';
import { createListing } from './marketplace.actions';
import { setListingCollections } from '../entities/collection.actions';
import ListingForm, {
  type ListingSnapshot,
  type ListingFormValues,
  type StorefrontOption,
  type CollectionOption,
} from './ListingForm';

/** A draft persisted to localStorage so an accidental nav-away loses nothing. */
interface StoredDraft {
  values: Partial<ListingFormValues>;
  images: string[];
  savedAt: number;
}

/** A compact listing to seed the duplicate picker. */
export interface DuplicableListing {
  id: string;
  title: string;
  values: Partial<ListingFormValues>;
}

const DRAFT_PREFIX = 'cn:new-listing-draft:';

/** True once the seller has typed/added anything worth keeping. */
function draftHasContent(s: ListingSnapshot): boolean {
  return !!(
    s.title?.trim() ||
    s.description?.trim() ||
    s.images.length ||
    s.category ||
    s.priceType ||
    s.district?.trim() ||
    s.city?.trim() ||
    s.state?.trim()
  );
}

export default function NewListingScreen({
  storefronts = [],
  defaultStorefrontId,
  promoted = null,
  duplicable = [],
  collectionsByShop,
}: {
  /** The seller's shops; the form shows a picker only when there are 2+. */
  storefronts?: StorefrontOption[];
  /** Pre-file the product in this shop (set when arriving from a shop's "Add
   *  product"); the picker pre-selects it so a multi-shop seller lands right. */
  defaultStorefrontId?: string;
  /** First-party promoted listing for the ad rail (resolved server-side). */
  promoted?: PromotedListingResolved | null;
  /** The seller's existing products, to offer "duplicate from existing". */
  duplicable?: DuplicableListing[];
  /** The owner's collections per shop, for the in-form collections picker. */
  collectionsByShop?: Record<string, CollectionOption[]>;
}) {
  const t = useTranslations('connect.marketplace.new');
  const tProg = useTranslations('connect.marketplace.new.progress');
  const tPrev = useTranslations('connect.marketplace.new.preview');
  const tTips = useTranslations('connect.marketplace.new.tips');
  const tCat = useTranslations('connect.search.listing.category');
  const tDetail = useTranslations('connect.marketplace.detail');
  const router = useRouter();
  const { message } = AntApp.useApp();

  // The shop the seller came from (when arriving via "?storefrontId="). Drives
  // back/cancel/success so they return to that shop's products, not the generic
  // marketplace browse.
  const fromShop = useMemo(
    () => storefronts.find((s) => s.id === defaultStorefrontId) ?? null,
    [storefronts, defaultStorefrontId],
  );
  const backHref = fromShop ? `/connect/stores/${fromShop.id}` : '/connect/marketplace';
  const backLabel = fromShop ? t('backToShop', { shop: fromShop.name }) : t('back');
  // After publishing, land on the product listing page: the shop's Products tab
  // when the seller came from a shop, else their cross-shop "My listings".
  const publishedHref = fromShop
    ? `/connect/stores/${fromShop.id}?tab=products`
    : '/connect/marketplace/mine';

  const draftKey = `${DRAFT_PREFIX}${defaultStorefrontId ?? 'default'}`;

  // Restore a local draft once, on mount. The restored values seed the form's
  // initialValues; we surface a dismissible note so the restore is never silent.
  const [restored] = useState<StoredDraft | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredDraft;
      return parsed?.values || parsed?.images?.length ? parsed : null;
    } catch {
      return null;
    }
  });
  const [showRestored, setShowRestored] = useState(!!restored);

  const [formKey, setFormKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashPublished, setFlashPublished] = useState(false);
  // Plan-limit upgrade prompt (shown when createListing returns CONNECT_LIMIT_REACHED).
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ListingSnapshot | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(restored?.savedAt ?? null);
  // Current time, refreshed every 30s, so the "saved Nm ago" label stays roughly
  // current without calling Date.now() during render (which is impure).
  const [now, setNow] = useState<number>(restored?.savedAt ?? 0);

  // Overrides applied to the form (restore + duplicate), with the came-from shop
  // always pinned so a multi-shop seller files into the right place.
  const [seedValues, setSeedValues] = useState<Partial<ListingFormValues>>(() => ({
    ...(restored?.values ?? {}),
    ...(defaultStorefrontId ? { storefrontId: defaultStorefrontId } : {}),
  }));
  const [seedImages, setSeedImages] = useState<string[]>(restored?.images ?? []);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* storage blocked - nothing to clear */
    }
    setSavedAt(null);
  }, [draftKey]);

  // Autosave on every snapshot change (cheap; keystroke-frequency is fine for
  // localStorage). Clears the store when the seller empties the form.
  const handleSnapshot = useCallback(
    (next: ListingSnapshot) => {
      setSnapshot(next);
      if (!draftHasContent(next)) {
        clearDraft();
        return;
      }
      const at = Date.now();
      try {
        const { images, ...values } = next;
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ values, images, savedAt: at } satisfies StoredDraft),
        );
        setSavedAt(at);
        setNow(at);
      } catch {
        /* storage blocked - autosave is best-effort */
      }
    },
    [draftKey, clearDraft],
  );

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const resetForm = useCallback(
    (values: Partial<ListingFormValues>, images: string[]) => {
      setSeedValues({
        ...values,
        ...(defaultStorefrontId ? { storefrontId: defaultStorefrontId } : {}),
      });
      setSeedImages(images);
      setSnapshot(null);
      setFormKey((k) => k + 1);
    },
    [defaultStorefrontId],
  );

  const discardDraft = () => {
    clearDraft();
    setShowRestored(false);
    resetForm({}, []);
  };

  const handleSubmit = async (
    input: CreateListingInput,
    opts?: { addAnother?: boolean; asDraft?: boolean; collectionIds?: string[] },
  ) => {
    setSubmitting(true);
    setErrorMsg(null);
    const res = await createListing(input);
    setSubmitting(false);
    if (res.ok) {
      clearDraft();
      // File the freshly-created product into the collections the seller picked.
      if (opts?.collectionIds?.length) {
        await setListingCollections(res.data._id, opts.collectionIds);
      }
      if (opts?.addAnother) {
        // Batch path: stay put, clear the form, confirm with an inline flash.
        setShowRestored(false);
        resetForm({}, []);
        setFlashPublished(true);
      } else {
        // Draft saved off-market vs published live: distinct toast, same landing
        // (the product listing page, where a draft shows under the Draft filter).
        const msg = opts?.asDraft ? t('draftSavedToast') : t('successTitle');
        message.success(msg);
        announceGlobal(msg);
        router.push(publishedHref);
      }
    } else if (handleLimited(res)) {
      // Plan limit hit: the shared upgrade dialog is now showing (no toast).
    } else {
      setErrorMsg(res.error);
    }
  };

  // ── Duplicate from existing ────────────────────────────────────────────────
  const [dupOpen, setDupOpen] = useState(false);
  const [dupChoice, setDupChoice] = useState<string | undefined>(undefined);
  const applyDuplicate = () => {
    const source = duplicable.find((d) => d.id === dupChoice);
    if (source) resetForm(source.values, []); // photos are deliberately not copied
    setDupOpen(false);
    setDupChoice(undefined);
  };

  const banner = (
    <>
      {flashPublished && (
        <Alert
          type="success"
          showIcon
          closable
          onClose={() => setFlashPublished(false)}
          style={{ marginBottom: 'var(--cr-space-md)' }}
          title={t('flashPublished')}
        />
      )}
      {showRestored && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 'var(--cr-space-md)' }}
          title={t('draftRestored')}
          action={
            <DsButton dsVariant="ghost" dsSize="sm" onClick={discardDraft}>
              {t('draftDiscard')}
            </DsButton>
          }
          closable
          onClose={() => setShowRestored(false)}
        />
      )}
      {limitDialog}
      {errorMsg && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--cr-space-md)' }}
          title={t('submitErrorTitle')}
          description={errorMsg}
        />
      )}
    </>
  );

  // ── Rail: fill progress + live preview + contextual tips ─────────────────────
  const SECTIONS = [
    { key: 'photos', anchor: 'sec-photos', done: (snapshot?.images.length ?? 0) > 0 },
    {
      key: 'basics',
      anchor: 'sec-basics',
      done: !!snapshot?.title?.trim() && !!snapshot?.category,
    },
    { key: 'description', anchor: 'sec-description', done: !!snapshot?.description?.trim() },
    { key: 'pricing', anchor: 'sec-pricing', done: !!snapshot?.priceType },
    {
      key: 'location',
      anchor: 'sec-location',
      done: !!(snapshot?.district?.trim() || snapshot?.city?.trim() || snapshot?.state?.trim()),
    },
  ] as const;
  const filled = SECTIONS.filter((s) => s.done).length;
  const ready = !!snapshot?.title?.trim() && !!snapshot?.category;

  const progressPanel = (
    <RailPanel title={tProg('title')}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={SECTIONS.length}
        aria-valuenow={filled}
        aria-label={tProg('count', { filled, total: SECTIONS.length })}
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--cr-surface-2)',
          overflow: 'hidden',
          marginBottom: 'var(--cr-space-sm)',
        }}
      >
        <div
          style={{
            width: `${(filled / SECTIONS.length) * 100}%`,
            height: '100%',
            background: 'var(--cr-primary)',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {SECTIONS.map((s) => (
          <li key={s.key}>
            <a
              href={`#${s.anchor}`}
              className="no-underline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: s.done ? 'var(--cr-text-3)' : 'var(--cr-text)',
              }}
            >
              <span
                aria-hidden
                style={{ color: s.done ? 'var(--cr-success)' : 'var(--cr-text-4)' }}
              >
                {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </span>
              {tProg(s.key)}
            </a>
          </li>
        ))}
      </ul>
      <p
        style={{
          margin: 'var(--cr-space-sm) 0 0',
          fontSize: 12,
          fontWeight: 600,
          color: ready ? 'var(--cr-success)' : 'var(--cr-text-4)',
        }}
      >
        {ready ? tProg('ready') : tProg('addMore')}
      </p>
    </RailPanel>
  );

  const cover = snapshot?.images[0];
  const priceText =
    !snapshot?.priceType || snapshot.priceType === 'negotiable' || snapshot.priceMin == null
      ? snapshot?.priceType
        ? tDetail('negotiable')
        : null
      : snapshot.priceType === 'range' &&
          snapshot.priceMax != null &&
          snapshot.priceMax > snapshot.priceMin
        ? tDetail('priceRange', {
            min: formatRupees(snapshot.priceMin),
            max: formatRupees(snapshot.priceMax),
          })
        : formatRupees(snapshot.priceMin);
  const previewLocation = [
    snapshot?.city?.trim(),
    snapshot?.district?.trim(),
    snapshot?.state?.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  const previewPanel = (
    <RailPanel title={tPrev('title')}>
      <div
        style={{
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-md)',
          overflow: 'hidden',
          background: 'var(--cr-surface)',
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob / R2 preview of unknown dimensions; matches the Connect listing-card pattern
          <img
            src={cover}
            alt=""
            aria-hidden
            style={{
              width: '100%',
              height: 120,
              objectFit: 'cover',
              display: 'block',
              background: 'var(--cr-surface-2)',
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: '100%',
              height: 120,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-4)',
            }}
          >
            <ImageOff size={22} aria-hidden />
          </div>
        )}
        <div style={{ padding: '10px 12px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: 13.5,
              fontWeight: 700,
              color: snapshot?.title?.trim() ? 'var(--cr-text)' : 'var(--cr-text-4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {snapshot?.title?.trim() || tPrev('placeholderTitle')}
          </h3>
          {snapshot?.category && (
            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--cr-text-4)' }}>
              {categoryLabel(snapshot.category, tCat)}
            </div>
          )}
          {priceText && (
            <div
              style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: 'var(--cr-primary)' }}
            >
              {priceText}
            </div>
          )}
          {previewLocation && (
            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--cr-text-4)' }}>
              {previewLocation}
            </div>
          )}
        </div>
      </div>
    </RailPanel>
  );

  // The single most useful nudge for the current state, then the evergreen tips.
  const contextualTip = !snapshot?.title?.trim()
    ? tTips('needTitle')
    : (snapshot?.images.length ?? 0) === 0
      ? tTips('needPhotos')
      : (snapshot?.description?.trim().length ?? 0) < 50
        ? tTips('needDescription')
        : !snapshot?.priceType
          ? tTips('needPrice')
          : null;

  const tipsPanel = (
    <RailPanel title={tTips('title')}>
      {contextualTip && (
        <p
          className="text-[12.5px] leading-relaxed"
          style={{
            margin: '0 0 var(--cr-space-sm)',
            padding: 'var(--cr-space-sm)',
            borderRadius: 'var(--cr-radius-sm)',
            background: 'var(--cr-wash-indigo)',
            color: 'var(--cr-primary)',
            fontWeight: 600,
          }}
        >
          {contextualTip}
        </p>
      )}
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {(['t1', 't2', 't3'] as const).map((k) => (
          <li
            key={k}
            className="text-[12.5px] leading-relaxed"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {tTips(k)}
          </li>
        ))}
      </ul>
    </RailPanel>
  );

  const savedLabel =
    savedAt == null
      ? null
      : (() => {
          const mins = Math.max(0, Math.floor((now - savedAt) / 60_000));
          return mins < 1 ? t('draftSavedJustNow') : t('draftSavedAgo', { minutes: mins });
        })();

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        <Link
          href={backHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-primary)',
          }}
        >
          <ArrowLeft size={14} aria-hidden />
          {backLabel}
        </Link>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: 'var(--cr-space-sm)',
            margin: 'var(--cr-space-xs) 0 0',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
            {t('title')}
          </h1>
          {savedLabel && (
            <span style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>{savedLabel}</span>
          )}
        </div>
        <p style={{ margin: '4px 0 6px', fontSize: 13.5, color: 'var(--cr-text-4)' }}>
          {t('subtitle')}
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--cr-space-sm)',
            marginBottom: 'var(--cr-space-md)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: 'var(--cr-radius-full)',
              fontSize: 11.5,
              fontWeight: 600,
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-3)',
            }}
          >
            {t('requiredNote')}
          </span>
          {duplicable.length > 0 && (
            <button
              type="button"
              onClick={() => setDupOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--cr-primary)',
              }}
            >
              <CopyPlus size={14} aria-hidden />
              {t('duplicateCta')}
            </button>
          )}
        </div>
        <ListingForm
          key={formKey}
          submitLabel={t('submit')}
          draftLabel={t('saveDraft')}
          secondaryLabel={t('saveAndAnother')}
          submitting={submitting}
          onSubmit={handleSubmit}
          onSnapshot={handleSnapshot}
          storefronts={storefronts}
          collectionsByShop={collectionsByShop}
          defaultStorefrontId={defaultStorefrontId}
          initialValues={seedValues}
          initialImages={seedImages}
          banner={banner}
          cancelHref={backHref}
        />
      </main>
      {/* The rail's ad inventory is owned by EntityAdRail / ConnectRightRail and
          stays intact: the `connect.right.top` slot (Google AdSense -> house
          creative) leads, the first-party promoted listing sits directly under
          it, and the `connect.right.mid` slot anchors the foot. The seller-assist
          panels ride in the contextual floor region BETWEEN the promoted ad and
          the mid slot, so they never displace a paid unit. */}
      <EntityAdRail
        promoted={promoted}
        floorPanel={
          <>
            {progressPanel}
            {previewPanel}
            {tipsPanel}
          </>
        }
      />

      <Modal
        open={dupOpen}
        title={t('duplicateTitle')}
        onCancel={() => setDupOpen(false)}
        onOk={applyDuplicate}
        okText={t('duplicateApply')}
        cancelText={t('duplicateCancel')}
        okButtonProps={{ disabled: !dupChoice }}
      >
        <p style={{ marginTop: 0, fontSize: 13, color: 'var(--cr-text-4)' }}>
          {t('duplicateHelp')}
        </p>
        <Select
          style={{ width: '100%' }}
          placeholder={t('duplicatePlaceholder')}
          value={dupChoice}
          onChange={setDupChoice}
          options={duplicable.map((d) => ({ label: d.title, value: d.id }))}
          showSearch
          optionFilterProp="label"
        />
      </Modal>
    </ConnectPage>
  );
}
