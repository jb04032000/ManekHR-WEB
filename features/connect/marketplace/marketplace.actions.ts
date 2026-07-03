'use server';

/**
 * Buyer-facing marketplace server actions (M1.6.2).
 *
 *   - `getPublicListing(id)` reads the public listing detail (M1.2
 *     `ListingService.getPublic`, `@Public`); only an active + approved listing
 *     resolves, anything else 404s.
 *   - `sendInquiry(listingId, message)` posts the buyer's inquiry (M1.5),
 *     mapping the backend error envelope to a discriminated `InquiryErrorCode`
 *     so the modal can render localized copy (especially the seller lead-cap).
 *
 * Both flow through the httpOnly-authed `serverHttp` client + `unwrapServer`.
 * A `'use server'` module may only export async functions, so the error mapper
 * + the read error helper live elsewhere (`inquiry-error.ts`).
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type {
  CreateListingInput,
  CreateListingResult,
  Inquiry,
  InquiryListPage,
  ListingDetail,
  OwnerListing,
  SendInquiryResult,
  UpdateListingInput,
} from './marketplace.types';
import { mapInquiryError } from './inquiry-error';
import { extractConnectError } from './connect-error';
// Typed CONNECT_LIMIT_REACHED 403 reader - shared across all four create flows
// so the blocked listing create shows the same LimitReachedDialog upgrade prompt.
import { extractConnectLimit } from '../connect-limit';

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Public listing detail by id. Returns a not-ok result on 404 / network error. */
export async function getPublicListing(id: string): Promise<ActionResult<ListingDetail>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/marketplace/public/listings/${encodeURIComponent(id)}`);
    return { ok: true, data: unwrapServer<ListingDetail>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Send an inquiry on a listing. The buyer is the authenticated viewer (resolved
 * server-side from the JWT); only the optional message travels in the body.
 * Returns the discriminated `SendInquiryResult` so the modal branches on `code`.
 */
export async function sendInquiry(listingId: string, message?: string): Promise<SendInquiryResult> {
  try {
    const http = await serverHttp();
    const res = await http.post(
      `/connect/marketplace/listings/${encodeURIComponent(listingId)}/inquiries`,
      { message: message ?? '' },
    );
    return { ok: true, data: unwrapServer<Inquiry>(res) };
  } catch (e) {
    return { ok: false, ...mapInquiryError(e) };
  }
}

/**
 * Create a listing (M1.6.3). The owner is derived server-side from the JWT, so
 * only the content travels in the body. Moderation is off, so the created
 * listing publishes live (`active`) immediately. On the per-person cap the action
 * returns `CONNECT_LIMIT_REACHED` plus the typed `limitReached` detail so the form
 * shows the shared LimitReachedDialog.
 */
export async function createListing(input: CreateListingInput): Promise<CreateListingResult> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/marketplace/listings', input);
    return { ok: true, data: unwrapServer<ListingDetail>(res) };
  } catch (e) {
    const { message } = extractConnectError(e);
    const limitReached = extractConnectLimit(e);
    if (limitReached) {
      return { ok: false, code: 'CONNECT_LIMIT_REACHED', error: message, limitReached };
    }
    return { ok: false, code: 'UNKNOWN', error: message };
  }
}

/**
 * The caller's own listings (any status), newest first. Pass `storefrontId` to
 * scope to one of the caller's shops (the storefront manage page is the per-shop
 * product home); omit it for all of the owner's listings flat (boost / edit).
 */
export async function getMyListings(storefrontId?: string): Promise<ActionResult<OwnerListing[]>> {
  try {
    const http = await serverHttp();
    const path = '/connect/marketplace/listings/mine';
    const res = storefrontId
      ? await http.get(path, { params: { storefrontId } })
      : await http.get(path);
    return { ok: true, data: unwrapServer<OwnerListing[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Patch a listing's content (owner-only). Moderation is off, so editing a live
 * listing keeps it live (no re-submission for review).
 */
export async function updateListing(
  id: string,
  input: UpdateListingInput,
): Promise<ActionResult<OwnerListing>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`/connect/marketplace/listings/${encodeURIComponent(id)}`, input);
    return { ok: true, data: unwrapServer<OwnerListing>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Publish a listing (owner-only): goes live immediately (moderation is off). */
export async function publishListing(id: string): Promise<ActionResult<OwnerListing>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/connect/marketplace/listings/${encodeURIComponent(id)}/publish`);
    return { ok: true, data: unwrapServer<OwnerListing>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Pause an active listing (owner-only). */
export async function pauseListing(id: string): Promise<ActionResult<OwnerListing>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/connect/marketplace/listings/${encodeURIComponent(id)}/pause`);
    return { ok: true, data: unwrapServer<OwnerListing>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Delete a listing (owner-only). */
export async function deleteListing(id: string): Promise<ActionResult<null>> {
  try {
    const http = await serverHttp();
    await http.delete(`/connect/marketplace/listings/${encodeURIComponent(id)}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * One page of the caller's SENT inquiries (buyer outbox), hydrated, newest first.
 * `cursor` is the previous page's `nextCursor`; omit it for the first page.
 */
export async function getSentInquiries(cursor?: string): Promise<ActionResult<InquiryListPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/marketplace/inquiries/mine/sent', {
      params: cursor ? { cursor } : {},
    });
    return { ok: true, data: unwrapServer<InquiryListPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * One page of the caller's RECEIVED inquiries (seller inbox), hydrated, newest
 * first. `cursor` is the previous page's `nextCursor`; omit it for the first page.
 */
export async function getReceivedInquiries(
  cursor?: string,
): Promise<ActionResult<InquiryListPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/marketplace/inquiries/mine/received', {
      params: cursor ? { cursor } : {},
    });
    return { ok: true, data: unwrapServer<InquiryListPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
