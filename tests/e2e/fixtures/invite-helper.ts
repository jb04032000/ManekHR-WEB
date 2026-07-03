import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Wave 4.13 (2026-05-10) - invite-flow fixtures for the RBAC E2E spec.
 *
 * Two helpers:
 *   - `createInvite` drives the owner-side Grant Access modal and returns
 *     the freshly-generated invite URL (W4.10 surfaces it in the success
 *     view; we extract from the readonly textbox).
 *   - `seedExpiredInvite` writes `inviteExpiry: <past>` directly to the
 *     `workspacemembers` Mongo collection so L7 can render the 410 path
 *     without waiting 7 days.
 */

interface CreateInviteOpts {
  /** TeamMember._id of the directory employee getting access. */
  memberId: string;
  /** Human label of the role to pick. Defaults to "Member" (W4.11 seed). */
  roleName?: string;
}

interface CreateInviteResult {
  inviteUrl: string;
  /** Token slice from `…/invite/<token>`. */
  token: string;
}

export async function createInvite(
  ownerPage: Page,
  opts: CreateInviteOpts,
): Promise<CreateInviteResult> {
  const { memberId, roleName = 'Member' } = opts;

  // Auto-open the Grant Access modal via the W4.4 deep-link `?grantAccess=`.
  await ownerPage.goto(`/dashboard/team?grantAccess=${encodeURIComponent(memberId)}`);

  // Modal opens; W4.11.5 pre-selects the Member role. If a different role is
  // requested, switch via the combobox.
  if (roleName !== 'Member') {
    await ownerPage.getByRole('combobox', { name: /search/i }).click();
    await ownerPage.getByRole('option', { name: roleName }).first().click();
  }

  // Pick "Link only" so BE returns inviteToken in the response.
  await ownerPage.getByRole('radio', { name: /link only/i }).click();
  await ownerPage.getByRole('button', { name: /send invite/i }).click();

  // W4.10 success view: readonly textbox holds the URL. Use evaluate as a
  // resilient fallback in case role/label resolution drifts.
  const inviteUrl = await ownerPage.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[readonly]'));
    const match = inputs.find((el) => typeof el.value === 'string' && /\/invite\//.test(el.value));
    return match?.value ?? '';
  });

  expect(inviteUrl, 'Grant success view should render the invite URL').toMatch(/\/invite\//);
  const token = inviteUrl.split('/invite/').pop() ?? '';
  expect(token, 'invite URL should contain a token segment').toBeTruthy();

  // Dismiss modal to leave the team hub in a clean state.
  await ownerPage.getByRole('button', { name: /^done$/i }).click();

  return { inviteUrl, token };
}

/**
 * Writes `inviteExpiry` to a past timestamp on the WorkspaceMember row that
 * carries the supplied invite token hash. Used only by the L7 expired-invite
 * scenario.
 *
 * Requires `MONGO_URI` env var (same connection string as BE). Imports
 * `mongodb` lazily so the spec file doesn't pull in the driver when the
 * fixture isn't called.
 */
export async function seedExpiredInvite(token: string): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('seedExpiredInvite: MONGO_URI env var required for direct DB write');
  }

  // SHA-256 hash mirrors BE token storage (workspaces.service.inviteMember
  // stores `inviteTokenHash`, never the raw token).
  const { createHash } = await import('crypto');
  const hash = createHash('sha256').update(token).digest('hex');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    // Database name extracted from URI path; default to 'crewroster' if
    // the URI didn't carry one (mongo-client default).
    const dbName = new URL(uri).pathname.replace(/^\//, '') || 'crewroster';
    const db = client.db(dbName);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db
      .collection('workspacemembers')
      .updateOne({ inviteTokenHash: hash }, { $set: { inviteExpiry: past } });
    if (result.matchedCount === 0) {
      throw new Error(
        `seedExpiredInvite: no WorkspaceMember matched tokenHash for token (first 8 chars: ${token.slice(0, 8)}…)`,
      );
    }
  } finally {
    await client.close();
  }
}
