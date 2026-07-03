'use client';

/**
 * Same-origin client-side fetch helpers for portal tabs. All requests go
 * through /api/portal/[token]/[...path] which keeps the JWT server-side
 * (T-16-07-01 mitigation).
 */

async function getJson<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`/api/portal/${encodeURIComponent(token)}/${path}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`portal fetch failed: ${res.status}`);
  }
  const body = await res.json();
  return (body?.data ?? body) as T;
}

export const portalClient = {
  statement: (token: string) => getJson<any>(token, 'statement'),
  invoices: (token: string, page = 1, limit = 20) =>
    getJson<any>(token, `invoices?page=${page}&limit=${limit}`),
  invoicePdfUrl: (token: string, invoiceId: string) =>
    getJson<{ url: string; expiresAt: string }>(token, `invoices/${invoiceId}/pdf-url`),
  receipts: (token: string) => getJson<any>(token, 'receipts'),
  aging: (token: string) => getJson<any>(token, 'aging'),
  pageView: (token: string, tab: string) =>
    fetch(`/api/portal/${encodeURIComponent(token)}/page-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab }),
      cache: 'no-store',
      keepalive: true,
    }).catch(() => undefined),
};

export function formatINRPaise(paise: number): string {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
