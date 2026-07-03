# Connect Profile - "Open to" Intent Cards (LinkedIn-parity) - Design

- Date: 2026-06-09
- Surface: `/connect/profile` (own) and `/u/[slug]` (public), shared `ProfileView`
- Repos: `crewroster-web` (primary) + `crewroster-backend` (additive schema + endpoints)
- Status: APPROVED in principle (owner picked Approach A); pending spec review

## 1. Problem

The Connect profile reduces a member's commercial intent to four flat, read-only
pills (`openTo.work | hiring | deals | customOrders`). They carry no detail, no
audience control, and no action. A visitor cannot tell _what_ the person is
hiring for, _what_ job-work they take, or _do anything_ about it. The LinkedIn
reference shows the mature pattern: each active intent is a rich, scoped,
actionable card.

We already own the backend features these cards should drive (Jobs, RFQ/quotes,
marketplace inquiries, a view counter), so the right build wires the cards to
real flows rather than faking them.

## 2. Goals

1. Turn each active "open to" intent into a rich card: a one-line detail, an
   audience scope, and a real call-to-action wired to an existing module.
2. Differentiate the owner view (edit + manage) from the visitor view (act).
3. Add the supporting header touches from the reference: an avatar status
   ribbon, a single "Open to" manage button, a profile-views count, and an
   audience control per intent.
4. Full 4-locale parity (en / gu / gu-en / hi-en), accessible (WCAG AA),
   responsive, with loading/empty/error states.

## 3. Non-goals

- No new payments anywhere (honors `feedback_no_payments_in_billing` and the
  Connect monetization split). "Request a quote" / "Apply" reuse existing
  non-payment flows.
- No change to the `companies` directory (owner decision, not user-facing).
- Not redesigning Jobs, RFQ, or Inbox - only linking to them.
- The paused preferred-contact-channel UI stays paused.

## 4. Research summary (best-in-industry synthesis)

- **LinkedIn "Open to work / hiring".** A rich card per intent, with specifics
  (roles, location, detail) and an explicit **audience scope** - "everyone"
  vs "recruiters only". A status frame/ribbon rings the avatar. ~200M people
  use Open-to-work; "open" candidates see materially higher response rates.
  Takeaway: detail + audience scope + a status ribbon are the load-bearing
  parts, not the pill itself.
  Sources:
  - https://huntr.co/blog/linkedin-open-to-work
  - https://www.linkedin.com/top-content/career/leveraging-linkedin-for-job-opportunities/linkedin-open-to-work-visibility-for-recruiters/
  - https://www.coursera.org/articles/how-to-let-recruiters-know-youre-open-on-linkedin
- **B2B marketplaces (RFQ pattern).** A seller advertises capacity/intent; a
  buyer submits a structured request; the seller responds with terms. Quotes
  carry a status lifecycle (pending/open/answered/closed). Takeaway: the
  "Open to job-work / custom orders" card should open our existing RFQ create
  flow, not a generic contact form.
  Sources:
  - https://www.yo-kart.com/blog/request-for-quote-rfq-module-b2b-ecommerce-marketplaces/
  - https://www.rigbyjs.com/blog/b2b-marketplace-features
- **Our context (Surat/Gujarat textile trade).** Intents map cleanly to real
  roles: workshop owners _hire_ + take _job-work_; karigars are _open to work_;
  wholesalers/traders do _deals_. The cards should speak this vocabulary in all
  four locales.

## 5. The four intents and their wiring

Each intent, when enabled, renders a card. CTA targets are existing features:

| Intent (key)   | Card meaning                                        | Visitor CTA -> destination                                          | Owner CTA                                 |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| `hiring`       | "Hiring karigars" + live roles & applicant tally    | "Show roles & N applicants" -> the person's open jobs (apply)       | "Manage roles" -> their jobs / applicants |
| `customOrders` | "Open to job-work / custom orders" + what they take | "Request a quote" -> RFQ create (existing)                          | edit detail                               |
| `deals`        | "Open to deals" (buy/sell) + short line             | "Browse shop" / "Send inquiry" -> storefront or marketplace inquiry | edit detail                               |
| `work`         | "Open to work" (karigar) + role + rate card         | "Message" -> inbox DM; surfaces rate                                | edit detail                               |

Notes:

- `hiring` numbers come from the person's `Job` docs (`companyUserId`). Web
  already has `listMyJobs()` for the owner; a public read of a person's _open_
  jobs is needed for the visitor card (see §7).
- `work` "Message" uses the existing inbox `startInboxDm` path (already used by
  `ProfileConnectActions`). If a profile is the owner's own, the card shows the
  rate-card editor link instead.
- A card with an empty detail still renders (intent on, no blurb) - detail is
  optional, the intent boolean is the gate.

## 6. Data model change (logical - owner sign-off required)

**Decision (revised from the first draft): keep the four booleans untouched,
add a parallel additive field.** `openTo.{work,hiring,deals,customOrders}` are
read by search indexing (`people-search.helpers`), feed ranking
(`getRankingSignals` -> `default-additive.strategy`), and the PATCH DTO.
Reshaping them into objects would force lockstep changes across all those
readers and a data migration - high blast radius for no gain. Instead the
booleans stay the on/off gate exactly as today (so search / ranking / mobile /
strength are 100% untouched), and a new **additive** field carries the rich
data:

```ts
// embedded sub-doc, no _id
class ConnectOpenToDetail {
  detail?: string;                 // <= 160 chars, the card blurb (optional)
  audience: 'all' | 'network';     // default 'all'
}
// new top-level field on ConnectProfile, default {}
class ConnectOpenToDetails {
  work?: ConnectOpenToDetail;
  hiring?: ConnectOpenToDetail;
  deals?: ConnectOpenToDetail;
  customOrders?: ConnectOpenToDetail;
}
@Prop({ type: ConnectOpenToDetailsSchema, default: () => ({}) })
openToDetails: ConnectOpenToDetails;
```

Why this is safe:

- No migration. Existing documents read `openToDetails` as `{}` (all defaults).
- No reader changes. `openTo` booleans keep their exact meaning and shape.
- The PATCH DTO gains one optional nested field; the existing `OpenToDto`
  (booleans) is unchanged.

Card render rule: an intent shows a card when its boolean is `true`. The card's
detail line + audience come from `openToDetails[key]` (absent -> no blurb,
audience defaults to `all`).

Audience enforcement (`network`):

- `audience: 'network'` means the card is shown to the owner and to
  first-degree connections only; other viewers (and logged-out) do not see that
  intent's card at all. Enforced **server-side** in the public profile read: the
  public read accepts the optional viewer id (`req.user.sub`, absent when
  logged-out) and, for each `network`-scoped intent where the viewer is not a
  connection, suppresses both that `openTo` boolean and its `openToDetails`
  entry in the response. So the trim is real, not client-only.

## 7. Backend endpoints (additive)

1. **Profile views counter.** Extend `ConnectViewTargetType` with `'profile'`
   (currently `'storefront' | 'listing'`). On a public profile render, record a
   view (`recordView(viewer, 'profile', subjectUserId)`) - deduped per viewer
   per UTC day, self-views excluded. Add `profileViewSummary(ownerUserId)`
   returning `{ views7d, views30d, total }` for the owner header stat. Reuses
   the existing daily-rollup collection and dedupe path; no new schema beyond
   the enum value.
2. **Public open-jobs read for a person.** A visitor-facing
   `GET /connect/jobs/by-user/:userId/open` returning that person's `open` jobs
   (count + minimal cards) to power the Hiring card's "N roles, M applicants".
   If an equivalent read already exists at the planning step, reuse it instead
   of adding one (verify against `jobs.controller`).
3. No new endpoint for RFQ / inquiry / DM - the cards deep-link into the
   existing create flows.

All new endpoints: `JwtAuthGuard` (or `@Public()` for the public profile-view
record if logged-out views should count - default: only count signed-in
viewers, matching the existing viewer-is-authenticated model), DTO validation,
throttle tier, OTel span, PostHog on writes (`connect.profile_viewed` is a read
-> span only; intent edits emit `connect.profile_intent_updated`).

## 8. Frontend

New/changed components under `features/connect/profile/`:

- `IntentCards.tsx` - renders the active intents as cards; takes `profile`,
  `isOwner`, `viewerRelationship`, and per-intent live data (job counts). Owner
  sees edit pencils + a manage link; visitors see the action CTA. Empty owner
  state nudges "Tell people what you're open to".
- `AvatarStatusRibbon.tsx` - the small ribbon on the avatar (e.g. "HIRING").
  Picks one primary intent by priority (hiring > work > customOrders > deals).
- Header changes in `ProfileView.tsx`:
  - replace the flat open-to pill row with `IntentCards`;
  - add the avatar ribbon;
  - add an "Open to" manage button (owner) that opens the openTo edit modal;
  - add the profile-views stat into the existing `stats` row
    (`connections · followers · N profile views`);
  - "Edit cover" affordance on the banner for the owner (small button overlay).
- `EditSectionModal.tsx` `openTo` section: upgrade from four switches to four
  rows, each with an enable switch + a detail input (160 chars) + an audience
  select (Everyone / My network). Reuses the existing section-modal plumbing.

Loading/empty/error:

- `/connect/profile` and `/u/[slug]` `loading.tsx` skeletons gain the intent-card
  block and the views stat so the swap stays shift-free (binding loading-skeleton
  rule).
- Owner with no intents on: a single dashed "Add what you're open to" prompt.
- Visitor with no public intents: the section simply does not render.

## 9. Visitor perspective (the explicit ask)

- A logged-in visitor sees only intents whose `audience` allows them, each with
  a working CTA (apply / quote / inquiry / message).
- A logged-out visitor on `/u/[slug]` sees `audience: 'all'` cards; CTAs that
  need an account route through the existing "Join Connect" conversion path.
- The owner sees every card (regardless of audience) with edit + manage and a
  small "who can see this" hint per card.

## 10. i18n

New keys under `connect.profile.intents.*` (card titles, detail placeholders,
CTAs, audience labels, ribbon labels) and `connect.profile.counts.profileViews`.
Full parity across en / gu / gu-en / hi-en. No em-dash anywhere (hyphen/period).

## 11. Accessibility

- Cards are `<section>`s with headings; CTAs are real buttons/links with
  discernible names. Ribbon has an `aria-label`. Audience select is labelled.
  Keyboard order: card title -> detail -> CTA. AA contrast on the colored card
  backgrounds (tune card tints against `--cr-*` tokens, not raw colors).

## 12. Testing

- Web: unit tests for `IntentCards` (owner vs visitor vs logged-out; audience
  trimming; empty states) and the avatar-ribbon priority. Extend
  `ProfileView.test.tsx`.
- BE: vitest for the `openTo` legacy->object normalizer (both shapes in, object
  out), the audience trim in the public read, and `recordView('profile', ...)`
  dedupe + self-view exclusion. Test only the touched modules (resource rule).
- Typecheck via `nest build` (BE) and `tsc` (web changed files).

## 13. Rollout / risk

- The earlier `openTo`-reshape risk is GONE: the additive `openToDetails` model
  (§6) leaves the booleans and every reader untouched, so there is no migration
  and the mobile contract is unaffected.
- Confirmed during planning: the jobs controller has `mine` (owner) and
  `by-page/:pageId` (page) reads but NO person-level public open-jobs read, so
  the Hiring visitor card needs the new `by-user/:userId/open` endpoint (§7.2).
- Profile-view counting is best-effort (failure never breaks render), matching
  the existing `recordView` contract.

## 14. Open items to confirm during planning (not owner decisions)

1. Whether a person-level public open-jobs read already exists (reuse vs add).
2. Exact mobile contract dependency on the raw `openTo` booleans.
3. Whether logged-out profile views should count (default: no).

## 15. Owner sign-off needed on

- The `ConnectOpenTo` schema change (§6) - logical change.
- Two additive endpoints (§7) - logical change.

Everything else (card design, copy, CTA targets, audience default = everyone)
is the assistant's call per the build-philosophy directive.
