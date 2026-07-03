import { Page, expect } from '@playwright/test';
import { gotoAuth, fillOtp, fillPin } from '../utils/auth';

/**
 * Connect E2E auth helper + seeded demo logins.
 *
 * Demo personas (crewroster-backend/scripts/connect-demo/content.ts) sign in
 * with their mobile + dev OTP 123456; the seed sets App-Lock PIN 000000 on each.
 * Used ONCE by connect.setup.ts to mint a storageState the specs reuse, so the
 * suite makes a single OTP request per run (the BE rate-limits OTP per phone).
 *
 * Requires: backend AUTH_OTP_MOCK=true + `npm run seed:connect` has been run.
 */
export const DEMO_PIN = '000000';

export const DEMO = {
  meera: '9100000001',
  rajesh: '9100000003',
  priya: '9100000011',
  firoz: '9100000015',
} as const;

export async function signInDemo(page: Page, mobile: string): Promise<void> {
  await gotoAuth(page);

  // Type the mobile like a human so the controlled form registers it, then continue.
  const id = page.locator('input[autocomplete="username"], input[name="identifier"]').first();
  await id.click();
  await id.fill('');
  await id.pressSequentially(mobile, { delay: 30 });
  await page
    .getByRole('button', { name: /continue/i })
    .first()
    .click();
  // Fallback submit in case the click didn't register on the controlled form.
  await page.keyboard.press('Enter').catch(() => {});

  // OTP-only accounts may show a "Send code" screen before the OTP boxes.
  const sendBtn = page.getByRole('button', { name: /send code|send otp|get otp/i }).first();
  if (await sendBtn.isVisible({ timeout: 6_000 }).catch(() => false)) {
    await sendBtn.click();
  }

  // Wait for the OTP screen; if it never appears, surface the on-screen error
  // text (printed to the terminal) so we know exactly why Continue was blocked.
  const otpGroup = page.getByRole('group', { name: /OTP input/i });
  try {
    await otpGroup.waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    const alertText = (
      await page
        .getByRole('alert')
        .allInnerTexts()
        .catch(() => [])
    )
      .join(' | ')
      .trim();
    const toastText = (
      await page
        .locator('.ant-message, .ant-notification, .ant-form-item-explain-error')
        .allInnerTexts()
        .catch(() => [])
    )
      .join(' | ')
      .trim();
    throw new Error(
      `OTP screen never appeared after Continue. On-screen message: "${alertText || toastText || '(none captured)'}". URL: ${page.url()}`,
    );
  }

  await fillOtp(page, '123456');
  await page
    .getByRole('button', { name: /^verify$/i })
    .first()
    .click();

  // May land on dashboard, connect, or an App-Lock gate.
  await page
    .waitForURL(/\/(dashboard|connect|auth\/setup-pin)/, { timeout: 25_000 })
    .catch(() => {});

  const unlock = page.getByRole('group', { name: /your pin/i });
  if (await unlock.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await fillPin(page, DEMO_PIN);
    await page.waitForTimeout(800);
  }

  await page.goto('/connect/feed');
  await expect(page).toHaveURL(/\/connect\/feed/, { timeout: 20_000 });
}
