import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getWallet } from '@/features/connect/ads/ads.actions';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { getMe } from '@/lib/actions/auth.actions';
import BoostComposer from '@/features/connect/ads/BoostComposer';
import BoostLoadError from '@/features/connect/ads/BoostLoadError';
import ProfileBoostNudge from '@/features/connect/ads/ProfileBoostNudge';

/**
 * /connect/boost/open-to-work - promote the caller's OWN profile to employers.
 * The ad unit is the caller's profile, so there is no id param: the backend
 * derives the advertiser from the JWT. Gate: `openTo.work` must be on (else we
 * show the enable nudge). The backend re-enforces the gate on submit.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.ads.boost');
  return { title: t('metaTitleOpenToWork'), robots: { index: false, follow: false } };
}

export default async function BoostOpenToWorkPage() {
  const [profileRes, walletRes, me] = await Promise.all([
    getMyConnectProfile(),
    getWallet(),
    getMe().catch(() => null),
  ]);
  if (!profileRes.ok) {
    return <BoostLoadError retryHref="/connect/boost/open-to-work" backHref="/connect/feed" />;
  }
  if (!profileRes.data.openTo?.work) {
    return <ProfileBoostNudge intent="work" />;
  }
  return (
    <BoostComposer
      openToWork={{ name: me?.name ?? '', headline: profileRes.data.headline }}
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me?.name}
    />
  );
}
