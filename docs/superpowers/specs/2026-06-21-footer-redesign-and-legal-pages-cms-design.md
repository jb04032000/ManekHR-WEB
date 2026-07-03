# Footer redesign + admin-managed legal pages — design

Date: 2026-06-21
Status: approved (owner decisions captured below); build in one pass.

## Goal

1. Clean up and upgrade the public marketing footer.
2. Replace the placeholder Terms pages with **admin-managed, dynamically
   rendered** legal/policy pages (Connect and ERP have separate documents).

## Owner decisions (this session)

- **No Legal column in the footer.** Legal links are removed from the footer.
  (The legal pages still exist and are reachable from signup/consent screens.)
- **Do it all in one pass** (footer + the full admin-managed legal-pages system).
- Instagram URL is `https://www.instagram.com/zari360app/`.

## Part 1 — Footer redesign (web only)

Remove from the footer: LinkedIn (social), the language switcher, the
registered-address line, "Careers" (Company), "Help center" (Resources), and the
whole Legal column. The empty Resources column is dropped; "Pricing" moves under
Company.

New column layout (keeps the existing `1.7fr repeat(4,1fr)` grid):

| Brand | Connect | ERP | Company | (4th slot now free) |
| ----- | ------- | --- | ------- | ------------------- |

- **Connect:** Overview `/connect`, Marketplace `/textile-marketplace`, Jobs `/textile-jobs`.
- **ERP:** Overview `/erp`, Team & attendance `/erp#team`, Finance & GST `/erp#finance`, Machines `/erp#machines`, Roles & access `/erp#roles`.
- **Company:** About us `/about`, Pricing `/pricing`, Contact `/contact`.
- Social row: **Instagram only**, real URL.

Files:

- `components/marketing/content.ts` — rewrite `FOOTER_COLUMNS` (connect / erp /
  company); set `FOOTER_SOCIAL` to Instagram only; set the real Instagram URL in
  `SOCIAL_LINKS`.
- `components/marketing/Footer.tsx` — drop `<LanguageMenu>` import + render and
  the `t('address')` line. Product dot colour now keyed per column (Connect =
  indigo on the Connect column, ERP = gold on the ERP column).
- `app/(marketing)/erp/page.tsx` — add `id` + `scroll-mt` anchors to the four
  pillar blocks (`team`, `finance`, `machines`, `roles`) so the ERP footer links
  resolve to real sections (no 404 / dead anchors).
- i18n (`app/messages/{en,gu,gu-en,hi-en}.json`) — restructure
  `marketing.footer`: new `cols` (connect, erp, company), new `links`
  (overview/erpOverview, marketplace, jobs, erpTeam, erpFinance, erpMachines,
  erpRoles, about, pricing, contact), `social` = instagram only. Remove unused
  keys (careers, help, termsConnect, termsErp, legal, resources, product,
  connect/erp old, linkedin) **and** the `address` key, keeping all four locales
  at parity (`check:i18n`). gu / gu-en / hi-en strings flagged for native review.

## Part 2 — Admin-managed legal pages (full-stack)

A minimal CMS: an admin creates/edits a legal document; the public site renders
the published version dynamically. Reuses the existing **admin Tiers** CRUD
pattern (`IsAdminGuard` + `@Public()` for the read) end to end.

### Backend (crewroster-backend) — new module `legal-pages`

`LegalPage` schema (`@Schema({ timestamps: true })`):

- `slug` (unique; `terms-connect` | `terms-erp` | `privacy-connect` | `privacy-erp`)
- `product` (`connect` | `erp`)
- `kind` (`terms` | `privacy`)
- `title` (string)
- `body` (string; Markdown authored by admin)
- `status` (`draft` | `published`, default `draft`)
- `version` (int, bumped on each publish), `effectiveDate` (Date, optional)

Endpoints:

- Admin (class `@UseGuards(JwtAuthGuard, IsAdminGuard)`): `GET /admin/legal-pages`,
  `POST /admin/legal-pages`, `PATCH /admin/legal-pages/:id`,
  `POST /admin/legal-pages/:id/publish`, `DELETE /admin/legal-pages/:id`.
  Audit each write via `AuditService.logEvent` (`AppModule.ADMIN`).
- Public: `GET /legal-pages/:slug` (`@Public()`) → returns the page **only when
  `status === 'published'`**, else 404. Never leaks draft content.

Migration: seed the four pages as `draft` with placeholder bodies so the public
routes have a row to resolve (renders the existing placeholder copy until an
admin publishes real content). DTOs use `class-validator`. Vitest: admin CRUD,
publish flips status + bumps version, public read returns published-only (draft
→ 404), audit logged.

### Web (crewroster-web)

- `lib/api/endpoints.ts` — `admin.legalPages` (+ id helpers) and a public
  `legalPages.bySlug(slug)`.
- `lib/actions/legal-pages.actions.ts` — server actions: list/get/create/update/
  publish/delete (admin) + `getPublishedLegalPage(slug)` (public read).
- `app/admin/legal-pages/page.tsx` — list + create/edit modal (slug, product,
  kind, title, body textarea, status) + Publish button. Copied from
  `app/admin/tiers/page.tsx`.
- Public render: `/terms/connect` + `/terms/erp` become dynamic (fetch the
  published terms page for that product; fall back to the current placeholder
  copy when none is published). Add `/privacy/connect` + `/privacy/erp` the same
  way. Body rendered as Markdown — add `react-markdown` (small, well-scoped) and
  render inside a `prose`-style wrapper; links open safely.

### Out of scope (YAGNI)

WYSIWYG editor (plain Markdown textarea), version-history UI (store `version`
int only), translated legal copy (English content for now), cookie/refund docs
(only terms + privacy now; the schema's `kind` leaves room to add later).

## Success criteria

- Footer: renders the new columns; Instagram-only social with the real URL; no
  LinkedIn / language switcher / address line / Careers / Help / Legal; ERP
  links scroll to real `/erp` sections. `tsc`, `eslint`, `check:i18n` green.
- CMS: admin can create → edit → publish a legal page; `GET /legal-pages/:slug`
  returns published-only; `/terms/connect` etc. render the published body (or the
  placeholder fallback). BE build + vitest green; migration applies cleanly.
- No git ops by assistant (owner stages + commits).
