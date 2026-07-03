'use server';

/**
 * Server actions for Shop Collections. Wraps the BE collection endpoints
 * (JwtAuthGuard; owner = req.user.sub) plus the `@Public` per-shop read used by
 * the storefront collection browser.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type {
  Collection,
  CollectionWithCount,
  PublicCollection,
  CreateCollectionPayload,
  UpdateCollectionPayload,
} from './collections.types';

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export async function getMyCollections(
  storefrontId: string,
): Promise<ActionResult<CollectionWithCount[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(
      `/connect/storefronts/${encodeURIComponent(storefrontId)}/collections`,
    );
    return { ok: true, data: unwrapServer<CollectionWithCount[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function createCollection(
  storefrontId: string,
  payload: CreateCollectionPayload,
): Promise<ActionResult<Collection>> {
  try {
    const http = await serverHttp();
    const res = await http.post(
      `/connect/storefronts/${encodeURIComponent(storefrontId)}/collections`,
      payload,
    );
    return { ok: true, data: unwrapServer<Collection>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function updateCollection(
  id: string,
  payload: UpdateCollectionPayload,
): Promise<ActionResult<Collection>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`/connect/collections/${encodeURIComponent(id)}`, payload);
    return { ok: true, data: unwrapServer<Collection>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function deleteCollection(id: string): Promise<ActionResult<null>> {
  try {
    const http = await serverHttp();
    await http.delete(`/connect/collections/${encodeURIComponent(id)}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function reorderCollections(
  storefrontId: string,
  orderedIds: string[],
): Promise<ActionResult<{ ok: true }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(
      `/connect/storefronts/${encodeURIComponent(storefrontId)}/collections/reorder`,
      { orderedIds },
    );
    return { ok: true, data: unwrapServer<{ ok: true }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Set the exact members + order of a collection (manage view). */
export async function setCollectionProducts(
  id: string,
  listingIds: string[],
): Promise<ActionResult<Collection>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/connect/collections/${encodeURIComponent(id)}/products`, {
      listingIds,
    });
    return { ok: true, data: unwrapServer<Collection>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Bulk-add products to a collection (union; no removals). */
export async function addCollectionProducts(
  id: string,
  listingIds: string[],
): Promise<ActionResult<{ added: number }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/connect/collections/${encodeURIComponent(id)}/products/add`, {
      listingIds,
    });
    return { ok: true, data: unwrapServer<{ added: number }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Set which collections a single product belongs to (product-editor path). */
export async function setListingCollections(
  listingId: string,
  collectionIds: string[],
): Promise<ActionResult<{ collectionIds: string[] }>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(
      `/connect/marketplace/listings/${encodeURIComponent(listingId)}/collections`,
      { collectionIds },
    );
    return { ok: true, data: unwrapServer<{ collectionIds: string[] }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Public collections for a shop (storefront browser). */
export async function getPublicCollections(
  storefrontId: string,
): Promise<ActionResult<PublicCollection[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(
      `/connect/marketplace/public/storefront/${encodeURIComponent(storefrontId)}/collections`,
    );
    return { ok: true, data: unwrapServer<PublicCollection[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
