import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getMe } from '@/lib/actions/auth.actions';
import { getWallet, getConnectPricing } from '@/features/connect/ads/ads.actions';
import WalletPanel from '@/features/connect/ads/WalletPanel';

/**
 * /connect/boost/wallet - the advertiser ads wallet.
 *
 * Server Component: loads the viewer identity + wallet in parallel, then hands
 * off to the <WalletPanel> client island for the balance display + the real
 * Razorpay top-up flow. A wallet read failure degrades to a soft note in the
 * panel; it never errors the page.
 *
 * Connect is person-centric: no workspaceId, no ERP RBAC.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.ads.wallet');
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function ConnectAdsWalletPage() {
  // Pricing is fetched alongside the wallet so the top-up presets + minimum come
  // from the admin-tunable config (deploy-free). The panel falls back to its
  // built-in constants if this read fails.
  // getMe is guarded (it throws, unlike the ActionResult reads) - it only
  // supplies the checkout-sheet prefill name, so an auth blip degrades to an
  // empty prefill instead of throwing the page to the error boundary.
  const [me, walletRes, pricingRes] = await Promise.all([
    getMe().catch(() => null),
    getWallet(),
    getConnectPricing(),
  ]);

  return (
    <WalletPanel
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me?.name ?? ''}
      presets={pricingRes.ok ? pricingRes.data.walletTopupPresets : undefined}
      minAmount={pricingRes.ok ? pricingRes.data.walletTopupMinAmount : undefined}
    />
  );
}
