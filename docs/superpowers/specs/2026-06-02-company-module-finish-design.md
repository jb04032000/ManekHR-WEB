# Finish the Company module - surfaces 3 + 4 design

Date: 2026-06-02
Status: proposed (awaiting owner review)
Author: assistant (open-design + brainstorming)

## Context

The Company module's directory (surface 1) and public page (surface 2) are done. This finishes it with the last two owner-facing surfaces: the create/edit form (surface 3) and the manage console (surface 4), restyled to the canonical prototype (`connect-company-create.html`, `connect-company-manage.html`) with honest data only.

Both already exist in basic form: `features/connect/entities/CompanyPageForm.tsx` (a plain AntD modal form with every field) and `features/connect/entities/ManageCompanyPageScreen.tsx` at `/connect/pages/[id]` (Overview/Posts/Jobs/Settings tabs, stat tiles, public URL, ERP badge, post + job composers). This is a restyle and an enhancement, not a from-scratch build.

## Decisions (owner-confirmed)

- Form lives on a dedicated page with a live preview (not a modal).
- Manage console shows real stats only; the time-series analytics charts and the separate Analytics tab are dropped (no tracking data exists).

## Honest-data contract

Keep (real): the form fields (name, about, logo, banner, specialization, machineCapacity, production, languages, location, visibility); followers / posts-30d / open-jobs from `getMyCompanyPageStats`; the ERP-linked badge; the public URL + share + QR; post-as-page and job composers; a setup checklist computed from page completeness.

Drop or flag (no backing data): page views / post impressions / search appearances and the weekly-followers chart; the activity feed; a follower list; phone / contact reveal; GST and Udyam verification badges (ERP badge stays); "N connections also follow"; the pinned post; post reaction and comment counts; the multi-admin "Page Admins" section (the schema has a single `ownerUserId`); the People tab (needs employee-link plumbing); and in-page product management (products live in the Storefront per the locked model, so it becomes a "Manage in Storefront" link).

## Architecture

Reuse the existing `CompanyPageForm`, `CompanyCard` / `CompanyPageView` patterns, `KpiStrip`, the post + job composers, `qrcode.react` (already a dependency), `ConnectPage` / `Rail`, and the `Ds*` atoms. No backend change (all data already exists via the stats + CRUD endpoints).

## Slice 3 - create/edit form (dedicated page + live preview)

- Restyle `CompanyPageForm` into clear sections: Identity (name, logo, cover), About (about text + specialization tags), Capabilities (machineCapacity, production, languages), Location (district, city, state), Visibility (public / connections / hidden). Drop the prototype's Verification (GST/Udyam) and Page-Admins sections; keep the ERP-linked status as a read-only note when linked.
- New dedicated routes: `app/connect/pages/new/page.tsx` (create) and `app/connect/pages/[id]/edit/page.tsx` (edit, seeded by `getMyCompanyPage(id)`). A shared client `CompanyPageEditor` lays the page out two-column: the sectioned form on the left, a sticky `CompanyPagePreview` on the right that renders the form's live values (cover, logo initials, name, specialization, location, visibility) in the public-page card style.
- Actions: "Create page" / "Save changes" (primary) and "Save as draft" which sets `visibility: 'hidden'` (our honest equivalent of a draft; there is no separate draft status). On success, route to the manage console.
- Wire the entry points: the hub's "Create" button and the manage console's "Edit page" link to these routes instead of opening the modal. Keep the old modal path only if something else still uses it; otherwise retire it.

## Slice 4 - manage console (real stats, honest)

Enhance `ManageCompanyPageScreen`:

- Richer header: cover + logo with an Edit affordance (links to the edit page), page name + a status pill derived from `visibility`, a page-switcher when the owner has more than one page, the public URL strip (copy + view), and an owner pill. Header actions: Edit page, Post as Page, Share, and a More menu (View as buyer, Unpublish via visibility, Delete).
- KPI strip (reuse `KpiStrip`): Followers, Posts (30 days), Open jobs - the three real metrics from `getMyCompanyPageStats`. No fabricated views/impressions KPI.
- Setup checklist computed client-side from completeness (has logo, has cover, has about, has specialization, has a linked storefront or product, shared the link). Each item links to the relevant action.
- Share panel: public URL + copy + WhatsApp + a real QR code (`qrcode.react`), downloadable.
- Tabs: Overview (checklist + share + "needs attention"), About (the spec grid, read with an Edit link), Posts (existing composer + list), Jobs (existing composer + list), Settings (link to the edit page). Drop Analytics and People; the Products surface becomes a "Manage in Storefront" link.

## i18n

New copy under `connect.companyPageAdmin.*` (or the existing company-admin namespace) across all four locales (en + gu + gu-en + hi-en), gu/gu-en/hi-en best-effort.

## Verification

Per slice, scoped to touched files: `tsc --noEmit`, `eslint` on changed files, `check:i18n`, `detect:hardcoded-i18n`, the banned-AntD `rg` self-check. Browser smoke is the owner's (Tier B). No em-dashes. Zero git unless the owner asks.

## Out of scope (flagged for later)

- Analytics tracking (page views, impressions, search appearances) and the weekly-followers chart.
- A follower list endpoint + UI.
- Phone / contact reveal (needs a phone field + reveal flow).
- GST / Udyam verification (needs API creds).
- Multi-admin pages (the schema is single-owner).
- The People tab (needs the employee-to-page link with consent).
