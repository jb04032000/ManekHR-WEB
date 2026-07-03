'use server';

/**
 * Connect @mention (tagging) - composer picker server action. Calls the backend
 * `GET /connect/mention/suggest` through the httpOnly-cookie-authed `serverHttp`
 * client and returns link-ready suggestions for the composer's @-picker. Mirrors
 * feed.actions' import/error conventions (same `serverHttp`/`unwrapServer`/
 * `ActionResult`/`toError`). Returns a discriminated `ActionResult` - never throws.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from './profile.types';

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** One @-picker suggestion - a person, company page, or storefront the composer
 *  can tag. `href` is the link rendered later by MentionText; `avatar` is null
 *  when the entity has no image. Mirrors the backend suggest response shape. */
export interface MentionSuggestion {
  type: 'profile' | 'company' | 'storefront';
  id: string;
  display: string;
  href: string;
  avatar: string | null;
}

/** Composer @-picker fetch. Links: backend GET /connect/mention/suggest. The
 *  endpoint is a non-me `/connect/...` route, so it uses an absolute path (no
 *  `/me/connect` BASE prefix - that would double the prefix, cf. getPublicPost). */
export async function suggestMentions(
  q: string,
  scope: 'all' | 'people' | 'companies' | 'storefronts' = 'all',
): Promise<ActionResult<MentionSuggestion[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/mention/suggest`, { params: { q, scope } });
    return { ok: true, data: unwrapServer<MentionSuggestion[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
