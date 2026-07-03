import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { REFERRAL_ENABLED } from '@/features/connect/referrals/referral-gate';
import { getMyReferral } from '@/features/connect/referrals/referrals.actions';
import ReferralScreen from '@/features/connect/referrals/ReferralScreen';

/**
 * `/connect/referrals` -- the dedicated Refer & Earn page.
 *
 * What: when REFERRAL_ENABLED is true, SSR-fetches the caller's referral
 *   summary and hands it to ReferralScreen. When false (shipped default),
 *   renders a graceful "coming soon" disabled panel -- never notFound() so the
 *   URL is stable for when the feature goes live.
 *
 * Cross-module links:
 *   - REFERRAL_ENABLED from features/connect/referrals/referral-gate.ts
 *   - getMyReferral from features/connect/referrals/referrals.actions.ts
 *     (backend GET /connect/referrals/me)
 *   - ReferralScreen from features/connect/referrals/ReferralScreen.tsx
 *
 * Watch: co-located loading.tsx MUST mirror ReferralScreen's layout section-
 *   for-section (binding rule). When REFERRAL_ENABLED flips to true, check
 *   that both page + loading skeleton stay in sync with the screen layout.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.referrals');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    robots: { index: false, follow: false },
  };
}

export default async function ConnectReferralsPage() {
  // --- Dark/disabled state ---
  if (!REFERRAL_ENABLED) {
    return (
      <div
        className="mx-auto w-full"
        style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
        aria-label="Refer & Earn -- coming soon"
      >
        <div
          className="flex flex-col items-center gap-4 rounded-[var(--cr-radius-lg)] p-10 text-center"
          style={{
            background: 'var(--cr-surface)',
            border: '1px solid var(--cr-border)',
          }}
        >
          <span aria-hidden className="text-4xl" style={{ filter: 'grayscale(1)', opacity: 0.4 }}>
            🎁
          </span>
          <h1 className="m-0 text-[18px] font-bold" style={{ color: 'var(--cr-text)' }}>
            Refer &amp; Earn — Coming Soon
          </h1>
          <p
            className="m-0 max-w-[440px] text-[14px] leading-relaxed"
            style={{ color: 'var(--cr-text-3)' }}
          >
            Invite friends to ManekHR Connect and both of you earn free boost credits. This feature
            is being prepared and will be available soon.
          </p>
        </div>
      </div>
    );
  }

  // --- Live state: SSR-fetch summary ---
  const summaryRes = await getMyReferral();

  return <ReferralScreen summary={summaryRes.ok ? summaryRes.data : null} />;
}
