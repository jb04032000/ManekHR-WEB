# Phase 1 - Identity (Profile + Onboarding)

Sub-plan. Per `WORKFLOW.md`: owner reviews this, then build. Master scope:
`connect-build-plan.md` → Phase 1 row.

## Goal

A person can enter Connect, declare intent, build a real profile, and have it
reachable at a public URL - with the ERP-linked moat badge derived live. This is
the identity foundation every later phase (feed authors, candidate cards, company
people, search results) renders against.

## Acceptance criteria (owner checks against these)

1. A `connectEnabled` user opens `/platform`, picks an intent, and lands on the
   correct next screen - built intents proceed; unbuilt destinations (Marketplace,
   Jobs, Feed) show an honest "coming soon", never a 404.
2. A user completes a profile - headline, photo, ≥3 skills, ≥1 portfolio item - and
   sees it rendered in their chosen locale, at 380px and desktop.
3. The profile is reachable at its canonical public URL `/u/[userId]` - server-
   rendered, indexable, working logged-out with a "Join Connect" CTA; `visibility`
   (`public` / `connections` / `hidden`) is enforced.
4. A workshop-owner profile shows the **ERP-linked** badge derived from real
   workspace activity (`ErpLinkService`); a no-workspace user's profile does not.
5. The Day-1 home shows the setup checklist as the hero + 3 curated featured
   workshops to follow.

## Scope

**In:** `User.connectEnabled` flag · `ConnectProfile` CRUD (lazy-create, get own,
get public, update, strength) · `ErpLinkService` exposed via endpoint · onboarding
intent flow · Day-1 home · own profile (view/edit) · public profile `/u/[id]` ·
empty-profile state · curated featured-workshops · `seed:connect` · uploads
`connect-banners` + `connect-portfolio` categories · i18n (4 locales) · tests.

**Out (later phases):** connections/follows (P2) · feed/posts (P3) · the
Marketplace/Jobs/Company/Inbox intents' destinations (their phases) · algorithmic
suggestions (P2 - Phase 1 ships the curated list).

## Backend tasks (`crewroster-backend/zari360-connect`)

- **B1** - `User.connectEnabled: boolean` (`default: false`). Logical change -
  flagged for owner approval in this sub-plan. Per-user beta gate (rollout layer 2).
- **B2** - `ConnectProfileService`: `getOrCreateForUser(userId)` (lazy-create -
  never auto-created for every ERP user), `getPublic(userId, viewer)` (visibility-
  aware), `update(userId, dto)`, `computeStrength(profile)`.
- **B3** - `ConnectProfileController` - `GET /me/connect/profile` (lazy-create),
  `PATCH /me/connect/profile`, `GET /connect/profiles/:userId` (public, visibility-
  gated, optional-auth), `GET /me/connect/profile/erp-link` (→ `ErpLinkService`).
  `JwtAuthGuard`; NOT subscription-gated (feature-flagged). Zod/class-validator
  DTOs, `AuditService` logging, PostHog events, OTel spans.
- **B4** - `uploads`: add `connect-banners` + `connect-portfolio` categories
  (per `BACKEND-REUSE-AUDIT.md` §2).
- **B5** - curated featured-workshops endpoint - `GET /connect/featured-workshops`
  (top ERP-active workspaces; bootstrap for Day-1, replaced by P2 algorithmic).
- **B6** - `seed:connect` script - demo users + `ConnectProfile`s (3 personas:
  master karigar, day-1 karigar, workshop owner) for stakeholder demos.
- **B7** - tests - service unit + controller integration (in-memory Mongo).

## Frontend tasks (`crewroster-web/zari360-connect`)

- **F1** - `/platform` smart entry: `connectEnabled` + no `ConnectProfile` →
  `/platform/onboarding`; else → `/platform/profile` (feed is P3 - profile is the
  P1 landing). Not-`connectEnabled` → existing "coming soon" placeholder.
- **F2** - `/platform/onboarding` - 4 intent cards (flag-gated) + Day-1 home
  (checklist hero, curated workshops). Wireframe: `connect-onboarding.jsx`.
- **F3** - `/platform/profile` - own profile view + edit. Wireframe:
  `connect-profile.jsx` + empty state `connect-empty.jsx`.
- **F4** - `/u/[userId]` in `app/(connect-public)/` - public profile, SSR/ISR,
  indexable, visibility-aware, logged-out "Join Connect" CTA.
- **F5** - JIT components: `PersonCard`, `ProfileStrengthCard`, `ERPLinkedPanel`,
  `ERPCallout`, `RateRow`, `ContactPreferenceSelector`, profile header, portfolio
  grid. All on `/design-system`.
- **F6** - `features/connect/profile.actions.ts` server actions + TanStack Query
  hooks for the interactive edit surface.
- **F7** - empty / loading / error states for every screen.
- **F8** - i18n - all Phase 1 strings, 4 locales.
- **F9** - component tests (Vitest) + E2E (Playwright) for criterion flows.

## Decisions (made - research-grounded, not owner-blocking)

- **Profile-strength formula** (0–100): photo 15 · headline 15 · bio 10 · ≥3 skills
  20 · ≥1 portfolio 20 · ≥1 experience 10 · rate card 10. LinkedIn-style weighted
  checklist; portfolio + skills weighted highest (design doc - visual proof matters
  most for karigars).
- **Intent → route map:** Workshop owner → profile + ERP callout · Karigar →
  profile (open-to-work pre-set) · Buyer → Marketplace (gated → "coming soon") ·
  Just exploring → feed (gated → P1 lands on Day-1 home). Gating via
  `isConnectModuleEnabled`.
- **Day-1 home** = setup-checklist hero + curated featured workshops + a feed
  placeholder ("your feed fills as you connect" - real feed is P3).
- ERP-linked badge resolves via `primaryWorkspace`; multi-workspace handled per
  `IDENTITY-MODEL.md`.

## Open - flag for owner

- `User.connectEnabled` (B1) is a logical schema change - **approve in this
  sub-plan review.** No admin UI to flip it ships in P1; closed-beta enablement is
  a DB/script action until an admin toggle is built. Acceptable for P1.

## Verification

Per-phase: backend `tsc` (scoped) + `vitest` green · web `tsc`/eslint/`next build` ·
`check:i18n` connect-keys parity · all 5 acceptance criteria demonstrably met ·
screens at 380/768/1280px · `/design-system` renders new components · Playwright
E2E for the onboarding→profile→public-view flow · per-phase hardening sub-checklist.

## Execution order (waves)

1. **B1 + B2 + B3** (backend identity) → schema/flag, service, endpoints.
2. **F5** (components) ∥ **B4/B5/B6** (uploads, featured, seed) - parallelizable.
3. **F3 + F4** (profile own + public) → consume B2/B3 + F5.
4. **F1 + F2** (smart entry + onboarding/Day-1).
5. **F7/F8/F9 + B7** (states, i18n, tests) folded into each screen as built.
6. Verify → owner review checkpoint.
