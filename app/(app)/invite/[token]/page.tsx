import axios from 'axios';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import {
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import InviteClient from './InviteClient';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { ApiConfig } from '@/lib/api/config';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InvitePreview {
  token: string;
  workspaceName: string;
  workspaceType?: string;
  memberCount: number;
  invitedBy: string;
  role: string;
  identifier?: string;
  identifierType?: 'email' | 'mobile';
  isLinkedToTeamMember: boolean;
  requiresSignup: boolean;
  inviteId: string;
}

/**
 * Wave 4.8 W4.8.5 (2026-05-10) - public invite landing page.
 *
 * Server-side fetches invite preview, branches on response status:
 *   - 200 + requiresSignup=true  → render `<InviteClient>` w/ atomic signup-and-accept form
 *   - 200 + requiresSignup=false → existing-user CTA (sign in then use switcher Accept)
 *   - 400 / invalid              → invalid-invite empty state
 *   - 410 GONE                   → expired empty state
 *
 * Acceptance UX matches `project_auth_combined_signup.md` pattern (atomic
 * signup-and-accept) - no separate "accept" click for new users. Existing
 * users sign in then use the Wave 4.7 switcher Accept button.
 */
export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // P1.8-revert.16 (2026-05-14) - hoist cookies() to function-top
  // regardless of branch. Calling cookies() conditionally inside the
  // `!requiresSignup` branch interacted badly with Turbopack's
  // streaming pipeline + force-dynamic + the redirect() call below,
  // causing intermittent "context not found" errors on the cold-path
  // render. Reading cookies eagerly is cheap and makes the function's
  // dynamic shape stable.
  const cookieStore = await cookies();
  const authToken = cookieStore.get(ApiConfig.token.storageKey)?.value;

  // Public endpoint - no auth header. Direct axios call (server-side) to
  // avoid loading the full server HTTP client which assumes a JWT cookie.
  const apiBase = (env.serverBackendApiUrl || env.backendApiUrl).replace(/\/$/, '');
  let preview: InvitePreview | null = null;
  let status = 0;
  try {
    const res = await axios.get(`${apiBase}/${ApiEndpoints.invites.preview(token)}`, {
      validateStatus: () => true,
    });
    status = res.status;
    if (status >= 200 && status < 300) {
      preview = (res.data?.data ?? res.data) as InvitePreview;
    }
  } catch {
    status = 500;
  }

  if (status === 410) {
    return (
      <div className="bg-surface-secondary flex min-h-screen items-center justify-center">
        <EmptyStateLayout
          icon={<ClockCircleOutlined />}
          iconBgColor="var(--cr-warning-50)"
          title="Invite expired"
          description="This invite link is no longer valid. Ask the workspace owner to send a new invite."
          actions={[{ label: 'Sign in', href: '/auth', type: 'primary' }]}
        />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="bg-surface-secondary flex min-h-screen items-center justify-center">
        <EmptyStateLayout
          icon={<CloseCircleOutlined />}
          iconBgColor="var(--cr-danger-50)"
          title="Invite not found"
          description="This invite link is invalid or has been revoked. Reach out to the workspace owner for a fresh invite."
          actions={[{ label: 'Sign in', href: '/auth', type: 'primary' }]}
        />
      </div>
    );
  }

  if (!preview.requiresSignup) {
    // P1.8-revert.14 (2026-05-14) - auth-aware fast-path. When the
    // invitee opens the link in a browser where they're already signed
    // in, skip the "Sign in to accept" CTA entirely and redirect them
    // straight to the dashboard. The dashboard's W4.7 inviteId handler
    // auto-accepts the invite on mount.
    //
    // Mismatch case (logged in as wrong user): redirect still works -
    // the BE accept endpoint refuses tokens not bound to the caller, so
    // the dashboard quietly skips the accept attempt + the user can use
    // the workspace switcher / sign out manually.
    const dashboardWithInvite = `/dashboard?inviteId=${encodeURIComponent(preview.inviteId)}`;
    if (authToken) {
      redirect(dashboardWithInvite);
    }
    // Wave 4.7 (2026-05-10) - preserve inviteId through the /auth flow so
    // /dashboard auto-accepts on first mount. Encodes the nested
    // /dashboard?inviteId=<id> as a single `redirect` param so the existing
    // AuthClient redirect handler carries it through unchanged. Falls back
    // to manual switcher Accept if the param is dropped (e.g. password
    // manager prefill drops the query).
    const signInHref = `/auth?redirect=${encodeURIComponent(dashboardWithInvite)}`;
    return (
      <div className="bg-surface-secondary flex min-h-screen items-center justify-center">
        <EmptyStateLayout
          icon={<ExclamationCircleOutlined />}
          iconBgColor="var(--cr-info-50)"
          title="You already have an account"
          description={`Sign in to accept your invite to ${preview.workspaceName}. We'll add you to the workspace automatically once you're signed in.`}
          actions={[{ label: 'Sign in to accept', href: signInHref, type: 'primary' }]}
        />
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary flex min-h-screen items-center justify-center py-10">
      {/* P1.8-revert.16 (2026-05-14) - Suspense boundary added to mirror
          the /auth/page.tsx pattern. Without it, the async server
          component's dynamic shape (cookies + axios + conditional
          redirect) collides with the client component's NextIntlClient
          Provider context lookup on Turbopack + Next 16, producing the
          "context not found" recoverable error. Wrapping InviteClient
          in Suspense isolates the boundary cleanly. */}
      <Suspense fallback={<div className="min-h-[60vh] w-full" />}>
        <InviteClient
          token={token}
          workspaceName={preview.workspaceName}
          role={preview.role}
          invitedBy={preview.invitedBy}
          identifier={preview.identifier ?? ''}
          identifierType={preview.identifierType ?? 'mobile'}
        />
      </Suspense>
    </div>
  );
}
