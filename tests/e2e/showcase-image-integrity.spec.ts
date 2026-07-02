import { test, expect } from '@playwright/test';

/**
 * Regressietest voor een productiebug (2026-07-02): sync-products.ts construeerde
 * een gegokte R2-URL (`${ean}-${sequenceNumber}`) wanneer een productafbeelding geen
 * geldige r2Key had (mislukte verwerking, bijv. 404 op de bronafbeelding). Dat gegokte
 * R2-object bestaat nooit -> 404 in productie, zichtbaar als kale grijze kaart zonder
 * het NoImagePlaceholder-beeldmerk.
 *
 * Root cause zat op twee plekken (beide gefixt):
 *  - backend/app/services/distribution/showcase_export.py: cover-image-selectie
 *    filterde niet op r2_key IS NOT NULL.
 *  - workwear-showcase/scripts/sync-products.ts: gokte een R2-sleutel i.p.v. de
 *    afbeelding over te slaan wanneer r2Key ontbrak.
 *
 * Een derde, losstaande laag van dezelfde bug: het NoImagePlaceholder-beeldmerk
 * (public/brand/vk-logo-mark.png) stond ooit in public/images/, een map die
 * pre-deploy-cleanup.ts altijd volledig wist -> het placeholder-icoon zelf gaf 404.
 */

test.describe('Productafbeeldingen — geen kapotte URLs', () => {
  test('geen enkele productafbeelding op de zoekpagina geeft een 4xx/5xx', async ({ page }) => {
    const failedImages: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      const isProductImage = /workwear-images\.databiz\.app\/(80|400|800)\//.test(url);
      if (isProductImage && response.status() >= 400) {
        failedImages.push(`${response.status()} ${url}`);
      }
    });

    await page.goto('/search', { waitUntil: 'networkidle' });

    // Scroll om lazy-loaded kaarten (loading="lazy") ook te laten opvragen
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);

    expect(
      failedImages,
      `Kapotte productafbeelding-URL('s) gevonden:\n${failedImages.join('\n')}`,
    ).toHaveLength(0);
  });

  test('het NoImagePlaceholder-beeldmerk zelf is bereikbaar (geen 404 op /brand/vk-logo-mark.png)', async ({ request, baseURL }) => {
    // Directe API-check i.p.v. UI-navigatie: deterministisch en snel. Bewaakt
    // specifiek dat het asset gecommit + gedeployed blijft buiten het bereik
    // van pre-deploy-cleanup.ts (zie module-docstring hierboven).
    const response = await request.get(`${baseURL}/brand/vk-logo-mark.png`);
    expect(response.status(), `vk-logo-mark.png gaf status ${response.status()}`).toBe(200);
    expect(response.headers()['content-type']).toContain('image');
  });
});
