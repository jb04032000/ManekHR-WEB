'use client';

/**
 * OnboardingClient - the Connect onboarding intent flow.
 *
 * Four intent cards. Picking one stamps `onboardedAt` (and pre-sets a karigar
 * open-to-work), then routes to `/connect/feed` - the Connect home. No intent
 * dead-ends: every choice reaches a built
 * screen (build plan - unbuilt modules show "coming soon" in the nav).
 */

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { message } from 'antd';
import { Building2, Compass, MapPin, Scissors, ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/components/ui';
import { ConnectPage } from '@/components/connect';
// Same State -> District picker the profile editor uses. Onboarding now captures
// the home location up front (optional) so a fresh profile has a canonical
// `district` the boost region-targeting matcher can match, instead of blank.
import StateDistrictPicker, {
  EMPTY_STATE_DISTRICT,
  type StateDistrictValue,
} from '@/features/connect/geo/StateDistrictPicker';
import { completeOnboarding, updateMyConnectProfile } from '../profile.actions';
import type { ConnectOnboardingIntent } from '../profile.types';

const INTENTS: { intent: ConnectOnboardingIntent; icon: ReactNode }[] = [
  { intent: 'workshop_owner', icon: <Building2 size={22} aria-hidden /> },
  { intent: 'karigar', icon: <Scissors size={22} aria-hidden /> },
  { intent: 'buyer', icon: <ShoppingBag size={22} aria-hidden /> },
  { intent: 'explorer', icon: <Compass size={22} aria-hidden /> },
];

export default function OnboardingClient() {
  const t = useTranslations('connect.onboarding');
  const router = useRouter();
  const [messageApi, messageCtx] = message.useMessage();
  const [submitting, setSubmitting] = useState<ConnectOnboardingIntent | null>(null);
  // Optional home location captured before the intent pick. Persisted via a
  // best-effort profile PATCH on submit (the onboarding endpoint itself only
  // takes the intent), so skipping it never blocks onboarding.
  const [location, setLocation] = useState<StateDistrictValue>(EMPTY_STATE_DISTRICT);

  async function pick(intent: ConnectOnboardingIntent) {
    if (submitting) return;
    setSubmitting(intent);
    // Save the location first (best-effort) so the freshly-onboarded profile
    // carries a canonical district + slugs the boost matcher can match. A failure
    // here must NOT block onboarding - the person can set it later in their
    // profile - so we ignore the result and proceed to completeOnboarding.
    if (location.district) {
      await updateMyConnectProfile({
        district: location.district,
        geoStateSlug: location.geoStateSlug,
        geoDistrictSlug: location.geoDistrictSlug,
      });
    }
    const res = await completeOnboarding(intent);
    if (res.ok) {
      router.push('/connect/feed');
    } else {
      messageApi.error(res.error);
      setSubmitting(null);
    }
  }

  return (
    <ConnectPage className="py-8">
      {messageCtx}

      <header className="text-center">
        <h1
          className="m-0 font-display text-[22px] font-bold sm:text-[26px]"
          style={{ color: 'var(--cr-text)' }}
        >
          {t('title')}
        </h1>
        <p
          className="m-0 mt-2 inline-flex items-center gap-1.5 text-[14px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('subtitle')}
          <InfoTooltip text={t('helpTitle')} body={t('help')} />
        </p>
      </header>

      {/* Optional home location. Encouraged (it powers nearby posts + lets
          region-targeted boosts reach the person) but never required - leaving
          it blank simply skips the best-effort profile PATCH in `pick`. */}
      <section
        className="mt-6 flex flex-col gap-2 p-4"
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
          >
            <MapPin size={16} aria-hidden />
          </span>
          <span className="text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
            {t('location.title')}
          </span>
          <span className="text-[12px] font-medium" style={{ color: 'var(--cr-text-4)' }}>
            {t('location.optional')}
          </span>
        </div>
        <p className="m-0 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
          {t('location.help')}
        </p>
        <StateDistrictPicker
          value={location}
          onChange={setLocation}
          disabled={!!submitting}
          stateLabel={t('location.stateLabel')}
          districtLabel={t('location.districtLabel')}
          statePlaceholder={t('location.statePlaceholder')}
          districtPlaceholder={t('location.districtPlaceholder')}
        />
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {INTENTS.map(({ intent, icon }) => {
          const isSubmitting = submitting === intent;
          return (
            <button
              key={intent}
              type="button"
              onClick={() => pick(intent)}
              disabled={!!submitting}
              aria-busy={isSubmitting}
              className="flex flex-col items-start gap-2 p-4 text-left transition-colors"
              style={{
                background: 'var(--cr-surface)',
                border: `1px solid ${isSubmitting ? 'var(--cr-primary-border)' : 'var(--cr-border)'}`,
                borderRadius: 'var(--cr-radius-lg)',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting && !isSubmitting ? 0.55 : 1,
              }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
              >
                {icon}
              </span>
              <span className="text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                {t(`intents.${intent}.title`)}
              </span>
              <span className="text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
                {t(`intents.${intent}.desc`)}
              </span>
              {isSubmitting && (
                <span className="text-[12px] font-medium" style={{ color: 'var(--cr-primary)' }}>
                  {t('settingUp')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ConnectPage>
  );
}
