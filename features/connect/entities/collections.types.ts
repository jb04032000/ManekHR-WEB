/**
 * ManekHR Connect -- Shop Collections types (web mirror of the backend
 * `Collection` shape). A collection is an owner-curated, shop-scoped group of
 * the shop's own products, for in-store browsing.
 */

export interface Collection {
  _id: string;
  storefrontId: string;
  ownerUserId: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string;
  sortIndex: number;
  /** Advisory manual order of member product ids. */
  productOrder: string[];
  createdAt?: string;
}

/** Owner-facing row: the collection plus its product tally (any status). */
export interface CollectionWithCount {
  collection: Collection;
  productCount: number;
}

/** Public collection slice for the storefront browser. `productCount` is LIVE only. */
export interface PublicCollection {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string;
  productCount: number;
}

export interface CreateCollectionPayload {
  title: string;
  description?: string;
  coverImage?: string;
}

export type UpdateCollectionPayload = Partial<CreateCollectionPayload>;
