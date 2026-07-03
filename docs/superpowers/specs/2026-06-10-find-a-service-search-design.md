# Find a Service - searchable services (phase B / option A) - Design

- Date: 2026-06-10
- Scope: reuse the existing Connect People search. Additive.
- Status: APPROVED (owner picked A, said go)

## 1. Goal

Make the profile "Services I provide" list FINDABLE: an employer/buyer types a service keyword in People search and gets people who offer it, with a "Providing services only" filter. No new pages, no taxonomy (services stay free-typed).

## 2. How it works (reuse the people search)

The Connect people search runs on a Meilisearch `connect_people` index (searchable: name/headline/skills; filters: skills/district/openToWork/openToHiring/erpLinked/experienceYears) with a Mongo regex fallback. We add:

- **services** to the index as a SEARCHABLE attribute (so a keyword matches a person's listed services).
- **providingServices** (= `openTo.customOrders`, the "Providing services" intent) as a FILTERABLE attribute (so the search can narrow to people who are providing services).

## 3. Backend changes (search module)

1. `search-index.registry.ts` PEOPLE_INDEX_DEF: add `'services'` to `searchableAttributes` (after skills - lowest rank) and `displayedAttributes`; add `'providingServices'` to `filterableAttributes`.
2. `search.service.ts` people document mapper - BOTH spots: `indexPerson` (~line 293) and the bulk `reindexAllPeople` (~line 353), plus the people-doc interface (~line 129). Add:
   - `services: string[]` = the profile's `services` titles (lowercased/trimmed; optionally include `note`), e.g. `(profile.services ?? []).map(s => s.title)` (+ notes joined if cheap).
   - `providingServices: boolean` = `profile.openTo?.customOrders ?? false`.
3. `people-search.helpers.ts`:
   - `PeopleSearchFilters`: add `providingServices?: boolean`.
   - `hasPeopleFilters`: include `providingServices`.
   - `buildPeopleMeiliFilter`: when `providingServices`, push `'providingServices = true'`.
   - `buildPeopleMongoConditions`: when `providingServices`, set `conditions['openTo.customOrders'] = true`.
   - Mongo fallback searchable text: the fallback people query matches name/headline/skills; extend it to also match `services.title` (regex) so a keyword finds services even with Meili off. (Confirm the fallback query shape in the service; add a `services.title` regex branch to the same `$or`.)
4. `dto/search-query.dto.ts`: add `providingServices?: boolean` (mirror the existing `openToWork` `@Transform(toBoolean) @IsBoolean()`).
5. The search service people path: read `query.providingServices` into the `PeopleSearchFilters` it builds (mirror how `openToWork` is threaded).
6. Reindex: `CONNECT_PROFILE_CHANGED -> indexPerson` already fires on every profile save, so saving services/Providing-services reindexes that person automatically. Existing indexed docs gain the new fields on their next save; a one-time `reindexAllPeople` backfills everyone (owner runs it, like other Meili reindex chores). NOTE this in the report - no migration, but a reindex is needed to backfill existing docs.

## 4. Web changes

1. `features/connect/search/FacetPanel.tsx`: add a "Providing services" toggle mirroring the existing `openToWork` toggle - writes `?providingServices=true`, drops it when off, included in the clear-all + `hasAnyFacet`.
2. The web search query/action + `SearchQueryDto` mirror: add `providingServices` to whatever params object the web sends (mirror `openToWork`).
3. A "Find a service" shortcut: a small chip/link on the people-search screen header (or the search empty state) that sets `?type=people&providingServices=true` - mirrors the "Find available karigars" shortcut. Optional but cheap; include it.
4. i18n (4 locales): `connect.search.providingServicesLabel` ("Providing services") + `providingServicesHelp` ("Show people offering services / job-work") + `findAServiceShortcut` ("Find a service") - mirror the `openToWorkLabel`/`openToWorkHelp` keys.

## 5. Module impact

Search only (BE index registry + service mapper x2 + helpers + DTO; web FacetPanel + query + i18n). Reuses the people search end to end. No new screens, no taxonomy.

## 6. Testing

- BE: `people-search.helpers` - `buildPeopleMeiliFilter`/`buildPeopleMongoConditions`/`hasPeopleFilters` handle `providingServices`. The people-doc mapper includes `services` + `providingServices` (extend the search service vitest). Index settings include the new attributes.
- Web: FacetPanel toggle writes/clears `?providingServices=true` (extend the FacetPanel test). i18n parity. tsc/eslint clean; no banned AntD v6.

## 7. Rollout / risk

Low/additive. A reindex (`reindexAllPeople`) is needed once to backfill `services`/`providingServices` onto already-indexed people (flag to owner); new saves index automatically. No schema/data migration. Free-typed services -> keyword search only (no category browse, deferred).
