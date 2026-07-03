import { portalHttp } from '@/lib/api/portal-http';
import PortalShell from './PortalShell';
import RevokedPage from './error-states/RevokedPage';
import ExpiredPage from './error-states/ExpiredPage';
import RateLimitedPage from './error-states/RateLimitedPage';
import GenericErrorPage from './error-states/GenericErrorPage';

export const dynamic = 'force-dynamic';
// Portal data is per-party private - never cache at the edge / CDN layer.
export const revalidate = 0;

type PortalTab = 'statement' | 'invoices' | 'receipts' | 'aging';
const VALID_TABS: PortalTab[] = ['statement', 'invoices', 'receipts', 'aging'];

// View-only portal (owner decision 2026-06-06, feedback_no_payments_in_billing):
// no payment fields, no upiVpa. Statement / invoices / receipts / aging only.
interface PortalContextDto {
  firm: { name: string; logo?: string; primaryColor?: string };
  party: { name: string };
  outstanding: number;
  scope?: string[];
}

/**
 * Public portal entry - renders the firm-branded shell or the appropriate
 * error landing depending on the backend's response status.
 *
 * Status mapping (mirrors PortalTokenGuard / PortalThrottlerGuard):
 *  - 401 Unauthorized -> expired/invalid signature/wrong audience
 *  - 410 Gone         -> revoked
 *  - 429              -> rate-limited
 *  - other 4xx/5xx    -> generic error
 */
export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const http = portalHttp(token);
  const ctxRes = await http.get('/portal/context');

  if (ctxRes.status === 401) return <ExpiredPage />;
  if (ctxRes.status === 410) return <RevokedPage />;
  if (ctxRes.status === 429) return <RateLimitedPage />;
  if (ctxRes.status < 200 || ctxRes.status >= 300) return <GenericErrorPage />;

  const payload: PortalContextDto = ctxRes.data?.data ?? ctxRes.data ?? null;
  if (!payload?.firm || !payload?.party) return <GenericErrorPage />;

  const requested = (sp?.tab ?? '').toLowerCase() as PortalTab;
  const activeTab: PortalTab = VALID_TABS.includes(requested) ? requested : 'statement';

  return (
    <PortalShell
      token={token}
      activeTab={activeTab}
      firmName={payload.firm.name}
      partyName={payload.party.name}
      logoUrl={payload.firm.logo}
      brandPrimary={payload.firm.primaryColor}
      outstandingPaise={payload.outstanding ?? 0}
      scope={payload.scope ?? []}
    />
  );
}
