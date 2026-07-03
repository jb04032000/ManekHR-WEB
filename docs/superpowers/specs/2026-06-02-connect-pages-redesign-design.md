# Connect pages redesign - design (Jobs · Companies · Notifications · Pages)

Date: 2026-06-02
Status: Design (owner asleep; build later OK). Reconciles the Claude-Design handoff
bundle with the flow changes shipped since (storefront/collection split, inquiry-
inbox unification, no rating/response data yet, WhatsApp/phone gaps).
Repos: `crewroster-web` (Connect) + `crewroster-backend` (Connect), branch `zari360-connect`
Handoff: `Zari360-handoff (3).zip` -> `connect-jobs.jsx`, `connect-company.jsx`,
`connect-entity-admin.jsx`, `connect-shell.jsx`, design-decisions doc.

## Reconciliation rules (apply to every page)

The handoff predates several shipped flow changes. Honor these when the handoff
conflicts:

1. **Company Page vs Storefront are SEPARATE** (shipped). The handoff's single
   "Company Page" shows products + jobs + people + reviews in one place. Our
   model: `CompanyPage` = identity (people, jobs, posts, about); `Storefront` =
   the shop (products/listings/collections). So a company page shows its **linked
   storefront(s)** for products, never products directly.
2. **No rating/review data yet** (established in the marketplace epic). Stars,
   "4.6 · 12 reviews", "hires within 7 days", salary benchmarks are NOT backed by
   data. Render a signal ONLY once its feature ships; until then omit (no
   fabrication). Reviews-after-deal + ratings are the marketplace epic Phase C.
3. **WhatsApp / phone** is not a stored field yet. "WhatsApp-first" CTAs route to
   the in-app inbox (the unified messaging we just built) until a phone field +
   consent lands. The inbox already pins a product/job context card.
4. **ERP-linked badge + ERP stats panel** are real (storefront/company
   `erpWorkspaceId` -> `erpLink`). GST/Udyam badges are net-new capture (self-
   declared UI now, verification API later - per the marketplace GST decision).
5. **Tabbed sub-pages, one URL per module** (design-decisions §1.2): Jobs =
   Find / My applications / Posted / Candidates; tabs swap content.
6. **Reuse our shipped components**: `ListingGridCard`, the inbox `ContextCard`,
   `StorefrontView`, the collection browser, `DsButton`, `ConnectPage`/`Rail`,
   `EntityAdRail`. Restyle existing screens; do not rebuild. Preserve the ad rail.
7. i18n across en / gu / gu-en / hi-en; gu/gu-en/hi-en owe native review.

---

## Current implementation (audited 2026-06-02)

All four modules are LIVE and more built than the handoff assumes. The redesign is
a restyle + targeted additions on top of working state machines, not a rebuild.

**Jobs** (`features/connect/jobs/`)

- `JobBoard` = a single AntD `Segmented` with 3 tabs: `board` (open jobs) / `mine`
  (my posted) / `myApplications`. `JobCard`, `ApplicationCard`, `JobComposer`,
  `ApplicationComposer` (with `VoiceNoteRecorder` - voice apply is REAL), and a
  full `JobDetailScreen` (company face: applications grid + shortlist/decline/
  accept; karigar face: apply/update/withdraw) all exist.
- `Job` fields (real): `title, description, category` (the 8 textile categories),
  `wageType` ('daily'|'piece'|'monthly'), `wageMin, wageMax, openings, location`
  {district,city,state}, `status` ('open'|'closed'|'filled'), `applicationsCount`,
  `companyPageId` (post AS a page), `boostCampaignId` (ad rail).
- `JobApplication` (real): `message, voiceNoteUrl, status`
  ('applied'|'shortlisted'|'accepted'|'declined'|'withdrawn') - the ATS pipeline
  ALREADY EXISTS as data + transitions; only a kanban _view_ is net-new.
- Board filtering today: `listJobBoard(category?)` only. District + wageType +
  skills + machine-type facets are NOT wired into `listBoard` yet.
- NET-NEW fields the handoff wants: `skills[]`, `machineType`, job alerts, Nvites,
  candidate search, salary benchmark, company rating, hire-speed.

**Companies / Pages** (`features/connect/entities/`)

- `CompanyDirectoryScreen` (/connect/companies) ALREADY a `CompanyCard` grid +
  `CompanyDirectoryFacetPanel` (q / district / specialization), paginated.
- `CompanyPageView` (public `/company/[slug]` + in-app `/connect/company/[slug]`)
  ALREADY renders banner, logo, name, location, ERP-linked badge (`TrustBadgeRow`,
  from `erpLink.linked`), Follow + follower count, About, "What we do"
  (specialization / machineCapacity / production / languages), open Jobs, Posts.
  It is a SINGLE SCROLL - no tab bar, no Products tab, no People tab, no Reviews.
- `CompanyPagesHub` (/connect/pages) + `ManageCompanyPageScreen` (/connect/pages/[id]
  with Posts / Jobs / Settings sections + delete + "Start selling") ALREADY exist
  and mirror the storefront hub/console.
- `CompanyPage` fields (real): `slug, name, logo, banner, about, industryPanel`
  {specialization[], machineCapacity, production, languages}, `location`,
  `erpWorkspaceId` -> derived `erpLink` {linked, since}, `visibility`
  ('public'|'connections'|'hidden').
- Storefront has `companyPageId` (the company<->shop link is in the model). The
  public page does NOT yet surface linked storefront products (no "storefronts by
  companyPageId" query wired to the view).
- `followerCount` is derived live (NetworkService), not stored.
- NET-NEW fields: `gstin`/`gstStatus`, hiring / open-to-bulk status pills, deeper
  ERP-derived stats (karigars on payroll / attendance / payroll figure - only
  {linked, since} is exposed today), Reviews, People tab, page-view analytics,
  multi-admin roles.

Implication: every page below is a **restyle + slot-in**, lowest-risk first.
Net-new fields/queries are their own phases (do not fabricate; render a signal
only once its data lands), exactly like the marketplace epic.

---

## 1. Jobs - `/connect/jobs` (current: `JobBoard`)

### Handoff design

3-column: **left filter rail** (employment type with counts - Full-time monthly /
Daily-wage / Piece-rate / Part-time / Apprenticeship / Contract; skills; daily-wage
range; location areas; machine type), **center job list** (search + posted-window +
sort; cards with a 3-cell **wage / schedule / tenure** strip emphasizing daily-wage
/ piece-rate / monthly, ERP badge, skill pills + "WhatsApp-first" + "Voice-note
application OK", Save + Apply/Applied, posted-time), **right rail** (Job alerts,
"Nvites · recruiters invited you", "Recruiting? (employer)" -> Post a job / recruiter
dashboard). Detail: wage grid, about role, about company (rating + hire-speed),
salary benchmark, similar jobs, **apply panel** (profile + cover note + voice note +
WhatsApp + send), application-tracking pipeline (Applied -> Viewed -> Shortlisted ->
Interview -> Offered/Hired).

### Proposed design (reconciled)

- **Sub-tabs**: keep the existing `Segmented`, relabel/extend to Find jobs (=`board`)
  / My applications (=`myApplications`) / Posted jobs (=`mine`) / Candidates (net-
  new, later). No URL change needed beyond what exists.
- **Find jobs** = the 3-column layout: filter rail + job-card list + right rail.
  - Job card (restyle `JobCard`): a wage strip built from REAL fields - `wageType`
    (daily-wage / piece-rate / monthly, made first-class with a labelled pill) +
    `wageMin/wageMax` + `openings` + `location`. ERP badge rides Phase B (only the
    page/storefront link carries it today; a job's company-page ERP badge is a
    join). `applicationsCount` + posted-time. Skill pills + "schedule" + "tenure"
    are NET-NEW fields (omit until added). Apply stays; a "Message employer" action
    -> the in-app inbox (no phone field yet).
  - Filter rail: category (real, already on `listBoard`) + district + wageType
    (cheap additions to `listBoard`'s query). Skills + machine-type + pay-range are
    net-new (need fields/params). Counts only where a facet exists (else omit).
  - Right rail: keep the ad rail; add a "Recruiting? -> Post a job" panel. Job
    alerts + Nvites are net-new features -> flag as a later phase (omit now).
- **My applications** = the seeker's applied list + the application-tracking
  pipeline per application (Applied -> Viewed -> Shortlisted -> Interview ->
  Offered/Hired). Status data: we have application status; map the stages.
- **Posted jobs** (employer) = the poster's jobs + a click-to-move **ATS pipeline**
  (Applied -> Screened -> Interviewed -> Offered -> Hired) per design-decisions.
  Net-new pipeline state on the application; flag as a phase if not present.
- **Candidates** (employer) = karigar profile search; "Caller-ID with intent"
  banner. Net-new; flag as a later phase.
- **Detail** (`/connect/jobs/[id]`): wage grid + about + apply panel (profile +
  cover note + **voice note** [the inbox already has voice; reuse] + send + "via
  inbox" instead of WhatsApp) + the application-tracking pipeline. Drop salary
  benchmark + company rating + hire-speed (net-new data). Keep "similar jobs"
  (query by type/district). "About company" links to the company page.

### Real-now vs net-new

- Real now: sub-tabs, filter rail, wage/schedule/tenure card, ERP badge, apply +
  voice note (reuse inbox), application status, similar jobs, ad rail.
- Net-new (phase later, flagged): job alerts, Nvites, ATS pipeline columns,
  candidate search + caller-ID, salary benchmark, company rating/hire-speed.

---

## 2. Companies - `/connect/companies` (current: `CompanyDirectoryScreen`) + the public page

The handoff `connect-company.jsx` is the **single public Company Page**, not the
directory. Split into two surfaces:

### 2a. `/connect/companies` - directory (no handoff; design on our system)

A browse/search of public company pages: a search + filter header (industry,
district, hiring, open-to-bulk), then a grid of **company cards** (logo, name, type,
district, ERP/GST badges [real ERP; GST self-declared], follower count, "Hiring N
roles" pill when jobs exist, Follow + View). Reuse the marketplace grid rhythm +
the ad rail. This is a restyle of `CompanyDirectoryScreen` into the card grid.

### 2b. Public company page (`/connect/company/[slug]` / our existing route)

Per `connect-company.jsx`, reconciled:

- **Head**: banner + logo + name + type + founded/people/followers + jobs/products
  counts + badges (ERP real; GST/Udyam self-declared) + "Hiring N" + "Open to bulk"
  status pills + Follow / Message (-> inbox) / WhatsApp(-> inbox).
- **Tabs**: Home / About / Posts / Products / Jobs / People / Reviews.
  - **Products** tab shows the page's **linked Storefront** products (reuse
    `StorefrontView` / `ListingGridCard`) - NOT products on the company directly
    (the storefront split). "View shop" deep-links to the storefront.
  - **Jobs** tab = the page's open jobs (reuse the job card).
  - **People** = team members who list this workspace as Experience (consent).
  - **Reviews** = reviews-after-deal (net-new, marketplace Phase C; show the
    "unlocked after both confirm a deal" explanation, empty until then).
- **About / industry details** (embroidery-specific, locked section):
  Specialisation / Machine capacity / Production-per-month / Languages.
- **Right rail**: the **ERP-linked stats panel** (navy; "not self-reported -
  drawn from a running ERP workspace": karigars on payroll, attendance ledger,
  payroll figure) - REAL via the ERP link; page admins; recommendations (reviews,
  net-new); similar workshops.

### Real-now vs net-new

- Real: directory grid, page head + badges (ERP), tabs, products-via-storefront,
  jobs tab, people, about/industry details, ERP stats panel.
- Net-new (flagged): GST/Udyam badge data, reviews/recommendations, "Open to bulk"
  status field, follower counts (if not tracked).

---

## 3. Notifications - `/connect/notifications` (current: `NotificationsScreen`)

No handoff design (only a nav bell badge). Design on our system + the design
decisions (grouped, batched, deep-linked - which we already partly ship):

- **Header**: "Notifications" + "Mark all read" + a Preferences link (exists).
- **Filter chips**: All / Unread / Mentions / Inquiries / Jobs / Network /
  System (map to our notification categories).
- **Grouped list**: rows with actor avatar, the batched message (§12.3 batching we
  ship), relative time, an unread dot, and a deep-link (we just wired inquiry ->
  inbox thread). Each row routes via the existing `notificationHref` resolver.
- **Empty + loading + error** states (loading.tsx exists).
- Right rail: keep the ad rail; a "notification preferences" quick panel.
  This is mostly a **restyle** of `NotificationsScreen` to the card/rail rhythm +
  the filter chips; the data + routing already exist.

---

## 4. Pages - `/connect/pages` (current: `CompanyPagesHub`) - the admin hub

The handoff `connect-entity-admin.jsx` already reflects the company/storefront
split (it has `CompanyPageAdmin`, `StorefrontAdmin`, `ERPLinkSettings`,
`CreateCompanyPage`, `CreateStorefront`). `/connect/pages` = the owner's **Company
Pages** management hub (Storefronts have their own hub at `/connect/stores`).

### Proposed design

- **Hub** (`/connect/pages`): the owner's company pages as cards (logo, name,
  followers, jobs/posts counts, ERP-linked chip, "View public" + "Manage"), a
  "Create company page" CTA, and an activation checklist when empty (mirrors the
  Storefronts hub we built).
- **Manage a page** (`/connect/pages/[id]`): a tabbed console mirroring
  `ManageStorefrontScreen` (Overview / Posts / Jobs / People / Settings):
  - Overview: glance stats (followers, posts, open jobs, page views), the public
    URL row (the refined copy-row we built), "View public page".
  - Posts: manage the page's posts.
  - Jobs: the page's posted jobs + (later) the ATS.
  - People: team members on the page.
  - Settings: name/description/logo/banner/industry-details + **ERP link** (link
    the page to an ERP workspace -> drives the ERP-linked badge + stats) + GST/
    Udyam capture (self-declared now) + delete.
- **Create company page** (`connect-entity-admin` CreateCompanyPage): name, public
  URL (slug), industry, team size, based-in, one-line description - in a modal or
  page, mirroring the storefront create form.

### Real-now vs net-new

- Real: hub cards + create + manage tabs + public URL row + ERP link + settings.
- Net-new (flagged): ATS in the Jobs tab, GST/Udyam verification, page-view
  analytics if not tracked, the storefront<->company linking UI (the model
  supports `companyPageId` on the storefront already).

---

## Build sequencing (when implementing later)

Ordered by gap-vs-handoff (biggest visible win first), each a restyle that must not
break the working module (verify continuously, mirror the marketplace approach):

1. **Jobs Find tab** - biggest gap: today a single `Segmented` list; restyle
   `JobBoard` to the 3-column layout + the wage-strip `JobCard` + a filter rail on
   the real facets (category/district/wageType). Highest visible win.
2. **Companies public page** - today a single scroll; add the tab bar (Home /
   About / Products / Jobs / Posts) and the **Products tab** = the linked
   storefront's products (wire a "storefronts by companyPageId" query, reuse
   `ListingGridCard`). People / Reviews tabs are net-new (later).
3. **Companies directory** - light restyle of `CompanyCard` to the marketplace
   grid rhythm; mostly done.
4. **Notifications** - already at the bar; OPTIONAL: add category filter chips
   (Network / Posts / Inquiries / Jobs) derived from the existing `classify()`
   tagKey (real data, no fabrication). Skip if low value.
5. **Pages hub + manage console** - already mirrors storefronts; OPTIONAL: a tab
   bar on `ManageCompanyPageScreen` (Overview / Posts / Jobs / Settings) + an
   ERP-link control in Settings.

Net-new data features stay their own phases AFTER the restyle (no fabricated
signals): Jobs skills/machineType/alerts/Nvites/candidates/salary-benchmark;
Companies GST/hiring-status/People/Reviews/ERP-stats.

Net-new data features (ratings/reviews, ATS, alerts, Nvites, candidate search,
salary benchmark, GST verification, phone/WhatsApp) are their own phases AFTER the
visual redesign, exactly like the marketplace epic - no fabricated signals.

## Non-negotiables

- Do not break the working Jobs / Companies / Notifications / Pages modules
  (restyle, reuse the state machines + actions).
- No fabricated data; a signal renders only once its feature ships.
- Ad rail preserved on every surface that has one.
- i18n ×4; reuse shipped components; follow the existing app structure.
