import { NextRequest, NextResponse } from 'next/server';
import { serverHttp } from '@/lib/api/server-client';

/**
 * Phase 16 / FIN-15-04 - same-origin proxy for invoice/credit-note print PDFs.
 *
 * Client-side iframe (`<PrintPreviewIframe />`) hits this route to render PDFs
 * with `?locale=en|gu|hi`. Same-origin keeps the auth cookie/JWT in flow and
 * mitigates T-16-08-03 (cross-origin cookie leak).
 *
 * Path params: type ∈ {sale-invoice, credit-note, purchase, debit-note}.
 * Required query: wsId, firmId, locale.
 */
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set(['sale-invoice', 'credit-note', 'purchase', 'debit-note']);
const ALLOWED_LOCALES = new Set(['en', 'gu', 'hi']);

const TYPE_TO_BACKEND_PATH: Record<string, (wsId: string, firmId: string, id: string) => string> = {
  'sale-invoice': (wsId, firmId, id) =>
    `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/print`,
  'credit-note': (wsId, firmId, id) =>
    `workspaces/${wsId}/finance/firms/${firmId}/sales/credit-notes/${id}/print`,
  purchase: (wsId, firmId, id) =>
    `workspaces/${wsId}/finance/firms/${firmId}/purchases/${id}/print`,
  'debit-note': (wsId, firmId, id) =>
    `workspaces/${wsId}/finance/firms/${firmId}/purchases/debit-notes/${id}/print`,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: 'invalid_document_type' }, { status: 400 });
  }

  const wsId = req.nextUrl.searchParams.get('wsId') ?? '';
  const firmId = req.nextUrl.searchParams.get('firmId') ?? '';
  const localeRaw = req.nextUrl.searchParams.get('locale') ?? 'en';
  const locale = ALLOWED_LOCALES.has(localeRaw) ? localeRaw : 'en';

  if (!wsId || !firmId) {
    return NextResponse.json({ error: 'wsId_and_firmId_required' }, { status: 400 });
  }

  const backendPath = TYPE_TO_BACKEND_PATH[type](wsId, firmId, id);
  const http = await serverHttp();

  try {
    const r = await http.get(backendPath, {
      params: { locale },
      responseType: 'arraybuffer',
    });
    return new Response(r.data as ArrayBuffer, {
      status: r.status,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown } };
    const status = e?.response?.status ?? 502;
    return NextResponse.json({ error: 'print_proxy_failed', upstreamStatus: status }, { status });
  }
}
