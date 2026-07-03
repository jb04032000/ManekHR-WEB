'use server';

/**
 * Server actions for Connect Storefronts (Phase 4, on the W1 entity foundation).
 * Wraps the BE `connect/storefronts` endpoints (JwtAuthGuard; owner =
 * req.user.sub) + the `@Public` read-by-slug + the storefront's public products.
 */

import { revalidatePath } from 'next/cache';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
// extractErrorMessage reads response.data.message / maps status codes -- avoids raw "Request failed with status code N" reaching the UI.
import { extractErrorMessage } from '@/lib/format/http-errors';
// Detects the typed CONNECT_LIMIT_REACHED 403 so a blocked create surfaces the
// upgrade prompt (LimitReachedDialog) instead of a generic toast.
import { extractConnectLimit } from '../connect-limit';
// Reads the BE error envelope's HTTP status so the ERP-link action can detect the
// 403 not-owner-of-workspace case and surface a friendly inline message.
import { extractConnectError } from '../marketplace/connect-error';
import type { ActionResult } from '../profile.types';
import type { ConnectListingRef } from '../search.types';
import type {
  Storefront,
  StorefrontStat,
  PublicStorefront,
  CreateStorefrontPayload,
  UpdateStorefrontPayload,
} from './entities.types';

const BASE = '/connect/storefronts';

export async function createStorefront(
  payload: CreateStorefrontPayload,
): Promise<ActionResult<Storefront>> {
  try {
    const http = await serverHttp();
    const res = await http.post(BASE, payload);
    // Bust the router cache so /connect/stores re-fetches on the next visit.
    revalidatePath('/connect/stores');
    return { ok: true, data: unwrapServer<Storefront>(res) };
  } catch (e) {
    const limitReached = extractConnectLimit(e);
    if (limitReached) return { ok: false, error: extractErrorMessage(e, ''), limitReached };
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

export async function listMyStorefronts(): Promise<ActionResult<Storefront[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(BASE);
    return { ok: true, data: unwrapServer<Storefront[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

export async function getMyStorefront(id: string): Promise<ActionResult<Storefront>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}`);
    return { ok: true, data: unwrapServer<Storefront>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

export async function updateStorefront(
  id: string,
  payload: UpdateStorefrontPayload,
): Promise<ActionResult<Storefront>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`${BASE}/${id}`, payload);
    return { ok: true, data: unwrapServer<Storefront>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

export async function deleteStorefront(id: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${id}`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/** Pin a storefront as the owner's primary (unsets any previous primary). */
export async function setPrimaryStorefront(id: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.put(`${BASE}/${id}/primary`, {});
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/** Remove the primary flag from a storefront without pinning another. Calls DELETE :id/primary. */
export async function unsetPrimaryStorefront(id: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${id}/primary`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/** Per-storefront counts (products / live / inquiries) for the owner's shops. */
export async function getMyStorefrontStats(): Promise<ActionResult<StorefrontStat[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/marketplace/listings/mine/storefront-stats');
    return { ok: true, data: unwrapServer<StorefrontStat[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/** Public read by slug -- powers the SEO page `/store/[slug]`. */
export async function getPublicStorefront(slug: string): Promise<ActionResult<PublicStorefront>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/public/${slug}`);
    return { ok: true, data: unwrapServer<PublicStorefront>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

// ── ERP link (consent + ownership-verified, ADR-0004) ────────────────────────
// Storefront analogue of the company-page link/unlink. The BE verifies the
// caller owns BOTH the shop and the workspace; a non-owner workspace returns a
// 403 ("You must own that workspace to link it") which we surface as the typed
// `notOwner` code so the editor renders the friendly inline message. Consumed by
// the storefront editor's "Link this shop to my ERP workspace" action (via
// ERPConsentModal in entity mode). Keep in sync with StorefrontController.linkErp.

/** The result of `linkStorefrontErp`: discriminated so the editor can branch on
 *  the 403 not-owner-of-workspace case (`code: 'notOwner'`). On success the BE
 *  returns the updated shop (now ERP-linked). */
export type StorefrontErpLinkResult =
  | { ok: true; data: Storefront }
  | { ok: false; code: 'notOwner' | 'generic'; error: string };

/** Link a storefront to an ERP workspace the caller owns (earns the ERP badge). */
export async function linkStorefrontErp(
  storefrontId: string,
  workspaceId: string,
): Promise<StorefrontErpLinkResult> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${encodeURIComponent(storefrontId)}/erp-link`, {
      workspaceId,
    });
    return { ok: true, data: unwrapServer<Storefront>(res) };
  } catch (e) {
    const { status, message } = extractConnectError(e);
    return { ok: false, code: status === 403 ? 'notOwner' : 'generic', error: message };
  }
}

/** Unlink a storefront's ERP workspace (badge drops immediately). */
export async function unlinkStorefrontErp(storefrontId: string): Promise<ActionResult<Storefront>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${encodeURIComponent(storefrontId)}/erp-link`);
    return { ok: true, data: unwrapServer<Storefront>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/** A storefront's own public products (active + approved). */
export async function getStorefrontListings(
  storefrontId: string,
): Promise<ActionResult<ConnectListingRef[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/marketplace/public/storefront/${storefrontId}/listings`);
    return { ok: true, data: unwrapServer<ConnectListingRef[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/**
 * A company page's public products (active + approved) across all its linked
 * public storefronts. Powers the company page's "Products" tab; logged-out OK.
 */
export async function getCompanyPageListings(
  pageId: string,
): Promise<ActionResult<ConnectListingRef[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(
      `/connect/marketplace/public/company-page/${encodeURIComponent(pageId)}/listings`,
    );
    return { ok: true, data: unwrapServer<ConnectListingRef[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}
