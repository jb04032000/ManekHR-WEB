# Company Directory Location Filter v2 - Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Git:** Per the owner's standing rule the assistant runs NO git; the owner stages/commits. "Commit" steps are omitted - verify with scoped checks instead.

**Goal:** Make the `/connect/companies` location filter scale (popular + search + show-more) and stop free-text district/city fragmentation (normalize-on-save), while keeping custom place entry.

**Architecture:** Backend gains a `distinctLocations` read + a public `/locations` endpoint, and normalizes/snaps district & city on write. Web gains a locations action, a search+popular+show-more rail, and autocomplete on the form's district/city fields. Approach B from the spec; Approach C (geo dataset) deferred.

**Tech Stack:** NestJS + Mongoose (BE), Next.js App Router + AntD v6 + cr- tokens + next-intl (web).

Spec: `docs/superpowers/specs/2026-06-04-company-directory-location-filter-design.md`

---

### Task 1: Backend - normalize + snap district/city on save

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/services/company-page.service.ts`
- Test: `crewroster-backend/src/modules/connect/entities/__tests__/company-page-location.helpers.vitest.ts` (new) OR extend an existing service spec for the pure helper.

- [ ] **Step 1:** Add a pure exported helper `normalizePlace(value: string): string` - `value.replace(/\s+/g, ' ').trim()`.
- [ ] **Step 2:** Add `private async canonicalPlace(field: 'location.district' | 'location.city', value: string): Promise<string>` - given a normalized value, find an existing public page whose `field` equals it case-insensitively (anchored regex, escaped); return the existing spelling if found, else the input.
- [ ] **Step 3:** In `create` and `update`, when `location` is provided, run district + city through `normalizePlace` then `canonicalPlace` before persisting (only when non-empty; empty stays '').
- [ ] **Step 4 (test):** Unit-test `normalizePlace` (" Surat City " -> "Surat City"; "surat" -> "surat"). canonicalPlace/create/update need a DB mock - cover with the existing decorator-mock pattern if cheap; otherwise assert the helper only and note the snap behavior is integration-verified.
- [ ] **Step 5:** Verify: `cd crewroster-backend && npx vitest run --no-file-parallelism <the spec>` → PASS; `npx nest build` → compiles.

### Task 2: Backend - `distinctLocations` service + DTO + public endpoint

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/services/company-page.service.ts`
- Modify: `crewroster-backend/src/modules/connect/entities/dto/company-page.dto.ts`
- Modify: `crewroster-backend/src/modules/connect/entities/controllers/company-page-public.controller.ts`

- [ ] **Step 1:** Service `async distinctLocations(field: 'district' | 'city', q: string | undefined, limit: number): Promise<Array<{ value: string; count: number }>>`. Aggregate public pages: `$match { visibility:'public', 'location.<field>': { $nin:[null,''] }, ...(q ? regex match) }`, `$group { _id: '$location.<field>', count }`, `$sort { count:-1, _id:1 }`, `$limit clampedLimit`. Map `_id -> value`. Escape `q` for regex; cap limit to 20.
- [ ] **Step 2:** DTO `DistinctLocationsDto`: `field` `@IsIn(['district','city'])`; `q?` `@IsString @MaxLength(120)`; `limit?` `@Type(Number) @IsInt @Min(1) @Max(20)`.
- [ ] **Step 3:** Controller `@Public() @Get('locations')` (declare BEFORE `:slug` so it isn't captured as a slug) calling `service.distinctLocations(query.field, query.q, query.limit ?? 10)`.
- [ ] **Step 4 (test):** vitest `distinctLocations` with a model mock: returns mapped/sorted/capped values; empty `q` returns top values.
- [ ] **Step 5:** Verify: `npx nest build` compiles; the new vitest passes.

### Task 3: Backend - bump district facet limit 12 -> 20

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/services/company-page.service.ts` (the district facet aggregation `.limit(12)`)

- [ ] **Step 1:** Change the district facet aggregation `$limit` / `.limit(12)` to `20`. (Specialization facet stays 12.)
- [ ] **Step 2:** Verify: `npx nest build`; existing `company-page.service.vitest.ts` still passes (`npx vitest run --no-file-parallelism <file>`).

### Task 4: Web - locations data action + type

**Files:**

- Modify: `crewroster-web/features/connect/entities/entities.types.ts` (add `LocationSuggestion = { value: string; count: number }`)
- Modify: `crewroster-web/features/connect/entities/company-page.actions.ts` (add `browseCompanyLocations(field, q?)`)

- [ ] **Step 1:** Add `export interface LocationSuggestion { value: string; count: number }`.
- [ ] **Step 2:** Add `export async function browseCompanyLocations(field: 'district' | 'city', q?: string): Promise<ActionResult<LocationSuggestion[]>>` calling `GET /connect/company-pages/public/locations` with `params { field, q, limit: 10 }`, returning `unwrapServer<LocationSuggestion[]>`.
- [ ] **Step 3:** Verify: `npx tsc --noEmit` (0 errors).

### Task 5: Web - directory rail: search + popular(8) + show-more

**Files:**

- Modify: `crewroster-web/features/connect/entities/CompanyDirectoryRail.tsx`

- [ ] **Step 1:** Add local state: `query` (search text), `results` (`LocationSuggestion[]`), `searching`, `expanded` (show-more). Debounce (~250ms) a call to `browseCompanyLocations('district', query)` when `query.trim().length >= 1`; clear results when empty.
- [ ] **Step 2:** Render a "Search area" `<input>` above the popular list (cr- token styled, cursor text). While there are results, render them as a clickable list (value + count) that calls `selectDistrict(value)`; show "No matching areas" (i18n) when a non-empty query yields none.
- [ ] **Step 3:** Popular checkboxes: show `districts.slice(0, expanded ? 20 : 8)`; if `districts.length > 8` render a "Show more (N)" / "Show less" toggle button (cr- token styled, cursor pointer).
- [ ] **Step 4:** Hide the popular list while a search query is active (search results take over), or render search results beneath the search box and keep popular below - pick: search results replace the popular list while `query` non-empty.
- [ ] **Step 5:** Verify: `npx eslint <file>`; `npx tsc --noEmit`.

### Task 6: Web - form district/city AutoComplete

**Files:**

- Modify: `crewroster-web/features/connect/entities/CompanyPageForm.tsx`

- [ ] **Step 1:** Replace the District `<Input>` and City `<Input>` with AntD v6 `<AutoComplete>` (allow free text). Each keeps its `Form.Item name` ("district"/"city"), `placeholder`, `maxLength` via `<Input>`-as-child or `options`.
- [ ] **Step 2:** Add debounced `onSearch` per field calling `browseCompanyLocations(field, text)` and mapping results to `options={[{ value }]}`. Local state for each field's options.
- [ ] **Step 3:** Free typing must still submit the typed value (AutoComplete passes the input string to the form value). No selection required.
- [ ] **Step 4:** Verify: `npx eslint <file>`; `npx tsc --noEmit`. Confirm no banned AntD v6 forms introduced.

### Task 7: i18n keys (4 locales)

**Files:**

- Modify: `crewroster-web/app/messages/{en,gu,gu-en,hi-en}.json` (`connect.companies.rail.*`)

- [ ] **Step 1:** Add keys: `searchAreaPlaceholder` ("Search area"), `showMore` ("Show more"), `showLess` ("Show less"), `noMatchingAreas` ("No matching areas"). Localize for gu/gu-en/hi-en.
- [ ] **Step 2:** Verify: `node scripts/check-i18n.js` → consistent.

### Task 8: Full verification

- [ ] BE: `npx nest build`; touched-module vitest with `--no-file-parallelism`.
- [ ] Web: `npx eslint <changed files>`; `npx tsc --noEmit` (0 errors); `node scripts/check-i18n.js`.
- [ ] Confirm existing `CompanyDirectoryScreen.test.tsx` + `CompanyCard.test.tsx` + browse-counts vitest still pass.

## Self-review

- **Spec coverage:** normalize-on-save (T1), distinct endpoint (T2), facet limit (T3), web action/type (T4), rail search+popular+show-more (T5), form autocomplete (T6), i18n (T7), verify (T8). All spec sections covered.
- **Types:** `LocationSuggestion { value, count }` used consistently across action + rail + form. Endpoint shape matches. `field` union `'district'|'city'` consistent BE DTO + web action.
- **Placeholders:** none - each task names exact files + concrete behavior.
- **Deferred (per spec):** geo dataset, multi-select, historical cleanup - intentionally not tasked.
