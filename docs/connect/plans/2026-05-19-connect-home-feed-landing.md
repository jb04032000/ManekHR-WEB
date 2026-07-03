# Connect Home → Feed-as-Landing - Implementation Plan

> **STATUS - SHIPPED (2026-05-20).** `/connect/home` is now a redirect stub to
> `/connect/feed`; the profile-completion full-page checklist became a
> dismissible `FeedProfileCard` at the top of the feed. Preserved for history.
> See `docs/connect/PROGRESS.md` for the canonical record.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax.

**Goal:** Make `/connect/feed` the single Connect home; retire the stale `Day1Home`
welcome page; move the profile checklist onto the feed as a dismissible card.

**Architecture:** `/connect/feed` (the real Phase-3 feed) becomes the landing. Every
entry point repoints to it. `Day1Home`'s profile checklist becomes a dismissible
top-of-feed card; the ERP cross-sell moves to the feed too. `/connect/home` becomes a
redirect stub. Web-only - no backend change.

**Tech stack:** Next.js 16 App Router, React 19, next-intl. Spec:
`docs/connect/specs/2026-05-19-connect-home-feed-landing.md`.

**Worktree:** `.worktrees/crewroster-web/zari360-connect`. **Owner runs all git - the
assistant runs zero git.**

---

## File structure

- Create: `components/connect/FeedProfileCard.tsx` - dismissible top-of-feed profile card.
- Modify: `app/connect/feed/page.tsx` - load the viewer's profile.
- Modify: `features/connect/feed/FeedScreen.tsx` - render the top-of-feed cards.
- Modify: `app/connect/home/page.tsx` - replace with a redirect stub.
- Delete: `features/connect/home/Day1Home.tsx`.
- Modify (route repoints, `/connect/home` → `/connect/feed`): `components/layout/ModeSwitcher.tsx`,
  `components/connect/ConnectModuleNav.tsx`, `components/connect/ConnectNudge.tsx`,
  `components/layout/TopHeader.tsx`, `app/auth/AuthClient.tsx`,
  `app/(marketing)/connect/page.tsx`, `app/connect/onboarding/page.tsx`,
  `app/connect/layout.tsx`, `features/connect/onboarding/OnboardingClient.tsx`,
  `features/connect/onboarding/OnboardingClient.test.tsx`,
  `lib/constants/keyboard-shortcuts.registry.ts`.
- Modify: `app/messages/{en,gu,gu-en,hi-en}.json` - drop the unused `connect.home.*` block.

---

## Task 1: `FeedProfileCard` component

**Files:**

- Create: `components/connect/FeedProfileCard.tsx`

- [ ] **Step 1: Create the component**

Create `components/connect/FeedProfileCard.tsx`:

```tsx
'use client';

/**
 * FeedProfileCard - the dismissible profile-completion card at the top of the
 * Connect feed. Hosts `ProfileStrengthCard` (the strength meter + checklist)
 * with a dismiss control overlaid in the top-right.
 *
 * Self-hides when ANY holds:
 *   - not yet mounted (localStorage is browser-only - avoids a hydration mismatch)
 *   - no profile loaded
 *   - the profile is complete (strength >= 100) - the nudge has nothing to do
 *   - dismissed (localStorage key `z360_connect_profile_card_dismissed`)
 *
 * Replaces the standalone `/connect/home` Day-1 home: the profile checklist is a
 * recede-able feed nudge, not a full landing page. Mirrors the mounted/dismissed
 * pattern of `ConnectNudge` / `ConnectErpCrossSell`.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ProfileStrengthCard, { type StrengthItem } from '@/components/connect/ProfileStrengthCard';
import type { ConnectProfile } from '@/features/connect/profile.types';

const DISMISSED_KEY = 'z360_connect_profile_card_dismissed';

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

  /** Combined hydration state - both fields are unknown until mount. */
  const [hydrated, setHydrated] = useState<{ mounted: boolean; dismissed: boolean }>({
    mounted: false,
    dismissed: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount localStorage hydration; single batched setState avoids cascading renders and keeps SSR markup deterministic.
    setHydrated({ mounted: true, dismissed: localStorage.getItem(DISMISSED_KEY) === '1' });
  }, []);

  if (!hydrated.mounted) return null;
  if (!profile) return null;
  if (profile.strength >= 100) return null;
  if (hydrated.dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setHydrated((h) => ({ ...h, dismissed: true }));
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
    action: done[key] ? undefined : { label: tStrength('add'), href: '/connect/profile' },
  }));

  return (
    <div style={{ position: 'relative' }}>
      <ProfileStrengthCard strength={profile.strength} items={items} />
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
```

Notes for the implementer:

- `ProfileStrengthCard` and its `StrengthItem` type are at
  `components/connect/ProfileStrengthCard.tsx` - confirm the import path / that
  `StrengthItem` is exported there (it is).
- The strength-item logic (`STRENGTH_KEYS`, `done`, `hasAnyRate`, `items`) is lifted
  verbatim from the soon-to-be-deleted `Day1Home`.
- `t('crossSell.dismiss')` is the existing "Dismiss" aria-label key used by
  `ConnectErpCrossSell` - reused, no new i18n key.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` - Expected: clean.

---

## Task 2: Render the cards on the feed

**Files:**

- Modify: `app/connect/feed/page.tsx`
- Modify: `features/connect/feed/FeedScreen.tsx`

- [ ] **Step 1: Load the profile in the feed page**

In `app/connect/feed/page.tsx`:

Replace:

```ts
import { getConnectEntryState } from '@/features/connect/profile.actions';
```

With:

```ts
import { getConnectEntryState, getMyConnectProfile } from '@/features/connect/profile.actions';
```

Replace:

```ts
const [feedRes, suggestionsRes, me, erpRes, entryRes] = await Promise.all([
  getFeed(activeTab),
  getSuggestions(),
  getMe(),
  getErpSummary(),
  getConnectEntryState(),
]);

const onboarded = entryRes.ok ? entryRes.data.onboarded : false;
```

With:

```ts
const [feedRes, suggestionsRes, me, erpRes, entryRes, profileRes] = await Promise.all([
  getFeed(activeTab),
  getSuggestions(),
  getMe(),
  getErpSummary(),
  getConnectEntryState(),
  getMyConnectProfile(),
]);

const onboarded = entryRes.ok ? entryRes.data.onboarded : false;
// The viewer's own profile drives the dismissible top-of-feed setup card.
// A load failure simply hides the card; it never errors the feed.
const profile = profileRes.ok ? profileRes.data : null;
```

Replace:

```tsx
return (
  <FeedScreen
    tab={activeTab}
    data={data}
    viewer={viewer}
    suggestions={suggestions}
    erpSummary={erpSummary}
    onboarded={onboarded}
  />
);
```

With:

```tsx
return (
  <FeedScreen
    tab={activeTab}
    data={data}
    viewer={viewer}
    suggestions={suggestions}
    erpSummary={erpSummary}
    onboarded={onboarded}
    profile={profile}
  />
);
```

- [ ] **Step 2: Accept the `profile` prop in `FeedScreen` + render the cards**

In `features/connect/feed/FeedScreen.tsx`:

Add to the imports (with the other `@/components/connect` / feature imports):

```ts
import ConnectErpCrossSell from '@/components/connect/ConnectErpCrossSell';
import FeedProfileCard from '@/components/connect/FeedProfileCard';
import type { ConnectProfile } from '../profile.types';
```

In `interface FeedScreenProps`, add the prop (after `onboarded`):

```ts
/** The viewer's own Connect profile - drives the top-of-feed setup card.
 *  `null` on a load error (the card simply does not render). */
profile: ConnectProfile | null;
```

In the `FeedScreen` function signature destructure, add `profile`:

```ts
export default function FeedScreen({
  tab,
  data,
  viewer,
  suggestions,
  erpSummary,
  onboarded,
  profile,
}: FeedScreenProps) {
```

In the `<main>`, directly after the closing `</header>` and before the composer
trigger `<button>`, insert the top-of-feed cards:

```tsx
{
  /* Top-of-feed setup cards - each self-hides (dismissed / not applicable). */
}
<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--cr-space-md)',
    marginBottom: 'var(--cr-space-md)',
  }}
>
  <ConnectErpCrossSell intent={profile?.onboardingIntent} />
  <FeedProfileCard profile={profile} />
</div>;
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` - Expected: clean.
Run: `npx eslint app/connect/feed features/connect/feed components/connect/FeedProfileCard.tsx` - Expected: clean.

---

## Task 3: Repoint every `/connect/home` reference to `/connect/feed`

**Files:** the 11 files listed below.

- [ ] **Step 1: Apply the repoints**

In each file, change the `/connect/home` route string to `/connect/feed`:

1. `components/layout/ModeSwitcher.tsx` - `router.push('/connect/home')` → `router.push('/connect/feed')`.
2. `components/connect/ConnectModuleNav.tsx` - the logo `<Link href="/connect/home">` → `href="/connect/feed"`.
3. `components/connect/ConnectNudge.tsx` - the CTA `<Link href="/connect/home">` → `href="/connect/feed"`.
4. `components/layout/TopHeader.tsx` - the page-title map key `'/connect/home': 'connectMode.pageTitle'` → `'/connect/feed': 'connectMode.pageTitle'`. (If a `/connect/feed` entry already exists in that map, instead just delete the `/connect/home` line.)
5. `app/auth/AuthClient.tsx` - replace ALL occurrences of `/connect/home` with `/connect/feed` (two `fallback` ternary strings + the three explanatory comments that mention the route).
6. `app/(marketing)/connect/page.tsx` - `redirect('/connect/home')` → `redirect('/connect/feed')`.
7. `app/connect/onboarding/page.tsx` - `redirect('/connect/home')` → `redirect('/connect/feed')`.
8. `app/connect/layout.tsx` - `redirect('/auth?redirect=/connect/home')` → `redirect('/auth?redirect=/connect/feed')`.
9. `features/connect/onboarding/OnboardingClient.tsx` - `router.push('/connect/home')` → `router.push('/connect/feed')` (and update the adjacent comment that names the route).
10. `features/connect/onboarding/OnboardingClient.test.tsx` - `expect(push).toHaveBeenCalledWith('/connect/home')` → `'/connect/feed'`.
11. `lib/constants/keyboard-shortcuts.registry.ts` - the `g>c` shortcut `action: '/connect/home'` → `action: '/connect/feed'`.

- [ ] **Step 2: Confirm no stray references**

Run a search for `/connect/home` across `**/*.{ts,tsx}` (Grep tool or
`Select-String`). Expected remaining matches: only `app/connect/home/page.tsx` (the
redirect stub, created in Task 4) and possibly a comment in
`features/connect/home/ConnectLockedEntry.tsx` (pre-existing, out of scope - leave it).
If any other live route reference remains, repoint it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` - Expected: clean.

---

## Task 4: Retire `/connect/home`

**Files:**

- Modify: `app/connect/home/page.tsx`
- Delete: `features/connect/home/Day1Home.tsx`

- [ ] **Step 1: Replace the page with a redirect stub**

Overwrite `app/connect/home/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

/**
 * `/connect/home` is retired - the Connect home is the feed (`/connect/feed`).
 * The Day-1 welcome page it used to render was a Phase-1 bootstrap; the real
 * feed (Phase 3) is now the landing. This stub redirects stray bookmarks and
 * old links so they never 404. See
 * docs/connect/specs/2026-05-19-connect-home-feed-landing.md.
 */
export default function ConnectHomePage() {
  redirect('/connect/feed');
}
```

- [ ] **Step 2: Delete the Day-1 home**

Confirm nothing imports `Day1Home` any more (Task 4 Step 1 removed the only import).
Run a search for `Day1Home` across `**/*.{ts,tsx}` - expected: no matches.
Then delete the file `features/connect/home/Day1Home.tsx` (filesystem deletion -
`Remove-Item` / `rm`, never `git rm`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` - Expected: clean.

---

## Task 5: Drop the unused `connect.home.*` i18n block

**Files:**

- Modify: `app/messages/en.json`, `gu.json`, `gu-en.json`, `hi-en.json`

`Day1Home` was the only consumer of the `connect.home.*` keys. With it deleted, the
whole block is dead. Remove it from all four locales.

- [ ] **Step 1: `app/messages/en.json`** - replace:

```
    "home": {
      "welcomeTitle": "Welcome to Zari360 Connect",
      "welcomeBody": "Here's how to get started. Finish your profile and follow a few workshops.",
      "featuredTitle": "Workshops to follow",
      "featuredBody": "Real workshops already on Zari360. Follow a few to get going.",
      "featuredEmpty": "Featured workshops will appear here soon.",
      "feedTitle": "Your feed",
      "feedPlaceholder": "Posts from people and workshops you follow will appear here as Connect grows. For now, complete your profile so buyers can find you.",
      "feedCta": "Complete your profile"
    },
    "onboarding": {
```

With:

```
    "onboarding": {
```

- [ ] **Step 2: `app/messages/gu.json`** - replace:

```
    "home": {
      "welcomeTitle": "Zari360 Connect માં આપનું સ્વાગત છે",
      "welcomeBody": "શરૂઆત આ રીતે કરો. તમારી પ્રોફાઇલ પૂર્ણ કરો અને થોડી વર્કશોપ ફોલો કરો.",
      "featuredTitle": "ફોલો કરવા જેવી વર્કશોપ",
      "featuredBody": "Zari360 પર પહેલેથી રહેલી અસલી વર્કશોપ. શરૂ કરવા થોડી ફોલો કરો.",
      "featuredEmpty": "ફીચર્ડ વર્કશોપ ટૂંક સમયમાં અહીં દેખાશે.",
      "feedTitle": "તમારી ફીડ",
      "feedPlaceholder": "તમે ફોલો કરો છો તે લોકો અને વર્કશોપની પોસ્ટ Connect વધશે તેમ અહીં દેખાશે. હમણાં, તમારી પ્રોફાઇલ પૂર્ણ કરો જેથી ખરીદનાર તમને શોધી શકે.",
      "feedCta": "પ્રોફાઇલ પૂર્ણ કરો"
    },
    "onboarding": {
```

With:

```
    "onboarding": {
```

- [ ] **Step 3: `app/messages/gu-en.json`** - replace:

```
    "home": {
      "welcomeTitle": "Zari360 Connect ma aapnu swagat chhe",
      "welcomeBody": "Shru aa rite karo. Tamari profile puran karo ane thodi workshop follow karo.",
      "featuredTitle": "Follow karva jevi workshop",
      "featuredBody": "Zari360 par pehlethi rahel asli workshop. Shru karva thodi follow karo.",
      "featuredEmpty": "Featured workshop tunk samay ma ahin dekhase.",
      "feedTitle": "Tamari feed",
      "feedPlaceholder": "Tame follow karo chho te loko ane workshop ni post Connect vadhse tem ahin dekhase. Hamna, tamari profile puran karo jethi kharidnar tamne shodhi shake.",
      "feedCta": "Profile puran karo"
    },
    "onboarding": {
```

With:

```
    "onboarding": {
```

- [ ] **Step 4: `app/messages/hi-en.json`** - replace:

```
    "home": {
      "welcomeTitle": "Zari360 Connect mein aapka swagat hai",
      "welcomeBody": "Shuruaat aise karein. Apni profile poori karein aur kuchh workshop follow karein.",
      "featuredTitle": "Follow karne layak workshop",
      "featuredBody": "Zari360 par pehle se maujood asli workshop. Shuru karne ke liye kuchh follow karein.",
      "featuredEmpty": "Featured workshop jald hi yahan dikhenge.",
      "feedTitle": "Aapki feed",
      "feedPlaceholder": "Aap jin logon aur workshop ko follow karte hain unki post Connect badhne ke saath yahan dikhegi. Abhi, apni profile poori karein taki kharidaar aapko dhoondh sakein.",
      "feedCta": "Profile poori karein"
    },
    "onboarding": {
```

With:

```
    "onboarding": {
```

- [ ] **Step 5: Verify**

Run: `node scripts/check-i18n.js` - Expected: passes (the four files stay key-parity
consistent - the block is removed from all four).

---

## Task 6: Full verification

**Files:** none - verification only.

- [ ] **Step 1: Typecheck + lint + i18n**

Run (web worktree):

- `npx tsc --noEmit` - clean, zero `any`.
- `npx eslint app components features lib` - no errors in the touched files (pre-existing
  unrelated errors in `app/admin/*` are not introduced here).
- `node scripts/check-i18n.js` - passes.

- [ ] **Step 2: Build**

Run: `npm run build` - Expected: `prebuild` (check-i18n) passes, `next build` succeeds.
`/connect/feed` and `/connect/home` both appear in the route manifest.

- [ ] **Step 3: Manual acceptance (owner / reviewer)**

Against spec §6, at 380px and desktop:

1. Clicking "Connect" (ERP↔Connect switcher, sidebar logo, `g>c` shortcut) lands
   directly on `/connect/feed` - no welcome page, no visible hop.
2. The profile-completion card shows at the top of the feed for an incomplete profile;
   it dismisses and stays dismissed (reload).
3. A complete profile (strength 100) shows no profile card.
4. Visiting `/connect/home` directly redirects to `/connect/feed` - no 404.
5. No "Welcome to Connect" page appears on a normal Connect visit.

---

## Notes for the executor

- **Zero git.** Owner stages and commits.
- **Task order:** 1 → 2 → 3 → 4 → 5 → 6. Task 4 deletes `Day1Home` only after Task 2
  stopped depending on it and Task 4 Step 1 removed its import; Task 5 drops the i18n
  after Task 4 deletes the only consumer.
- No backend change. `getFeaturedWorkshops` (web action + backend stub) is left in
  place - harmless; Phase 6 company work revisits it.
- The top-of-feed card wrapper renders an empty 16px-gap `<div>` when BOTH cards
  self-hide (complete + dismissed profile, non-cross-sell user). Acceptable minor
  cosmetic; do not lift the cards' visibility logic into `FeedScreen` to chase it.
