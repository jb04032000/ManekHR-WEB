'use server';

/**
 * Server actions for the Connect RFQ board + quotes (W4). Wraps the BE
 * `connect/rfq` endpoints (JwtAuthGuard; actor = req.user.sub). Board-only (no
 * notifications). ActionResult shape throughout.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type {
  Rfq,
  RfqDetail,
  Quote,
  MyQuoteView,
  CreateRfqPayload,
  CreateQuotePayload,
  BoardFilters,
  BoardFacets,
  BoardStats,
} from './rfq.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/** Drop empty values so we never send blank query params (BE rejects unknowns). */
function pruneParams(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

const BASE = '/connect/rfq';

export async function createRfq(payload: CreateRfqPayload): Promise<ActionResult<Rfq>> {
  try {
    const http = await serverHttp();
    const res = await http.post(BASE, payload);
    return { ok: true, data: unwrapServer<Rfq>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** BoardFilters -> wire params: csv-join the array facets (districts/statuses),
 *  prune empties. Keep keys in sync with the BE RfqBoardQueryDto + the URL
 *  parser in page.tsx / useRfqBoardFilters. */
function toBoardParams(filters: BoardFilters): Record<string, unknown> {
  const { districts, statuses, ...rest } = filters;
  return pruneParams({
    ...rest,
    districts: districts && districts.length ? districts.join(',') : undefined,
    statuses: statuses && statuses.length ? statuses.join(',') : undefined,
  });
}

/** The open-RFQ board with the filter rail / sort / search / paging. */
export async function listRfqBoard(filters: BoardFilters = {}): Promise<ActionResult<Rfq[]>> {
  try {
    const http = await serverHttp();
    const params = toBoardParams(filters);
    const res = await http.get(
      `${BASE}/board`,
      Object.keys(params).length ? { params } : undefined,
    );
    return { ok: true, data: unwrapServer<Rfq[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Facet counts for the filter rail (BE one-$facet aggregation; jobs pattern).
 *  Sort/limit/skip are NOT sent -- the facets DTO whitelists filter fields only. */
export async function getRfqBoardFacets(
  filters: BoardFilters = {},
): Promise<ActionResult<BoardFacets>> {
  try {
    const http = await serverHttp();
    const params = toBoardParams(filters);
    delete params.sort;
    delete params.limit;
    delete params.skip;
    const res = await http.get(
      `${BASE}/board/facets`,
      Object.keys(params).length ? { params } : undefined,
    );
    return { ok: true, data: unwrapServer<BoardFacets>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Headline counts for the board KPI strip (real numbers, never faked). */
export async function getRfqBoardStats(): Promise<ActionResult<BoardStats>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/board/stats`);
    return { ok: true, data: unwrapServer<BoardStats>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's own posted requests. */
export async function listMyRfqs(): Promise<ActionResult<Rfq[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/mine`);
    return { ok: true, data: unwrapServer<Rfq[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's own sent quotes, each enriched with a small RFQ snapshot. */
export async function listMyQuotes(): Promise<ActionResult<MyQuoteView[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/my-quotes`);
    return { ok: true, data: unwrapServer<MyQuoteView[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** One RFQ enriched with buyerStats + quoteStats (the detail context). */
export async function getRfq(id: string): Promise<ActionResult<RfqDetail>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}`);
    return { ok: true, data: unwrapServer<RfqDetail>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function closeRfq(id: string): Promise<ActionResult<Rfq>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${id}/close`);
    return { ok: true, data: unwrapServer<Rfq>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Submit (or update) the caller's quote on an RFQ. */
export async function submitQuote(
  rfqId: string,
  payload: CreateQuotePayload,
): Promise<ActionResult<Quote>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${rfqId}/quotes`, payload);
    return { ok: true, data: unwrapServer<Quote>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** All quotes on one of the caller's RFQs (buyer-only). */
export async function listQuotesForMyRfq(rfqId: string): Promise<ActionResult<Quote[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${rfqId}/quotes`);
    return { ok: true, data: unwrapServer<Quote[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function acceptQuote(quoteId: string): Promise<ActionResult<Quote>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/quotes/${quoteId}/accept`);
    return { ok: true, data: unwrapServer<Quote>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function withdrawQuote(quoteId: string): Promise<ActionResult<Quote>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/quotes/${quoteId}/withdraw`);
    return { ok: true, data: unwrapServer<Quote>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Buyer marks a quote as a finalist (BE POST quotes/:id/shortlist). */
export async function shortlistQuote(quoteId: string): Promise<ActionResult<Quote>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/quotes/${quoteId}/shortlist`);
    return { ok: true, data: unwrapServer<Quote>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Buyer declines a live quote (BE POST quotes/:id/decline). */
export async function declineQuote(quoteId: string): Promise<ActionResult<Quote>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/quotes/${quoteId}/decline`);
    return { ok: true, data: unwrapServer<Quote>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
