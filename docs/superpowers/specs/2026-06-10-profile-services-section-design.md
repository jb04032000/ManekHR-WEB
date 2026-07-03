# Profile "Services I provide" section (static MVP) - Design

- Date: 2026-06-10
- Scope: Connect profile only. Additive. No search, no discovery this phase.
- Status: APPROVED (owner picked A)

## 1. Goal

Let a member list the services they provide (freelancer / job-work layer, LinkedIn "Provide services" lite). Static and self-typed: the owner types each service; it shows on their profile. No search/taxonomy/status this phase (those are a later phase B).

## 2. Data shape (one new field, like portfolio)

`ConnectProfile.services: ConnectServiceItem[]` where:

```ts
class ConnectServiceItem {
  title: string; // required, <= 120 (e.g. "Computerized embroidery job-work")
  note?: string; // optional one-line, <= 160 (e.g. "Multi-head, bulk runs")
}
```

- Additive; default `[]`. No migration. Mobile keeps working (new field it can ignore).
- DTO: `ServiceItemDto` (title required @MaxLength 120; note optional @MaxLength 160) + `services?: ServiceItemDto[]` on `UpdateConnectProfileDto`. Add `'services'` to the service `UPDATABLE_FIELDS`.
- Mirror the existing `ConnectPortfolioItem` / `PortfolioItemDto` pattern exactly.

## 3. Web

- Types: `ConnectServiceItem` in `profile.types.ts`; add `services: ConnectServiceItem[]` to `ConnectProfile` (so `ConnectProfileBody` inherits) and `services?: ConnectServiceItem[]` to `UpdateConnectProfileInput`.
- zod (`profile-edit-schema.ts`): `services: z.array(z.object({ title: z.string().trim().min(1).max(120), note: z.string().max(160).optional() }))`.
- Editor (`EditSectionModal.tsx`): a new `'services'` section - a `Form.List` list editor (mirror `PortfolioFields`/`ExperienceFields`): each row = a `title` Input (required) + a `note` Input (optional), with add/remove. Add to `ProfileEditSection`, `sectionTitle`, `extractInitialValues` (`services` case), `buildSectionPayload` (`services` case: map title/note, filter `title.length>0`), and the `SectionForm` switch.
- Display (`ProfileView.tsx`): a new `ProfileSection` titled Services (icon e.g. lucide `Wrench` or `Sparkles`), rendered for `profile.services.length > 0 || isOwner`. Each service: title (semibold) + note (muted) below. Owner gets the section pencil -> `onEdit('services')` and an `EmptyHint` when empty (mirror the Skills/Portfolio sections). Place it near Skills / Experience.
- i18n (4 locales): `connect.profile.sections.services` ("Services"), `connect.profile.empty.services` ("List the services you provide"), `connect.profile.edit.serviceTitle` ("Service"), `edit.serviceTitlePlaceholder`, `edit.serviceNote` ("Short note"), `edit.serviceNotePlaceholder`, `edit.addService` ("Add a service"). No em-dash.

## 4. Non-goals (this phase)

- No services search / directory / discovery. No service taxonomy/tags. No "Providing services" status pill. No reviews wiring (the existing rating system already covers the person). All deferred to phase B.
- No payments.

## 5. Module impact

Profile only (schema + DTO + service + web types/zod/editor/display + i18n). Fully additive.

## 6. Testing

- BE: schema accepts/defaults `services`; DTO validates title required + lengths; `update()` persists it (services in UPDATABLE_FIELDS).
- Web: zod test (valid services parse; missing title rejected); editor list add/remove maps payload; ProfileView renders the services section (owner empty-hint + populated list). tsc/eslint/4-locale clean; no banned AntD v6.

## 7. Rollout / risk

Low/additive. Old profiles render no Services section (empty). Reuses the established portfolio/experience section pattern end to end.
