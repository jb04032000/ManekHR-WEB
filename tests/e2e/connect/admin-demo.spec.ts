import { test, expect } from '@playwright/test';
import { signInWithMobileAndPin } from '../utils/auth';

/**
 * Admin "Connect demo manager" smoke. Needs a PLATFORM-ADMIN account (isAdmin),
 * which the demo personas are not — so it's gated on env and skipped otherwise.
 *   E2E_ADMIN_MOBILE = an admin account's mobile
 *   E2E_ADMIN_PIN    = its App-Lock PIN (default 000000)
 */
const ADMIN_MOBILE = process.env.E2E_ADMIN_MOBILE;
const ADMIN_PIN = process.env.E2E_ADMIN_PIN ?? '000000';

test.describe('Admin — Connect demo manager', () => {
  test.skip(!ADMIN_MOBILE, 'Set E2E_ADMIN_MOBILE (a platform admin) to run this spec');

  test('lists demo accounts and shows controls', async ({ page }) => {
    await signInWithMobileAndPin(page, ADMIN_MOBILE as string, ADMIN_PIN);
    await page.goto('/admin/connect/demo');
    await expect(page.getByText(/demo accounts/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('9100000001').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /clear all/i })).toBeVisible();
  });
});
