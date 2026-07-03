'use server';

/**
 * Connect Network - server actions (Phase 2). Call the backend
 * `connect/network` endpoints + the `connect/people` batch lookup through the
 * httpOnly-cookie-authed `serverHttp` client. Every action returns a
 * discriminated `ActionResult` - never throws to the caller.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from './profile.types';
import type {
  ConnectionRequest,
  ConnectionRequestAction,
  ConnectionSummary,
  Follow,
  InvitationBox,
  NetworkCounts,
  PersonRef,
  RelationshipState,
  Suggestion,
} from './network.types';

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

const BASE = '/me/connect/network';

/** Send a connection request to another member. */
export async function sendConnectionRequest(
  toUserId: string,
  note?: string,
): Promise<ActionResult<ConnectionRequest>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/requests`, { toUserId, note });
    return { ok: true, data: unwrapServer<ConnectionRequest>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Accept or ignore a pending connection request (recipient only). */
export async function respondToConnectionRequest(
  requestId: string,
  action: ConnectionRequestAction,
): Promise<ActionResult<ConnectionRequest>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`${BASE}/requests/${encodeURIComponent(requestId)}`, { action });
    return { ok: true, data: unwrapServer<ConnectionRequest>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Withdraw a pending connection request the caller sent. */
export async function withdrawConnectionRequest(
  requestId: string,
): Promise<ActionResult<ConnectionRequest>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/requests/${encodeURIComponent(requestId)}`);
    return { ok: true, data: unwrapServer<ConnectionRequest>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's invitations for a box (defaults to `received`). */
export async function listInvitations(
  box: InvitationBox = 'received',
): Promise<ActionResult<ConnectionRequest[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/invitations`, { params: { box } });
    return { ok: true, data: unwrapServer<ConnectionRequest[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's connections. */
export async function listConnections(): Promise<ActionResult<ConnectionSummary[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/connections`);
    return { ok: true, data: unwrapServer<ConnectionSummary[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Remove a connection with another member. */
export async function removeConnection(
  userId: string,
): Promise<ActionResult<{ removed: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/connections/${encodeURIComponent(userId)}`);
    return { ok: true, data: unwrapServer<{ removed: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Follow another member (asymmetric, idempotent). */
export async function followUser(userId: string): Promise<ActionResult<Follow>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/following/${encodeURIComponent(userId)}`);
    return { ok: true, data: unwrapServer<Follow>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Unfollow a member. */
export async function unfollowUser(userId: string): Promise<ActionResult<{ unfollowed: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/following/${encodeURIComponent(userId)}`);
    return { ok: true, data: unwrapServer<{ unfollowed: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Everything the caller follows. */
export async function listFollowing(): Promise<ActionResult<Follow[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/following`);
    return { ok: true, data: unwrapServer<Follow[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Everyone who follows the caller. Each row's `followerId` is the follower. */
export async function listFollowers(): Promise<ActionResult<Follow[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/followers`);
    return { ok: true, data: unwrapServer<Follow[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Public social-proof counts (`{ connections, followers }`) for a profile
 * header, by `User` id. Public endpoint - works for a logged-out viewer on
 * `/u/[slug]`. Independent edge counts (see backend `getPublicProfileCounts`).
 */
export async function getPublicNetworkCounts(
  userId: string,
): Promise<ActionResult<{ connections: number; followers: number }>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/network/${encodeURIComponent(userId)}/counts`);
    return { ok: true, data: unwrapServer<{ connections: number; followers: number }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Network badge counts - pending requests / connections / following. */
export async function getNetworkCounts(): Promise<ActionResult<NetworkCounts>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/counts`);
    return { ok: true, data: unwrapServer<NetworkCounts>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Resolve a set of user ids to their people-card identity in one batch
 * round-trip - hydrates the network / suggestions / search people cards.
 */
export async function getPeople(ids: string[]): Promise<ActionResult<PersonRef[]>> {
  if (ids.length === 0) return { ok: true, data: [] };
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/people', { params: { ids: ids.join(',') } });
    return { ok: true, data: unwrapServer<PersonRef[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Public-safe variant of `getPeople` -- hits `@Public GET /connect/people/public`,
 * which resolves ids to identity ONLY for users with a public Connect profile.
 * Used by the logged-out public profile activity hydration (`getPublicActivity`)
 * so a signed-out visitor stops 401-ing on the members-only `/connect/people`
 * and a non-public author simply resolves to nothing.
 */
export async function getPublicPeople(ids: string[]): Promise<ActionResult<PersonRef[]>> {
  if (ids.length === 0) return { ok: true, data: [] };
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/people/public', { params: { ids: ids.join(',') } });
    return { ok: true, data: unwrapServer<PersonRef[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * ERP-weighted "people you may know" for the caller, best first.
 * `opts.timeout` overrides the shared 15s client timeout for THIS call only. The
 * feed right-rail awaits this inside the feed page's blocking Promise.all
 * (app/connect/feed/page.tsx), so it passes a short fail-fast timeout (5s): a
 * slow/cold-start backend on this best-effort widget must not hold the whole
 * feed render for the full 15s (the rail just stays empty on a miss). Other
 * callers (Network page, profile/post activity rails) omit it and keep the
 * default. Keep in sync with the best-effort rail timeouts in the feed page.
 */
export async function getSuggestions(opts?: {
  timeout?: number;
}): Promise<ActionResult<Suggestion[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/suggestions`, {
      ...(opts?.timeout ? { timeout: opts.timeout } : {}),
    });
    return { ok: true, data: unwrapServer<Suggestion[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's relationship to another user - drives the `/u/[id]` action buttons. */
export async function getRelationship(userId: string): Promise<ActionResult<RelationshipState>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/relationship/${encodeURIComponent(userId)}`);
    return { ok: true, data: unwrapServer<RelationshipState>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
