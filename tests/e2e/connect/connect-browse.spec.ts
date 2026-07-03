import { test, expect } from '@playwright/test';

/**
 * Connect "it's populated and nothing crashes" smoke across the high-use
 * surfaces, signed in as the master-karigar demo persona. Assertions are
 * content-tolerant (regex over seeded copy) so they survive small content
 * tweaks but still catch an empty/broken screen.
 */
test.describe('Connect — browse the populated app', () => {
  test('feed shows seeded posts', async ({ page }) => {
    await page.goto('/connect/feed');
    await expect(page).toHaveURL(/\/connect\/feed/);
    await expect(
      page.getByText(/zardozi|bridal|festive|karigar|embroidery|zari/i).first(),
    ).toBeVisible();
  });

  test('jobs board lists seeded jobs', async ({ page }) => {
    await page.goto('/connect/jobs');
    await expect(page).toHaveURL(/\/connect\/jobs/);
    await expect(
      page.getByText(/operator|karigar|designer|supervisor|embroidery|adda/i).first(),
    ).toBeVisible();
  });

  test('marketplace lists seeded products', async ({ page }) => {
    await page.goto('/connect/marketplace');
    await expect(page).toHaveURL(/\/connect\/marketplace/);
    await expect(
      page.getByText(/zari|georgette|embroidery|fabric|saree|dupatta/i).first(),
    ).toBeVisible();
  });

  test('network tabs render', async ({ page }) => {
    await page.goto('/connect/network');
    await expect(page).toHaveURL(/\/connect\/network/);
    await expect(page.getByText(/connections|invitations|following/i).first()).toBeVisible();
  });

  test('own profile renders', async ({ page }) => {
    await page.goto('/connect/profile');
    await expect(page).toHaveURL(/\/connect\/profile/);
    await expect(page.getByText(/Meera|karigar|zari/i).first()).toBeVisible();
  });
});
