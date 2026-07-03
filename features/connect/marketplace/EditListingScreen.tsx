'use client';

/**
 * EditListingScreen - the edit wrapper around the shared ListingForm
 * (/connect/marketplace/listing/:id/edit, M1.6.4). Prefills from the owner's
 * listing and PATCHes via `updateListing`. Moderation is off, so editing a live
 * listing keeps it live; the saved copy just confirms the changes are live.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, App as AntApp } from 'antd';
// dayjs hydrates the course batchStart ISO into the AntD DatePicker value.
import dayjs from 'dayjs';
import DsButton from '@/components/ui/DsButton';
import { ConnectPage } from '@/components/connect';
import { announceGlobal } from '@/components/connect/globalAnnouncer';
import type { ActionResult } from '../profile.types';
import type { CreateListingInput, ListingUnit, OwnerListing } from './marketplace.types';
import { pauseListing, publishListing, updateListing } from './marketplace.actions';
import { setListingCollections } from '../entities/collection.actions';
import type { CollectionWithCount } from '../entities/collections.types';
import ListingForm, { type ListingFormValues } from './ListingForm';

interface EditListingScreenProps {
  listing: OwnerListing;
  /** The shop's collections, for the in-form collections picker. */
  collections?: CollectionWithCount[];
}

export default function EditListingScreen({ listing, collections = [] }: EditListingScreenProps) {
  const t = useTranslations('connect.marketplace.edit');
  const tMine = useTranslations('connect.marketplace.mine');
  const tStatus = useTranslations('connect.marketplace.mine.status');
  const router = useRouter();
  const { message } = AntApp.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  // The collections picker lives inside the shared ListingForm; map the shop's
  // collections into the per-shop option set it expects.
  const collectionsByShop = listing.storefrontId
    ? {
        [listing.storefrontId]: collections.map((c) => ({
          id: c.collection._id,
          title: c.collection.title,
        })),
      }
    : {};

  // The current status, with the one seller-driven transition it allows:
  // active -> Pause, paused -> Resume, draft -> Publish. Calling the action then
  // refreshing re-reads the server component so the pill + control update.
  const statusTone =
    listing.status === 'active'
      ? { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' }
      : listing.status === 'rejected'
        ? { bg: 'var(--cr-error-bg)', fg: 'var(--cr-error)' }
        : { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-3)' };
  const statusAction: {
    label: string;
    run: (id: string) => Promise<ActionResult<OwnerListing>>;
  } | null =
    listing.status === 'active'
      ? { label: tMine('pause'), run: pauseListing }
      : listing.status === 'paused'
        ? { label: tMine('resume'), run: publishListing }
        : listing.status === 'draft'
          ? { label: tMine('publish'), run: publishListing }
          : null;

  const runStatus = async () => {
    if (!statusAction) return;
    setStatusBusy(true);
    setErrorMsg(null);
    const res = await statusAction.run(listing._id);
    setStatusBusy(false);
    if (res.ok) {
      message.success(t('statusUpdated'));
      announceGlobal(t('statusUpdated'));
      router.refresh();
    } else {
      setErrorMsg(res.error);
    }
  };

  // Back / save return to the shop this product lives in (its Products tab), so
  // the seller lands where the product actually shows. Falls back to the flat
  // "my listings" only for a legacy listing with no storefront.
  const storeHref = listing.storefrontId
    ? `/connect/stores/${listing.storefrontId}?tab=products`
    : '/connect/marketplace/mine';

  const initialValues: Partial<ListingFormValues> = {
    title: listing.title,
    category: listing.category,
    description: listing.description ?? undefined,
    priceType: listing.priceType,
    priceMin: listing.priceMin ?? undefined,
    priceMax: listing.priceMax ?? undefined,
    unit: (listing.unit as ListingUnit | undefined) ?? undefined,
    moq: listing.moq ?? undefined,
    leadTimeDays: listing.leadTimeDays ?? undefined,
    district: listing.location?.district ?? undefined,
    city: listing.location?.city ?? undefined,
    state: listing.location?.state ?? undefined,
    // Spec rows + trade terms prefill (detail-page spec grid / trade-terms rail).
    specs: listing.specs?.map((s) => ({ label: s.label, value: s.value })) ?? [],
    tradeTerms: {
      dispatch: listing.tradeTerms?.dispatch ?? undefined,
      payment: listing.tradeTerms?.payment ?? undefined,
      returns: listing.tradeTerms?.returns ?? undefined,
    },
    // Course prefill (Institutes Phase 1): only present on a `course` listing.
    // batchStart ISO -> Dayjs for the DatePicker; the fee amount stays on the
    // shared priceMin/priceMax above (ListingForm re-derives them from feeType).
    ...(listing.courseDetails
      ? {
          courseDurationLabel: listing.courseDetails.durationLabel,
          courseBatchStart: listing.courseDetails.batchStart
            ? dayjs(listing.courseDetails.batchStart)
            : undefined,
          courseMode: listing.courseDetails.mode,
          courseFeeType: listing.courseDetails.feeType,
          courseSeats: listing.courseDetails.seats ?? undefined,
          courseCertificate: listing.courseDetails.certificate,
          courseSkillsTaught: listing.courseDetails.skillsTaught,
        }
      : {}),
  };

  const handleSubmit = async (input: CreateListingInput, opts?: { collectionIds?: string[] }) => {
    setSubmitting(true);
    setErrorMsg(null);
    const res = await updateListing(listing._id, input);
    if (res.ok && opts?.collectionIds) {
      // Apply the collection memberships chosen in the form (incl. removals).
      await setListingCollections(listing._id, opts.collectionIds);
    }
    setSubmitting(false);
    if (res.ok) {
      // A simple success toast, then back to the product listing page where the
      // edited product shows. No full-screen confirmation takeover.
      message.success(t('successTitle'));
      announceGlobal(t('successTitle'));
      router.push(storeHref);
    } else {
      setErrorMsg(res.error);
    }
  };

  const banner = errorMsg ? (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 'var(--cr-space-md)' }}
      title={t('saveErrorTitle')}
      description={errorMsg}
    />
  ) : null;

  return (
    <ConnectPage>
      <main className="min-w-0 flex-1" style={{ maxWidth: 640 }}>
        <Link
          href={storeHref}
          style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-primary)' }}
        >
          {t('back')}
        </Link>
        <h1
          style={{
            margin: 'var(--cr-space-xs) 0 0',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--cr-text)',
          }}
        >
          {t('title')}
        </h1>
        <p
          style={{ margin: '4px 0 var(--cr-space-md)', fontSize: 13.5, color: 'var(--cr-text-4)' }}
        >
          {t('subtitle')}
        </p>

        {/* Status control: see + change the product's live state without leaving
            the edit page (the manager's quick toggle, mirrored here). */}
        <div
          className="mb-4 flex flex-wrap items-center gap-3"
          style={{
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-lg)',
            background: 'var(--cr-surface)',
            padding: 'var(--cr-space-md) var(--cr-space-lg)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('statusHeading')}
          </span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: 'var(--cr-radius-full)',
              background: statusTone.bg,
              color: statusTone.fg,
            }}
          >
            {tStatus(listing.status)}
          </span>
          {listing.status === 'rejected' && listing.rejectionReason && (
            <span style={{ fontSize: 12, color: 'var(--cr-error)' }}>
              {listing.rejectionReason}
            </span>
          )}
          {statusAction && (
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              className="ml-auto"
              disabled={statusBusy}
              loading={statusBusy}
              onClick={() => void runStatus()}
            >
              {statusAction.label}
            </DsButton>
          )}
        </div>

        <ListingForm
          submitLabel={t('submit')}
          submitting={submitting}
          onSubmit={handleSubmit}
          initialValues={initialValues}
          initialImages={listing.images ?? []}
          initialVideos={listing.videos ?? []}
          collectionsByShop={collectionsByShop}
          defaultStorefrontId={listing.storefrontId}
          initialCollectionIds={listing.collectionIds ?? []}
          cancelHref={storeHref}
          banner={banner}
        />
      </main>
    </ConnectPage>
  );
}
