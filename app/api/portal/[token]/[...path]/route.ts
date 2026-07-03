import { NextRequest, NextResponse } from 'next/server';
import { portalHttp } from '@/lib/api/portal-http';

/**
 * Same-origin proxy for the public party portal (Phase 16 / FIN-15-03).
 *
 * Client-side tabs hit /api/portal/[token]/[...path]; this handler forwards
 * the request to the backend with the X-Portal-Token header injected on the
 * server. The portal JWT therefore NEVER appears in any client-side fetch
 * URL (it lives only in the path segment, which IS the auth method by
 * design - see threat T-16-07-01).
 *
 * Cache-Control: private, no-store on every response prevents shared caches
 * from holding party-private data (T-16-07-05 mitigation).
 */
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

function isPdfPath(path: string): boolean {
  // Match the backend's `/portal/invoices/:id/pdf` endpoint (NOT pdf-url, which is JSON).
  return /\/pdf(\?|$)/.test(path);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; path: string[] }> },
) {
  const { token, path } = await params;
  const subPath = (path ?? []).join('/');
  const search = req.nextUrl.search ?? '';
  const url = `/portal/${subPath}${search}`;
  const http = portalHttp(token);

  if (isPdfPath(url)) {
    const r = await http.get(url, { responseType: 'arraybuffer' });
    if (r.status < 200 || r.status >= 300) {
      return NextResponse.json(
        { success: false, status: r.status, message: 'PDF unavailable' },
        { status: r.status, headers: NO_STORE_HEADERS },
      );
    }
    const cd =
      (r.headers?.['content-disposition'] as string | undefined) ??
      `attachment; filename="invoice.pdf"`;
    return new NextResponse(r.data, {
      status: r.status,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': cd,
        ...NO_STORE_HEADERS,
      },
    });
  }

  const r = await http.get(url);
  return NextResponse.json(r.data, {
    status: r.status,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; path: string[] }> },
) {
  const { token, path } = await params;
  const subPath = (path ?? []).join('/');
  const search = req.nextUrl.search ?? '';
  const url = `/portal/${subPath}${search}`;
  const http = portalHttp(token);

  let body: unknown = undefined;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  const r = await http.post(url, body ?? {});
  // Backend returns 204 No Content for /page-view - preserve that shape.
  if (r.status === 204) {
    return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json(r.data, {
    status: r.status,
    headers: NO_STORE_HEADERS,
  });
}
