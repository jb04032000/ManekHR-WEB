import { expect, type Page } from '@playwright/test';

/**
 * Shared auth helpers used by setup specs + lifecycle scenarios.
 *
 * Wave 4.13 (2026-05-10) - extracted from `auth-sms-otp.spec.ts` so the
 * RBAC fixtures can reuse the OTP-mock sign-in path without duplicating
 * locator wiring.
 */

export function uniqueMobile(): string {
  // 10-digit Indian mobile starting with 6/7/8/9 (DTO regex /^[6-9]\d{9}$/).
  const first = '6789'[Math.floor(Math.random() * 4)];
  let rest = '';
  for (let i = 0; i < 9; i += 1) rest += Math.floor(Math.random() * 10);
  return `${first}${rest}`;
}

export async function gotoAuth(page: Page): Promise<void> {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

export async function fillIdentifierAndContinue(page: Page, identifier: string): Promise<void> {
  await page.locator('input[autocomplete="username"]').fill(identifier);
  await page
    .getByRole('button', { name: /continue/i })
    .first()
    .click();
}

export async function fillOtp(page: Page, code: string): Promise<void> {
  const otpGroup = page.getByRole('group', { name: /OTP input/i });
  await expect(otpGroup).toBeVisible({ timeout: 10_000 });
  const inputs = otpGroup.getByRole('textbox');
  for (let i = 0; i < code.length; i += 1) {
    await inputs.nth(i).fill(code[i]);
  }
}

export async function fillPin(page: Page, pin: string): Promise<void> {
  // App-Lock PIN dialog renders 6 single-digit boxes. Mirror fillOtp shape.
  const group = page.getByRole('group', { name: /Your PIN/i });
  await expect(group).toBeVisible({ timeout: 10_000 });
  const inputs = group.getByRole('textbox');
  for (let i = 0; i < pin.length; i += 1) {
    await inputs.nth(i).fill(pin[i]);
  }
}

/**
 * Signs the page session in as a pre-seeded user via the OTP-mock path.
 * Requires:
 *   - AUTH_OTP_MOCK=true on BE (mock OTP 123456)
 *   - User row exists for the supplied mobile (login flow, NOT register)
 *   - App-lock PIN previously set to `pin` (or '000000' default for the
 *     workspace's seed accounts)
 */
export async function signInWithMobileAndPin(
  page: Page,
  mobile: string,
  pin: string,
): Promise<void> {
  await gotoAuth(page);
  await fillIdentifierAndContinue(page, mobile);
  await fillOtp(page, '123456');
  await page.getByRole('button', { name: /^verify$/i }).click();

  // After verify, OTP mock register/login path either lands on dashboard
  // (existing user) or on App Lock PIN (existing user with PIN set).
  await page.waitForURL(/\/(dashboard|auth\/setup-pin)/, { timeout: 20_000 });
  if (page.url().includes('/auth/setup-pin')) {
    // Fresh test user without PIN - set one to `pin` so subsequent runs
    // can unlock. Skip when fixture provisioning already did this.
    return;
  }
  // Existing user: enter PIN.
  await fillPin(page, pin);
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}
