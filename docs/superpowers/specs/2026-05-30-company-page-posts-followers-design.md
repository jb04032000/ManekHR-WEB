# Company Page Posts + Followers - Design

**Date:** 2026-05-30
**Status:** Approved (approach + fan-out audience), pending spec review
**Area:** Zari360 Connect - Company Page entity (`src/modules/connect/entities`) + Feed (`feed`) + Network (`network`); web `features/connect/entities`, `features/connect/feed`.

## Goal

Turn a Company Page from a static identity into a living channel: the page owner publishes updates **as the page**, and members **follow the page** to get those updates in their feed. This activates the "Posts" + "Followers" seams left clean during the Company Pages + Storefronts milestone.

## Decision summary

- **Model:** one additive nullable pointer `companyPageId` on the existing `Post` (and denormalized onto `FeedEntry`). A page post is a normal `Post` whose `companyPageId` is set. `authorId` stays the owning `User` (permissions + audit); `companyPageId` overrides the _displayed identity_ and the _fan-out audience_. Mirrors how `Listing.storefrontId` was added - additive, low-risk, person-centric (`ownerUserId`/`authorId` remain the source of truth).
- **Rejected alternative:** a polymorphic `authorType: 'user' | 'companyPage'` enum on `Post`. More "correct" but touches every post read path for a distinction one nullable field carries. Higher regression surface; not worth it.
- **Followers:** no schema change - `Follow.followeeType` already includes `'companyPage'`. Add the page-typed service methods + endpoints beside the existing user ones.
- **Fan-out audience (owner-chosen):** a page post reaches **page followers only**, plus the owner's own feed. Personal followers do NOT receive business posts unless they also follow the page. Person and business audiences stay distinct.

## Reuse (compose, do not rebuild)

- `feed.service.ts` - `createPost` + `fanOutPost` + the BullMQ `connect-feed-fanout` queue/processor. Add an optional `companyPageId` and an audience switch.
- `feed-fanout.processor.ts` - `listFollowerIds(authorId)` finds user-followers today; add a page-followers resolution path.
- `network.service.ts` - `followUser` / `unfollowUser` / `listFollowerIds` / follower counts / `isFollowing`. Add `followCompanyPage` / `unfollowCompanyPage` / `listCompanyPageFollowerIds` / page follower count beside them (the comment at L427 already anticipates "Company Pages arrive in Phase 6").
- `CompanyPageService.assertOwnsCompanyPage` - ownership gate for posting as a page.
- Notifications - reuse `connect.followed` for a page-follow (recipient = page owner).
- Web `Composer`, `PostCard`, `FeedList`, the feed author block, `ModuleTabs` (company page tabs), `CompanyPageView`.

## Schema changes (logical - owner-approved)

1. `Post.companyPageId?: ObjectId` (ref `CompanyPage`, default `null`). Index `{ companyPageId, createdAt: -1 }` for the page Posts tab.
2. `FeedEntry.companyPageId?: ObjectId` (default `null`) - denormalized so the feed renders page identity without a per-row join.
3. No `Follow` change.

## Behavior

### Posting as a page

- The existing create-post endpoint/DTO gains an optional `companyPageId`.
- `createPost`: if `companyPageId` present → `assertOwnsCompanyPage(authorId, companyPageId)`, stamp `Post.companyPageId`, and fan out to the **page's** followers.
- `fanOutPost` + the fanout job carry `companyPageId`. The owner's own `FeedEntry` (instant self-view) and every page-follower's `FeedEntry` are written with `companyPageId` stamped.
- Audience resolution: page post → `listCompanyPageFollowerIds(companyPageId)`; user post → unchanged (`listFollowerIds(authorId)`).

### Following a page

- `POST /connect/company-pages/:id/follow` and `/unfollow` (person-centric; follower = `req.user.sub`).
- Follower count + `isFollowing` surfaced on the public page payload (extend `getPublicCompanyPage`).
- A page-follow dispatches `connect.followed` to the page owner (best-effort).
- Block self-follow of your own page (mirror the user self-follow guard).

### Reading page posts

- `GET /connect/company-pages/:id/posts` - public (no auth), lists `Post` where `companyPageId = id`, newest first, paginated. Both surfaces use the id form: the public `/company/[slug]` page already resolves slug to the page (and its id) server-side when it loads, then fetches posts by id.

### Feed render (identity)

- When a `Post` / `FeedEntry` carries `companyPageId`, the feed + post-detail author block renders the **company page** (name, logo, link to `/company/[slug]`) instead of the user. Reactions/comments unchanged (they key on `postId`).

## Web surfaces

- **Public `/company/[slug]`** - a **Posts** tab (page posts via `PostCard` with page identity), a **Follow / Following** button, and a follower count. Logged-out users see a join CTA.
- **Company Page manage** - a **"Post as page"** composer (reuses `Composer`, passing `companyPageId`) + the page's posts list with delete.
- **Following feed** - page posts appear with page attribution for page followers.

## Out of scope (clean seams, later)

- Posting as a page from a storefront, scheduled posts, analytics, multi-admin posting (Connect is single-owner → owner-only posting), page post visibility tiers beyond `public`.

## Waves

- **W1 - BE schema + fan-out.** `Post.companyPageId` + `FeedEntry.companyPageId` + indexes; `createPost` accepts + owner-checks `companyPageId`; fan-out audience switch; `listCompanyPageFollowerIds`. RED-first tests (ownership gate, audience switch, idempotent fan-out).
- **W2 - BE follow + posts API.** `followCompanyPage` / `unfollowCompanyPage` / follower count / `isFollowing`; page-follow notification; `GET .../posts`; extend the public page payload. Tests.
- **W3 - Web feed identity.** Feed + post-detail author block resolves page identity from `companyPageId`. Tests.
- **W4 - Web page Posts tab + Follow + composer.** Public page Posts tab + follow button + count; manage-screen "Post as page" composer + posts list.
- **W5 - i18n (4 locales) + a11y + tests + demo seed** (extend `seed:connect` so the demo company page has a couple of posts + a follower).

## Verification

- Backend: `npx nest build` (SWC) + scoped `npx vitest run <file> --no-file-parallelism`. Never whole-project tsc/vitest (OOM).
- Web: `npx tsc --noEmit`, `node scripts/check-i18n.js` (4-locale parity), changed-file `npx eslint`, scoped `npx vitest`.
- Regression gate: a user post still fans out to user-followers only; existing feed render unchanged when `companyPageId` is null.
- Person-centric throughout; no `workspaceId`, no `<Can>`. No em-dash. Owner does git pushes + live smokes.
