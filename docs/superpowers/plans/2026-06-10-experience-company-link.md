# Experience Company Link + Current Company Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a profile work entry optionally LINK to a real `CompanyPage` (logo + clickable page) while keeping plain text for companies not on the platform, and show the derived "current company" near the name.

**Architecture:** Additive only. `ConnectExperienceItem` gains an optional `companyPageId` (ref CompanyPage); `workshop` free text stays the display name + fallback. The profile read batch-resolves linked pages to `{id,name,slug,logo}` via the existing `CompanyPageService.getRefs` (drops hidden/missing -> falls back to text). The editor gets a name type-ahead backed by a new lightweight company-name search endpoint. "Current company" is derived (the ongoing entry, no `to`). No migration; mobile keeps reading `workshop`.

**Tech Stack:** NestJS + Mongoose + class-validator + Vitest (backend); Next.js App Router + AntD v6 + next-intl + Vitest/RTL (web).

**Conventions (binding):** No git ops by the agent (owner commits; "Commit" steps are for the owner). Backend: typecheck via `npm run build`, module vitest `--no-file-parallelism`, every endpoint `JwtAuthGuard`/`@Public()` + DTO + throttle. Web: AntD v6 only, 4-locale parity, no em-dash, short what/links/gotcha comments, matching `loading.tsx` already exists. Work ONLY in the MAIN checkouts (`crewroster-backend`, `crewroster-web`), never `.worktrees`.

---

## File Structure

**Backend**

- Modify `connect/profile/schemas/connect-profile.schema.ts` - `ConnectExperienceItem.companyPageId`.
- Modify `connect/profile/dto/update-connect-profile.dto.ts` - `ExperienceItemDto.companyPageId`.
- Modify `connect/entities/services/company-page.service.ts` - `searchByName(q, limit)` returning `CompanyPageRef[]`.
- Modify `connect/entities/controllers/company-page-public.controller.ts` - `GET .../search?q=` (Public).
- Modify `connect/entities/dto/*` - a `SearchCompanyPagesDto` (q + optional limit) if the controller needs one (or inline `@Query`).
- Modify `connect/profile/connect-profile.service.ts` - populate `experienceCompanies` (a `Record<pageId, CompanyPageRef>` or attach onto each item) in `getPublicByUserId` + the own read path; inject `CompanyPageService` (or call its refs) `@Optional()`.
- Tests: `profile/__tests__/connect-profile.service.vitest.ts`, `entities/__tests__/company-page.service.*.vitest.ts` (extend/add).

**Web**

- Modify `features/connect/profile.types.ts` - `ConnectExperienceItem.companyPageId?`, and a `company?: CompanyPageRef` resolved field on the read shape (or a `companyRefs` map on the profile).
- Modify `features/connect/profile/profile-edit-schema.ts` - experience `companyPageId` optional.
- Create `features/connect/entities/company-page.actions.ts` addition OR `features/connect/profile.actions.ts` - `searchCompanyPages(q)` action.
- Modify `features/connect/profile/EditSectionModal.tsx` - company type-ahead in `ExperienceFields`.
- Modify `features/connect/profile/ProfileView.tsx` - `ExperienceList` logo+link; header current-company line.
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` - picker + current-company labels.

---

## Phase A - Backend

### Task A1: experience `companyPageId` schema + DTO

**Files:**

- Modify: `crewroster-backend/src/modules/connect/profile/schemas/connect-profile.schema.ts` (the `ConnectExperienceItem` class)
- Modify: `crewroster-backend/src/modules/connect/profile/dto/update-connect-profile.dto.ts` (the `ExperienceItemDto` class)
- Test: `crewroster-backend/src/modules/connect/profile/__tests__/connect-profile.schema.vitest.ts`

- [ ] **Step 1: failing test** (append):

```ts
it('experience accepts an optional companyPageId', () => {
  const model = mongoose.model('ConnectProfileExpCoTest', ConnectProfileSchema);
  const pid = new Types.ObjectId();
  const doc = new model({
    userId: new Types.ObjectId(),
    experience: [{ workshop: 'Patel Embroidery', companyPageId: pid }],
  });
  expect(String(doc.experience[0].companyPageId)).toBe(String(pid));
  const plain = new model({
    userId: new Types.ObjectId(),
    experience: [{ workshop: 'Local unit' }],
  });
  expect(plain.experience[0].companyPageId == null).toBe(true);
});
```

- [ ] **Step 2: run, verify FAIL** - `cd crewroster-backend && npx vitest run src/modules/connect/profile/__tests__/connect-profile.schema.vitest.ts --no-file-parallelism`
- [ ] **Step 3: implement** - in `ConnectExperienceItem`, after `workshop` (keep all existing fields):

```ts
/**
 * OPTIONAL link to a CompanyPage on the platform. `null`/absent = the company
 * is NOT on the platform (free-text only). `workshop` stays the display name +
 * fallback. Cross-module: resolved to {name,slug,logo} via CompanyPageService.getRefs
 * on the profile read; the web experience list renders the logo + /company/[slug] link.
 */
@Prop({ type: Types.ObjectId, ref: 'CompanyPage', default: null })
companyPageId?: Types.ObjectId | null;
```

In the DTO `ExperienceItemDto`, add:

```ts
@IsOptional()
@IsMongoId()
companyPageId?: string;
```

(import `IsMongoId` from class-validator.)

- [ ] **Step 4: run, verify PASS.**
- [ ] **Step 5: Commit (owner)**

```bash
git add src/modules/connect/profile/schemas/connect-profile.schema.ts src/modules/connect/profile/dto/update-connect-profile.dto.ts src/modules/connect/profile/__tests__/connect-profile.schema.vitest.ts
git commit -m "feat(connect): optional companyPageId on experience"
```

> NOTE: `update-connect-profile.dto.ts` `ExperienceItemDto` and the service `buildSectionPayload`/experience write path must carry `companyPageId` through. The service `update()` already `set`s the whole `experience` array from the DTO, so once the DTO field exists it persists. Confirm `experience` is in `UPDATABLE_FIELDS` (it is).

---

### Task A2: lightweight company-name search endpoint

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/services/company-page.service.ts`
- Modify: `crewroster-backend/src/modules/connect/entities/controllers/company-page-public.controller.ts`
- Test: `crewroster-backend/src/modules/connect/entities/__tests__/company-page.service.*.vitest.ts` (extend the existing service spec; if none, create `company-page.search.vitest.ts`)

Context: `getRefs(ids)` returns `CompanyPageRef = { id, name, slug, logo, ... }` and drops non-public pages. `browse` supports `q` but merges heavy cross-collection signals - too heavy for a type-ahead. Add a thin name search returning the same `CompanyPageRef` projection.

- [ ] **Step 1: failing test** - add a `searchByName` test (adapt to the service spec harness; read it first):

```ts
it('searchByName returns public pages whose name matches, capped', async () => {
  // seed public pages: "Patel Embroidery Works", "Patel Looms", "Shah Textiles"; one hidden "Patel Hidden"
  const res = await service.searchByName('patel', 5);
  const names = res.map((r) => r.name);
  expect(names).toContain('Patel Embroidery Works');
  expect(names).not.toContain('Patel Hidden'); // hidden excluded
  expect(res.length).toBeLessThanOrEqual(5);
});
```

- [ ] **Step 2: run, verify FAIL** - `cd crewroster-backend && npx vitest run src/modules/connect/entities/__tests__/ --no-file-parallelism` (target the file you added).
- [ ] **Step 3: implement** - service method (mirror how `getRefs` projects to `CompanyPageRef`; reuse that mapper if present):

```ts
/**
 * Lightweight name type-ahead for the profile experience company picker. Public
 * pages only (visibility 'public'), case-insensitive name prefix/substring,
 * newest-ish first, capped. Returns the same minimal CompanyPageRef shape as
 * getRefs. Cross-module: the web profile experience editor calls this.
 */
async searchByName(q: string, limit = 8): Promise<CompanyPageRef[]> {
  const term = (q ?? '').trim();
  if (term.length < 2) return [];
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const rows = await this.pageModel
    .find({ name: rx, visibility: 'public' })
    .select('name slug logo')
    .limit(Math.min(Math.max(limit, 1), 10))
    .lean<Array<{ _id: Types.ObjectId; name: string; slug: string; logo: string }>>()
    .exec();
  return rows.map((p) => ({ id: String(p._id), name: p.name, slug: p.slug, logo: p.logo }));
}
```

(Adapt `this.pageModel` to the service's actual model property; if `CompanyPageRef` requires more fields like `erpLinked`, set them to a safe default or reuse the existing ref mapper.)
Controller route - Public, declared BEFORE the `:slug` route (alongside `refs`/`browse`), with a throttle tier consistent with the other public reads:

```ts
/** Public: company-name type-ahead for the profile experience picker. */
@Public()
@Get('search')
search(@Query('q') q?: string, @Query('limit') limit?: string) {
  return this.service.searchByName(q ?? '', limit ? Number(limit) : 8);
}
```

- [ ] **Step 4: run, verify PASS.**
- [ ] **Step 5: `npm run build` clean.**
- [ ] **Step 6: Commit (owner)**

```bash
git add src/modules/connect/entities/services/company-page.service.ts src/modules/connect/entities/controllers/company-page-public.controller.ts src/modules/connect/entities/__tests__/
git commit -m "feat(connect): company-name search endpoint for experience picker"
```

---

### Task A3: populate linked companies on the profile read

**Files:**

- Modify: `crewroster-backend/src/modules/connect/profile/connect-profile.service.ts`
- Modify: `crewroster-backend/src/modules/connect/profile/connect-profile.module.ts` (provide `CompanyPageService` if not already importable; else inject the model + map inline)
- Test: `crewroster-backend/src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts`

Goal: the profile read returns the linked companies so the web can render logo + link without an extra round-trip. Attach a `experienceCompanies: Record<string, CompanyPageRef>` (keyed by pageId) onto the returned profile object (own + public reads). Hidden/missing pages are simply absent from the map -> web falls back to the `workshop` text.

> Injection: confirm whether `CompanyPageService.getRefs` is importable into the profile module without a cycle (mirror the `@Optional()` pattern used for reviews/connections). If a cycle, inject the `CompanyPage` model into `ConnectProfileService` and run the same `find({_id in ids, visibility:'public'}).select('name slug logo')` map locally. Pick the cycle-free option and document it.

- [ ] **Step 1: failing test** (append; adapt to harness):

```ts
it('attaches experienceCompanies for linked public pages, omits hidden/missing', async () => {
  // profile.experience = [{workshop:'A', companyPageId: pubId}, {workshop:'B', companyPageId: hiddenId}, {workshop:'C'}]
  // getRefs([pubId,hiddenId]) -> only pubId resolves
  const pub = await service.getPublicByUserId(subjectHex);
  expect(pub.experienceCompanies[String(pubId)]?.slug).toBeTruthy();
  expect(pub.experienceCompanies[String(hiddenId)]).toBeUndefined();
});
```

- [ ] **Step 2: run, verify FAIL.**
- [ ] **Step 3: implement** - after the profile lean fetch (in `getPublicByUserId`, and the own read if it returns experience), collect ids + attach:

```ts
private async attachExperienceCompanies<T extends { experience?: { companyPageId?: unknown }[] }>(profile: T): Promise<T & { experienceCompanies: Record<string, CompanyPageRef> }> {
  const ids = [...new Set((profile.experience ?? [])
    .map((e) => (e.companyPageId ? String(e.companyPageId) : null))
    .filter((x): x is string => !!x))];
  const refs = ids.length ? await this.companyRefs(ids) : [];
  const map: Record<string, CompanyPageRef> = {};
  for (const r of refs) map[r.id] = r;
  return { ...profile, experienceCompanies: map };
}
```

where `companyRefs(ids)` calls `companyPageService.getRefs(ids)` (or the local model map). Wire `attachExperienceCompanies` into `getPublicByUserId` (after the audience trim) and the own-profile read path. Return type widens to include `experienceCompanies`.

- [ ] **Step 4: run, verify PASS;** then `npm run build` clean.
- [ ] **Step 5: Commit (owner)**

```bash
git add src/modules/connect/profile/connect-profile.service.ts src/modules/connect/profile/connect-profile.module.ts src/modules/connect/profile/__tests__/connect-profile.service.vitest.ts
git commit -m "feat(connect): resolve linked companies on profile experience read"
```

---

## Phase B - Web

### Task B1: types + edit schema + search action

**Files:**

- Modify: `crewroster-web/features/connect/profile.types.ts`
- Modify: `crewroster-web/features/connect/profile/profile-edit-schema.ts` + its test
- Modify: `crewroster-web/features/connect/profile.actions.ts`

- [ ] **Step 1:** types - add to `ConnectExperienceItem`: `companyPageId?: string | null;`. Add to the profile read shapes (`ConnectProfile` + `PublicConnectProfile`/body) `experienceCompanies?: Record<string, CompanyPageRef>;` (import `CompanyPageRef` from the entities types where `getCompanyPageRefs` returns it - find it via the existing `feed.actions` import `from './entities/company-page.actions'`).
- [ ] **Step 2 (TDD):** edit-schema test - append:

```ts
it('experience accepts an optional companyPageId', () => {
  const r = connectProfileUpdateSchema.safeParse({
    experience: [{ workshop: 'X', companyPageId: '64b8f0000000000000000000' }],
  });
  expect(r.success).toBe(true);
});
```

Run `npx vitest run features/connect/profile/profile-edit-schema.test.ts` (FAIL), then add `companyPageId: z.string().optional().nullable()` to the experience object in the schema, re-run (PASS).

- [ ] **Step 3:** action - append to `profile.actions.ts`:

```ts
import type { CompanyPageRef } from './entities/company-page.actions'; // or wherever CompanyPageRef lives

/** Company-name type-ahead for the experience picker (public). */
export async function searchCompanyPages(q: string): Promise<ActionResult<CompanyPageRef[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/company-pages/public/search', { params: { q } });
    return { ok: true, data: unwrapServer<CompanyPageRef[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

(Confirm the exact base path the web uses for company-pages public reads by checking `entities/company-page.actions.ts` `getCompanyPageRefs`; match it.)

- [ ] **Step 4:** `npx tsc --noEmit` clean on changed files; `npx vitest run features/connect/profile/profile-edit-schema.test.ts` green.
- [ ] **Step 5: Commit (owner)** the three files.

---

### Task B2: experience editor company picker

**Files:**

- Modify: `crewroster-web/features/connect/profile/EditSectionModal.tsx` (`ExperienceFields`, `extractInitialValues` experience case, `buildSectionPayload` experience case)

- [ ] **Step 1: implement** - in `ExperienceFields`, add a company search-select ABOVE the existing `workshop` input (or replace the workshop field with a combined control). Minimal approach that keeps `workshop` as the stored name:

```tsx
// A debounced company type-ahead. Selecting a platform company sets
// companyPageId + fills workshop with its name; typing a free name leaves
// companyPageId null (company not on the platform). Links to: searchCompanyPages
// -> /connect/company-pages/public/search; the profile read resolves the logo+link.
<Form.Item name={[field.name, 'companyPageId']} hidden><Input /></Form.Item>
<Form.Item name={[field.name, 'workshop']} label={t('edit.workshop')}
  rules={[{ required: true, message: t('edit.workshopRequired') }, { max: 160, message: t('edit.workshopMax') }]}>
  <Select
    showSearch filterOption={false} allowClear
    placeholder={t('edit.workshopPlaceholder')}
    onSearch={handleSearch}        // debounced -> searchCompanyPages -> setOptions
    options={options}              // [{value: name, label: <logo+name>, data: {id,slug,logo}}]
    onSelect={(_, opt) => form.setFieldValue([... ,'companyPageId'], opt.data.id)}
    onChange={(val, opt) => { if (!opt) form.setFieldValue([...,'companyPageId'], null); }}
    mode={undefined}
  />
</Form.Item>
```

Implementation notes for the agent: AntD `Select showSearch` with `filterOption={false}` + `onSearch` (debounced ~300ms) calling `searchCompanyPages(q)`; map results to options carrying `{id,slug,logo}`. On select -> set the hidden `companyPageId`. Free typing without selecting must still set `workshop` to the typed text and leave `companyPageId` null - use AntD `Select` with `mode="tags"` capped to 1, OR an `AutoComplete` (simpler for free text + suggestions). **Prefer `AutoComplete`**: it natively allows a free typed value plus suggestion options; on choosing a suggestion set `companyPageId`, on free text clear it. Use whichever cleanly supports "free text OR pick a suggestion". Keep `workshop` required.
`extractInitialValues` experience case: add `companyPageId: e.companyPageId ?? null` per item. `buildSectionPayload` experience case: include `companyPageId: e?.companyPageId || undefined` per mapped item.

- [ ] **Step 2:** `npx tsc --noEmit` clean; `npx vitest run features/connect/profile` green; `npx eslint features/connect/profile/EditSectionModal.tsx` clean; banned-AntD self-check zero.
- [ ] **Step 3: Commit (owner).**

---

### Task B3: experience list logo + link + current company

**Files:**

- Modify: `crewroster-web/features/connect/profile/ProfileView.tsx` (`ExperienceList` + a new current-company line in the header Row 2)
- Modify: `crewroster-web/features/connect/profile/ProfileView.test.tsx`

- [ ] **Step 1: experience list** - `ExperienceList` receives `companies?: Record<string, CompanyPageRef>` (thread it from `ProfileView` via `profile.experienceCompanies`). For each item with `companyPageId` resolving in the map, render the company logo (small `DsAvatar`/img) + the company name as a `Link` to `/company/${ref.slug}`; else render the plain `workshop` text exactly as today.
- [ ] **Step 2: current company (header)** - derive: among `profile.experience`, the entries with no `to` (ongoing); pick the most recent `from`. Render a compact line in Row 2 (under the name/headline): a small briefcase icon (or the company logo if linked) + the workshop name, linked to `/company/[slug]` when `companyPageId` resolves. Hide when there is no ongoing entry.

```tsx
// Current company = the ongoing experience (no end date), most recent start.
const current = useMemo(() => {
  const ongoing = (profile.experience ?? []).filter((e) => !e.to);
  ongoing.sort((a, b) => (b.from ? +new Date(b.from) : 0) - (a.from ? +new Date(a.from) : 0));
  return ongoing[0] ?? null;
}, [profile.experience]);
```

Render under the headline when `current` exists: logo/icon + `current.workshop`, wrapped in a `Link` to `/company/${companies[current.companyPageId]?.slug}` when resolved.

- [ ] **Step 3: tests** - add to `ProfileView.test.tsx`: an experience entry with `companyPageId` present in `experienceCompanies` renders a link to `/company/<slug>` + the company name; an ongoing entry renders the current-company line. Keep existing tests green (fixtures already pass `experience: [...]`; add `experienceCompanies: {}` where the body type now requires it - mirror the earlier `openToDetails: {}` fixture fix).
- [ ] **Step 4:** `npx vitest run features/connect/profile` green; `npx tsc --noEmit` clean on ProfileView; `npx eslint` clean.
- [ ] **Step 5: Commit (owner).**

---

### Task B4: i18n (4 locales)

**Files:**

- Modify: `crewroster-web/app/messages/{en,gu,gu-en,hi-en}.json`

- [ ] **Step 1:** add under `connect.profile.edit` (or `connect.profile`): `companyLink` ("Company"), `companyLinkHint` ("Pick your company to show its logo, or just type the name"), and under `connect.profile`: `currentCompany` ("Current") if a label is needed. English shown; translate/transliterate gu/gu-en/hi-en, no em-dash. Keep JSON valid + key parity.
- [ ] **Step 2:** parity check: `node -e "['en','gu','gu-en','hi-en'].forEach(l=>{const m=require('./app/messages/'+l+'.json'); if(!m.connect.profile.edit.companyLink) throw new Error(l)})" && echo OK`
- [ ] **Step 3: Commit (owner).**

---

## Phase C - Verify

- [ ] **C1 backend:** `cd crewroster-backend && npx vitest run src/modules/connect/profile src/modules/connect/entities --no-file-parallelism` green; `npm run build` clean.
- [ ] **C2 web:** `cd crewroster-web && npx vitest run features/connect/profile` green; `npx tsc --noEmit` clean on changed files; `npx eslint` on changed files clean; banned-AntD self-check zero; i18n parity OK.
- [ ] **C3 owner smoke:** add a work entry, pick a platform company (logo + link show), type a non-platform name (plain text, no logo), set one as ongoing (current company shows under the name); open the public `/u/[slug]` and confirm the same; a hidden/removed linked company falls back to text.

---

## Self-Review

**Spec coverage:** §2 decisions (linked vs free text, no auto-create, derive current) -> A1 (optional field) + B2 (free-text-or-pick) + B3 (derive). §3 data model -> A1. §4 reads+search -> A3 (populate via getRefs) + A2 (name search). §5 web -> B2 (editor), B3 (list + header). §6 module impact -> profile + entities only. §7 testing -> tests in A1/A2/A3/B1/B3.

**Placeholder scan:** The AutoComplete-vs-Select choice in B2 is a named, bounded decision (prefer AutoComplete for free-text + suggestions) with a concrete fallback, not filler. Injection choice in A3 names the concrete options + how to pick. No "TODO"/"handle edge cases".

**Type consistency:** `CompanyPageRef { id, name, slug, logo }` used identically across A2/A3 (BE) and B1/B2/B3 (web). `companyPageId` optional everywhere (schema, DTO, web type, zod). `experienceCompanies: Record<pageId, CompanyPageRef>` consistent A3 -> B1 -> B3.

**In-task confirmations (not owner decisions):** exact `CompanyPageRef` import path on web; whether `CompanyPageService` injects cycle-free into the profile module (A3); the web company-pages public base path.
