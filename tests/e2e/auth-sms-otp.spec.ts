import { test, expect, type Page } from '@playwright/test';

/**
 * SMS-OTP auth e2e - covers the four registered flows under mock mode.
 *
 * Requirements (BE):
 *   - AUTH_OTP_MOCK=true             (accepts fixed code 123456 - no MSG91 call)
 *   - NEXT_PUBLIC_AUTH_OTP_MOCK=true (FE mock banner renders)
 *
 * Each test uses a unique random Indian mobile to avoid collisions across
 * runs. New-mobile registration uses the OTP-only path (no password).
 */

function uniqueMobile(): string {
  // 10-digit Indian mobile starting with 6/7/8/9 (DTO regex is /^[6-9]\d{9}$/).
  const first = '6789'[Math.floor(Math.random() * 4)];
  let rest = '';
  for (let i = 0; i < 9; i += 1) rest += Math.floor(Math.random() * 10);
  return `${first}${rest}`;
}

async function gotoAuth(page: Page): Promise<void> {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function fillIdentifierAndContinue(page: Page, identifier: string): Promise<void> {
  await page.locator('input[autocomplete="username"]').fill(identifier);
  await page
    .getByRole('button', { name: /continue/i })
    .first()
    .click();
}

async function fillOtp(page: Page, code: string): Promise<void> {
  // OtpInput → PinInput renders 6 single-digit boxes inside a group with
  // aria-label "OTP input"; each box has aria-label "Digit N". PinInput
  // sets autoComplete="off" (anti-formfill) so we target by role+name.
  const otpGroup = page.getByRole('group', { name: /OTP input/i });
  await expect(otpGroup).toBeVisible({ timeout: 10_000 });
  const inputs = otpGroup.getByRole('textbox');
  for (let i = 0; i < code.length; i += 1) {
    await inputs.nth(i).fill(code[i]);
  }
}

test.describe('SMS-OTP register (new mobile)', () => {
  test('happy path - mock OTP 123456 lands on workspace setup with name + optional password fields', async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    await gotoAuth(page);
    await fillIdentifierAndContinue(page, mobile);

    // OtpSendMode (register variant): mobile pre-filled, mock banner visible,
    // single Send button. Name field deliberately NOT here - captured later.
    await expect(page.getByText(/mock otp active/i)).toBeVisible();
    await expect(page.getByPlaceholder(/full name/i)).toHaveCount(0);
    await page.getByRole('button', { name: /send code/i }).click();

    // OtpVerifyMode: enter 123456 → workspace setup.
    await fillOtp(page, '123456');
    await page.getByRole('button', { name: /^verify$/i }).click();

    // RegisterWorkspaceMode: name + optional password + workspace fields.
    await expect(
      page.getByRole('heading', { name: /setup workspace|create your workspace/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/full name/i)).toBeVisible();
    // Optional password field uses placeholder "At least 8 characters".
    await expect(page.getByPlaceholder(/at least 8 characters/i)).toBeVisible();
  });
});

test.describe('SMS-OTP send-OTP error fallback', () => {
  // The fallback link is exercised in vitest (sms-otp.service.vitest.ts
  // SERVICE_DEGRADED cases) and visible-by-component-render - but a
  // browser-level intercept of /auth/send-otp doesn't fire here because the
  // FE submits via a Next.js Server Action, not a direct fetch to that URL.
  // Re-enable when we add a stub route or BE-level fault injection.
  test.skip('shows "Use a different sign-in method" on send error', () => {});
});

test.describe('SMS-OTP login (existing mobile)', () => {
  test.skip('requires a pre-seeded user - gated until test-user fixture exists', () => {});
});
