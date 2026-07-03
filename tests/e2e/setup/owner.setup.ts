import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import { signInWithMobileAndPin } from '../utils/auth';

/**
 * Wave 4.13 (2026-05-10) - owner storage-state setup.
 *
 * Signs in once as a pre-seeded owner account (E2E_OWNER_MOBILE /
 * E2E_OWNER_PIN), saves the resulting localStorage / cookies to
 * `tests/e2e/.auth/owner.json`. The RBAC project consumes this storage
 * via `test.use({ storageState })` so each scenario starts already-signed-in
 * without burning OTP mock cycles per spec.
 *
 * Required env vars (provisioned by owner before first run):
 *   E2E_OWNER_MOBILE - pre-seeded owner mobile, e.g. "9999900001"
 *   E2E_OWNER_PIN    - App-Lock PIN, default "000000" (matches W4.12 session)
 */

const OWNER_STORAGE = path.join(process.cwd(), 'tests/e2e/.auth/owner.json');

setup('authenticate owner', async ({ page }) => {
  const mobile = process.env.E2E_OWNER_MOBILE;
  const pin = process.env.E2E_OWNER_PIN ?? '000000';
  expect(mobile, 'E2E_OWNER_MOBILE env var must be set').toBeTruthy();

  await signInWithMobileAndPin(page, mobile!, pin);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page.context().storageState({ path: OWNER_STORAGE });
});
