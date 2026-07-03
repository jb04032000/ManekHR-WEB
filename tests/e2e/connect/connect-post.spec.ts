import { test, expect } from '@playwright/test';

/**
 * Core write flow: create a text post and confirm it lands in the feed.
 * The composer has no test-id yet, so we open it by its prompt text then type
 * into the first textarea — adjust the trigger selector if the composer UI moves.
 */
test('Connect — create a text post appears in the feed', async ({ page }) => {
  await page.goto('/connect/feed');

  // The composer is a button with this prompt; clicking it opens the editor.
  await page
    .getByRole('button', { name: /share a design|what you are working on|share something/i })
    .first()
    .click();

  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  const body = `E2E smoke post ${Date.now()}`;
  await textarea.fill(body);

  await page
    .getByRole('button', { name: /^publish$/i })
    .first()
    .click();

  await expect(page.getByText(body).first()).toBeVisible({ timeout: 15_000 });
});
