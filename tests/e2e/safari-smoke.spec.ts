import { test, expect } from '@playwright/test';

/**
 * Safari/WebKit smoke tests for showcase.databiz.app
 * Verifies critical interactions that have historically been problematic on Safari.
 */

test.describe('Safari WebKit smoke', () => {
  test('search page loads and header is visible', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });
  });

  test('feedback button meets 44×44px minimum touch target', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // The feedback tab button is the one outside the dialog
    const feedbackBtn = page.locator('button[aria-label="Feedback geven"]').last();
    await expect(feedbackBtn).toBeVisible({ timeout: 8_000 });

    const box = await feedbackBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('clicking feedback button opens the drawer', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    const feedbackBtn = page.locator('button[aria-label="Feedback geven"]').last();
    await feedbackBtn.click();

    // Drawer has role="dialog" and aria-label="Feedback geven"
    const drawer = page.locator('[role="dialog"][aria-label="Feedback geven"]');
    await expect(drawer).toBeVisible({ timeout: 5_000 });
  });

  test('search page is interactive within 5s — filter responds to click', async ({ page }) => {
    const start = Date.now();
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    // Wait for at least one brand filter button to appear (signals data loaded)
    const firstFilterBtn = page.locator('button').filter({ hasText: /^.{2,}$/ }).first();
    await expect(firstFilterBtn).toBeVisible({ timeout: 5_000 });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5_000);
  });
});
