# Connect Product Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Git in this project:** the OWNER stages and commits all changes (both repos). Every "Commit" step below means **stage and hand off to the owner** - the executing agent runs NO `git commit`/`git push`. Both repos are unpushed worktrees on branch `zari360-connect`.

**Goal:** Let marketplace sellers attach free-form, self-describing product tags (e.g. _kanjivaram_, _tissue silk_, _3-ply zari_) that are created on first use, searchable immediately, and surface as browse filters automatically - with no admin approval - by reusing the existing `ConnectTag` registry and `TagService`.

**Architecture:** The 8-enum `category` stays the required coarse spine (no migration). A new additive `Listing.tags: string[]` stores canonical `ConnectTag` slugs. Listing create/edit resolves seller terms through `TagService.normalizeHashtags` (alias-fold) + `recordUsage` (create-on-first-use), exactly as post hashtags already do. Tags are indexed into the `connect_listings` Meili index as searchable + filterable attributes; browse facets rank tags by listing count (automatic, no stored approval state). The web form gets a tag combobox backed by the existing `GET /connect/tags/search` autocomplete.

**Tech Stack:** Backend NestJS + Mongoose + Meilisearch (`crewroster-backend/zari360-connect`); Web Next.js + AntD + next-intl (`crewroster-web/zari360-connect`). Tests: Vitest (`*.vitest.ts` colocated backend; `*.test.tsx` web).

**Spec:** `docs/superpowers/specs/2026-06-01-connect-custom-category-taxonomy-design.md`

**Repo roots (absolute):**

- Backend: `D:\Work\Projects\Personal\zari360\.worktrees\crewroster-backend\zari360-connect`
- Web: `D:\Work\Projects\Personal\zari360\.worktrees\crewroster-web\zari360-connect`

**Verification notes (project-specific):**

- Backend: test ONLY the touched files, e.g. `npx vitest run <file> --no-file-parallelism` (full suite OOMs). Typecheck via `npx nest build` (SWC), not whole-project `tsc`.
- Web: `npx vitest run <file> --no-file-parallelism`; typecheck `npx tsc --noEmit`; lint `npx eslint <files>`.
- No em-dashes anywhere (i18n, comments, copy). Use hyphen/period/comma.

---

## File Structure

**Backend (`crewroster-backend/zari360-connect`):**

- Modify `src/modules/connect/marketplace/schemas/listing.schema.ts` - add `tags` prop.
- Modify `src/modules/connect/marketplace/marketplace.types.ts` (or wherever `CreateListingInput`/`UpdateListingInput` live) - add optional `tags`.
- Modify `src/modules/connect/marketplace/dto/create-listing.dto.ts` + `update-listing.dto.ts` - validated `tags`.
- Modify `src/modules/connect/marketplace/services/listing.service.ts` - resolve+record tags on create/update; add `tags` to `EDITABLE_FIELDS`.
- Modify `src/modules/connect/marketplace/marketplace.module.ts` - import the tags module so `TagService` injects.
- Modify `src/modules/connect/search/search-index.registry.ts` - add `tags` to listing index searchable + filterable attributes.
- Modify `src/modules/connect/search/listing-search.helpers.ts` - map `tags` into the indexed doc; support a `tags` filter clause; expose tag facets.
- Modify `src/modules/connect/search/dto/search-query.dto.ts` - accept `tags`.

**Web (`crewroster-web/zari360-connect`):**

- Modify `features/connect/marketplace/marketplace.types.ts` - `tags` on `CreateListingInput`, `ListingDetail`, `OwnerListing`.
- Modify `features/connect/marketplace/ListingForm.tsx` (+ `.css`) - tag combobox.
- Create `features/connect/marketplace/tag.actions.ts` - server action wrapping `GET /connect/tags/search`.
- Modify `features/connect/marketplace/ListingFacetPanel.tsx` - tag filter chips.
- Modify `features/connect/search.types.ts` - `tags` on the listing facet filter type.
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` - new copy.

---

## BACKEND

### Task B1: Add `tags` to the Listing schema + types + DTOs

**Files:**

- Modify: `src/modules/connect/marketplace/schemas/listing.schema.ts` (after the `images` prop, ~line 165)
- Modify: `src/modules/connect/marketplace/dto/create-listing.dto.ts`
- Modify: `src/modules/connect/marketplace/dto/update-listing.dto.ts`
- Modify: the `CreateListingInput` / `UpdateListingInput` interfaces (grep to locate; likely `marketplace.types.ts` in the marketplace module)
- Test: `src/modules/connect/marketplace/schemas/__tests__/listing.schema.vitest.ts` (create if absent; else add a case)

- [ ] **Step 1: Write the failing test** - a listing persists a `tags` array, defaulting to `[]`.

```ts
// listing.schema.vitest.ts
import { describe, it, expect } from 'vitest';
import { ListingSchema } from '../listing.schema';

describe('Listing schema tags', () => {
  it('declares a tags string array defaulting to empty', () => {
    const path = ListingSchema.path('tags');
    expect(path).toBeDefined();
    expect(path!.instance).toBe('Array');
    // default is an empty array
    expect(ListingSchema.path('tags').getDefault?.() ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/connect/marketplace/schemas/__tests__/listing.schema.vitest.ts --no-file-parallelism`
Expected: FAIL - `tags` path undefined.

- [ ] **Step 3: Add the schema prop** (after the `images` prop in `listing.schema.ts`):

```ts
  /** Seller-applied product tags (canonical ConnectTag slugs). The flexible,
   *  searchable layer over the coarse `category`; see the product-tags spec. */
  @Prop({ type: [String], default: [] })
  tags: string[];
```

- [ ] **Step 4: Add `tags` to the input interfaces** - in the `CreateListingInput` and `UpdateListingInput` types, add:

```ts
  /** Raw seller-entered terms; the service resolves them to canonical slugs. */
  tags?: string[];
```

- [ ] **Step 5: Add validated `tags` to both DTOs** - in `create-listing.dto.ts` and `update-listing.dto.ts`, mirror the existing optional-array validation style (e.g. how `images` is validated):

```ts
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
```

(Add any missing imports from `class-validator`: `IsArray`, `ArrayMaxSize`, `IsString`, `MaxLength`, `IsOptional`.)

- [ ] **Step 6: Run the schema test to verify it passes**

Run: `npx vitest run src/modules/connect/marketplace/schemas/__tests__/listing.schema.vitest.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx nest build`
Expected: build succeeds.

- [ ] **Step 8: Commit** (stage; owner commits)

```bash
git add src/modules/connect/marketplace/schemas/listing.schema.ts src/modules/connect/marketplace/dto/create-listing.dto.ts src/modules/connect/marketplace/dto/update-listing.dto.ts
# + the input-types file
```

Message: `feat(connect): add Listing.tags field + DTO validation`

---

### Task B2: Resolve + record tags on listing create/update

**Files:**

- Modify: `src/modules/connect/marketplace/services/listing.service.ts` (`create` ~173, `update` ~230, `EDITABLE_FIELDS`)
- Modify: `src/modules/connect/marketplace/marketplace.module.ts` (import the tags module)
- Test: `src/modules/connect/marketplace/services/__tests__/listing.service.tags.vitest.ts` (create)

The pattern to mirror is how posts wire tags: `TagService.normalizeHashtags(raw)` returns canonical slugs, and `TagService.recordUsage(slugs, userId)` creates open tags on first use. Grep `recordUsage` in the feed/post service for the exact call site to copy.

- [ ] **Step 1: Write the failing test** - create resolves raw terms via `TagService` and stores the slugs.

```ts
// listing.service.tags.vitest.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Use the repo's @nestjs/mongoose decorator-mock pattern (see
// auth.service.audit.vitest.ts) to instantiate ListingService with mocked deps.

const tagService = {
  normalizeHashtags: vi.fn(async (raw: string[]) =>
    raw.map((r) => r.toLowerCase().replace(/\s+/g, '-')),
  ),
  recordUsage: vi.fn(async () => undefined),
};

describe('ListingService tags on create', () => {
  beforeEach(() => {
    tagService.normalizeHashtags.mockClear();
    tagService.recordUsage.mockClear();
  });

  it('resolves raw terms to slugs, records usage, and stores slugs', async () => {
    const { service, created } = makeServiceWithCreateCapture({ tagService });
    await service.create('owner1', {
      title: 'Heavy zari saree',
      category: 'weaving',
      tags: ['Kanjivaram', '3 ply zari'],
    });
    expect(tagService.normalizeHashtags).toHaveBeenCalledWith(['Kanjivaram', '3 ply zari']);
    expect(tagService.recordUsage).toHaveBeenCalledWith(['kanjivaram', '3-ply-zari'], 'owner1');
    expect(created.tags).toEqual(['kanjivaram', '3-ply-zari']);
  });
});
```

(`makeServiceWithCreateCapture` is a local helper that builds `ListingService` with mocked `listingModel.create` capturing the payload, plus stub `allowances`, `storefronts`, `audit`, `posthog`. Follow the decorator-mock example in `src/modules/auth/__tests__/auth.service.audit.vitest.ts`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/connect/marketplace/services/__tests__/listing.service.tags.vitest.ts --no-file-parallelism`
Expected: FAIL - tags not resolved/stored; `tagService` not called.

- [ ] **Step 3: Inject `TagService`** - add it to the `ListingService` constructor (mirror an existing injected service), and import the tags module in `marketplace.module.ts` so the provider resolves:

```ts
// marketplace.module.ts imports: [ ..., ConnectTagsModule ]
```

- [ ] **Step 4: Resolve + record in `create`** - before `this.listingModel.create({...})`, add:

```ts
const tagSlugs = input.tags?.length ? await this.tagService.normalizeHashtags(input.tags) : [];
if (tagSlugs.length) void this.tagService.recordUsage(tagSlugs, ownerUserId);
```

and add `tags: tagSlugs,` to the `listingModel.create({...})` payload.

- [ ] **Step 5: Handle tags in `update`** - `tags` cannot be a blind `EDITABLE_FIELDS` copy (raw terms must be resolved). In `update`, before the `EDITABLE_FIELDS` loop, resolve and assign explicitly, and ensure `tags` is NOT in `EDITABLE_FIELDS`:

```ts
if (patch.tags !== undefined) {
  const slugs = patch.tags.length ? await this.tagService.normalizeHashtags(patch.tags) : [];
  if (slugs.length) void this.tagService.recordUsage(slugs, ownerUserId);
  (listing as unknown as Record<string, unknown>).tags = slugs;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/modules/connect/marketplace/services/__tests__/listing.service.tags.vitest.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 7: Typecheck** - `npx nest build` → succeeds.

- [ ] **Step 8: Commit** (stage; owner commits) - `feat(connect): resolve + record listing tags via TagService on create/update`

---

### Task B3: Index `tags` into the listings Meili index

**Files:**

- Modify: `src/modules/connect/search/search-index.registry.ts` (listings block, ~lines 99-120)
- Modify: `src/modules/connect/search/listing-search.helpers.ts` (the listing→doc mapper, ~line 143)
- Test: `src/modules/connect/search/__tests__/listing-search.helpers.vitest.ts` (add a case)

- [ ] **Step 1: Write the failing test** - the indexed doc carries `tags`.

```ts
it('maps listing.tags into the search document', () => {
  const doc = toListingDoc({
    /* minimal listing */ _id: 'L1',
    title: 't',
    category: 'weaving',
    images: [],
    tags: ['kanjivaram'],
  } as never);
  expect(doc.tags).toEqual(['kanjivaram']);
});
```

(Use the exact `toListingDoc`/builder name + minimal fixture already used by neighbouring tests in this file.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/connect/search/__tests__/listing-search.helpers.vitest.ts --no-file-parallelism`
Expected: FAIL - `doc.tags` undefined.

- [ ] **Step 3: Add `tags` to the doc type + mapper** - in `listing-search.helpers.ts`, add `tags: string[]` to the indexed-doc interface and `tags: listing.tags ?? [],` to the builder (next to `images: listing.images ?? []`).

- [ ] **Step 4: Register the attribute** - in `search-index.registry.ts` listings block, add `'tags'` to `searchableAttributes` (after `'category'`) and to `filterableAttributes`:

```ts
    searchableAttributes: ['title', 'description', 'category', 'tags'],
    filterableAttributes: [ 'category', 'tags', /* ...existing... */ ],
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/modules/connect/search/__tests__/listing-search.helpers.vitest.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 6: Typecheck** - `npx nest build` → succeeds.

- [ ] **Step 7: Commit** (stage; owner commits) - `feat(connect): index listing tags (searchable + filterable) in Meili`

> **Owner ops note:** existing listings must be **reindexed** once for `tags` to populate the index (run the existing listings reindex/provision command). New/edited listings index automatically.

---

### Task B4: Tag filter + tag facets in listing search

**Files:**

- Modify: `src/modules/connect/search/dto/search-query.dto.ts` - accept `tags`
- Modify: `src/modules/connect/search/listing-search.helpers.ts` - filter clause + request `tags` facet
- Test: `src/modules/connect/search/__tests__/listing-search.helpers.vitest.ts` (add cases)

- [ ] **Step 1: Write the failing tests** - (a) a `tags` filter yields a Meili clause; (b) the search requests the `tags` facet.

```ts
it('builds a tags filter clause', () => {
  const filter = buildListingFilter({ tags: ['kanjivaram'] } as never);
  expect(filter).toContain('tags = "kanjivaram"');
});
```

(Match the existing `buildListingFilter`/`hasFacets` names + `quoteMeili` helper used in this file; mirror how `category` builds its clause at ~line 176.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/connect/search/__tests__/listing-search.helpers.vitest.ts --no-file-parallelism`
Expected: FAIL.

- [ ] **Step 3: Add `tags` to the search DTO** - in `search-query.dto.ts`, mirror the `category` facet field with an optional `tags?: string[]` (or repeated `tag` param), validated like other facets.

- [ ] **Step 4: Add the filter clause** - where `category` is turned into a Meili clause (~line 176), add (for each tag, AND-joined exact match):

```ts
if (filters.tags?.length) {
  for (const tag of filters.tags) clauses.push(`tags = ${quoteMeili(tag)}`);
}
```

Update `hasFacets` (~line 61) to also return true when `filters.tags?.length`.

- [ ] **Step 5: Request the tag facet** - in the Meili listing search call, add `'tags'` to the `facets` array so the response returns the tag distribution (listing count per tag) the web rail ranks by.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/modules/connect/search/__tests__/listing-search.helpers.vitest.ts --no-file-parallelism`
Expected: PASS.

- [ ] **Step 7: Typecheck** - `npx nest build` → succeeds.

- [ ] **Step 8: Commit** (stage; owner commits) - `feat(connect): tag filter + tag facet in listing search`

---

## WEB

### Task W1: Web types + tag autocomplete server action

**Files:**

- Modify: `features/connect/marketplace/marketplace.types.ts` - add `tags?: string[]` to `CreateListingInput`, `UpdateListingInput` (already a `Partial`), `ListingDetail`, `OwnerListing`/`AdminListing`.
- Create: `features/connect/marketplace/tag.actions.ts` - `searchTags(q)` server action calling `GET /connect/tags/search`.
- Test: `features/connect/marketplace/tag.actions.test.ts` (mock the http client; assert it calls the right path and returns `{ slug, label }[]`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/...serverHttp...', () => ({
  /* mock get -> { tags: [{ slug:'kanjivaram', label:'Kanjivaram' }] } */
}));
import { searchTags } from './tag.actions';

it('returns tag suggestions for a prefix', async () => {
  const res = await searchTags('kanj');
  expect(res.ok).toBe(true);
  if (res.ok) expect(res.data[0].slug).toBe('kanjivaram');
});
```

(Mirror the http + `ActionResult` pattern in `marketplace.actions.ts`.)

- [ ] **Step 2: Run to verify it fails** - `npx vitest run features/connect/marketplace/tag.actions.test.ts --no-file-parallelism` → FAIL (module missing).

- [ ] **Step 3: Add `tags` to the types** - in `marketplace.types.ts`:

```ts
// on CreateListingInput:
  /** Raw seller-entered product terms; backend resolves to canonical slugs. */
  tags?: string[];
// on ListingDetail and AdminListing:
  tags?: string[];
```

- [ ] **Step 4: Implement `tag.actions.ts`**

```ts
'use server';
import { serverHttp } from '@/lib/...'; // mirror marketplace.actions.ts
import { unwrapServer, toError } from '@/lib/...';

export interface TagSuggestion {
  slug: string;
  label: string;
}

export async function searchTags(
  q: string,
): Promise<{ ok: true; data: TagSuggestion[] } | { ok: false; error: string }> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/tags/search', { params: { q } });
    const body = unwrapServer<{
      tags: { slug: string; labels?: { en?: string }; label?: string }[];
    }>(res);
    return {
      ok: true,
      data: (body.tags ?? []).map((t) => ({
        slug: t.slug,
        label: t.label ?? t.labels?.en ?? t.slug,
      })),
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

(Adjust the import paths + the response shape to the real `GET /connect/tags/search` payload - confirm the `tags[]` item shape from `tag.controller.ts`.)

- [ ] **Step 5: Run to verify it passes** - same command → PASS.

- [ ] **Step 6: Typecheck + lint** - `npx tsc --noEmit` (0 errors) and `npx eslint features/connect/marketplace/tag.actions.ts features/connect/marketplace/marketplace.types.ts`.

- [ ] **Step 7: Commit** (stage; owner commits) - `feat(connect): web listing tags type + tag autocomplete action`

---

### Task W2: Tag combobox on the listing form

**Files:**

- Modify: `features/connect/marketplace/ListingForm.tsx` - add a tags `Select` (mode `tags`, debounced async options via `searchTags`); include `tags` in the built payload + the snapshot.
- Modify: `features/connect/marketplace/ListingForm.css` - minor spacing if needed.
- Modify: `app/messages/{en,gu,gu-en,hi-en}.json` - labels.
- Test: `features/connect/marketplace/ListingForm.test.tsx` - assert the tags field renders and a selected tag is included in `onSubmit`.

- [ ] **Step 1: Write the failing test**

```tsx
it('includes selected tags in the submitted payload', async () => {
  const onSubmit = vi.fn();
  renderWithIntl(<ListingForm submitLabel="Save" submitting={false} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Heavy zari' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
  // open the tags select, type, and select/commit a free value:
  const tagsInput = screen.getByLabelText('Product types'); // label from i18n
  fireEvent.change(tagsInput, { target: { value: 'kanjivaram' } });
  fireEvent.keyDown(tagsInput, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['kanjivaram'] }),
      expect.anything(),
    ),
  );
});
```

(Mock `./tag.actions` `searchTags` to return `[]` so no network. AntD `Select mode="tags"` allows free entry; adjust the interaction to AntD's DOM if needed.)

- [ ] **Step 2: Run to verify it fails** - `npx vitest run features/connect/marketplace/ListingForm.test.tsx --no-file-parallelism` → FAIL.

- [ ] **Step 3: Add the field** - in `ListingForm.tsx`, in the Basics section under category, add an AntD `Select` with `mode="tags"`, debounced `onSearch` calling `searchTags`, options from suggestions, `maxCount={8}`, `value`/`onChange` wired to a `tags` form item. Include `tags` in `ListingFormValues`, in `handleFinish` (`if (values.tags?.length) input.tags = values.tags`), and in the `ListingSnapshot` emit.

- [ ] **Step 4: Add i18n** (all 4 locales) - `tagsLabel` ("Product types / specialities"), `tagsPlaceholder` ("Type to add, e.g. kanjivaram, tissue silk"), `tagsHelp` ("Add your own terms so buyers searching them find you."). No em-dashes.

- [ ] **Step 5: Run to verify it passes** - same command → PASS. Also re-run the existing `ListingForm.test.tsx` cases.

- [ ] **Step 6: Typecheck + lint + i18n parity** - `npx tsc --noEmit`; `npx eslint features/connect/marketplace/ListingForm.tsx`; verify all 4 locales have the new keys.

- [ ] **Step 7: Commit** (stage; owner commits) - `feat(connect): tag combobox on listing form`

---

### Task W3: Tag filter chips on the marketplace facet panel

**Files:**

- Modify: `features/connect/search.types.ts` - add `tags?: string[]` to the listing facet filter type.
- Modify: `features/connect/marketplace/ListingFacetPanel.tsx` - render tag chips (from the search response's tag facet, top ~12, scoped to the active category) → toggle `?tag=` in the URL, mirroring the category-pill pattern (`handleCategoryClick`).
- Modify: the marketplace browse screen if it must thread the tag facet from the search response to the panel.
- Modify: `app/messages/{en,gu,gu-en,hi-en}.json` - `facets.tagsTitle`.
- Test: `features/connect/marketplace/ListingFacetPanel.test.tsx` - a tag chip toggles the `tag` URL param.

- [ ] **Step 1: Write the failing test** - clicking a tag chip sets `?tag=<slug>`; clicking the active one clears it. Mirror the existing category-pill test in this file.

- [ ] **Step 2: Run to verify it fails** - `npx vitest run features/connect/marketplace/ListingFacetPanel.test.tsx --no-file-parallelism` → FAIL.

- [ ] **Step 3: Implement** - add a "Product types" chip group below the category pills, fed by the tag facet (slugs + counts) the screen passes in; reuse the exact URL-param toggle pattern used for `category` (`params.set('tag', slug)` / `params.delete('tag')`). Single-select first (mirrors category); multi is a follow-up.

- [ ] **Step 4: Add i18n** (4 locales) - `facets.tagsTitle` ("Product types"). No em-dashes.

- [ ] **Step 5: Run to verify it passes** - same command → PASS.

- [ ] **Step 6: Typecheck + lint + i18n parity** - as above.

- [ ] **Step 7: Commit** (stage; owner commits) - `feat(connect): tag filter chips on marketplace facets`

---

## Self-Review (completed by plan author)

- **Spec coverage:** schema/types/DTO (B1) ✓; create+edit resolution via TagService, no admin gate (B2) ✓; searchable + facetable index (B3) ✓; tag filter + facet ranking (B4) ✓; web combobox via existing autocomplete (W1+W2) ✓; browse filter chips (W3) ✓; 4-locale i18n (W2,W3) ✓; coarse spine unchanged + no migration ✓ (no migration task needed; reindex flagged as an owner op in B3). Curated-seed tags (spec "open question, recommended") = optional follow-up, not blocking.
- **Placeholder scan:** code-bearing steps include code or a precise "mirror file:line" instruction; remaining unknowns (exact existing helper names, DTO validation style, http import paths) are explicitly flagged to confirm against the named file, not left vague.
- **Type consistency:** `tags: string[]` (canonical slugs) used consistently on schema, indexed doc, filter, and web types; `searchTags` returns `{ slug, label }[]` used by the combobox; the form emits raw terms, the backend resolves them - single direction, no signature drift.

## Execution note

This plan is **cross-repo**. Recommended order: B1→B2→B3→B4 (backend first so the web has fields + the autocomplete + facet to consume), then W1→W2→W3. The web autocomplete (W1) only needs the pre-existing `GET /connect/tags/search`, so W1/W2 can proceed in parallel with B3/B4 if desired.
