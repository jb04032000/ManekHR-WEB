import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getWallet } from '@/features/connect/ads/ads.actions';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { getMe } from '@/lib/actions/auth.actions';
import BoostComposer from '@/features/connect/ads/BoostComposer';
import BoostLoadError from '@/features/connect/ads/BoostLoadError';
import ProfileBoostNudge from '@/features/connect/ads/ProfileBoostNudge';

/**
 * /connect/boost/hiring - promote the caller's OWN hiring status to workers.
 * Profile/intent level (no specific job post). No id param: the backend derives
 * the advertiser from the JWT. Gate: `openTo.hiring` must be on (else the enable
 * nudge). The backend re-enforces the gate on submit.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.ads.boost');
  return { title: t('metaTitleHiring'), robots: { index: false, follow: false } };
}

export default async function BoostHiringPage() {
  const [profileRes, walletRes, me] = await Promise.all([
    getMyConnectProfile(),
    getWallet(),
    getMe().catch(() => null),
  ]);
  if (!profileRes.ok) {
    return <BoostLoadError retryHref="/connect/boost/hiring" backHref="/connect/feed" />;
  }
  if (!profileRes.data.openTo?.hiring) {
    return <ProfileBoostNudge intent="hiring" />;
  }
  return (
    <BoostComposer
      hiring={{ name: me?.name ?? '', headline: profileRes.data.headline }}
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me?.name}
    />
  );
}
