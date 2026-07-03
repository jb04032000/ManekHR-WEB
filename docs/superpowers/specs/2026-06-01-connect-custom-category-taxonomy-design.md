# Connect marketplace: seller-created, searchable product tags

**Status:** Approved (design) · **Date:** 2026-06-01 · **Deciders:** Owner

> **Design change after a 360 codebase review (2026-06-01):** the original draft
> proposed a NEW `ConnectCategoryTerm` collection with bespoke dedup + promotion.
> A review of `crewroster-backend` found `ConnectTag` + `TagService` already
> implement that registry (canonical slug, per-locale labels, aliases, category,
> usageCount, create-on-first-use, autocomplete endpoint, Meili synonym merge) for
> post hashtags. Building a parallel collection would duplicate it and violate the
> reuse standard. This spec now **reuses `ConnectTag`**. The owner-approved
> behavior is unchanged; only the implementation is smaller.

## Problem

The marketplace category is a fixed enum of 8 coarse buckets. The textile trade is
far larger: sellers describe products as _kanjivaram_, _tissue silk_, _3-ply zari_,
_banarasi brocade_, _organza_. Those words are neither selectable nor searchable
today. The vocabulary is unknown up front, so it must grow from seller usage, and
buyers must find products by those words - automatically, with no admin approval.

## Decision

Keep the 8 coarse buckets as the required **spine** (preserves faceted browse, ad
targeting, existing listings - no migration). Let sellers attach free-form
**product tags** to a listing, reusing the existing **`ConnectTag`** registry and
**`TagService`**:

- A seller-typed term is **normalized + alias-folded to a canonical slug**
  (`TagService.normalizeHashtags`), so spelling variants collapse to one tag.
- A genuinely new term is **created on first use** as an open tag
  (`recordUsage`, `isCurated = false`) - **first-class and searchable immediately**,
  no pending state, no admin step.
- Browse **facet prominence is automatic and query-time**: the marketplace surfaces
  tags by popularity (listing-count from Meili facets, ranked with `usageCount`), so
  popular tags rise to filter chips without any stored approval transition.

This realizes the owner's choice - full custom, suggest-then-promote, no admin -
within the model the platform already uses for hashtags.

## Why reuse ConnectTag (not a new collection)

`ConnectTag` ([connect-tag.schema.ts](../../../../../crewroster-backend/zari360-connect/src/modules/connect/tags/schemas/connect-tag.schema.ts))
already has: `slug` (unique canonical), per-locale `labels` (en/gu/guEn/hiEn),
`aliases[]`, `category` (`material|technique|role|product|generic`), `usageCount`,
`trendingScore`, `isCurated`. `TagService` already has `normalizeHashtags`,
`recordUsage` (create-on-first-use + usage bump), and `autocomplete` exposed at
`GET /connect/tags/search?q=`. `ConnectTag.aliases` already merge into the Meili
synonym map. The marketplace work is to **attach tags to listings and index/facet
them** - the registry, normalization, create-on-use, autocomplete, and synonym
recall already exist and are shared with the feed.

## Scope

Cross-repo. No data migration (additive). A single coherent feature.

- **Backend (`crewroster-backend/zari360-connect`):** add `Listing.tags`; wire
  listing create/edit through `TagService`; index `tags` in the Meili listing
  index; add a `tags` filter + facet to listing search.
- **Web (`crewroster-web/zari360-connect`):** a tag combobox on the add/edit form
  (typeahead via the existing endpoint, free entry of new terms); tag filter chips
  on the marketplace; 4-locale i18n.

Out of scope for v1: admin merge/flag console; promoting a hot tag into a coarse
spine bucket; distinct-seller anti-gaming (see Risks); per-listing tag analytics.

## Data model

### Reuse `ConnectTag` (no new collection)

Listing tags are `ConnectTag` slugs - the same namespace as post hashtags, so the
vocabulary is unified across feed + marketplace (a tag like `kanjivaram` is one tag
everywhere). No schema change to `ConnectTag`.

### `Listing` schema change (additive)

- Add `tags: string[]` (canonical `ConnectTag` slugs; cap `MAX_TAGS = 8`; default
  `[]`).
- `category` (the 8-enum) is unchanged and remains **required** (the spine).

## Flows

### Attach tags (on listing create / edit)

1. Take the seller's entered terms (raw strings from the combobox).
2. `slugs = await tagService.normalizeHashtags(rawTerms)` - alias-fold + canonicalize
   (reuses the textile-terms dictionary + registry aliases).
3. `void tagService.recordUsage(slugs, sellerUserId)` - fire-and-forget; creates an
   open tag on first use and bumps `usageCount`. (Same call posts make.)
4. Store the resolved `slugs` on `listing.tags` (deduped, capped at `MAX_TAGS`).

### Search + browse

- Index `listing.tags` into the Meili listing doc
  ([listing-search.helpers.ts](../../../../../crewroster-backend/zari360-connect/src/modules/connect/search/listing-search.helpers.ts))
  as a **searchable** attribute (text recall, with alias recall already provided by
  the merged synonym map) and a **filterable/facet** attribute (filter chips +
  facet distribution).
- Add a `tags` filter to the listing search DTO + Meili filter clause (exact-slug),
  alongside the existing `category` filter.
- The marketplace returns the top tag facets (by listing count), optionally scoped to
  the active coarse `category`. No `pending/approved` field: every tag is searchable;
  popularity alone decides facet prominence. This is the automatic, admin-free
  "promotion".

## Web UI

- **Add/edit form ([ListingForm.tsx](../../../features/connect/marketplace/ListingForm.tsx)):**
  the coarse category picker stays. Add a "Product types / specialities" combobox
  below it: type-ahead calls `GET /connect/tags/search?q=` (existing) to suggest
  existing tags (so spelling converges); the seller may add a brand-new term.
  Selected terms render as removable chips, cap `MAX_TAGS`. Optional, never required.
  The create/edit payload sends the raw term strings; the backend resolves them.
- **Marketplace facet panel
  ([ListingFacetPanel.tsx](../../../features/connect/marketplace/ListingFacetPanel.tsx)):**
  tag filter chips (top tags, scoped to the active coarse category) -> `?tag=` /
  `?tags=`. Mirrors the existing single-select category-pill pattern.
- **i18n:** all new copy across en / gu / gu-en / hi-en. No em-dashes.
- States: empty (no suggestions yet), loading (typeahead), error (resolve failed ->
  keep typed text, allow retry). WCAG AA; combobox keyboard-navigable.

## Tunables (constants, not config UI in v1)

- `MAX_TAGS = 8` per listing.
- Tag-facet count shown on the marketplace: top `~12` by listing count.
- Autocomplete ranking is the existing `usageCount` desc, `trendingScore` desc.

## Consequences

**Easier:** niche products become discoverable; sellers self-describe in their own
words; a single tag vocabulary spans feed + marketplace; search recall improves via
the existing synonym map.

**New work:** `Listing.tags` + create/edit wiring; Meili index attribute + filter +
facet; web combobox + facet chips + i18n. All additive; small because the registry,
normalization, create-on-use, autocomplete, and synonyms already exist.

**To revisit later:** admin merge/flag console; promoting a hot tag into a coarse
spine bucket; distinct-seller anti-gaming; tag analytics; multi-select coarse
`category[]` (already a noted backend follow-up).

## Risks & mitigations

- **Messy/duplicate tags** -> `normalizeHashtags` alias-folds on entry; typeahead
  nudges reuse of existing tags; the curated seed + synonym groups anchor common
  spellings.
- **Gaming a tag into the facet** -> low harm now: tags never gate visibility (always
  searchable); they only affect facet-chip prominence. v1 ranks facets by listing
  count; a distinct-seller signal is a later refinement if abuse appears.
- **Vocabulary mixing feed + marketplace** -> intended; unified discovery. The
  `category` field on each tag keeps grouping coherent.
- **Index drift** -> tags ride the existing listing indexer; reindex path unchanged.

## Open questions (none blocking)

- Whether the marketplace facet should mix in `trendingScore` or rank purely by
  listing count. Start with listing count; tune later.
- Whether to seed a few curated textile tags (`isCurated = true`) so the typeahead is
  useful on day one before user tags accumulate. Recommended; cheap.
