# Profile Experience - Company Link + Current Company - Design

- Date: 2026-06-10
- Surface: Connect profile (own `/connect/profile` + public `/u/[slug]`), experience editor
- Repos: `crewroster-backend` (additive field + populate + a name search) + `crewroster-web` (picker + display + header)
- Status: APPROVED (owner said go)

## 1. Problem

Work history (`ConnectExperienceItem`) is free text only (`workshop` name). LinkedIn lets a work entry LINK to a real Company Page (logo + clickable page + "employee of") and shows the CURRENT company up top near the name. We want the same, while keeping plain-text entries for companies not on our platform.

## 2. Decisions (incl. the owner's "on-platform vs not" point)

- Each work entry supports BOTH:
  - **Linked** - the company exists on our platform (a `CompanyPage`): store its id; show logo + clickable `/company/[slug]`.
  - **Free text** - the company is NOT on our platform: store just the typed name (today's behavior). No logo/link, still shows.
- The typed name (`workshop`) is ALWAYS stored as the display name, even when linked (so a renamed/removed page still renders a name; and it is the fallback). The link (`companyPageId`) is OPTIONAL and additive.
- **No auto-creation** of company pages from a typed name in v1 (avoids junk/unclaimed pages). If that company later joins the platform, a future pass can offer to link it.
- Like LinkedIn, **no admin approval** to link - anyone may claim to work at any public company page.
- **Current company is DERIVED**, not a new field: the ongoing entry (no `to` date), most recent `from` wins if several. Shown under the name with logo + link when linked.

## 3. Data model (backend, additive - no migration)

`ConnectExperienceItem` gains one optional field:

```ts
/** Optional link to a CompanyPage on the platform. null/absent = free-text only
 *  (company not on the platform). `workshop` stays the display name + fallback. */
@Prop({ type: Types.ObjectId, ref: 'CompanyPage', default: null })
companyPageId?: Types.ObjectId | null;
```

- `workshop` (required, free text) unchanged. Existing rows have no `companyPageId` -> render exactly as today.
- DTO (`update-connect-profile.dto.ts` ExperienceItemDto): add optional `companyPageId` (validate as Mongo id; reject non-ids).
- Web `ConnectExperienceItem` type + zod gain optional `companyPageId`.

## 4. Backend reads + search

- **Populate linked companies on profile read.** When the profile read returns experience, batch-resolve the distinct `companyPageId`s to `{ id, name, slug, logo }` and attach them so the client can render logo + link. Reuse the existing `CompanyPagePublicController` `GET .../refs?ids=` / `service.getRefs(ids)` batch lookup (confirm exact shape in planning) - call it inside the profile read assembly OR expose the refs to the web action which hydrates (mirror how the feed hydrates authors). Prefer server-side populate on the profile read so both own + public profiles get it in one round-trip.
  - Privacy: a linked page that is not `public` (or deleted) resolves to no ref -> the entry falls back to the plain `workshop` text (no leak).
- **Company name type-ahead for the picker.** The editor needs to search company pages by name. Reuse the existing public company browse (`GET connect/company-pages/browse`) IF it supports a name query; otherwise add a light `?q=<name>` prefix search returning `{ id, name, slug, logo }` (cap ~10). This is a name PICKER, NOT the hidden companies directory page - different surface, allowed.

## 5. Web

- **Experience editor** (`EditSectionModal.tsx` ExperienceFields): add a company field per entry - a search-select (AntD `Select showSearch` with debounced options from the name search). Selecting a result sets `companyPageId` + fills `workshop` with the page name. Typing a free name (no selection) keeps `companyPageId` null and `workshop` = the typed text. A small hint distinguishes "linked (shows logo)" vs "name only".
- **Experience list** (`ProfileView.tsx` ExperienceList): when the entry has a resolved company ref, render the company logo (small, `DsAvatar`/img) + the name as a link to `/company/[slug]`; else render the plain `workshop` text as today.
- **Current company in the header**: derive the ongoing entry; render a compact line under the name (e.g. a briefcase/logo + "Patel Embroidery Works", linked when linked). Sits in the Row 2 identity block (below the name/headline, above or near the counts). Owner with no current company: nothing (or a subtle add hint).

## 6. Module impact

~2: Profile (schema field + read populate + editor + list + header current-company) and Company Pages/entities (the name search + the existing `getRefs` populate). i18n for the new picker/labels (4 locales). Mobile reads `workshop` text - unaffected (additive).

## 7. Testing

- BE: experience schema accepts/defaults `companyPageId`; DTO validates it; profile read attaches company refs for linked entries and falls back for non-public/missing pages; name search returns matches.
- Web: editor sets `companyPageId` on select and clears on free text; ExperienceList renders logo+link when linked, plain text otherwise; header shows the derived current company; tsc/eslint/4-locale clean; no banned AntD v6 forms.

## 8. Rollout / risk

Low/additive. Old entries unchanged. The only judgment calls (free claim, no auto-create, derive current company) are decided above. "People who work here" reverse list on the company page is OUT of scope (future follow-up).
