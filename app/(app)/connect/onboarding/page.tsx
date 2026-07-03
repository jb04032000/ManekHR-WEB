import { redirect } from 'next/navigation';

/**
 * `/connect/onboarding` - TEMPORARILY DISABLED (2026-05-23).
 *
 * The intent flow is skipped for now: it doesn't yet capture all the relevant
 * fields (e.g. designations) and its data isn't consumed downstream beyond the
 * Connect→ERP cross-sell. Until it's rebuilt, this route just redirects to the
 * feed so any bookmark / stale link still resolves (no 404). The write-action
 * redirects that pointed here are also neutralised - `app/connect/feed/page.tsx`
 * now passes `onboarded={true}`, so the feed gates never fire.
 *
 * REVIVE: uncomment the original implementation below, restore
 * `getConnectEntryState()` + `onboarded` in `app/connect/feed/page.tsx`. The
 * `OnboardingClient` component + its tests are kept intact.
 *
 * Original implementation:
 *   import type { Metadata } from 'next';
 *   import { getTranslations } from 'next-intl/server';
 *   import { getConnectEntryState } from '@/features/connect/profile.actions';
 *   import OnboardingClient from '@/features/connect/onboarding/OnboardingClient';
 *
 *   export async function generateMetadata(): Promise<Metadata> {
 *     const t = await getTranslations('connect.onboarding');
 *     return { title: t('metaTitle') };
 *   }
 *
 *   export default async function ConnectOnboardingPage() {
 *     const entryRes = await getConnectEntryState();
 *     const entry = entryRes.ok
 *       ? entryRes.data
 *       : { connectEnabled: false, onboarded: false, policyAccepted: false };
 *     if (!entry.connectEnabled || entry.onboarded) redirect('/connect/feed');
 *     return <OnboardingClient />;
 *   }
 */
export default function ConnectOnboardingPage() {
  redirect('/connect/feed');
}
