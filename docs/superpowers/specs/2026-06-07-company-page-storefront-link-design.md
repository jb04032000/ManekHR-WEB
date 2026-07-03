# Company Page <-> Storefront link (design)

**Status:** Approved (owner "go", 2026-06-07)
**Scope:** crewroster-backend + crewroster-web (Connect)
**Owner decisions:** store card + Visit-store redirect | exactly one store per page | new "Store" tab in the page console | attach-existing-or-create

## Context

A company page and a storefront are separate Connect entities. Products
(`Listing`) belong to a storefront (`Listing.storefrontId`), never to a page.
The goal: a company page owner attaches ONE storefront to the page so products
are managed only in the storefront, and the public page shows that store and
sends buyers to it.

Most plumbing already exists:

- `Storefront.companyPageId` (optional ObjectId, indexed) is the page<-store link.
- `Listing.storefrontId` is the product<-store link.
- Product roll-up to a page already works: `ListingService.listPublicByCompanyPage(pageId)`
  via `StorefrontService.findPublicIdsByCompanyPage(pageId)` ->
  `GET /connect/marketplace/public/company-page/:pageId/listings`.
- "Start selling" (`StartSellingButton`) creates a storefront pre-linked to the page.
- Public `CompanyPageView` already has an inline "products" tab.
- Caps: free tier = 1 company page + 1 storefront (`ConnectAllowances`).

The gaps are: attach an EXISTING store, enforce ONE store per page, a
redirect-first public display, and a manage surface to link/switch/unlink.

## Decisions

1. **Single source of truth = `Storefront.companyPageId`.** No new field on
   CompanyPage (avoids dual-link drift). The page's "attached store" is the
   storefront whose `companyPageId === pageId` (0 or 1).
2. **At most one storefront per page.** Enforced in the service on attach (swap
   clears any prior link) + a partial unique index on `companyPageId` (where not
   null) as an integrity backstop, after a one-time de-dup.
3. **A storefront still links to at most one page** (single-valued
   `companyPageId`), so the relationship is optional-1:1 on both sides.
4. **Public display = store card + redirect.** No full inline catalogue on the
   page; the full catalogue lives on `/store/[slug]`.
5. **Manage = new "Store" tab** in `ManageCompanyPageScreen`.
6. **Link source = attach existing OR create.**

## Backend

### Schema / migration (`storefront.schema.ts`)

- Add a **partial unique index**: `{ companyPageId: 1 }` `unique` with
  `partialFilterExpression: { companyPageId: { $type: 'objectId' } }`.
- One-time de-dup migration before the index: for any page with >1 linked
  storefront, keep the most-recently-updated, set the others' `companyPageId` to
  null. (Low likelihood; safety only.)

### Service (`storefront.service.ts` / `company-page.service.ts`)

- `getAttachedStorefront(pageId, { ownerView })`: the single linked storefront
  (owner view ignores visibility; public view returns only `public`).
- `attachStorefrontToPage(userId, pageId, storefrontId)`: assert caller owns BOTH
  the page and the store; clear any other storefront linked to `pageId`; set
  `store.companyPageId = pageId`. Idempotent.
- `unlinkStorefrontFromPage(userId, pageId)`: clear `companyPageId` on the page's
  attached store. Tolerates none.
- Audit each attach/unlink (`AuditService`, Connect module).

### Controller (`company-page.controller.ts`)

- `GET    /connect/company-pages/:pageId/store` -> attached store (owner-guarded; public variant reuses the existing public storefront read).
- `PUT    /connect/company-pages/:pageId/store` body `{ storefrontId }` -> attach/swap.
- `DELETE /connect/company-pages/:pageId/store` -> unlink.
- Throttle tiers per repo convention; DTO `{ storefrontId: IsMongoId }`.

Product roll-up endpoint is unchanged (now returns 0-or-1 store's products).

## Web

### Actions (`entities/company-page.actions.ts` or `storefront.actions.ts`)

- `getCompanyPageStore(pageId)`, `attachStoreToPage(pageId, storefrontId)`,
  `unlinkStoreFromPage(pageId)`. `listMyStorefronts()` already exists for the picker.

### Manage console - new "Store" tab (`ManageCompanyPageScreen.tsx`)

- Add `'store'` to `ManageTab` + a tab entry (icon `Store`/`Package`).
- **Attached**: store summary card (logo, name, visibility, product count) +
  **Manage store** (-> `/connect/stores/[id]`) + **Switch store** + **Unlink**.
- **None**: **Attach existing store** (picker modal of the owner's storefronts
  with `companyPageId == null`; already-linked ones shown disabled "Linked to
  <page>") + **Create a new store** (reuse `StartSellingButton` create-and-link).
- Repoint the Overview "Products -> /connect/stores" hint to the Store tab.

### Public company page (`CompanyPageView.tsx`) - redirect model

- Replace the inline "products" tab with a **Store** section: a store card (logo,
  name, product count, ~4-6 featured products preview) + **Visit store** button
  -> `/store/[slug]`.
- Compact store card also on **Overview**.
- No attached store -> no Store section.

### Loading / i18n

- `loading.tsx` for any new data route; 4-locale i18n for all new strings
  (en/gu/gu-en/hi-en), parity enforced; no em-dashes.

## Edge cases

- Attached store deleted -> link auto-clears (store gone) -> page shows "no store".
- Store visibility `hidden`/`connections` -> owner sees it in manage; public Store
  section hides per visibility.
- Attaching a store already linked to another page: the picker only offers
  stores with `companyPageId == null` (linked ones shown disabled, "Linked to
  <page>"), and the attach service rejects a store that is already linked to a
  different page (no silent move).
- Caps unchanged.

## Testing

- BE unit: attach swaps/clears prior link; unlink tolerates none; ownership guard
  rejects non-owner of either entity; getAttachedStorefront visibility rules.
- Web: manage Store tab attached vs empty states; picker filters linked stores;
  public Store section renders card + Visit store and hides when none.

## Out of scope

- Multiple stores per page (explicitly one).
- Moving/merging products between stores.
- Changing the storefront's own manage console (products stay there).
