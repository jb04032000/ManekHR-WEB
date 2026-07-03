import { describe, it, expect } from 'vitest';
import { resolvePostAuthTarget } from './post-auth-target';

/**
 * Post-auth routing helper - the single source of truth for "where do I send
 * this user after auth / PIN setup". Replaces the four copy-pasted
 * "workspaceless -> /connect/feed" blocks (AuthClient.doRedirect, AuthClient's
 * landing useEffect, setup-pin computePostPinTarget + its zero-workspace
 * branch). The behaviour change vs. the old inline logic: a WORKSPACELESS user
 * who intends ERP (accepted the ERP policy but NOT the Connect policy) is
 * routed to /auth/setup-workspace to finish ERP onboarding, NEVER force-pushed
 * to /connect/feed. Genuine Connect users (accepted Connect, or neither/both)
 * still land on /connect/feed. See memory project_erp_connect_signup_misroute.
 */
describe('resolvePostAuthTarget', () => {
  const erpIntent = { hasWorkspace: false, erpPolicyAcceptedAt: '2026-06-24T00:00:00Z' };
  const connectIntent = { hasWorkspace: false, connectPolicyAcceptedAt: '2026-06-24T00:00:00Z' };

  it('routes admins to /admin even when workspaceless', () => {
    expect(resolvePostAuthTarget({ user: { isAdmin: true, hasWorkspace: false } })).toBe('/admin');
  });

  it('routes a forced password reset to the security page (non-admin)', () => {
    expect(resolvePostAuthTarget({ user: { hasWorkspace: true }, mustResetPassword: true })).toBe(
      '/account/security#password',
    );
  });

  it('sends a user WITH a workspace to /dashboard by default', () => {
    expect(resolvePostAuthTarget({ user: { hasWorkspace: true } })).toBe('/dashboard');
  });

  it('honours a safe requested redirect for a user with a workspace', () => {
    expect(
      resolvePostAuthTarget({
        user: { hasWorkspace: true },
        requestedRedirect: '/dashboard/salary',
      }),
    ).toBe('/dashboard/salary');
  });

  // ── The fix: ERP-intent workspaceless users go to setup-workspace ──
  it('sends a workspaceless ERP-intent user to /auth/setup-workspace, NOT /connect/feed', () => {
    expect(resolvePostAuthTarget({ user: erpIntent })).toBe('/auth/setup-workspace');
  });

  it('sends a workspaceless Connect-intent user to /connect/feed', () => {
    expect(resolvePostAuthTarget({ user: connectIntent })).toBe('/connect/feed');
  });

  it('treats a workspaceless user who accepted BOTH policies as Connect (not ERP-only)', () => {
    expect(
      resolvePostAuthTarget({
        user: {
          hasWorkspace: false,
          erpPolicyAcceptedAt: '2026-06-24T00:00:00Z',
          connectPolicyAcceptedAt: '2026-06-24T00:00:00Z',
        },
      }),
    ).toBe('/connect/feed');
  });

  it('defaults a workspaceless user with NO accepted policy to /connect/feed', () => {
    expect(resolvePostAuthTarget({ user: { hasWorkspace: false } })).toBe('/connect/feed');
  });

  // ── Requested-redirect sanitisation (preserve existing behaviour) ──
  it('collapses a stale ?redirect=/dashboard for a workspaceless ERP-intent user to setup-workspace', () => {
    expect(resolvePostAuthTarget({ user: erpIntent, requestedRedirect: '/dashboard' })).toBe(
      '/auth/setup-workspace',
    );
  });

  it('collapses a stale ?redirect=/dashboard for a workspaceless Connect user to /connect/feed', () => {
    expect(
      resolvePostAuthTarget({ user: connectIntent, requestedRedirect: '/dashboard/team' }),
    ).toBe('/connect/feed');
  });

  it('never honours a ?redirect into /admin for a non-admin user', () => {
    expect(
      resolvePostAuthTarget({ user: { hasWorkspace: true }, requestedRedirect: '/admin/plans' }),
    ).toBe('/dashboard');
  });

  it('collapses bare /connect to /connect/feed', () => {
    expect(resolvePostAuthTarget({ user: connectIntent, requestedRedirect: '/connect' })).toBe(
      '/connect/feed',
    );
  });

  it('defaults a null user to /dashboard (matches prior doRedirect fall-through)', () => {
    expect(resolvePostAuthTarget({ user: null })).toBe('/dashboard');
  });
});
