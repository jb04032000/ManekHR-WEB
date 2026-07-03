# Home page redesign — sticky product tour + cohesive scene flow

Date: 2026-06-18. Surface: public marketing home page (`app/(marketing)/page.tsx`).
Owner ask: the home page felt unorganized, "context keeps changing" on scroll, not
engaging/modern; it is the #1 first-impression surface and will be used for marketing
videos/images. Reference admired: https://aletheia.events/ (its 2nd section's
sticky-left / scrolling-right product showcase). Owner approved scope: **build it +
extra polish.**

## Diagnosis

The page was 10 disparate full-bleed bands. Two of them told the "what's inside" story
twice (`ThreePillars` = 3 jobs, then `ModuleShowcase` = 5 tools), and every band reset
layout/background/topic, so the eye never kept a stable subject.

## What was built

1. **New `ProductTour.tsx`** — the anchor scene. MERGES `ThreePillars` + `ModuleShowcase`
   into one sticky-left / scrolling-right product tour (the aletheia pattern):
   - LEFT (sticky on `lg`, `lg:sticky lg:top-[96px]` clearing the 76px navbar): heading
     (`marketing.modules.{eyebrow,title,sub}`) + the living `NetworkHeroMock` window +
     `Explore` CTA (`marketing.modules.cta`).
   - RIGHT: an `<ol>` of 5 capability cards (feed / storefront / quotations / jobs / chat),
     each its own `Reveal` (`delay 0` — a vertical scroll list must not use cumulative
     stagger), each carrying its real mock (`FeedMock/StorefrontMock/RfqMock/JobsMock/ChatMock`).
   - Responsive: mobile = single column, anchor first with the mock `hidden lg:block`
     (so the hero's `NetworkHeroMock` is not repeated on a phone); sticky is `lg`-only.
   - Reuses `marketing.modules.*` → **zero net-new i18n keys.**
2. **Reorder `page.tsx`** into 7 cohesive scenes with a deliberate background rhythm
   (no two same tones adjacent; the two dark bands kept far apart):
   Hero(tinted) → ProductTour(white) → LandingSteps(cream) → TrustWedge(dark) →
   AudienceStrip(cream) → PricingStory(white) → ErpCompanion(cream) → FaqBlock(white) →
   FinalCta(dark). `ThreePillars`/`ModuleShowcase` are no longer rendered on home (files
   kept, reversible).
3. **Consistency polish (kept tight):** unified the grid-card radius family to
   `rounded-[20px]` (LandingSteps + TrustWedge `18→20`, matching Tour + Audience). Added
   `scroll-mt-[96px]` on the `#how` target so the hero's "See how it works" jump clears
   the navbar. Deliberately did NOT re-route `PricingStory`/`ErpCompanion` through
   `SectionHeading` or re-skin `AudienceStrip` into the dark band (reviewer flagged these
   as intentional layouts; re-skinning risked regressions for invisible gains).

## Reviewer's #1 risk + resolution

A sticky-left pattern only feels premium if the pinned anchor is SHORTER than the
scrolling rail (else the pin barely moves). Verified live: anchor 885px vs rail 2633px →
the pin travels ~1.7k px. Confirmed in-browser the anchor pins at `top:96px` and the
right cards reveal one by one.

## Verification (dev server, localhost:3002)

- Desktop (1440): `#tour` present, 5 cards, sticky `position:sticky`, anchor pins at 96px
  while the right column advances Feed → Storefront; 0 horizontal overflow.
- Mobile (≤500): sticky `position:static`, anchor mock hidden, single column, all 5 cards
  fit (incl. `JobsMock`), 0 horizontal overflow.
- Gates: `check:i18n` 13923 (no new keys), eslint clean on touched files, `tsc` 0 errors.

## Deferred (owner can request later)

Global `.mkt-reveal` curve retune, per-section `Reveal` delay normalization, and the
broader heading/card-DNA convergence — all judged invisible-on-a-filmed-scroll and/or
cross-page side effects; left out to keep the change safe and focused.
