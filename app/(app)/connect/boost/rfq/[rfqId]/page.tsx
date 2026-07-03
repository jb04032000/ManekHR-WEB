import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { listMyRfqs } from '@/features/connect/rfq/rfq.actions';
import { getWallet } from '@/features/connect/ads/ads.actions';
import { getMe } from '@/lib/actions/auth.actions';
import BoostComposer from '@/features/connect/ads/BoostComposer';
import BoostLoadError from '@/features/connect/ads/BoostLoadError';

/**
 * /connect/boost/rfq/[rfqId] - the Boost composer for a request-for-quote
 * (reaches suppliers). Mirrors the job boost route: `listMyRfqs` returns only the
 * caller's own requests, and the RFQ must be `open`. The backend re-enforces
 * ownership + open + no-duplicate on submit. Person-centric: no workspaceId.
 */
interface Props {
  params: Promise<{ rfqId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations('connect.ads.boost');
  return { title: t('metaTitleRfq'), robots: { index: false, follow: false } };
}

export default async function BoostRfqPage({ params }: Props) {
  const { rfqId } = await params;

  const [mineRes, walletRes, me] = await Promise.all([
    listMyRfqs(),
    getWallet(),
    getMe().catch(() => null),
  ]);
  if (!mineRes.ok) {
    return <BoostLoadError retryHref={`/connect/boost/rfq/${rfqId}`} backHref="/connect/rfq" />;
  }

  const rfq = mineRes.data.find((item) => item._id === rfqId);
  if (!rfq || rfq.status !== 'open') {
    redirect('/connect/rfq');
  }

  return (
    <BoostComposer
      rfq={{ _id: rfq._id, title: rfq.title, category: rfq.category }}
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me?.name}
    />
  );
}
