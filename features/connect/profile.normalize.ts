/**
 * Public-profile shape normalizer.
 *
 * The backend `ConnectProfile` schema was made all-optional (so a sparsely
 * filled or freshly created profile can be saved with most fields absent). The
 * web TS types, however, still declare the read shape with required fields
 * (`bio: string`, `skills: string[]`, `openTo: {...}`, ...), and `ProfileView`
 * dereferences them directly during render (`profile.bio.trim()`,
 * `profile.openTo.hiring`, `profile.skills.length`, ...).
 *
 * When such a profile is opened via a shared `/u/[slug]` link, the omitted
 * fields arrive as `undefined` and the first unguarded access throws
 * `Cannot read properties of undefined`, which the route error boundary catches
 * and renders as "Something went wrong". The owner's own profile is always fully
 * populated, so the bug only shows for visitors opening a shared link.
 *
 * `normalizePublicProfile` backfills every field `ProfileView` (and its
 * children) reads with a safe, empty default, so a partial backend payload can
 * never crash the render. Applied once at the page boundary, right after the
 * fetch - one call site covers every downstream component.
 */

import type { PublicConnectProfile } from './profile.types';

/** Fill any field the render path reads but the backend may have omitted. */
export function normalizePublicProfile(profile: PublicConnectProfile): PublicConnectProfile {
  return {
    ...profile,
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    banner: profile.banner ?? '',
    skills: profile.skills ?? [],
    portfolio: profile.portfolio ?? [],
    experience: profile.experience ?? [],
    // MANDATORY backfill: ProfileView dereferences profile.training.length during
    // render (Training section), so a sparse public payload (a shared /u/[slug]
    // link) would otherwise crash the same way the other required lists do.
    // trainingCompanies stays an optional hydration map the view guards with `?.`.
    training: profile.training ?? [],
    services: profile.services ?? [],
    videos: profile.videos ?? [],
    recommendations: profile.recommendations ?? [],
    openTo: {
      work: profile.openTo?.work ?? false,
      hiring: profile.openTo?.hiring ?? false,
      deals: profile.openTo?.deals ?? false,
      customOrders: profile.openTo?.customOrders ?? false,
    },
    openToDetails: profile.openToDetails ?? {},
    visibility: profile.visibility ?? 'public',
    contactPreference: profile.contactPreference ?? 'whatsapp',
    strength: profile.strength ?? 0,
    // rateCard stays optional (RateRow handles undefined); experienceCompanies
    // is an optional hydration map the view already guards with `?.`.
  };
}
