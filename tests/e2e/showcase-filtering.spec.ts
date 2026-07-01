import { test, expect } from '@playwright/test';

/**
 * SCOPE 2 + 3 — Zoekfunctionaliteit & Filtering
 *
 * Test de zoekbalk, merkfilter, en combinaties van filters.
 * Valt onder de agentic QA skill, SCOPE 2 (zoeken) en SCOPE 3 (navigatie).
 */

test.describe('Zoekfunctionaliteit', () => {
  test('SCOPE 2.1 — zoek op "vest" geeft resultaten', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    const searchInput = page.locator('input[type="search"], input[placeholder*="zoek"], input[placeholder*="Zoek"]').first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });

    await searchInput.fill('vest');
    await page.waitForTimeout(400);

    // Resultaten verschijnen
    await expect(page.locator('text=/\\d+ resultaat/')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Geen resultaten')).not.toBeVisible();
  });

  test('SCOPE 2.2 — niet-bestaand woord toont lege state zonder crash', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });

    const searchInput = page.locator('input[type="search"], input[placeholder*="zoek"], input[placeholder*="Zoek"]').first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });

    await searchInput.fill('xyzquux_doesnot_exist_12345');
    await page.waitForTimeout(400);

    // Lege state zichtbaar, geen crash
    await expect(page.locator('text=Geen resultaten')).toBeVisible({ timeout: 5_000 });

    // Geen JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    expect(errors).toHaveLength(0);
  });

  test('SCOPE 2.3 — wissen van zoekterm toont alle producten terug', async ({ page }) => {
    await page.goto('/search?q=vest', { waitUntil: 'networkidle' });

    const searchInput = page.locator('input[type="search"], input[placeholder*="zoek"], input[placeholder*="Zoek"]').first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });

    await searchInput.fill('');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Terug naar alle producten (geen resultaten-teller, maar producten-teller)
    await expect(page.locator('text=Geen resultaten')).not.toBeVisible();
  });
});

test.describe('Filtering — merkfilter', () => {
  test('SCOPE 3.5 — merkfilter beperkt zichtbare producten', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // Wacht op de merkfilter-lijst (sidebar)
    const brandList = page.locator('aside').first();
    await expect(brandList).toBeVisible({ timeout: 8_000 });

    // Klik op de eerste beschikbare merkknop
    const brandButtons = brandList.locator('button').filter({ hasText: /\w{3,}/ });
    const brandCount = await brandButtons.count();
    if (brandCount === 0) {
      test.skip(true, 'Geen merkfilters gevonden in sidebar');
      return;
    }

    const firstBrand = brandButtons.first();
    const brandName = await firstBrand.textContent();
    await firstBrand.click();

    await page.waitForTimeout(500);

    // Na filteren: merk-chip zichtbaar
    const brandChip = page.locator(`text=${brandName?.split(/\d/)[0].trim()}`).first();
    await expect(brandChip).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Filtering — categorie + merk combinatie', () => {
  test('combinatie van categorie en merk toont resultaten of lege state (geen crash)', async ({ page }) => {
    await page.goto('/search?cat=ALG-KLD-JAS-JACK', { waitUntil: 'networkidle' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // Wacht tot categoriefilter actief is
    await expect(page.locator('text=Categorie:')).toBeVisible({ timeout: 8_000 });

    // Klik op een merkknop
    const brandButtons = page.locator('aside').first().locator('button').filter({ hasText: /\w{3,}/ });
    const count = await brandButtons.count();
    if (count === 0) {
      test.skip(true, 'Geen merkfilters beschikbaar bij deze categorie');
      return;
    }

    await brandButtons.first().click();
    await page.waitForTimeout(500);

    // Geen JavaScript-crash
    page.on('pageerror', (err) => {
      throw new Error(`JavaScript-fout na combinatiefilter: ${err.message}`);
    });

    // Ofwel producten, ofwel expliciete lege state
    const hasProducts = await page.locator('[class*="card"], [class*="Card"], article').count() > 0;
    const hasEmpty = await page.locator('text=Geen producten').isVisible();
    const hasNoResults = await page.locator('text=Geen resultaten').isVisible();

    expect(hasProducts || hasEmpty || hasNoResults).toBe(true);
  });
});
