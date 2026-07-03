# Shop Collections - design

Date: 2026-06-01
Status: Approved (design); implementation pending
Repos: `crewroster-backend` (Connect), `crewroster-web` (Connect), branch `zari360-connect`

## Problem

A storefront can hold a large catalog, but a real shop is usually a single
marketplace `category` (a saree shop's whole catalog is `finished-goods`). The
marketplace category is a cross-shop discovery taxonomy, not an in-shop
organizer, so for a big single-vertical shop the store page collapses to one
useless filter chip. Buyers have no way to navigate a 200-product shop, and the
owner has no way to group their own products.

`Storefront.categories` already exists but is only a descriptive "this shop
sells in: weaving, dyeing" tag list rendered as static chips; it does not
organize products.

## Goal

Give each shop owner-curated, shop-scoped **Collections** that group their own
products for in-store browsing, with best-in-industry UX (Shopify Collections /
IndiaMART seller catalogs / Etsy shop sections), without disturbing the global
marketplace taxonomy or the product-tags layer.

## Three distinct concepts (after this change)

| Concept                | Scope      | Cardinality      | Purpose                         | Status    |
| ---------------------- | ---------- | ---------------- | ------------------------------- | --------- |
| Marketplace `category` | cross-shop | one per product  | global discovery taxonomy       | unchanged |
| Product `tags`         | cross-shop | many per product | flexible discovery hashtags     | unchanged |
| Shop `Collection`      | per-shop   | many per product | owner-curated in-store grouping | NEW       |

## Data model

### New `Collection` entity (backend, collection `connect_collections`)

- `storefrontId: ObjectId` (ref Storefront, required) - the shop it belongs to.
- `ownerUserId: ObjectId` (ref User, required) - person-centric ownership, mirrors
  Listing/Storefront. Authorize by userId only.
- `title: string` (required, trimmed, maxlength 80).
- `slug: string` (required, lowercase) - unique PER storefront. Generated from
  title, deduped with a numeric suffix on collision (`bridal-sarees-2`).
- `description?: string` (maxlength 500).
- `coverImage?: string` (uploaded URL, nullable).
- `sortIndex: number` (default 0) - order among the shop's collections.
- `productOrder: ObjectId[]` (default []) - advisory manual order of products
  inside this collection (see "Membership" below).
- timestamps.

Indexes:

- `{ storefrontId: 1, sortIndex: 1 }` - the shop's collection list, ordered.
- `{ storefrontId: 1, slug: 1 }` unique - per-shop slug uniqueness + public lookup.
- `{ ownerUserId: 1 }` - ownership scans.

### Membership lives on the product

- `Listing.collectionIds: ObjectId[]` (default []) - the SINGLE SOURCE OF TRUTH
  for "is product X in collection Y".
  - Reads are trivial and indexed: `Listing.find({ collectionIds: Y, status, moderationStatus })`.
  - The product editor reads membership directly off the listing.
  - No two-document drift to keep in sync.
- `Collection.productOrder` is ONLY an advisory display order:
  - A member missing from `productOrder` sorts after, by `createdAt` desc.
  - An orphan id in `productOrder` (e.g. product later removed) is ignored on read.
  - Reordering touches only `productOrder`.
  - Deleting a product cleanly drops membership (the product is gone); the orphan
    in `productOrder` is harmless and lazily ignored.
- Index: `Listing` gains `{ storefrontId: 1, collectionIds: 1, status: 1 }` for the
  public "active products in collection Y of shop S" query.

### Caps

- Max collections per shop: `MAX_COLLECTIONS = 50` (generous fixed cap, not
  subscription-gated in v1; free shops must be able to organize). Create throws
  403 at the cap.
- A product may belong to many collections (no per-product cap needed at SMB scale).

## Backend

New module `src/modules/connect/collections/` (schema, service, controller,
tests), following the Listing/Storefront conventions (env loader, JwtAuthGuard,
class-validator DTOs, throttler tier, AuditService writes, person-centric
ownership, OTel/PostHog on writes).

### Service behaviors

- `create(ownerUserId, storefrontId, dto)` - verify shop ownership; assert cap;
  generate unique per-shop slug; `sortIndex` = current max + 1; audit + emit.
- `listMine(ownerUserId, storefrontId)` - the shop's collections, `sortIndex` asc,
  each with a `productCount` (count of listings whose `collectionIds` contains it;
  any status, for the owner).
- `update(id, ownerUserId, dto)` - rename/description/cover; re-slug on title
  change (keep old slug? No - re-slug, dedupe; public URL changes, acceptable in
  v1 since collections are new). Owner-only.
- `reorderCollections(ownerUserId, storefrontId, orderedIds[])` - rewrite
  `sortIndex` from the given order; validates all ids belong to the shop.
- `setProducts(collectionId, ownerUserId, orderedListingIds[])` - the manage-a-
  collection path: set the exact membership + order for this collection in one
  call. Diff against current members: add `collectionId` to newly-included
  listings' `collectionIds`, pull it from removed ones; write `productOrder` =
  orderedListingIds. All listings verified owned + in this shop.
- `setListingCollections(listingId, ownerUserId, collectionIds[])` - the product-
  editor path: set which collections a single product is in. Diff and update the
  listing's `collectionIds`; append the listing to each newly-added collection's
  `productOrder`, pull from removed ones. Verifies each collection is owned + same
  shop as the listing.
- `addProductsBulk(collectionId, ownerUserId, listingIds[])` - the bulk path from
  the product manager: add `collectionId` to each listing's `collectionIds` (union,
  no removals) + append to `productOrder`.
- `remove(id, ownerUserId)` - delete the collection; pull its id from every member
  listing's `collectionIds`. Audit + emit.
- `listPublicByStorefront(storefrontId)` - public collections (all; a collection
  is shown even if some members are not live, but its public `productCount` counts
  only active+approved) ordered by `sortIndex`, each with `{ id, title, slug,
description, coverImage, productCount }`.
- Public products in a collection reuse the existing public-storefront listing
  read, filtered by `collectionIds` contains the collection and ordered by the
  collection's `productOrder` then recency.

### Endpoints (all JwtAuthGuard + throttler, except public reads via the public proxy)

- `POST   /connect/storefronts/:storefrontId/collections` - create
- `GET    /connect/storefronts/:storefrontId/collections` - owner list (+counts)
- `PATCH  /connect/collections/:id` - rename / description / cover
- `DELETE /connect/collections/:id` - delete
- `POST   /connect/storefronts/:storefrontId/collections/reorder` - reorder collections
- `POST   /connect/collections/:id/products` - set products + order (manage view)
- `POST   /connect/collections/:id/products/add` - bulk add (union)
- `PATCH  /connect/marketplace/listings/:id/collections` - set a listing's collections
- Public: `GET /connect/store/:slug/collections` - public list (+ live counts)
- Public products-in-collection: extend the existing public storefront listings
  read with an optional `?collection=<id|slug>` filter.

### Listing read shape

- `OwnerListing` (and the owner listing ref) gains `collectionIds: string[]` so
  the product editor + bulk UI know current membership.
- The public listing ref returned by the STOREFRONT read path
  (`listPublicByStorefront`) also carries `collectionIds: string[]`, so the store
  page can filter the grid by collection client-side without extra round-trips.
  The global marketplace / search card refs do NOT carry it (cards never display
  their collections), keeping those payloads unchanged.

## Web

### Owner: Collections tab (new) in `ManageStorefrontScreen`

Tabs become `Overview · Products · Collections · Inquiries · Settings`.

- Collections tab lists collections as cards (cover thumbnail + title + product
  count), with Create, rename/description (modal reusing the storefront-form
  patterns), set cover (MediaUploadGrid single image), drag-reorder collections,
  delete (confirm).
- Open a collection -> a product picker: the shop's products with checkboxes to
  include/exclude, and drag-reorder of the included set. Saves via `setProducts`.

### Owner: product editor

- `ListingForm` gains a "Collections" multi-select (AntD Select, options = this
  shop's collections), bound to the listing's `collectionIds`. Create flow:
  selected collections are applied after the listing is created (the listing id is
  needed); edit flow: applied via `PATCH .../collections`.
- Empty state: if the shop has no collections yet, the field shows a quiet "Create
  collections from the Collections tab" hint instead of an empty dropdown.

### Owner: bulk in `OwnerListingsManager`

- Select mode's bulk bar gains "Add to collection" -> a modal to pick one
  collection -> `addProductsBulk`. Sits beside the existing bulk pause / category /
  delete.
- Optional: a Collection filter in the manager toolbar (filter the owner's product
  list by collection). Include it (cheap, useful for big catalogs).

### Public: collection browser in `StorefrontView`

- When the shop has collections: a horizontally-scrollable collection tab/chip row
  (`All` + each collection with its live count). Selecting a collection:
  - filters the product grid to that collection (client-side over the fetched set,
    consistent with the existing sort/filter toolbar),
  - shows the collection's cover banner + description above the grid (when set),
  - writes `?c=<collectionSlug>` to the URL for deep-linking + back/forward.
- When the shop has no collections: today's flat grid (unchanged).
- Remove the marketplace-category filter chips from the public store (collections
  replace them as the real organizer). The category chips stay in the owner's
  internal Products filter. The sort control stays.
- The store page already fetches the shop's listings; it will also fetch the
  shop's public collections (one extra read) to build the tabs. Each listing must
  carry its `collectionIds` for client-side filtering, OR the page fetches per
  selected collection. Decision: include `collectionIds` on the public listing ref
  ONLY for the storefront read path (not the global cards) so the client can filter
  without extra round-trips.

### i18n

New keys under `connect.storefrontAdmin` (collections tab + manager), the listing
form (`connect.marketplace.new`/`edit` collections field), and
`connect.storefront` (public collection browser), across en / gu / gu-en / hi-en.
gu / gu-en / hi-en need owner native review.

## Edge cases

- Deleting a collection pulls it from all members; products stay (only the grouping
  is removed).
- Deleting a product removes it from membership naturally; orphan ids in
  `productOrder` are ignored on read and cleaned on the next `setProducts`.
- Pausing/unpublishing a product: it stays a member but the public collection only
  shows active+approved, so it disappears publicly and returns when re-published.
- A collection with zero live products: still listed to the owner (with its count);
  on the public store the client HIDES it from the tab row (no dead chips). The
  public `listPublicByStorefront` collections read returns every collection with
  its live `productCount`, and `StorefrontView` filters out those with a zero live
  count before rendering the tabs.
- Renaming a collection re-slugs it; the old `?c=` deep-link 404s gracefully to the
  store root (acceptable for a brand-new feature).
- Slug collision within a shop: numeric suffix.

## Security

- Every collection write derives the owner from the JWT; ownership is verified on
  the collection AND on any listing it touches (no cross-user or cross-shop writes).
- Public reads expose only title/slug/description/cover/live-count and live
  products; never draft/paused products or any owner-only field.

## Testing

- Backend: schema (defaults, indexes), service (create + slug dedupe + cap,
  setProducts diff add/remove, setListingCollections diff, addProductsBulk union,
  remove cleanup pulls from members, public list live-count, reorder), controller
  (ownership guards, cross-shop rejection).
- Web: Collections tab (create/rename/reorder/delete), product picker
  (include/exclude/reorder save), ListingForm collections multi-select (create +
  edit apply), OwnerListingsManager bulk add-to-collection + collection filter,
  StorefrontView collection tab row (filter, empty-collection hidden, `?c=`
  deep-link, no-collections fallback).

## Phasing (for the implementation plan)

1. Backend: `Collection` schema + module + service + controller + tests;
   `Listing.collectionIds` + index; listing read shape adds `collectionIds`.
2. Web owner: Collections tab + product picker; ListingForm multi-select;
   OwnerListingsManager bulk + filter.
3. Web public: StorefrontView collection browser + store-page data wiring; remove
   the marketplace-category chips from the public store.
4. i18n ×4 + tests throughout each phase.

## Non-goals (deliberate, not stubs)

- Smart / automatic (rule-based) collections - real rule-engine complexity an SMB
  rarely needs. Manual curation is the complete v1.
- Dedicated SEO collection routes (`/store/:shop/:collection` as separate pages) -
  `?c=` deep-linking covers v1; separate SEO pages can be added later.
- Nested / sub-collections - flat is sufficient for an SMB catalog.
