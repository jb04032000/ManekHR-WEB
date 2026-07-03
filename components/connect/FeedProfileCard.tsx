'use client';

/**
 * FeedProfileCard - the dismissible profile-completion card at the top of the
 * Connect feed. Hosts `ProfileStrengthCard` (the strength meter + checklist)
 * with a dismiss control overlaid in the top-right.
 *
 * Self-hides when ANY holds:
 *   - the auth store has not rehydrated yet (avoids an SSR/hydration mismatch)
 *   - no profile loaded
 *   - the profile is complete (strength >= 100) - the nudge has nothing to do
 *   - the `connect_profile_card` hint is in `user.dismissedHints`
 *
 * Dismissal is persisted on the backend (`User.dismissedHints`) so it survives
 * sign-out and follows the user across devices.
 */

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ProfileStrengthCard, { type StrengthItem } from '@/components/connect/ProfileStrengthCard';
import { useAuthStore } from '@/lib/store';
import { dismissHint } from '@/features/connect/hints.actions';
import type { ConnectProfile } from '@/features/connect/profile.types';

/** Profile-strength checklist keys - mirror the backend `STRENGTH_WEIGHTS`. */
const STRENGTH_KEYS = [
  'headline',
  'bio',
  'banner',
  'skills',
  'portfolio',
  'experience',
  'rateCard',
] as const;

/** `true` when any rate is quoted. */
function hasAnyRate(profile: ConnectProfile): boolean {
  const r = profile.rateCard;
  return !!(r && ((r.dailyWage ?? 0) > 0 || (r.pieceRate ?? 0) > 0 || (r.monthly ?? 0) > 0));
}

interface FeedProfileCardProps {
  /** The viewer's own profile - drives the checklist. `null` on a load error. */
  profile: ConnectProfile | null;
}

export default function FeedProfileCard({ profile }: FeedProfileCardProps) {
  const t = useTranslations('connect');
  const tStrength = useTranslations('connect.profile.strength');
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);

  if (!isHydrated) return null;
  if (!profile) return null;
  if (profile.strength >= 100) return null;
  if (user?.dismissedHints?.includes('connect_profile_card')) return null;

  function handleDismiss() {
    // Optimistic store update hides the card instantly; the backend write
    // (best-effort) makes the dismissal stick across sign-out and devices.
    updateUser({ dismissedHints: [...(user?.dismissedHints ?? []), 'connect_profile_card'] });
    void dismissHint('connect_profile_card');
  }

  const done: Record<(typeof STRENGTH_KEYS)[number], boolean> = {
    headline: !!profile.headline.trim(),
    bio: !!profile.bio.trim(),
    banner: !!profile.banner.trim(),
    skills: profile.skills.length >= 3,
    portfolio: profile.portfolio.length >= 1,
    experience: profile.experience.length >= 1,
    rateCard: hasAnyRate(profile),
  };

  const items: StrengthItem[] = STRENGTH_KEYS.map((key) => ({
    key,
    label: tStrength(key),
    done: done[key],
    // Deep-link straight to that field's edit section - `/connect/profile`
    // reads `?edit=` and opens the edit form scrolled to it.
    action: done[key]
      ? undefined
      : { label: tStrength('add'), href: `/connect/profile?edit=${key}` },
  }));

  return (
    // `lg:hidden` lives ON this root (not a parent wrapper) on purpose: this
    // in-feed nudge is the phone/tablet entry point only - at lg+ the left rail's
    // `ProfileStrengthCard` shows the same meter, so we hide this duplicate there.
    // Keeping the breakpoint hide here means that when the card self-hides
    // (returns null above) NO node is emitted at all. A parent wrapper carrying
    // `lg:hidden` would instead stay in the feed's flex column on mobile (its
    // hide only bites at lg+), take a `gap` slot, and push the composer ~16px
    // lower than the rails. FeedScreen therefore renders this BARE. Links:
    // FeedProfileCard -> FeedScreen top-of-feed stack.
    <div className="lg:hidden" style={{ position: 'relative' }}>
      <ProfileStrengthCard strength={profile.strength} items={items} reserveDismissSpace />
      <button
        type="button"
        aria-label={t('crossSell.dismiss')}
        onClick={handleDismiss}
        className="absolute rounded p-0.5 transition-opacity hover:opacity-60"
        style={{
          top: 'var(--cr-space-md)',
          right: 'var(--cr-space-md)',
          color: 'var(--cr-text-4)',
          lineHeight: 1,
        }}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
