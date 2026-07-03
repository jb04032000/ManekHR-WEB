'use client';

/**
 * OwnProfileClient - the interactive shell for `/connect/profile`.
 *
 * The Server Component (`page.tsx`) hands down the already-loaded profile +
 * ERP-link results. This client island:
 *  - sources the canonical identity (name / avatar) from the auth store -
 *    name + avatar live on `User`, never on `ConnectProfile` (IDENTITY-MODEL);
 *  - renders `ProfileView` exclusively (no view ↔ edit toggle anymore);
 *  - opens a focused `EditSectionModal` when the owner clicks a section
 *    pencil or a strength-checklist item; routes a `?edit=<strengthKey>`
 *    deep-link to the matching section modal on mount;
 *  - keeps the profile in local state so a save reflects instantly.
 *
 * Earlier shape - the page swapped between `ProfileView` and the all-in-one
 * `ProfileEditForm`, which forced a global Save / Cancel on a long-scroll
 * form. The new per-section modal pattern matches LinkedIn / Facebook and
 * makes small edits a one-click affair.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
// Referral entry point: owner-only row linking to /connect/referrals.
// Cross-module: referral-gate.ts / app/connect/referrals/page.tsx.
// Watch: gate ensures this renders ONLY when REFERRAL_ENABLED=true (dark by default)
// and ONLY on the owner's own profile (never on /u/[slug]).
import { REFERRAL_ENABLED } from '@/features/connect/referrals/referral-gate';
import DsButton from '@/components/ui/DsButton';
import ProfileView from '@/features/connect/profile/ProfileView';
import ActivityPreview from '@/features/connect/profile/ActivityPreview';
import { ConnectLimitsCard } from '@/components/connect/ConnectLimitsCard';
import { BoostNudgeSlot } from '@/components/connect/BoostNudgeSlot';
import { ConnectProfileDeleteCard } from '@/components/account-deletion/ConnectProfileDeleteCard';
import ProfileSkeleton from '@/features/connect/profile/ProfileSkeleton';
import EditSectionModal, {
  strengthKeyToSection,
  type ProfileEditSection,
} from '@/features/connect/profile/EditSectionModal';
import {
  PROFILE_STRENGTH_KEYS,
  type ActionResult,
  type ConnectProfile,
  type ErpLinkStatus,
  type ProfileStrengthKey,
} from '@/features/connect/profile.types';
import type { HydratedFeedItem } from '@/features/connect/feed.types';
import type { PromotedListingResolved } from '@/features/connect/marketplace/PromotedListingAdCard';

interface OwnProfileClientProps {
  profileResult: ActionResult<ConnectProfile>;
  erpResult: ActionResult<ErpLinkStatus>;
  /** Own social-proof counts ({ connections, followers }); undefined on failure. */
  stats?: { connections: number; followers: number };
  /** The owner's recent posts, server-fetched, for the compact Activity teaser.
   *  The full tabbed view lives at `/connect/profile/activity`. */
  activityPreview?: HydratedFeedItem[];
  /** Owner's total profile-view count for the header stat (connect views module);
   *  undefined when the summary fetch failed. */
  profileViews?: number;
  /** First-party promoted listing (boost), placement `profile_view`, or null on a
   *  no-fill. Passed straight to ProfileView for the desktop aside + mobile ad. */
  promoted?: PromotedListingResolved | null;
}

/** Narrow a raw `?edit=` query value to a known strength key. */
function toStrengthKey(value: string | null): ProfileStrengthKey | null {
  return value && (PROFILE_STRENGTH_KEYS as readonly string[]).includes(value)
    ? (value as ProfileStrengthKey)
    : null;
}

export default function OwnProfileClient({
  profileResult,
  erpResult,
  stats,
  activityPreview,
  profileViews,
  promoted = null,
}: OwnProfileClientProps) {
  const t = useTranslations('connect.profile');
  const tRef = useTranslations('connect.referrals');
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [profile, setProfile] = useState<ConnectProfile | null>(
    profileResult.ok ? profileResult.data : null,
  );

  // A `?edit=<strengthKey>` deep-link (from a strength checklist on the
  // feed, the rail, or the in-feed dismissible card) routes the user to
  // the matching section modal - strength keys map through
  // `strengthKeyToSection` ('bio' → 'about', 'rateCard' → 'rates' etc.).
  // Read once into state; query is stripped so a refresh / cancel does
  // not re-open the modal.
  const deepLinkKey = toStrengthKey(params.get('edit'));
  const [editSection, setEditSection] = useState<ProfileEditSection | null>(
    deepLinkKey ? strengthKeyToSection(deepLinkKey) : null,
  );

  useEffect(() => {
    if (params.get('edit')) router.replace('/connect/profile');
  }, [params, router]);

  if (!profileResult.ok || !profile) {
    return (
      <ErrorBlock
        title={t('loadErrorTitle')}
        message={profileResult.ok ? t('loadError') : profileResult.error}
        retryLabel={t('retry')}
        onRetry={() => router.refresh()}
      />
    );
  }

  // Auth store rehydrates from localStorage on mount - hold the skeleton until
  // the canonical name/avatar are available rather than flashing a blank name.
  if (!isHydrated) return <ProfileSkeleton />;

  const erp = erpResult.ok ? erpResult.data : null;
  // Share token prefers the human-readable handle (`/u/jayesh-bambhaniya`) and
  // falls back to the ObjectId for pre-backfill rows. The backend resolves
  // both forms, so either yields the same destination - but the handle gives
  // a sharable, readable URL when one exists.
  const shareToken = user?.handle || profile.userId;

  return (
    <>
      <ProfileView
        userId={shareToken}
        profile={profile}
        displayName={user?.name ?? ''}
        avatarUrl={user?.profilePicture}
        erpLinked={!!erp?.linked}
        erpSince={erp?.since ?? null}
        stats={stats}
        profileViews={profileViews}
        promoted={promoted}
        isOwner
        onEdit={(section) => setEditSection(section)}
        activity={
          <ActivityPreview posts={activityPreview ?? []} showAllHref="/connect/profile/activity" />
        }
        // The one consolidated "Your limits" view: every Connect cap in one place
        // on the owner's own profile. Owner-only (rendered here, never on /u/[slug]).
        // The boost nudge sits atop it (unfiltered = top traction across listing/
        // post/job) - this is also the owner's own-posts/consolidated home, and the
        // server-side global cool-down keeps it to one prompt per week across all
        // surfaces.
        limits={
          <>
            {/* "Refer & earn" entry point -- owner-only, dark when
                REFERRAL_ENABLED=false (i18n key: connect.referrals.profileEntry,
                Phase 9 adds it). Cross-module: referral-gate.ts.
                Watch: never pass this to ProfileView on /u/[slug] routes. */}
            {REFERRAL_ENABLED && (
              <Link
                href="/connect/referrals"
                className="mb-3 flex items-center gap-2.5 rounded-[var(--cr-radius-md)] px-3.5 py-2.5 no-underline transition-colors hover:bg-neutral-50"
                style={{
                  border: '1px solid var(--cr-border)',
                  background: 'var(--cr-surface)',
                  color: 'var(--cr-text-2)',
                  display: 'flex',
                }}
              >
                <Gift size={16} aria-hidden style={{ color: 'var(--cr-primary)', flexShrink: 0 }} />
                <span className="text-[13px] font-medium">{tRef('profileEntry')}</span>
              </Link>
            )}
            <BoostNudgeSlot className="mb-3" />
            <ConnectLimitsCard />
            {/* Scope-1 DPDP delete-Connect danger zone (owner-only). Mirror card
                lives on /account/security. See ACCOUNT-DELETION-AND-DPDP-PLAN.md §7. */}
            <ConnectProfileDeleteCard />
          </>
        }
      />
      {editSection && (
        <EditSectionModal
          open
          section={editSection}
          profile={profile}
          onSaved={(updated) => {
            setProfile(updated);
          }}
          onClose={() => setEditSection(null)}
        />
      )}
    </>
  );
}

/** Recoverable load-failure state for the own-profile screen. */
function ErrorBlock({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-3 py-16 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--cr-error-bg)', color: 'var(--cr-error)' }}
      >
        <AlertTriangle size={22} aria-hidden />
      </span>
      <h2 className="m-0 text-[16px] font-semibold" style={{ color: 'var(--cr-text)' }}>
        {title}
      </h2>
      <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
        {message}
      </p>
      <DsButton dsVariant="primary" dsSize="sm" onClick={onRetry}>
        {retryLabel}
      </DsButton>
    </div>
  );
}
