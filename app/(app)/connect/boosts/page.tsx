import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getMe } from '@/lib/actions/auth.actions';
import {
  listBoosts,
  getBoostStats,
  getWallet,
  getConnectPricing,
  getBoostable,
} from '@/features/connect/ads/ads.actions';
import BoostsManagerScreen from '@/features/connect/ads/BoostsManagerScreen';

/**
 * `/connect/boosts` - the boosts manager + onboarding hub. SSR-seeds the caller's
 * campaigns, KPI aggregates, ads wallet, live pricing levers, and their boostable
 * items so the dashboard, inline wallet strip, and quick-start render without a
 * client fetch. All reads are JWT-scoped on the backend (the caller's own data).
 *
 * Connect is person-centric: no workspaceId, no ERP RBAC, no <Can>.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.boosts.mgr');
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  // Next 16: searchParams is async (a Promise) - await before reading. `?boost=`
  // opens the results drawer for that boost on mount (post-launch redirect + the
  // legacy /connect/boost/results/:id forward both land here).
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConnectBoostsPage({ searchParams }: PageProps) {
  // getMe is guarded (it throws, unlike the ActionResult reads) - it only supplies
  // the inline top-up checkout-sheet prefill name, so an auth blip degrades to an
  // empty prefill instead of throwing the page to the error boundary.
  const [{ boost }, boostsRes, statsRes, walletRes, pricingRes, boostableRes, me] =
    await Promise.all([
      searchParams,
      listBoosts(),
      getBoostStats(),
      getWallet(),
      getConnectPricing(),
      getBoostable(),
      getMe().catch(() => null),
    ]);

  // A repeated `?boost=a&boost=b` arrives as an array; take the first id.
  const initialBoostId = Array.isArray(boost) ? boost[0] : boost;

  return (
    <BoostsManagerScreen
      boosts={boostsRes.ok ? boostsRes.data : []}
      stats={statsRes.ok ? statsRes.data : null}
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me?.name ?? ''}
      pricing={pricingRes.ok ? pricingRes.data : null}
      boostable={boostableRes.ok ? boostableRes.data : null}
      initialBoostId={initialBoostId}
    />
  );
}
