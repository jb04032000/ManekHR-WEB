# Connect Jobs Board upgrade (design) - v2 (verification-revised)

**Status:** Approved direction; revised after a technical + UX verification pass (2026-06-08).
**Scope:** crewroster-backend + crewroster-web (Connect jobs, `/connect/jobs`).
**Delivery:** one spec, a 6-phase plan, executed phase-by-phase with a verify gate between phases.

**Owner decisions (locked):**

- Server-driven faceted search (filters + counts + pagination on the server; filters in the URL).
- Filter rail shows real per-facet counts.
- Inline Save (one-tap) + Apply (with a confirm) on each card; card stays clickable via a stretched-link.
- Employer identity on cards; ERP-verified as a quiet positive signal only (no GST-verified yet; no verified/unverified split).
- List + Grid toggle; list default; grid hidden on narrow screens.
- Promoted (boosted) jobs surfaced in a clearly separated, labelled block.
- **Google AdSense dropped for this board** (members-only surface; trust/data/DPDP concerns). Monetise via first-party promoted jobs only.

## Verification findings folded in (why v2 differs from v1)

1. The board is **members-only** (`jobs.controller.ts` class `@UseGuards(JwtAuthGuard)`, `board` has no `@Public()`; page is `robots:noindex`). No logged-out / SEO / public-ad narrative. Users on the board are always authenticated.
2. **AdSense infra already exists** (`components/connect/AdSlot.tsx`, `GoogleAdUnit.tsx`, `lib/connect/ads.ts`, `lib/env.ts` slots; prop is `placement`). We are NOT building it - and per the owner we are NOT using it here at all. Dropped.
3. The ad `decide` engine is single-winner + bills an impression per call + JWT-only; it does NOT fit "pin K + interleave" and does not exclude closed jobs. Promoted jobs need a **separate read-only, non-billing resolver**.
4. **App Router has no shallow `router.replace`.** Filter sync uses client fetch via server actions + `window.history.replaceState` for the URL (no SSR re-run per tap).
5. Facet fields are **unindexed**; DTO filters are strict enums/singletons; `machineType` is free-text; custom `category` is rejected by the strict DTO. Plan adds indexes + multi-select DTO params + a plural-supersedes-singular rule, and keeps category OUT of the rail (role strip + search cover occupation).
6. **ERP-verified is not in the batch refs shape**; cards need a refs extension. Person-posted jobs have no ERP concept (never badged).
7. UX: one-tap Apply risks accidental applies (confirm sheet); per-tap server round-trips hurt on 3G (mobile = staged + "Show N jobs"); the 8-group rail is too dense (primary facets + "More filters", collapsed on mobile); role appears in both strip and rail (remove from rail); verified-badge rarity can erode trust (neutral identity for all, badge as a quiet plus).

## Context (what exists - do not rebuild)

- `app/connect/jobs/page.tsx` (SSR) -> `JobBoard.tsx` (client). Fetches board(limit 100), mine, myApplications, stats(openTotal/newToday), viewerSkills, saved.
- `JobBoard.tsx`: header + Post a job, 4 KPI cards, 4 tabs (Open / My applications / Saved / My jobs), how-it-works panel, search, role strip (with counts from the loaded board), sort dropdown, active-filter chips, empty states. Today it filters the Open tab in client `useState`.
- `JobCard.tsx`: the WHOLE card is one `<a>` Link (so there are no inline buttons to conflict yet), skill-match ribbon, wage, tags, footer meta.
- `JobFilterRail.tsx`: category chips, wageType chips, skills checkboxes (no counts), district text input, posted radios, clear.
- Backend `GET /connect/jobs/board` (`BoardQueryDto`) + `buildBoardFilter`/`buildBoardSort` + `boardStats`. `q` is an unanchored regex over title/description/category/role.
- Job fields: `role`, `employmentType` (enum), `shift` (enum), `machineType` (free-text, unindexed), `skills[]`, `wageType` (enum), `location.{district,city,state}`, `openings`, `closesAt`, `createdAt`, `boostCampaignId`.
- Indexes today: `status+createdAt`, `category+status+createdAt`, `companyUserId`, `companyPageId+status+createdAt`, `status+role+createdAt`. None on district/skills/employmentType/machineType/wageType.
- `SavedJob` + saveJob/unsaveJob/listSavedJobs. Batch resolvers `getCompanyPageRefs(ids)` (name/slug/logo) + `getPeople(ids)`. ERP-link is exposed per-page via `getPublicCompanyPage(slug)`, not in refs.
- `components/connect/Skeleton.tsx` primitives (import directly, not via the barrel). i18n `connect.jobs.*` ~line 9821.

## The Interaction & Cursor Contract (binding per element)

1. **Card is a `<div>`, never an `<a>`.** Title is a `<Link>` with `after:absolute after:inset-0` (stretched-link) so the whole card opens `/connect/jobs/[id]`. Save/Apply are real controls with `position:relative; z-index:2` so they sit ABOVE the stretched pseudo-element and the AntD wave overlay; they click independently. No `onClick` on the wrapper, no `stopPropagation`.
2. The hover lift/shadow + the `aria-label` move from the old anchor to the `<div>` / title link respectively. Inner buttons keep their own hover; card hover must not fight them.
3. Every clickable non-native element: `cursor-pointer`; disabled: `cursor-not-allowed` + `aria-disabled` + an in-locale reason (e.g. "This job is filled").
4. Visible `:hover` / `:active` / `focus-visible` ring on everything; full keyboard operability; correct `role`/`aria-pressed`/`aria-checked`/`aria-label` on toggles/checkboxes/radios/segmented/promoted-label.
5. Tap targets >= 44px and count/secondary text >= 4.5:1 contrast (sunlight/outdoor use) - an explicit acceptance criterion, not an afterthought.
6. Applied/Saved states are carried by a **filled icon + colour**, not text alone (low-literacy): bookmark-filled = saved; check + disabled = applied.

## Architecture: server-driven faceted search (Open tab only)

- **Results**: `GET /connect/jobs/board` with the full filter set + `limit`(20)/`skip` (Load more, append).
- **Counts**: NEW `GET /connect/jobs/board/facets` - one `$facet` aggregation -> `{ total, facets: { district[], role[], employmentType[], machineType[], skill[], wageType[] } }`, each entry `{ value, count }`. Each facet's sub-pipeline applies all active filters EXCEPT its own field (so users see "how many you'd get"). Refetched on filter change only, never on pagination.
- **Filter contract**: OR within a facet (two districts = either), AND across facets. Kept invisible to the user (only a plain "Showing N jobs" count).
- **Selected values always present**: the facet builder unions-in any currently-selected value even if it falls outside the top-50 cap (so a selected filter never disappears from the rail).
- **Desktop debounce**: facet + results refetch on filter change is debounced (~250ms) so a fast multi-toggle fires one aggregation, not one per tap.
- **URL is source of truth**: `?roles=a,b&districts=x&employmentTypes=&machineTypes=&skills=&pay=min-max&posted=7&sort=recent&view=list&q=`. SSR seeds page 1 from `searchParams`. On change, the **client** board calls the server actions (`listJobBoard`, `getJobBoardFacets`) and writes the URL via `window.history.replaceState` (no `router.replace`, no SSR re-run, no scroll reset). The current client `useState` filtering of the Open tab is **removed** (not kept).
- **Stale-response safety**: an `AbortController` + monotonic request-id; ignore any response older than the latest filter state.
- **Role strip counts switch to facet counts** (today they read the loaded board, which will be wrong once only page 1 is loaded).
- Tabs (My applications / Saved / My jobs) stay client-rendered from their SSR-seeded arrays.

## Phases

### Phase 1 - Server-driven foundation

**Backend**

- Multi-select on `BoardQueryDto` + `buildBoardFilter`: `districts`, `roles`, `employmentTypes`, `machineTypes` (csv); `skills` already csv. Singular params keep working; **plural supersedes singular** when both present (documented in the helper). `roles`/`employmentTypes` validated against their preset/enum sets; `machineTypes` free strings (trim, case-insensitive match); `districts` case-insensitive.
- `boardFacets(query)` -> `{ total, facets }` via `$facet`; per-facet `$match` = active filters minus that field; `$sortByCount`; cap top 50/facet. `machineType` facet accepts the scan cost (uncontrolled vocab) and is demoted in the UI.
- New `GET /connect/jobs/board/facets` (same guard as `board`) + a `@Throttle` tier (heavier than board).
- **Indexes** (additive): `{ status:1, 'location.district':1 }`, `{ status:1, employmentType:1 }`, `{ status:1, skills:1 }` (multikey). Note machineType stays unindexed (accepted).
- Targeted vitest: multi-select filter build + plural-supersedes-singular + facet shape (`--no-file-parallelism`).
  **Web**
- `jobs.types.ts`: `BoardFilters` gains plural fields + `view`; add `BoardFacets`.
- `jobs.actions.ts`: `getJobBoardFacets(filters)`.
- `page.tsx`: read filters from `searchParams`; SSR page-1 results + facets + total; default `limit` 20 (update the call).
- `JobBoard.tsx`: server-driven Open tab (client fetch on change + `window.history.replaceState`; AbortController/request-id; Load more; role-strip counts from facets). Remove client `useState` Open-tab filtering.
- NEW `app/connect/jobs/loading.tsx` mirroring the board (KPIs + tabs + rail + list rows), Skeleton primitives imported **directly**, root `aria-hidden`, no em-dashes.
  **Edge cases:** 0 results (empty state with a primary "Clear all filters"), no filters (bare board unchanged), invalid params ignored by DTO, total=0 facets (groups still render, counts 0), back/forward restores filters, stale-response abort, facet-fetch failure (retry affordance), Load-more failure (retry).

### Phase 2 - Filter rail (audience-tuned, counts, mobile)

- **Primary (always visible):** Location (multi-check + counts, top-N + "Show more", search within when long), Pay type (chips: hourly/daily/piece/monthly), Posted date (radios). Role stays the **icon role strip** (single-select) - removed from the rail to avoid duplication.
- **"More filters" (collapsed):** Employment type (multi-check), Machine type (multi-check, demoted), Skills (multi-check + counts, top-N + more).
- Open-positions-only toggle; Clear all (only when active).
- A selected value whose count drops to 0 stays visible + selected (so it can be unselected); other 0-count values render disabled (no list jump).
- **Mobile:** rail collapses behind a "Filters (N)" button by default; filters **stage locally** and apply via one **"Show N jobs"** button (single round-trip); optimistic local hiding while the authoritative refetch runs. Desktop applies on change (instant feel).
  **Edge cases:** long gu/hi labels wrap (never truncate the label to fit the count), facet value with no i18n label (humanize), rapid toggle debounced before the URL write, "More filters" remembers open/closed per session.

### Phase 3 - Job cards (identity + verified + Save/Apply + list/grid)

- **Employer identity (batch):** page-posted -> company name + logo (`getCompanyPageRefs`); person-posted -> person name (`getPeople`). Neutral identity for ALL (name + logo/initial).
- **ERP-verified**: extend `CompanyPageService.getRefs` (`.select` add `erpWorkspaceId`) + `CompanyPageRef` to carry `erpLinked = !!erpWorkspaceId` (additive BE change) so it batches; show a quiet positive badge only when true; person-posted never badged; no verified/unverified split or filter.
- **FE refs wiring is net-new for the board:** the jobs board does not batch-resolve employer identity today. Add a web action that calls the public refs endpoint (`getCompanyPageRefs(ids)`) + a `getPeople(ids)` call, batch one of each per page render, and pass an `employer` map into the cards. (The BE `erpLinked` field alone is insufficient.)
- **Save** = one-tap, optimistic, filled-bookmark state (reversible, private).
- **Apply** = opens a lightweight confirm (bottom sheet on mobile) restating the job + "your number stays private until they shortlist you"; single confirm action; then the existing apply flow. Owner-on-own-job: no Save/Apply (mirror the post-menu fix); show views on My jobs.
- Card per the Interaction Contract (div + stretched title link + layered buttons). **List row** (default) + **Grid card** variants sharing subcomponents.
  **Edge cases:** logged-out (rare; auth wrapper handles, return to the job + resume intent), already-applied ("Applied", disabled), already-saved (filled), closed/filled (disabled Apply + in-locale reason), missing employer/logo (fallback/initial), long titles clamp.

### Phase 4 - View toggle + result header

- Segmented List/Grid (cursor + aria), list default; **Grid hidden below the mobile breakpoint** (a persisted `?view=grid` never renders a broken phone layout). Resolution order: `?view=` wins; absent -> SSR list; client reconciles from `localStorage` and rewrites via `history.replaceState`.
- Result header: "N jobs match your filters · {city}" from facets `total`.
- Bulk hint on cards when openings is high (>=10 -> "Bulk · N needed").

### Phase 5 - Promoted (boosted) jobs (first-party only; NO AdSense)

- **Module wiring (resolve first):** `AdsModule` exports only `WalletService` today; campaign/creative models + a read path are not available to JobsModule. Add a read-only `resolveActiveJobBoosts()` in the ads module (queries `AdCampaign{kind:'boost_job',status:'active',window+budget ok}` -> `AdCreative{promoted_job, jobRef}`), export it, and import `AdsModule` into `JobsModule`. Do not widen exports beyond what is needed.
- A **read-only, non-billing** resolver returns up to K active job boosts for the board (resolve `jobRef` -> load Job -> **exclude any not `status:'open'`** and any not matching the active filters). Does NOT call `decide` (which bills + single-winner).
- Render in a **visually separated, clearly labelled "Promoted" block** (not interleaved into the organic stream), in-locale label + icon, de-duped from the organic list. K low (1-2 on mobile).
- Impression/click are first-party analytics only (no per-render billing here).
  **Edge cases:** no active promotions (no block), promoted job filtered out by current filters (omit), boosted-but-closed (excluded).

### Phase 6 - i18n + a11y + cursor sweep + analytics + verification

- 4-locale i18n for every new string (parity via `check-i18n`, no em-dashes).
- a11y: keyboard, focus-visible, tap-targets >=44px, count/secondary contrast >=4.5:1, aria on rail/cards/toggle/promoted.
- Cursor-contract sweep over all new interactive elements.
- **Analytics (FE PostHog):** filter_applied, facet_toggled, save_from_card, apply_confirmed, view_toggled, promoted_impression, promoted_click. (BE read endpoints emit OTel spans only, no PostHog, per repo rule.)
- Verification: BE `nest build` + targeted vitest; web eslint per file + check-i18n; manual smoke checklist.

## Out of scope

- Google AdSense on this board (dropped).
- GST/Udyam verification system (separate; only ERP-verified shown).
- Inline-on-card apply composer (Apply confirm -> existing apply flow / detail).
- Saved-search / job alerts. Mobile app parity (web only).
- `category` as a rail facet (role strip + search cover occupation; avoids the custom-category DTO problem).
