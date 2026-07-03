'use client';

/**
 * ListingForm - the shared listing field set used by both create
 * (NewListingScreen) and edit (EditListingScreen) (M1.6.4). It owns the AntD
 * Form + the image grid, builds the `CreateListingInput` from the values, and
 * hands it to the parent's `onSubmit`. The parent owns the action call and the
 * result UI (success / limit / error), injected here via `banner`.
 *
 * Only title + category are required (mirrors the backend DTO); the rest are
 * optional trade terms. Images reuse the shipped `MediaUploadGrid`, seeded with
 * `initialImages` for edit.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { searchTags } from './tag.actions';
import { createCollection } from '../entities/collection.actions';
import { useTranslations } from 'next-intl';
import {
  Button,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
  Tooltip,
} from 'antd';
// Dayjs is the AntD DatePicker value type; course batchStart is a Dayjs in the
// form and serializes back to ISO on submit (mirrors JobComposer.closesAt).
import { type Dayjs } from 'dayjs';
import { X } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
// Policy-driven product-video cap (seconds) for the section help copy - the same
// number MediaUploadGrid enforces in its pre-check, never a second hardcoded value.
import { getUploadPolicy } from '@/lib/upload-policies.helpers';
import './ListingForm.css';
import {
  LISTING_COURSE_FEE_TYPES,
  LISTING_COURSE_MODES,
  LISTING_PRICE_TYPES,
  LISTING_SERVICE_DELIVERY_MODES,
  LISTING_SERVICE_PRICING_MODELS,
  LISTING_UNITS,
  NEW_SERVICE_CATEGORIES,
  type CreateListingInput,
  type ListingCategory,
  type ListingCourseDetails,
  type ListingPriceType,
  type ListingServiceDetails,
  type ListingUnit,
  type ListingVideo,
} from './marketplace.types';

/** Set lookup for the 8 service categories that switch the form to the service
 *  field set (mirror of the BE NEW_SERVICE_CATEGORIES require-rule). */
const NEW_SERVICE_CATEGORY_SET = new Set<string>(NEW_SERVICE_CATEGORIES);

/**
 * The known listing categories, grouped for the picker. They mix process (what
 * you do to cloth), trade (what you buy/sell), and learn (a training course -
 * Institutes Phase 1), so a flat row reads as a jumble; the labelled clusters let
 * a seller scan to their kind fast. The values are the same backend enum - this
 * is presentation only. `learn` carries the `course` slug, which switches the
 * form to the course field set below; `string[]` (not `ListingCategory[]`) since
 * `course` is a search-types category not in the marketplace product enum.
 */
const CATEGORY_GROUPS: {
  key: 'process' | 'trade' | 'learn' | 'service';
  items: (ListingCategory | string)[];
}[] = [
  { key: 'process', items: ['weaving', 'dyeing', 'printing', 'embroidery-zari'] },
  { key: 'trade', items: ['job-work', 'raw-material', 'machinery', 'finished-goods'] },
  { key: 'learn', items: ['course'] },
  // Service categories (Slice B2): the 8 NEW_SERVICE_CATEGORIES. Picking one
  // switches the form to the service field set below (mirrors how `course`
  // switches to the course fields). `string[]` since these are not in the
  // marketplace product enum, same as `course`.
  {
    key: 'service',
    items: [
      'consulting',
      'maintenance',
      'machine-repair',
      'testing',
      'installation',
      'transport',
      'logistics',
      'contractor',
    ],
  },
];

/**
 * A live read of the form, emitted on every change via `onSnapshot`. The create
 * screen uses it to drive the rail (progress, contextual tips, live preview) and
 * to autosave a local draft. Carries the raw field values plus the uploaded
 * image URLs so a draft can be fully restored.
 */
export interface ListingSnapshot {
  title?: string;
  category?: string;
  description?: string;
  priceType?: ListingPriceType;
  priceMin?: number;
  priceMax?: number;
  unit?: ListingUnit;
  moq?: number;
  leadTimeDays?: number;
  district?: string;
  city?: string;
  state?: string;
  tags?: string[];
  /** Spec rows as typed (may hold incomplete rows mid-edit). */
  specs?: { label?: string; value?: string }[];
  /** Trade-terms prose as typed. */
  tradeTerms?: { dispatch?: string; payment?: string; returns?: string };
  images: string[];
}

export interface ListingFormValues {
  title: string;
  category: string;
  description?: string;
  priceType?: ListingPriceType;
  priceMin?: number;
  priceMax?: number;
  unit?: ListingUnit;
  moq?: number;
  leadTimeDays?: number;
  storefrontId?: string;
  district?: string;
  city?: string;
  state?: string;
  tags?: string[];
  /** Specification rows (Form.List) - rendered as the detail-page spec grid. */
  specs?: { label?: string; value?: string }[];
  /** Off-platform trade terms - rendered on the detail-page rail. */
  tradeTerms?: { dispatch?: string; payment?: string; returns?: string };
  // ── Course fields (Institutes Phase 1) - bound ONLY when category==='course'.
  // They are collected into `courseDetails` in handleFinish, which also derives
  // the shared price rows (priceType/priceMin/priceMax) from `courseFeeType`.
  /** Course length, free text (e.g. "3 months", "12 weeks"). Required for course. */
  courseDurationLabel?: string;
  /** Next batch start date (AntD DatePicker value); serialized to ISO on submit. */
  courseBatchStart?: Dayjs;
  /** Delivery mode. Required for course. */
  courseMode?: 'online' | 'offline' | 'hybrid';
  /** Fee type, drives the price rows (free -> none, fixed -> priceMin, range -> both). */
  courseFeeType?: 'fixed' | 'range' | 'free';
  /** Optional seat cap. */
  courseSeats?: number;
  /** Whether a certificate is awarded. */
  courseCertificate?: boolean;
  /** Skills the course teaches (tags input). */
  courseSkillsTaught?: string[];
  // ── Service fields (Slice B2) - bound ONLY when the category is one of the 8
  // NEW_SERVICE_CATEGORIES. Collected into `serviceDetails` in handleFinish, which
  // also derives the shared price rows (priceType/priceMin) from `servicePricingModel`.
  /** Where the service is delivered. Required for a service category. */
  serviceDeliveryMode?: 'on-site' | 'remote' | 'both';
  /** How the fee is expressed; drives the price rows (negotiable -> none, else priceMin).
   *  Required for a service category. */
  servicePricingModel?: 'fixed' | 'hourly' | 'daily' | 'per-visit' | 'negotiable';
  /** Free-text geographic coverage, e.g. "Surat + Ahmedabad". Optional. */
  serviceCoverageArea?: string;
  /** Years of experience the provider has. Optional. */
  serviceYearsExperience?: number;
  /** Free-text availability, e.g. "Mon to Sat, 9am to 7pm". Optional. */
  serviceAvailability?: string;
}

/** Minimal shop reference for the storefront picker. */
export interface StorefrontOption {
  id: string;
  name: string;
}

/** Minimal collection reference for the in-form collections picker. */
export interface CollectionOption {
  id: string;
  title: string;
}

interface ListingFormProps {
  submitLabel: string;
  submitting: boolean;
  /**
   * Receives the built payload. `opts.addAnother` is true when the seller used
   * the optional "Save and add another" action, so the create screen can reset
   * the form instead of showing the success panel. Edit ignores it.
   */
  onSubmit: (
    input: CreateListingInput,
    opts?: { addAnother?: boolean; asDraft?: boolean; collectionIds?: string[] },
  ) => void;
  initialValues?: Partial<ListingFormValues>;
  initialImages?: string[];
  /**
   * The listing's existing product video(s) for the edit prefill (at most one).
   * Seeds the video grid AND preserves each clip's already-captured `posterUrl`
   * on save - so editing other fields never drops the existing poster. Create
   * passes none.
   */
  initialVideos?: ListingVideo[];
  /**
   * The seller's shops. The picker shows ONLY when there are 2+ (a single-shop
   * or no-shop seller never has to choose -- the backend auto-files the default).
   * Omitted entirely on edit (a listing does not move between shops here).
   */
  storefronts?: StorefrontOption[];
  /** Parent-injected content above the form (limit / error alerts). */
  banner?: ReactNode;
  /** Where the Cancel link points. Defaults to the marketplace browse. */
  cancelHref?: string;
  /**
   * Called on every field change with a live read of the form. The create
   * screen uses it for the rail (progress / tips / preview) + local autosave.
   * MUST be referentially stable (wrap in `useCallback`) - it is an effect dep.
   */
  onSnapshot?: (snapshot: ListingSnapshot) => void;
  /**
   * Optional secondary submit label ("Save and add another"). When set, a
   * second action renders next to the primary; the create screen passes it for
   * batch sellers. Omit on edit.
   */
  secondaryLabel?: string;
  /**
   * Optional "Save as draft" label. When set, a draft action renders that saves
   * the listing off-market (`asDraft`) instead of publishing it live. The create
   * screen passes it; edit omits it (an existing listing keeps its status).
   */
  draftLabel?: string;
  /**
   * The owner's collections per shop (`storefrontId -> collections`). Drives the
   * in-form "Collections" picker, scoped to whichever shop the product is filed
   * in. Omit (or leave empty) to hide the picker.
   */
  collectionsByShop?: Record<string, CollectionOption[]>;
  /**
   * The shop a single-shop seller (or the edit flow) files into when no picker
   * is shown - so the collections picker + inline-create know which shop to use.
   */
  defaultStorefrontId?: string;
  /** The collections this product already belongs to (edit prefills; create []). */
  initialCollectionIds?: string[];
}

/**
 * A labelled card that groups related fields, giving the form visual rhythm and
 * scannability instead of one long flat column. Uses `role="group"` +
 * `aria-labelledby` so the grouping is exposed to assistive tech (the heading
 * doubles as the group's accessible name).
 */
function FormSection({
  id,
  title,
  help,
  children,
}: {
  /** Anchor target for the rail's section nav (e.g. `sec-photos`). */
  id?: string;
  title: string;
  help?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      role="group"
      aria-labelledby={headingId}
      className="cn-listing-section"
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        padding: 'var(--cr-space-lg)',
        marginBottom: 'var(--cr-space-md)',
      }}
    >
      <h2
        id={headingId}
        style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--cr-text)' }}
      >
        {title}
      </h2>
      {help ? (
        <p
          style={{
            margin: '3px 0 var(--cr-space-md)',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--cr-text-4)',
          }}
        >
          {help}
        </p>
      ) : (
        <div style={{ height: 'var(--cr-space-md)' }} aria-hidden />
      )}
      {children}
    </section>
  );
}

/** The known category slugs, derived from the grouped presets. */
const KNOWN_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.items) as readonly string[];

/** Product-video duration cap (seconds), read from the upload policy (not hardcoded). */
const videoMaxSec = getUploadPolicy('connect-product-video').duration?.max ?? 60;

/**
 * The "add your own" category control: a searchable, self-creating combobox (not
 * a bare text box). As the seller types it suggests EXISTING categories (so two
 * sellers do not coin "saree" and "sarees" for the same thing), and offers an
 * explicit "Add <term>" row to commit a genuinely new one. The committed value
 * is a single canonical string; the backend folds it to a slug on save. Bound to
 * the wrapping Form.Item via the injected `value` / `onChange`.
 */
function CustomCategoryCombobox({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder: string;
}) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (!term) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await searchTags(term);
      if (res.ok) {
        // Drop the known 8 - those already have dedicated chips above.
        setOptions(
          res.data
            .filter((s) => !KNOWN_CATEGORIES.includes(s.slug))
            .map((s) => ({ label: s.label, value: s.slug })),
        );
      }
    }, 250);
  };

  // The committed custom value, mapped to the single-element array AntD's tags
  // mode uses. A known preset (chosen via the chips above) is not a custom value,
  // so it shows as empty here.
  const selected = value && !KNOWN_CATEGORIES.includes(value) ? [value] : [];

  // Single custom category rendered with the SAME tag-chip UX as the "Product
  // types & specialities" field (type-to-add, a removable chip, server
  // suggestions) so the two self-creating fields read identically. Capped at one
  // because a listing carries exactly one category; the form value stays a single
  // string (mapped to/from the one-element array here). Replaces the old bespoke
  // "Add <term>" combobox, which rendered plain text and could duplicate keys.
  return (
    <Select
      mode="tags"
      maxCount={1}
      showSearch
      filterOption={false}
      tokenSeparators={[',']}
      value={selected}
      placeholder={placeholder}
      onSearch={handleSearch}
      onChange={(vals: string[]) => onChange?.(vals[vals.length - 1] ?? '')}
      options={options}
      style={{ width: '100%' }}
    />
  );
}

/**
 * Category picker: the 8 known categories as quick localized chips PLUS an
 * "add your own" input, so a seller who does not fit the presets can name their
 * own. The value is a single canonical string (a known slug, or the seller's
 * own term); the backend normalizes a custom term to a slug on save. Controlled
 * by the wrapping `Form.Item name="category"`.
 */
function CategoryPicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const t = useTranslations('connect.marketplace.new');
  const tGroup = useTranslations('connect.marketplace.new.categoryGroup');
  const tCat = useTranslations('connect.search.listing.category');
  const isKnown = !!value && KNOWN_CATEGORIES.includes(value);
  const [customOpen, setCustomOpen] = useState(!!value && !isKnown);
  return (
    <div>
      <Radio.Group
        className="cn-cat-groups"
        value={isKnown ? value : undefined}
        onChange={(e) => {
          onChange?.(e.target.value);
          setCustomOpen(false);
        }}
      >
        {CATEGORY_GROUPS.map((group) => (
          <div key={group.key} className="cn-cat-group">
            <span className="cn-cat-group-label">{tGroup(group.key)}</span>
            <div className="cn-cat-row">
              {group.items.map((c) => (
                <Radio.Button key={c} value={c}>
                  {tCat(c)}
                </Radio.Button>
              ))}
            </div>
          </div>
        ))}
      </Radio.Group>
      <div className="cn-cat-custom">
        {customOpen ? (
          <CustomCategoryCombobox
            value={value}
            onChange={onChange}
            placeholder={t('categoryCustomPlaceholder')}
          />
        ) : (
          <button type="button" className="cn-cat-addown" onClick={() => setCustomOpen(true)}>
            {t('categoryAddOwn')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ListingForm({
  submitLabel,
  submitting,
  onSubmit,
  initialValues,
  initialImages,
  initialVideos,
  storefronts,
  banner,
  cancelHref = '/connect/marketplace',
  onSnapshot,
  secondaryLabel,
  draftLabel,
  collectionsByShop,
  defaultStorefrontId,
  initialCollectionIds,
}: ListingFormProps) {
  const showStorefrontPicker = (storefronts?.length ?? 0) > 1;
  const t = useTranslations('connect.marketplace.new');
  const tSec = useTranslations('connect.marketplace.new.section');
  const tUnit = useTranslations('connect.marketplace.detail.units');
  const [form] = Form.useForm<ListingFormValues>();
  const priceType = Form.useWatch('priceType', form);
  const watchedStorefrontId = Form.useWatch('storefrontId', form);
  // Course mode (Institutes Phase 1): when the seller picks the `course` category
  // the form swaps in the course field set + drives the price rows off the fee
  // type instead of the standard priceType radio.
  const category = Form.useWatch('category', form);
  const courseFeeType = Form.useWatch('courseFeeType', form);
  const isCourse = category === 'course';
  // Service mode (Slice B2): when the seller picks one of the 8 service categories
  // the form swaps in the service field set + drives the price rows off the
  // pricing model, mirroring the course branch above.
  const servicePricingModel = Form.useWatch('servicePricingModel', form);
  const isService = !!category && NEW_SERVICE_CATEGORY_SET.has(category);

  // ── Collections picker (in-form, shared by create + edit) ──────────────────
  // The shop this product files into: the picked shop (multi-shop), else the
  // came-from / single shop. The picker + inline-create are scoped to it.
  const activeShopId = showStorefrontPicker
    ? watchedStorefrontId
    : (defaultStorefrontId ?? storefronts?.[0]?.id);
  const [collectionsState, setCollectionsState] = useState<Record<string, CollectionOption[]>>(
    collectionsByShop ?? {},
  );
  const [collectionIds, setCollectionIds] = useState<string[]>(initialCollectionIds ?? []);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const activeCollections = useMemo(
    () => (activeShopId ? (collectionsState[activeShopId] ?? []) : []),
    [activeShopId, collectionsState],
  );

  // Create a new collection inline (no leaving the form), then select it.
  const createCollectionInline = async () => {
    const title = newCollectionName.trim();
    if (!title || !activeShopId) return;
    setCreatingCollection(true);
    const res = await createCollection(activeShopId, { title });
    setCreatingCollection(false);
    if (res.ok) {
      const option = { id: res.data._id, title: res.data.title };
      setCollectionsState((prev) => ({
        ...prev,
        [activeShopId]: [...(prev[activeShopId] ?? []), option],
      }));
      setCollectionIds((prev) => [...prev, option.id]);
      setNewCollectionName('');
    }
  };
  // A live mirror of the form values (seeded from initialValues) so the disable
  // gate + the parent snapshot react without one useWatch per field.
  const [values, setValues] = useState<Partial<ListingFormValues>>(initialValues ?? {});
  const [images, setImages] = useState<string[]>(initialImages ?? []);

  // ── Product video (at most one) ────────────────────────────────────────────
  // The uploaded clip URL(s) from the video grid + the {videoUrl -> posterUrl}
  // map the grid captures. `initialVideos` (edit) both seeds the grid and lets us
  // fall back to a clip's already-stored poster on save, so editing other fields
  // never strips an existing poster. The whole pipeline (duration pre-check at
  // 60s, poster capture, server duration) is reused from the feed via
  // MediaUploadGrid + the `connect-product-video` policy.
  const initialVideoUrls = useMemo(() => (initialVideos ?? []).map((v) => v.url), [initialVideos]);
  const initialPosterByUrl = useMemo(
    () =>
      Object.fromEntries(
        (initialVideos ?? []).filter((v) => v.posterUrl).map((v) => [v.url, v.posterUrl!]),
      ),
    [initialVideos],
  );
  const [videoUrls, setVideoUrls] = useState<string[]>(initialVideoUrls);
  // Captured posters only (the grid emits a {videoUrl -> posterUrl} map of NEWLY
  // captured frames; an initial/edit clip has no fresh capture). At save we merge
  // these over `initialPosterByUrl` so an untouched existing clip keeps its poster.
  const [capturedPosterByUrl, setCapturedPosterByUrl] = useState<Record<string, string>>({});

  // Which action was pressed: the secondary "add another" sets this just before
  // submitting so handleFinish can tell the parent to reset rather than confirm.
  const intentRef = useRef<'publish' | 'another' | 'draft'>('publish');

  // Tag combobox state: options from server typeahead.
  const [tagOptions, setTagOptions] = useState<{ label: string; value: string }[]>([]);
  const tagDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTagSearch = (q: string) => {
    if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
    if (!q.trim()) return;
    tagDebounceRef.current = setTimeout(async () => {
      const res = await searchTags(q.trim());
      if (res.ok) {
        setTagOptions(res.data.map((s) => ({ label: s.label, value: s.slug })));
      }
    }, 250);
  };

  // Emit a snapshot whenever any value or the image set changes. `onSnapshot`
  // is documented as stable, so this only fires on real edits.
  useEffect(() => {
    onSnapshot?.({ ...values, images });
  }, [values, images, onSnapshot]);

  // Required to publish == what the backend DTO requires: title + category
  // (plus a shop when the multi-shop picker is showing). Everything else is an
  // optional trade term, so the gate stays honest and never blocks on them. A
  // course additionally needs its three required course fields (durationLabel +
  // mode + feeType), mirroring the BE course DTO requireds.
  const courseReady =
    !!values.courseDurationLabel?.trim() && !!values.courseMode && !!values.courseFeeType;
  // A service category additionally needs its two required core fields
  // (deliveryMode + pricingModel), mirroring the BE service DTO requireds.
  const isServiceCategory = !!values.category && NEW_SERVICE_CATEGORY_SET.has(values.category);
  const serviceReady = !!values.serviceDeliveryMode && !!values.servicePricingModel;
  const canPublish =
    !!values.title?.trim() &&
    !!values.category &&
    (!showStorefrontPicker || !!values.storefrontId) &&
    (values.category !== 'course' || courseReady) &&
    (!isServiceCategory || serviceReady);

  const handleFinish = (formValues: ListingFormValues) => {
    const input: CreateListingInput = {
      title: formValues.title.trim(),
      category: formValues.category,
    };
    if (formValues.description?.trim()) input.description = formValues.description.trim();
    const isCourseSubmit = formValues.category === 'course';
    const isServiceSubmit = NEW_SERVICE_CATEGORY_SET.has(formValues.category);
    if (isCourseSubmit) {
      // Course (Institutes Phase 1): collect the course fields into courseDetails
      // and DERIVE the shared price rows from the fee type, so the fee lives on
      // priceMin/priceMax/priceType (no duplicate amount). free -> no price;
      // fixed -> priceType 'fixed' + priceMin; range -> priceType 'range' + both.
      const courseDetails: ListingCourseDetails = {
        durationLabel: formValues.courseDurationLabel?.trim() ?? '',
        batchStart: formValues.courseBatchStart ? formValues.courseBatchStart.toISOString() : null,
        mode: formValues.courseMode ?? 'offline',
        feeType: formValues.courseFeeType ?? 'free',
        seats: typeof formValues.courseSeats === 'number' ? formValues.courseSeats : null,
        certificate: !!formValues.courseCertificate,
        skillsTaught: formValues.courseSkillsTaught ?? [],
      };
      input.courseDetails = courseDetails;
      if (courseDetails.feeType === 'free') {
        input.priceType = 'fixed';
        input.priceMin = 0;
      } else if (courseDetails.feeType === 'fixed') {
        input.priceType = 'fixed';
        if (typeof formValues.priceMin === 'number') input.priceMin = formValues.priceMin;
      } else {
        // range
        input.priceType = 'range';
        if (typeof formValues.priceMin === 'number') input.priceMin = formValues.priceMin;
        if (typeof formValues.priceMax === 'number') input.priceMax = formValues.priceMax;
      }
    } else if (isServiceSubmit) {
      // Service (Slice B2): collect the service fields into serviceDetails and
      // DERIVE the shared price rows from the pricing model, so the fee lives on
      // priceMin/priceType (no duplicate amount) - mirrors the course branch.
      // negotiable -> no price; everything else -> a fixed rate in priceMin.
      const serviceDetails: ListingServiceDetails = {
        deliveryMode: formValues.serviceDeliveryMode ?? 'on-site',
        pricingModel: formValues.servicePricingModel ?? 'negotiable',
        ...(formValues.serviceCoverageArea?.trim()
          ? { coverageArea: formValues.serviceCoverageArea.trim() }
          : {}),
        yearsExperience:
          typeof formValues.serviceYearsExperience === 'number'
            ? formValues.serviceYearsExperience
            : null,
        availability: formValues.serviceAvailability?.trim() ?? '',
      };
      input.serviceDetails = serviceDetails;
      if (serviceDetails.pricingModel === 'negotiable') {
        input.priceType = 'negotiable';
      } else {
        input.priceType = 'fixed';
        if (typeof formValues.priceMin === 'number') input.priceMin = formValues.priceMin;
      }
    } else {
      if (formValues.priceType) input.priceType = formValues.priceType;
      if (typeof formValues.priceMin === 'number') input.priceMin = formValues.priceMin;
      if (typeof formValues.priceMax === 'number') input.priceMax = formValues.priceMax;
    }
    if (formValues.unit) input.unit = formValues.unit;
    if (typeof formValues.moq === 'number') input.moq = formValues.moq;
    if (typeof formValues.leadTimeDays === 'number') input.leadTimeDays = formValues.leadTimeDays;
    if (showStorefrontPicker && formValues.storefrontId)
      input.storefrontId = formValues.storefrontId;
    const district = formValues.district?.trim();
    const city = formValues.city?.trim();
    const state = formValues.state?.trim();
    if (district || city || state) input.location = { district, city, state };
    if (images.length > 0) input.images = images;
    // Product video(s) are ALWAYS sent (like specs/trade terms) so an edit that
    // removes the clip actually clears it (PATCH: an omitted field stays). Each
    // clip's poster is the freshly captured one, else the existing stored poster.
    input.videos = videoUrls.map((url) => {
      const posterUrl = capturedPosterByUrl[url] ?? initialPosterByUrl[url];
      return posterUrl ? { url, posterUrl } : { url };
    });
    if (formValues.tags?.length) input.tags = formValues.tags;
    // Specs + trade terms are ALWAYS sent (not only when non-empty) so an edit
    // that clears them actually clears them on the backend (PATCH semantics:
    // an omitted field stays unchanged). Incomplete spec rows are dropped.
    input.specs = (formValues.specs ?? [])
      .map((s) => ({ label: s?.label?.trim() ?? '', value: s?.value?.trim() ?? '' }))
      .filter((s) => s.label.length > 0 && s.value.length > 0)
      .slice(0, 12);
    input.tradeTerms = {
      dispatch: formValues.tradeTerms?.dispatch?.trim() ?? '',
      payment: formValues.tradeTerms?.payment?.trim() ?? '',
      returns: formValues.tradeTerms?.returns?.trim() ?? '',
    };
    const intent = intentRef.current;
    intentRef.current = 'publish';
    if (intent === 'draft') input.asDraft = true;
    onSubmit(input, {
      addAnother: intent === 'another',
      asDraft: intent === 'draft',
      collectionIds,
    });
  };

  return (
    <>
      {banner}
      <Form
        form={form}
        layout="vertical"
        colon={false}
        initialValues={initialValues}
        onValuesChange={(_, all) => setValues(all)}
        onFinish={handleFinish}
      >
        <FormSection id="sec-photos" title={tSec('photos')} help={tSec('photosHelp')}>
          <MediaUploadGrid
            mediaKind="image"
            max={8}
            initialUrls={initialImages}
            onChange={setImages}
            showCover
            reorderable
          />
        </FormSection>

        {/* Product video: one short clip (<= 60s, the connect-product-video
            policy cap). Reuses the feed video pipeline via MediaUploadGrid's
            video mode - client duration pre-check + poster-frame capture + the
            server-side duration probe. Additive to photos; the cover + search
            still come from the photos above. */}
        <FormSection
          id="sec-video"
          title={tSec('video')}
          help={tSec('videoHelp', { seconds: videoMaxSec })}
        >
          <MediaUploadGrid
            mediaKind="video"
            max={1}
            category="connect-product-video"
            // The clip lives in the video-only product bucket; its captured
            // poster (an image) goes to the image-capable connect-posts bucket
            // (same place the listing photos live), which has the compression
            // preset the poster is encoded with.
            posterCategory="connect-posts"
            initialUrls={initialVideoUrls}
            onChange={setVideoUrls}
            onPosters={setCapturedPosterByUrl}
          />
        </FormSection>

        <FormSection id="sec-basics" title={tSec('basics')}>
          <Form.Item
            label={t('titleLabel')}
            name="title"
            extra={t('titleHelp')}
            rules={[
              { required: true, message: t('titleRequired') },
              { max: 160, message: t('titleTooLong') },
            ]}
          >
            <Input maxLength={160} showCount placeholder={t('titlePlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('categoryLabel')}
            name="category"
            extra={t('categoryHelp')}
            rules={[{ required: true, message: t('categoryRequired') }]}
          >
            <CategoryPicker />
          </Form.Item>

          {showStorefrontPicker && (
            <Form.Item
              label={t('storefrontLabel')}
              name="storefrontId"
              extra={t('storefrontHelp')}
              rules={[{ required: true, message: t('storefrontRequired') }]}
            >
              <Select
                placeholder={t('storefrontPlaceholder')}
                options={storefronts!.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Form.Item>
          )}

          <Form.Item label={t('tagsLabel')} name="tags" extra={t('tagsHelp')}>
            <Select
              mode="tags"
              showSearch
              filterOption={false}
              maxCount={8}
              tokenSeparators={[',']}
              placeholder={t('tagsPlaceholder')}
              options={tagOptions}
              onSearch={handleTagSearch}
            />
          </Form.Item>

          {/* Collections: organize this product into the shop's own groups while
              creating it. Multi-select existing groups OR type a new name and
              create it inline (no leaving the form). Hidden until the shop is
              known (a brand-new seller with no shop yet has nothing to group). */}
          {activeShopId && (
            <Form.Item label={t('collectionsLabel')} extra={t('collectionsHelp')}>
              <Select
                mode="multiple"
                allowClear
                value={collectionIds}
                onChange={setCollectionIds}
                placeholder={t('collectionsPlaceholder')}
                optionFilterProp="label"
                options={activeCollections.map((c) => ({ value: c.id, label: c.title }))}
                popupRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <div style={{ display: 'flex', gap: 8, padding: '0 8px 4px' }}>
                      <Input
                        value={newCollectionName}
                        maxLength={80}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void createCollectionInline();
                          }
                        }}
                        placeholder={t('collectionsNewPlaceholder')}
                      />
                      <Button
                        type="text"
                        loading={creatingCollection}
                        disabled={!newCollectionName.trim()}
                        onClick={() => void createCollectionInline()}
                        style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
                      >
                        {t('collectionsCreate')}
                      </Button>
                    </div>
                  </>
                )}
              />
            </Form.Item>
          )}
        </FormSection>

        <FormSection id="sec-description" title={tSec('details')} help={tSec('detailsHelp')}>
          <Form.Item
            label={t('descriptionLabel')}
            name="description"
            extra={t('descriptionHelp')}
            rules={[{ max: 5000 }]}
          >
            <Input.TextArea
              rows={5}
              maxLength={5000}
              showCount
              placeholder={t('descriptionPlaceholder')}
            />
          </Form.Item>
        </FormSection>

        {/* Course section (Institutes Phase 1): rendered ONLY for the `course`
            category. Carries the course-specific fields + the fee-driven price
            rows (replacing the standard priceType/unit/MOQ pricing section, which
            is hidden for a course). courseDetails + the derived price rows are
            assembled in handleFinish. */}
        {isCourse && (
          <FormSection
            id="sec-course"
            title={t('course.sectionTitle')}
            help={t('course.sectionHelp')}
          >
            <Form.Item
              label={t('course.durationLabel')}
              name="courseDurationLabel"
              extra={t('course.durationHelp')}
              rules={[{ required: true, message: t('course.durationRequired') }, { max: 80 }]}
            >
              <Input maxLength={80} placeholder={t('course.durationPlaceholder')} />
            </Form.Item>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
              <Form.Item
                style={{ flex: '1 1 200px' }}
                label={t('course.batchStartLabel')}
                name="courseBatchStart"
                extra={t('course.batchStartHelp')}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder={t('course.batchStartPlaceholder')}
                />
              </Form.Item>
              <Form.Item
                style={{ flex: '1 1 160px' }}
                label={t('course.seatsLabel')}
                name="courseSeats"
                extra={t('course.seatsHelp')}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder={t('course.seatsPlaceholder')}
                />
              </Form.Item>
            </div>

            <Form.Item
              label={t('course.modeLabel')}
              name="courseMode"
              rules={[{ required: true, message: t('course.modeRequired') }]}
            >
              <Radio.Group
                optionType="button"
                options={LISTING_COURSE_MODES.map((m) => ({
                  label: t(`course.mode.${m}`),
                  value: m,
                }))}
              />
            </Form.Item>

            <Form.Item
              label={t('course.feeTypeLabel')}
              name="courseFeeType"
              extra={t('course.feeTypeHelp')}
              rules={[{ required: true, message: t('course.feeTypeRequired') }]}
            >
              <Radio.Group
                optionType="button"
                options={LISTING_COURSE_FEE_TYPES.map((f) => ({
                  label: t(`course.feeType.${f}`),
                  value: f,
                }))}
              />
            </Form.Item>

            {/* Fee amount rows, driven by the fee type. free -> no amount; fixed
                -> one price; range -> from/to. The standard priceType radio is not
                shown for a course (the fee type stands in for it). */}
            {(courseFeeType === 'fixed' || courseFeeType === 'range') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
                <Form.Item
                  style={{ flex: '1 1 160px' }}
                  label={
                    courseFeeType === 'range' ? t('course.feeFromLabel') : t('course.feeLabel')
                  }
                  name="priceMin"
                >
                  <InputNumber min={0} prefix="₹" style={{ width: '100%' }} placeholder="0" />
                </Form.Item>
                {courseFeeType === 'range' && (
                  <Form.Item
                    style={{ flex: '1 1 160px' }}
                    label={t('course.feeToLabel')}
                    name="priceMax"
                  >
                    <InputNumber min={0} prefix="₹" style={{ width: '100%' }} placeholder="0" />
                  </Form.Item>
                )}
              </div>
            )}

            <Form.Item
              label={t('course.certificateLabel')}
              name="courseCertificate"
              valuePropName="checked"
              extra={t('course.certificateHelp')}
            >
              <Switch />
            </Form.Item>

            {/* Skills the course teaches: same type-to-add tag UX as "Product types
                & specialities", so the two self-creating fields read identically. */}
            <Form.Item
              label={t('course.skillsLabel')}
              name="courseSkillsTaught"
              extra={t('course.skillsHelp')}
            >
              <Select
                mode="tags"
                showSearch
                filterOption={false}
                maxCount={12}
                tokenSeparators={[',']}
                placeholder={t('course.skillsPlaceholder')}
                options={tagOptions}
                onSearch={handleTagSearch}
              />
            </Form.Item>
          </FormSection>
        )}

        {/* Service section (Slice B2): rendered ONLY for a service category.
            Carries the service-specific fields + the pricing-model-driven price
            rows (replacing the standard priceType/unit/MOQ pricing section, which
            is hidden for a service, like for a course). serviceDetails + the
            derived price rows are assembled in handleFinish. */}
        {isService && (
          <FormSection
            id="sec-service"
            title={t('service.sectionTitle')}
            help={t('service.sectionHelp')}
          >
            <Form.Item
              label={t('service.deliveryModeLabel')}
              name="serviceDeliveryMode"
              extra={t('service.deliveryModeHelp')}
              rules={[{ required: true, message: t('service.deliveryModeRequired') }]}
            >
              <Radio.Group
                optionType="button"
                options={LISTING_SERVICE_DELIVERY_MODES.map((m) => ({
                  label: t(`service.deliveryMode.${m}`),
                  value: m,
                }))}
              />
            </Form.Item>

            <Form.Item
              label={t('service.pricingModelLabel')}
              name="servicePricingModel"
              extra={t('service.pricingModelHelp')}
              rules={[{ required: true, message: t('service.pricingModelRequired') }]}
            >
              <Select
                placeholder={t('service.pricingModelPlaceholder')}
                options={LISTING_SERVICE_PRICING_MODELS.map((p) => ({
                  label: t(`service.pricingModel.${p}`),
                  value: p,
                }))}
              />
            </Form.Item>

            {/* Fee amount row, driven by the pricing model. negotiable -> no
                amount; every other model -> a single rate. The standard priceType
                radio is not shown for a service (the pricing model stands in). */}
            {servicePricingModel && servicePricingModel !== 'negotiable' && (
              <Form.Item style={{ maxWidth: 220 }} label={t('service.feeLabel')} name="priceMin">
                <InputNumber min={0} prefix="₹" style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            )}

            <Form.Item
              label={t('service.coverageAreaLabel')}
              name="serviceCoverageArea"
              extra={t('service.coverageAreaHelp')}
              rules={[{ max: 160 }]}
            >
              <Input maxLength={160} placeholder={t('service.coverageAreaPlaceholder')} />
            </Form.Item>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
              <Form.Item
                style={{ flex: '1 1 160px' }}
                label={t('service.yearsExperienceLabel')}
                name="serviceYearsExperience"
                extra={t('service.yearsExperienceHelp')}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder={t('service.yearsExperiencePlaceholder')}
                />
              </Form.Item>
              <Form.Item
                style={{ flex: '2 1 220px' }}
                label={t('service.availabilityLabel')}
                name="serviceAvailability"
                extra={t('service.availabilityHelp')}
                rules={[{ max: 160 }]}
              >
                <Input maxLength={160} placeholder={t('service.availabilityPlaceholder')} />
              </Form.Item>
            </div>
          </FormSection>
        )}

        {!isCourse && !isService && (
          <FormSection id="sec-pricing" title={tSec('pricing')} help={tSec('pricingHelp')}>
            <Form.Item label={t('priceTypeLabel')} name="priceType">
              <Radio.Group
                optionType="button"
                options={LISTING_PRICE_TYPES.map((pt) => ({
                  label: t(`priceType.${pt}`),
                  value: pt,
                }))}
              />
            </Form.Item>

            {(priceType === 'fixed' || priceType === 'range') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
                <Form.Item
                  style={{ flex: '1 1 160px' }}
                  label={priceType === 'range' ? t('priceFromLabel') : t('priceLabel')}
                  name="priceMin"
                >
                  <InputNumber min={0} prefix="₹" style={{ width: '100%' }} placeholder="0" />
                </Form.Item>
                {priceType === 'range' && (
                  <Form.Item
                    style={{ flex: '1 1 160px' }}
                    label={t('priceToLabel')}
                    name="priceMax"
                  >
                    <InputNumber min={0} prefix="₹" style={{ width: '100%' }} placeholder="0" />
                  </Form.Item>
                )}
              </div>
            )}

            <Form.Item label={t('unitLabel')} name="unit">
              <Select
                allowClear
                placeholder={t('unitPlaceholder')}
                options={LISTING_UNITS.map((u) => ({ label: tUnit(u), value: u }))}
              />
            </Form.Item>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
              <Form.Item
                style={{ flex: '1 1 160px' }}
                label={t('moqLabel')}
                name="moq"
                extra={t('moqHelp')}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder={t('moqPlaceholder')} />
              </Form.Item>
              <Form.Item
                style={{ flex: '1 1 160px' }}
                label={t('leadTimeLabel')}
                name="leadTimeDays"
                extra={t('leadTimeHelp')}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder={t('leadTimePlaceholder')}
                />
              </Form.Item>
            </div>
          </FormSection>
        )}

        {/* Specifications: free label/value rows -> the detail page's spec grid
            (backend Listing.specs, max 12). Incomplete rows are dropped on save. */}
        <FormSection id="sec-specs" title={tSec('specs')} help={tSec('specsHelp')}>
          <Form.List name="specs">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <div
                    key={field.key}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-sm)' }}
                  >
                    <Form.Item
                      style={{ flex: '1 1 140px', marginBottom: 'var(--cr-space-sm)' }}
                      name={[field.name, 'label']}
                      rules={[{ max: 60 }]}
                    >
                      <Input
                        maxLength={60}
                        placeholder={t('specLabelPlaceholder')}
                        aria-label={t('specLabelAria')}
                      />
                    </Form.Item>
                    <Form.Item
                      style={{ flex: '2 1 220px', marginBottom: 'var(--cr-space-sm)' }}
                      name={[field.name, 'value']}
                      rules={[{ max: 200 }]}
                    >
                      <Input
                        maxLength={200}
                        placeholder={t('specValuePlaceholder')}
                        aria-label={t('specValueAria')}
                      />
                    </Form.Item>
                    <Button
                      type="text"
                      aria-label={t('specRemove')}
                      onClick={() => remove(field.name)}
                      style={{ color: 'var(--cr-text-4)' }}
                      icon={<X size={14} aria-hidden />}
                    />
                  </div>
                ))}
                {fields.length < 12 && (
                  <Button type="dashed" onClick={() => add()} block>
                    {t('specAdd')}
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </FormSection>

        {/* Trade terms: dispatch / payment / returns prose -> the detail page's
            Trade terms rail card (backend Listing.tradeTerms). All optional. */}
        <FormSection id="sec-tradeterms" title={tSec('tradeTerms')} help={tSec('tradeTermsHelp')}>
          <Form.Item
            label={t('dispatchLabel')}
            name={['tradeTerms', 'dispatch']}
            rules={[{ max: 300 }]}
          >
            <Input maxLength={300} placeholder={t('dispatchPlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('paymentLabel')}
            name={['tradeTerms', 'payment']}
            rules={[{ max: 300 }]}
          >
            <Input maxLength={300} placeholder={t('paymentPlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('returnsLabel')}
            name={['tradeTerms', 'returns']}
            rules={[{ max: 300 }]}
          >
            <Input maxLength={300} placeholder={t('returnsPlaceholder')} />
          </Form.Item>
        </FormSection>

        <FormSection id="sec-location" title={tSec('location')} help={tSec('locationHelp')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item style={{ flex: '1 1 160px' }} label={t('districtLabel')} name="district">
              <Input maxLength={120} placeholder={t('districtPlaceholder')} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 160px' }} label={t('cityLabel')} name="city">
              <Input maxLength={120} placeholder={t('cityPlaceholder')} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 160px' }} label={t('stateLabel')} name="state">
              <Input maxLength={120} placeholder={t('statePlaceholder')} />
            </Form.Item>
          </div>
        </FormSection>

        {/* Sticky action bar: the commit controls stay in reach without a
            screen-and-a-half scroll to the foot of the form. */}
        <div className="cn-listing-actions">
          <DsButton dsVariant="ghost" href={cancelHref}>
            {t('cancel')}
          </DsButton>
          {draftLabel && (
            <DsButton
              dsVariant="ghost"
              htmlType="submit"
              disabled={!canPublish || submitting}
              onClick={() => {
                intentRef.current = 'draft';
              }}
            >
              {draftLabel}
            </DsButton>
          )}
          {secondaryLabel && (
            <DsButton
              dsVariant="ghost"
              htmlType="submit"
              disabled={!canPublish || submitting}
              onClick={() => {
                intentRef.current = 'another';
              }}
            >
              {secondaryLabel}
            </DsButton>
          )}
          <Tooltip title={canPublish ? undefined : t('publishMissing')}>
            {/* span wrapper so the tooltip still shows over a disabled button */}
            <span>
              <DsButton
                dsVariant="primary"
                htmlType="submit"
                loading={submitting}
                disabled={!canPublish}
              >
                {submitLabel}
              </DsButton>
            </span>
          </Tooltip>
        </div>
      </Form>
    </>
  );
}
