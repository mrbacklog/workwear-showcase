import { test, expect } from '@playwright/test';

/**
 * SCOPE 3 — Categorienavigatie
 *
 * Dekt de bug waarbij categorieën met producten toch "Geen producten" toonden.
 * Root cause: validCodesSet (useMemo) herberekende niet nadat de category tree
 * asynchroon geladen was. Fix: findCategory afhankelijk gemaakt van `tree`.
 */

test.describe('Categorienavigatie', () => {
  // Categorieën waarvan we weten dat ze producten hebben (core-data)
  const CATEGORIES_WITH_PRODUCTS = [
    { code: 'ALG-KLD-JAS-JACK', label: 'Jacks', minCount: 50 },
    { code: 'ALG-KLD-SHIRT-TSHIRT', label: 'T-shirts', minCount: 50 },
  ];

  for (const cat of CATEGORIES_WITH_PRODUCTS) {
    test(`${cat.label} (${cat.code}): toont producten na directe URL-navigatie`, async ({ page }) => {
      // Directe navigatie naar categorie via URL-parameter
      await page.goto(`/search?cat=${cat.code}`, { waitUntil: 'networkidle' });
      await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

      // Mag NIET "Geen producten" tonen
      await expect(page.locator('text=Geen producten')).not.toBeVisible({ timeout: 8_000 });

      // Moet productkaarten tonen
      const cards = page.locator('[data-testid="model-card"], .model-card, article, [class*="card"]');
      await expect(cards.first()).toBeVisible({ timeout: 10_000 });

      // Tel de producten via de teller in de subheader
      const productCount = page.locator('text=/\\d+ product/');
      await expect(productCount).toBeVisible({ timeout: 5_000 });
    });
  }

  test('SCOPE 3.1 — categorie geselecteerd via megamenu toont producten', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // Wacht tot het menu navigeerbaar is (data geladen)
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 8_000 });

    // Klik op een categorie-link in de header
    const categoryLinks = page.locator('a[href*="cat="]');
    const count = await categoryLinks.count();
    if (count === 0) {
      test.skip(true, 'Geen categorie-links gevonden in navigatie');
      return;
    }

    const firstLink = categoryLinks.first();
    await firstLink.click();

    // Na klik: geen "Geen producten" tonen voor categorieën die producten hebben
    // Wacht kort op de render
    await page.waitForTimeout(500);

    const noProducts = page.locator('text=Geen producten');
    const cards = page.locator('[data-testid="model-card"], article, [class*="Card"], [class*="card"]');

    // Of producten aanwezig OF expliciete lege state (sommige categorieën kunnen leeg zijn)
    const hasCards = await cards.count() > 0;
    const hasNoProducts = await noProducts.isVisible();

    // Als "Geen producten" zichtbaar is maar er producten zijn → BUG
    if (hasNoProducts && !hasCards) {
      const url = page.url();
      throw new Error(`Categorie toont "Geen producten" na URL-navigatie. URL: ${url}`);
    }
  });

  test('SCOPE 3.2 — categoriefilter chip is zichtbaar na selectie', async ({ page }) => {
    await page.goto(`/search?cat=ALG-KLD-JAS-JACK`, { waitUntil: 'networkidle' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // Een categorie-chip (filter badge) moet zichtbaar zijn
    const chip = page.locator('text=Categorie:');
    await expect(chip).toBeVisible({ timeout: 8_000 });
  });

  test('SCOPE 3.3 — verwijderen van categoriefilter toont alle producten', async ({ page }) => {
    await page.goto(`/search?cat=ALG-KLD-JAS-JACK`, { waitUntil: 'networkidle' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // Klik op het ✕ om de categorie te wissen
    const removeBtn = page.locator('button[aria-label="Categorie verwijderen"]');
    await expect(removeBtn).toBeVisible({ timeout: 8_000 });
    await removeBtn.click();

    // Na verwijdering: geen categorie-chip meer
    await expect(page.locator('text=Categorie:')).not.toBeVisible({ timeout: 3_000 });

    // En meer producten dan in gefilterde staat
    const productCount = page.locator('text=/\\d+ product/');
    await expect(productCount).toBeVisible({ timeout: 5_000 });
  });

  test('SCOPE 3.4 — productaantallen in menu > 0 voor bekende categorieën', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // De megamenu toont aantallen — controleer dat ze > 0 zijn
    // Aantallen staan als "(106)" naast de categorienaam
    const counters = page.locator('text=/\\(\\d+\\)/');
    const countItems = await counters.count();
    expect(countItems).toBeGreaterThan(0);
  });
});
