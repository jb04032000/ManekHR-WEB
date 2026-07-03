'use server';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';

/**
 * Admin-managed legal/policy pages (Terms + Privacy CMS).
 *   - Admin CRUD + publish -> legal-pages.admin.controller.ts (IsAdminGuard).
 *   - Public read (getPublishedLegalPage) -> legal-pages.public.controller.ts
 *     (@Public, published-only). Consumed by the marketing /terms + /privacy routes.
 */

const A = ApiEndpoints.admin;
const P = ApiEndpoints.legalPages;

export interface LegalPage {
  _id: string;
  slug: string;
  product: 'platform' | 'connect' | 'erp';
  kind: 'terms' | 'privacy' | 'guidelines';
  title: string;
  body: string;
  status: 'draft' | 'published';
  version: number;
  effectiveDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLegalPagePayload {
  slug: string;
  product: 'platform' | 'connect' | 'erp';
  kind: 'terms' | 'privacy' | 'guidelines';
  title: string;
  body?: string;
  status?: 'draft' | 'published';
  effectiveDate?: string;
}

export interface UpdateLegalPagePayload {
  title?: string;
  body?: string;
  status?: 'draft' | 'published';
  effectiveDate?: string;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function getLegalPages(): Promise<LegalPage[]> {
  const http = await serverHttp();
  return http.get(A.legalPages).then(unwrapServer<LegalPage[]>);
}

export async function getLegalPage(id: string): Promise<LegalPage> {
  const http = await serverHttp();
  return http.get(A.legalPageById(id)).then(unwrapServer<LegalPage>);
}

export async function createLegalPage(data: CreateLegalPagePayload): Promise<LegalPage> {
  const http = await serverHttp();
  return http.post(A.createLegalPage, data).then(unwrapServer<LegalPage>);
}

export async function updateLegalPage(
  id: string,
  data: UpdateLegalPagePayload,
): Promise<LegalPage> {
  const http = await serverHttp();
  return http.patch(A.updateLegalPage(id), data).then(unwrapServer<LegalPage>);
}

export async function publishLegalPage(id: string): Promise<LegalPage> {
  const http = await serverHttp();
  return http.post(A.publishLegalPage(id), {}).then(unwrapServer<LegalPage>);
}

export async function deleteLegalPage(id: string): Promise<{ message: string }> {
  const http = await serverHttp();
  return http.delete(A.deleteLegalPage(id)).then(unwrapServer<{ message: string }>);
}

// ── Public ───────────────────────────────────────────────────────────────────

/**
 * Public read for the marketing /terms + /privacy routes. Returns null when no
 * published version exists yet (backend 404s on draft-only / missing) so the page
 * can fall back to its placeholder copy instead of erroring.
 */
export async function getPublishedLegalPage(slug: string): Promise<LegalPage | null> {
  try {
    const http = await serverHttp();
    return await http.get(P.bySlug(slug)).then(unwrapServer<LegalPage>);
  } catch {
    return null;
  }
}
