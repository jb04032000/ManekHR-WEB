import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { getPeople } from '@/features/connect/network.actions';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';
import { listMyStorefronts } from '@/features/connect/entities/storefront.actions';
import { getRfq, listQuotesForMyRfq, listMyQuotes } from '@/features/connect/rfq/rfq.actions';
import RfqDetailScreen from '@/features/connect/rfq/RfqDetailScreen';
import type { RfqBuyerRef } from '@/features/connect/rfq/useBoardBuyers';
import { env } from '@/lib/env';
import ShareButton from '@/components/connect/ShareButton';

export const metadata: Metadata = {
  title: 'Quote request',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Validate the `?from=` board URL a card carried in. Only an internal
 *  `/connect/rfq` path is accepted (guards against open-redirect via a crafted
 *  link); anything else falls back to the screen's history-aware Back. */
function resolveBackHref(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(s);
  } catch {
    return undefined;
  }
  return decoded.startsWith('/connect/rfq') ? decoded : undefined;
}

/**
 * `/connect/rfq/[id]` -- one RFQ. The buyer (owner) sees the compare-quotes
 * view; everyone else sees the send-a-quote surface. SSR resolves everything
 * the screen needs in one pass: the enriched request (buyerStats + quoteStats
 * ride the getRfq read), the buyer's identity (network getPeople), and - for a
 * seller - their own quote + storefronts for the quote-as picker.
 */
export default async function ConnectRfqDetailRoute({ params, searchParams }: Props) {
  const { id } = await params;
  const backHref = resolveBackHref((await searchParams).from);
  const [rfqRes, meRes] = await Promise.all([getRfq(id), getMyConnectProfile()]);
  if (!rfqRes.ok) notFound();

  const rfq = rfqRes.data;
  const viewerId = meRes.ok ? meRes.data.userId : '';
  const isBuyer = !!viewerId && rfq.buyerUserId === viewerId;

  // Buyer identity for the request card + the first-party rail ad in parallel.
  const [buyerRes, promoted] = await Promise.all([
    getPeople([rfq.buyerUserId]),
    resolvePromotedRailListing('rfq_detail'),
  ]);
  const buyerPerson = buyerRes.ok ? buyerRes.data[0] : undefined;
  const buyer: RfqBuyerRef | null = buyerPerson
    ? {
        name: (buyerPerson as { name: string }).name,
        avatar: (buyerPerson as { avatar: string | null }).avatar || undefined,
      }
    : null;

  if (isBuyer) {
    const quotesRes = await listQuotesForMyRfq(id);
    // The buyer (owner) can share their own request to attract more quotes - the
    // share text is framed accordingly ("I am looking for quotes..."). The link
    // is the in-app RFQ; a recipient signs in to quote (RFQ is members-only, no
    // public SEO page). Cross-module: ShareButton + connect.share.text.rfq.
    const rfqUrl = `${env.appUrl}/connect/rfq/${id}`;
    return (
      <>
        <div className="mb-3 flex justify-end">
          <ShareButton surface="rfq" url={rfqUrl} name={rfq.title} size="small" />
        </div>
        <RfqDetailScreen
          rfq={rfq}
          isBuyer
          quotes={quotesRes.ok ? quotesRes.data : []}
          myQuote={null}
          buyer={buyer}
          promoted={promoted}
          backHref={backHref}
        />
      </>
    );
  }

  const [myQuotesRes, storefrontsRes] = await Promise.all([listMyQuotes(), listMyStorefronts()]);
  const myQuote = myQuotesRes.ok ? (myQuotesRes.data.find((q) => q.rfqId === id) ?? null) : null;
  return (
    <RfqDetailScreen
      rfq={rfq}
      isBuyer={false}
      quotes={[]}
      myQuote={myQuote}
      buyer={buyer}
      storefronts={storefrontsRes.ok ? storefrontsRes.data : []}
      promoted={promoted}
      backHref={backHref}
    />
  );
}
