import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AdSenseLoader from '@/components/connect/AdSenseLoader';
import { getConnectEntryState } from '@/features/connect/profile.actions';
import ConnectComingSoon from '@/features/connect/home/ConnectComingSoon';
import ConnectLockedEntry from '@/features/connect/home/ConnectLockedEntry';
import PolicyGate from '@/components/policy/PolicyGate';
import ConnectAppFooter from '@/components/connect/ConnectAppFooter';
import { GlobalAnnouncer } from '@/components/connect';
import HideOnPaths from '@/components/connect/HideOnPaths';

export const metadata: Metadata = {
  title: { template: '%s | ManekHR', default: 'Connect' },
  description:
    'ManekHR Connect - the marketplace, jobs and professional network for the embroidery industry.',
};

/**
 * Connect shell layout - the single chokepoint for every authenticated
 * `/connect/*` route. Gates entry server-side: a locked session sees the PIN
 * screen, a signed-out session is routed to sign-in, a not-enabled user sees
 * the "coming soon" panel, and a user who has not accepted the Connect policy
 * is held at the full-screen `PolicyGate` before any Connect page renders.
 * Each gate state renders WITHOUT `DashboardLayout` (no nav chrome to click
 * around). See docs/connect/specs/2026-05-19-dual-policy-design.md §4.3.
 *
 * `connectEnabled` is not in the JWT, so the check is a backend call.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const entryRes = await getConnectEntryState();

  if (!entryRes.ok) {
    // App-Locked session (423) - show the PIN unlock screen.
    if (entryRes.locked) return <ConnectLockedEntry />;
    // Genuinely signed out - a 401 that survived the refresh-retry. Route to
    // sign-in. NEVER the "coming soon" panel: a revoked token is not a missing
    // `connectEnabled` flag.
    // `reauth=1` tells AuthClient this bounce came from a SERVER-side auth
    // failure (token rejected after the refresh-retry). Without it a stale
    // client session (localStorage user present, server cookie invalid) would
    // ping-pong: this layout -> /auth -> (client thinks authed) -> back here.
    // AuthClient reads the flag, clears the stale session, and shows the login
    // form instead of redirecting back. Keep in sync with AuthClient's landing
    // effect. -> app/(app)/auth/AuthClient.tsx
    if (entryRes.authFailed) redirect('/auth?redirect=/connect/feed&reauth=1');
    // Any other failure - rethrow. A layout-level throw is caught by a parent
    // error boundary (Next.js: a segment's own error.tsx does not catch its
    // layout's errors), which renders the error fallback.
    throw new Error(entryRes.error || 'Failed to load Connect.');
  }

  const entry = entryRes.data;
  if (!entry.connectEnabled) return <ConnectComingSoon />;
  // Forced policy consent - must come AFTER connectEnabled (a not-enabled user
  // also reports policyAccepted=false; they get "coming soon", not the gate).
  if (!entry.policyAccepted) return <PolicyGate product="connect" />;

  return (
    <DashboardLayout mode="connect">
      {/* Sticky-footer column. A flex column that FILLS the content area via the
          shell's flex chain (DashboardLayout makes <Content> a flex column and
          the capture-root `flex-1` in connect mode), so `flex-1` here grows the
          column to the true content-area bottom. The footer's `mt-auto` then
          absorbs the free space and pins it flush to the bottom on short pages
          (e.g. an empty Network / feed state); on a tall page mt-auto collapses
          to 0 and `pt-10` keeps the gap above the footer. Replaces an earlier
          `min-h-[calc(100dvh-12rem)]` magic number that overshot the real chrome
          on desktop and left a dead gap BELOW the footer (2026-06-17 footer fix).
          Keep in sync with `connectFill` in DashboardLayout. */}
      <div className="flex flex-1 flex-col">
        <GlobalAnnouncer />
        {/* Google AdSense loader - env-gated + deduped + Connect-only. This is the
            SOLE mount point for the loader, so the script never loads on ERP /
            marketing / kiosk / portal / admin routes. The <AdSlot> units fill via
            adsbygoogle.push once it is ready. */}
        <AdSenseLoader />
        {children}
        {/* Hidden on full-screen / dense management surfaces: the inbox fills the
            viewport like a native chat app, and the storefront ('/connect/stores/<id>')
            and company-page ('/connect/pages/<id>') manage consoles are dense
            dashboards where a footer is noise. Hiding it on the company-page console
            also lets its right Rail stay pinned: a footer below the column would
            otherwise drag the sticky rail off-screen on short tabs (see
            ManageCompanyPageScreen + Rail.tsx). The pages hub ('/connect/pages',
            no trailing slash) keeps its footer. */}
        <HideOnPaths prefix={['/connect/inbox', '/connect/stores/', '/connect/pages/']}>
          {/* data-connect-bottom-footer: the mutual-exclusion hook. On a page
              with a right-rail footer this wrapper is hidden at the rail's
              breakpoint (so the two never double up); below the breakpoint the
              rail is gone and this takes over. See app/globals.css. */}
          <div className="mt-auto pt-10" data-connect-bottom-footer>
            <ConnectAppFooter />
          </div>
        </HideOnPaths>
      </div>
    </DashboardLayout>
  );
}
