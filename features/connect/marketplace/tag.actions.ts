'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type { TagSuggestion } from './marketplace.types';

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Tag autocomplete for the listing form combobox. Wraps GET /connect/tags/search. */
export async function searchTags(q: string): Promise<ActionResult<TagSuggestion[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/tags/search', { params: { q } });
    const body = unwrapServer<{
      tags: { slug: string; label?: string; labels?: { en?: string } }[];
    }>(res);
    return {
      ok: true,
      data: (body.tags ?? []).map((t) => ({
        slug: t.slug,
        label: t.label ?? t.labels?.en ?? t.slug,
      })),
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
