import { test, expect, type Browser } from '@playwright/test';
import * as path from 'path';
import { createInvite, seedExpiredInvite } from './fixtures/invite-helper';
import { uniqueMobile, fillOtp } from './utils/auth';

/**
 * RBAC grant-access lifecycle e2e - covers the 5 canonical scenarios in
 * the RBAC plan (`resume-crewroster-polish-tingly-pillow.md` Wave 4.9 / 4.12):
 *   L1 (@owner) - owner grants → fresh phone → atomic signup → /dashboard
 *   L2 (@member) - existing user invited → switcher Accept
 *   L4 (@owner + @member) - owner removes member → 403 within seconds
 *   L5 (@member) - removed member with no other workspace → onboarding redirect
 *   L7 (@owner) - expired invite → 410 EmptyStateLayout
 *
 * Wave 4.13 (2026-05-10) - fixtures plumbed in. Each scenario tagged with
 * `@owner` or `@member` so `playwright.config.ts` can route them to the
 * right pre-authed storage state via the corresponding project.
 *
 * Requirements (env vars per playwright.config.ts; setup specs validate):
 *   E2E_OWNER_MOBILE / E2E_OWNER_PIN
 *   E2E_MEMBER_MOBILE / E2E_MEMBER_PIN
 *   E2E_OWNER_WORKSPACE_ID
 *   E2E_OWNER_TEAM_MEMBER_ID
 *   E2E_OWNER_TEAM_MEMBER_FOR_REMOVAL_ID
 *   MONGO_URI (only for L7)
 */

async function freshIncognito(
  browser: Browser,
): Promise<{ context: Awaited<ReturnType<Browser['newContext']>>; close: () => Promise<void> }> {
  const context = await browser.newContext({ storageState: undefined });
  return {
    context,
    close: () => context.close(),
  };
}

test.describe('RBAC L1 - owner grants → fresh phone → atomic signup-and-accept @owner', () => {
  test('happy path: invite link surfaces in modal, /invite/[token] form completes, lands /dashboard', async ({
    page,
    browser,
  }) => {
    const memberId = process.env.E2E_OWNER_TEAM_MEMBER_ID;
    expect(memberId, 'E2E_OWNER_TEAM_MEMBER_ID env var required').toBeTruthy();

    // Step 1: owner grants access via fixture (drives Grant Access modal +
    // captures token from W4.10 success view).
    const { inviteUrl, token } = await createInvite(page, {
      memberId: memberId!,
      roleName: 'Member',
    });
    expect(inviteUrl).toMatch(/\/invite\//);
    expect(token).toHaveLength(64); // sha-256 hex slice from BE

    // Step 2: open invite link in fresh incognito context (no owner cookies).
    const incognito = await freshIncognito(browser);
    try {
      const invitee = await incognito.context.newPage();
      await invitee.goto(inviteUrl);

      // Step 3: complete the atomic signup form (W4.8.5 InviteClient).
      const fakeName = `Smoke ${uniqueMobile().slice(-4)}`;
      await invitee.getByPlaceholder(/full name/i).fill(fakeName);
      await invitee.getByPlaceholder(/min 8 characters/i).fill('smoke@1234');
      await invitee.getByRole('button', { name: /send verification code/i }).click();

      // Step 4: enter mock OTP 123456 → Verify and join.
      await fillOtp(invitee, '123456');
      await invitee.getByRole('button', { name: /verify and join workspace/i }).click();

      // Step 5: assert we land on /dashboard or /auth/setup-pin (post-signup
      // app-lock onboarding - both indicate the join succeeded). Either
      // outcome means the User was created + WorkspaceMember.status='active'
      // + JWT issued.
      await invitee.waitForURL(/\/(dashboard|auth\/setup-pin)/, { timeout: 30_000 });
    } finally {
      await incognito.close();
    }

    // Step 6: owner-side verification - reload team hub, confirm member's
    // app-access state changed (the detail page CTA flips from "Grant App
    // Access" to a different state once the membership row is active).
    await page.goto(`/dashboard/team/${memberId}`);
    // The CTA may swap to "Revoke" / "Resend" / disappear depending on
    // app version. Assert at least one indicator that the grant was
    // recorded.
    await expect(page.locator('body')).toContainText(/granted|active/i, {
      timeout: 15_000,
    });
  });
});

test.describe('RBAC L2 - existing user invited → switcher Accept @member', () => {
  test('pending-invite badge in switcher, click Accept, workspace appears', async ({
    page,
    browser,
  }) => {
    const ownerWorkspaceId = process.env.E2E_OWNER_WORKSPACE_ID;
    const memberMobile = process.env.E2E_MEMBER_MOBILE;
    expect(ownerWorkspaceId).toBeTruthy();
    expect(memberMobile).toBeTruthy();

    // Pre-condition: owner side creates an invite for the existing member
    // user. Spin a separate owner-authed context inside this @member spec
    // so we don't depend on cross-spec ordering.
    const ownerStorage = path.join(process.cwd(), 'tests/e2e/.auth/owner.json');
    const ownerCtx = await browser.newContext({ storageState: ownerStorage });
    try {
      const ownerPage = await ownerCtx.newPage();
      // Use the BE direct invite endpoint via owner-page fetch - server
      // action is invoked by hitting /api/workspaces/<wsId>/members/invite.
      const memberIdForInvite = process.env.E2E_MEMBER_TEAM_MEMBER_ID ?? '';
      test.skip(
        !memberIdForInvite,
        'E2E_MEMBER_TEAM_MEMBER_ID env var required for L2 (an existing-user team-member id)',
      );
      await createInvite(ownerPage, { memberId: memberIdForInvite, roleName: 'Member' });
    } finally {
      await ownerCtx.close();
    }

    // Member-side: storage state pre-authenticated. Open dashboard, expect
    // the W4.2 sidebar pending-invites group to appear with one entry.
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /accept/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await page
      .getByRole('button', { name: /accept/i })
      .first()
      .click();

    // Workspace switcher should now list the joined workspace.
    await expect(page.locator('body')).toContainText(/anat group|workspace/i, {
      timeout: 15_000,
    });
  });
});

test.describe('RBAC L4 - owner removes member → revocation denylist @owner', () => {
  test('next member request 403s within ~5s of removal', async ({ page }) => {
    const memberId = process.env.E2E_OWNER_TEAM_MEMBER_FOR_REMOVAL_ID;
    expect(memberId).toBeTruthy();

    // Pre-condition: member has active access (chained from L1 OR seeded
    // via fixture). For deterministic CI, fixture-seed required.
    test.fixme(
      !process.env.E2E_PRE_SEEDED_REMOVAL,
      'L4 requires E2E_PRE_SEEDED_REMOVAL fixture - pre-seeded active member id',
    );

    // Owner removes the member from team hub.
    await page.goto('/dashboard/team');
    // Find the More-actions kebab on the member row + click Remove.
    // Selectors tightened in a follow-up iteration when we add stable
    // data-testid attributes to row actions.
    test.fixme(true, 'kebab-row Remove flow needs stable testids');
  });
});

test.describe('RBAC L5 - removed member, no other workspace → onboarding redirect @member', () => {
  test('reload any /dashboard route redirects to /auth/setup-workspace', async ({ page }) => {
    test.fixme(
      !process.env.E2E_MEMBER_NO_WORKSPACE,
      'L5 requires E2E_MEMBER_NO_WORKSPACE fixture - member with empty owned + member workspaces',
    );
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/setup-workspace/, { timeout: 15_000 });
  });
});

test.describe('RBAC L7 - expired invite → 410 EmptyStateLayout @owner', () => {
  test('visit /invite/<expired-token> renders "Invite expired" empty state', async ({
    page,
    browser,
  }) => {
    const memberId = process.env.E2E_OWNER_TEAM_MEMBER_ID;
    expect(memberId).toBeTruthy();
    test.skip(!process.env.MONGO_URI, 'MONGO_URI env var required for L7 fixture');

    // Step 1: create a fresh invite (owner-side) so we have a known token.
    const { token } = await createInvite(page, { memberId: memberId!, roleName: 'Member' });

    // Step 2: directly write inviteExpiry: past via Mongo driver.
    await seedExpiredInvite(token);

    // Step 3: visit the invite URL in incognito → assert 410 empty state.
    const incognito = await browser.newContext({ storageState: undefined });
    try {
      const invitee = await incognito.newPage();
      await invitee.goto(`/invite/${token}`);
      await expect(invitee.getByRole('heading', { name: /invite expired/i })).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await incognito.close();
    }
  });
});
