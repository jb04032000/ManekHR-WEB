# Connect Targeting Rebuild — Canonical Location & Trade

- **Date:** 2026-06-14
- **Status:** Draft for owner review (no code yet)
- **Repos:** crewroster-web + crewroster-backend (Connect)
- **Owner decision:** "Full rebuild" — standardise how every member stores
  trade/location into one shared system app-wide, incl. data migration.

---

## 1. Problem (what's actually wrong today)

The boost "Who should see it?" step exposes a **hardcoded 12-city Gujarat
district list** and **10 title-case trade chips**. Underneath:

- **Member location is a single free-text `district` string** on `ConnectProfile`
  (no city/state; default `''`), set only in profile-edit via a plain text box,
  not collected at onboarding. (`connect-profile.schema.ts:275`)
- **Member trade is a free-text `skills[]` array** (no enum), set via a tags
  input with non-binding suggestions. (`connect-profile.schema.ts:266`)
- **The boost trade match is BROKEN.** The audience counter does an exact,
  case-sensitive `skills $in spec.sectors` (`ad-profile.source.ts:185`) while the
  delivery matcher compares `skills[0].toLowerCase()` against title-case sector
  values (`lib/targeting.ts:19`). Title-case "Weaving" never equals lowercase
  "weaving" → it matches almost nobody, and the "X members match" count does NOT
  agree with who would actually be shown the ad.
- The rest of Connect already solved this: **people search** matches location +
  skills with normalized (lowercased) comparison, and **marketplace** uses the
  self-expanding **ConnectTag** taxonomy with a "preset + add-your-own" typeahead.
  Boost is the only surface still on hardcoded lists + broken matching.

**Net:** can't target other states, can't use custom trades, and the trade
filter doesn't actually work.

## 2. Goal

One canonical, app-wide system for member **location** and **trade**, used by
profile capture, search, and boost targeting, with **consistent normalized
matching (count == delivery)**, supporting **all-India** locations and
**custom + multiple** trades, plus a **migration** of existing free-text data.

## 3. Canonical model

### Location

- Bundle a static **India State → District** dataset (36 states/UTs + ~780
  districts) as a single shared reference, mirrored FE/BE the way
  `LISTING_CATEGORIES` is. This is the master list the product is missing today.
- `ConnectProfile` gains structured `location { stateCode, district, city? }`:
  `stateCode` = standard state code, `district` = canonical district slug,
  `city`/area = optional free text. The legacy flat `district` is kept during
  migration, then derived/retired.
- **Capture:** cascading **State → District** select (+ optional city) in
  onboarding and profile-edit.
- **Match:** exact on canonical district slug (optionally state) — clean because
  both sides are now canonical.

### Trade

- Adopt the existing **ConnectTag** taxonomy as the member trade vocabulary:
  canonical lowercase slugs, aliases, per-locale labels, self-registering custom
  terms, `searchTags` typeahead, `normalizeHashtags`. (Already powers listing
  categories + tags.)
- **Capture:** the existing listing-style typeahead (preset + custom + multiple),
  storing canonical slugs; member `skills` fold through `normalizeHashtags`.
- **Match:** exact on slug.

### Boost engine

- Audience counter + delivery matcher both compare **canonical slugs** → fixes
  the current bug; the estimate and real delivery agree.
- (Optional) counter returns distinct present values so pickers can show "popular"
  options that always have members.

## 4. Consumers (all move to the canonical model)

- **Onboarding + profile-edit:** capture canonical location + trade.
- **People search facets:** state/district + trade on canonical values.
- **Boost targeting picker:** popular quick-picks + State→District +
  trade typeahead (custom + multiple). Retire `BOOST_DISTRICTS` / `BOOST_SECTORS`.

## 5. Migration (existing data — never lose it)

Run via the existing migration ledger (`MigrationRunnerService`, `npm run migrate`):

- **District:** fuzzy-map free-text `district` → canonical `{stateCode, district}`;
  unmatched values are kept as `city` + flagged for review.
- **Skills:** fold through `normalizeHashtags` → canonical slugs; keep originals
  where unmapped.
- Idempotent, fail-closed, reversible.

## 6. Out of scope (fast-follow, not this rebuild)

- Listings/jobs location canonicalization (they already carry structured
  free-text location; align later using the same dataset).
- Pincode / lat-long / map radius; non-India geography.

## 7. Risks & honest tradeoffs

- **YAGNI flag:** the member base is **Gujarat-today**. All-India geography is
  future-readiness + correctness, not immediate multi-state reach. The concrete,
  immediate wins are: fixing the broken trade match, enabling custom trades, and
  clean canonical data. Worth confirming you want the full all-India scope now vs
  the lighter "fix the bug + custom trades + free-text area" option.
- **Live data migration** of member profiles → must be additive, backfilled,
  reversible; staged behind the migration ledger.
- **Onboarding gains a location step** → keep it optional/skippable so the signup
  funnel doesn't drop.
- Cross-module surface (profile, search, boost) → phased to limit blast radius.

## 8. Phases (each gets its own plan + approval)

- **P1 — Foundations:** India dataset (shared) + additive `location` schema +
  trade normalize helpers + migration scaffolding. No UX change.
- **P2 — Capture:** onboarding + profile-edit pickers; run the backfill migration.
- **P3 — Consume:** boost picker + people-search on canonical values; fix + align
  the matching (counter == delivery); retire the hardcoded lists.
- **P4 — Verify/cleanup:** parity tests, retire legacy `district`, 4-locale i18n,
  live smoke.

## 9. Success criteria

- A member in any Indian state can be set up and targeted.
- An advertiser can target by any trade, including a custom one, and multiple.
- "X members match" equals who is actually delivered to.
- Existing members' location/trade preserved and mapped.
- All gates green; i18n complete across en/gu/gu-en/hi-en.

## 10. Open questions for owner review

1. Confirm **all-India now** vs trimming to the lighter fix (see §7 YAGNI flag).
2. Onboarding location step: **optional/skippable** (recommended) or required?
3. Should this rebuild also pull **listings/jobs** location onto the canonical
   dataset now, or keep that as the §6 fast-follow (recommended)?
