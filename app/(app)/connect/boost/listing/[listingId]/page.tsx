import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMyListings } from '@/features/connect/marketplace/marketplace.actions';
import { getWallet } from '@/features/connect/ads/ads.actions';
import { getMe } from '@/lib/actions/auth.actions';
import BoostComposer from '@/features/connect/ads/BoostComposer';
import BoostLoadError from '@/features/connect/ads/BoostLoadError';

/**
 * /connect/boost/listing/[listingId] - the Boost composer for a marketplace
 * listing (M2.1). Reuses the shipped <BoostComposer> with a listing target.
 *
 * Owner + approved guard: `getMyListings` returns only the caller's own
 * listings, and the listing must be moderation-approved (mirrors the backend
 * boost gate). Anything else redirects to the seller's manage view. The backend
 * re-enforces both, plus the no-duplicate-boost rule, on submit.
 *
 * Connect is person-centric: no workspaceId, no ERP RBAC, no <Can>.
 */

interface Props {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params; // awaited for the dynamic route; listingId not needed for a generic title
  const t = await getTranslations('connect.ads.boost');
  return {
    title: t('metaTitleListing'),
    robots: { index: false, follow: false },
  };
}

export default async function BoostListingPage({ params }: Props) {
  const { listingId } = await params;

  // getMe is for the viewer's display name only (a prefill); guard it so an auth
  // blip degrades to no-prefill instead of throwing the whole page to the error
  // boundary (getMe throws, unlike the ActionResult reads beside it).
  const [mineRes, walletRes, me] = await Promise.all([
    getMyListings(),
    getWallet(),
    getMe().catch(() => null),
  ]);
  if (!mineRes.ok) {
    // The own-listings read FAILED (outage/transient) - distinct from a listing
    // that genuinely is not boostable. Show a retryable error rather than a
    // silent redirect to /mine (which reads as "your listing vanished").
    return (
      <BoostLoadError
        retryHref={`/connect/boost/listing/${listingId}`}
        backHref="/connect/marketplace/mine"
      />
    );
  }

  const listing = mineRes.data.find((item) => item._id === listingId);
  // Boost gate mirrors the backend: an approved listing only (any lifecycle
  // status). A non-owned id never appears in listMine, so this also enforces
  // ownership without leaking existence.
  if (!listing || listing.moderationStatus !== 'approved') {
    redirect('/connect/marketplace/mine');
  }

  return (
    <BoostComposer
      listing={{
        _id: listing._id,
        title: listing.title,
        category: listing.category,
        images: listing.images ?? [],
      }}
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me?.name}
    />
  );
}
