import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import { signInWithMobileAndPin } from '../utils/auth';

/**
 * Wave 4.13 (2026-05-10) - member storage-state setup.
 *
 * Signs in once as a pre-seeded second user (E2E_MEMBER_MOBILE /
 * E2E_MEMBER_PIN). Used by L2 (existing-user accept) + L4 (removed-member
 * 403 verification) + L5 (empty-workspace redirect).
 *
 * Required env vars:
 *   E2E_MEMBER_MOBILE - pre-seeded second-user mobile (distinct from owner)
 *   E2E_MEMBER_PIN    - App-Lock PIN, default "000000"
 */

const MEMBER_STORAGE = path.join(process.cwd(), 'tests/e2e/.auth/member.json');

setup('authenticate member', async ({ page }) => {
  const mobile = process.env.E2E_MEMBER_MOBILE;
  const pin = process.env.E2E_MEMBER_PIN ?? '000000';
  expect(mobile, 'E2E_MEMBER_MOBILE env var must be set').toBeTruthy();

  await signInWithMobileAndPin(page, mobile!, pin);
  await expect(page).toHaveURL(/\/dashboard|\/auth\/setup-workspace/, {
    timeout: 30_000,
  });

  await page.context().storageState({ path: MEMBER_STORAGE });
});
