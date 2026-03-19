/**
 * Showcase sync script.
 *
 * Bridges the backend PIM API with the static Showcase frontend by:
 *   1. Checking for changes via the distribution API
 *   2. Exporting model data (JSON) and images (base64 WebP)
 *   3. Building a MiniSearch index for client-side full-text search
 *   4. Writing static JSON files to public/data/ and images to public/images/
 *   5. Optionally triggering `next build` for a full static export
 *
 * Usage:
 *   npx tsx scripts/sync-products.ts [--force] [--build] [--dry-run]
 *
 * Environment:
 *   BACKEND_URL   - Backend base URL (default: http://localhost:8001)
 *   AGENT_SECRET  - Required for API authentication
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import MiniSearch from 'minisearch';
import { generateBrandSprites } from './generate-sprites';
import type { BrandSpriteModel } from './generate-sprites';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8001';
const AGENT_SECRET = process.env.AGENT_SECRET ?? '';
const API_PREFIX = '/api/v1/distribution/showcase';

// Backend API URL for image fetching during sync
// All images (full + thumbs) are downloaded to public/images/ and served from Cloudflare CDN
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL ?? `${BACKEND_URL}${API_PREFIX}/image`;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const THUMBS_DIR = path.join(PUBLIC_DIR, 'images', 'thumbs');
const FULL_DIR = path.join(PUBLIC_DIR, 'images', 'full');
const SPRITES_DIR = path.join(PUBLIC_DIR, 'images', 'sprites');
const SPRITE_MAP_PATH = path.join(DATA_DIR, 'sprite-map.json');
const IMAGE_CONCURRENCY = 20;

// ---------------------------------------------------------------------------
// Types (matching backend Pydantic schemas)
// ---------------------------------------------------------------------------

interface ShowcaseCategory {
  code: string;
  nameNl: string;
  level: number;
  parentCode: string | null;
  sortOrder: number;
  children: ShowcaseCategory[];
}

interface ShowcaseImage {
  ean: string;
  sequenceNumber: number;
  imageType: string | null;
  webpBase64: string | null;
  thumbBase64: string | null;
}

interface ShowcaseVariant {
  ean: string;
  sizeRaw: string;
  sizeDisplay: string | null;
  priceCents: number | null;
}

interface ShowcaseColorGroup {
  colorRaw: string;
  colorCode: string | null;
  colorName: string | null;
  hexCode: string | null;
  secondaryHex: string | null;
  secondaryName: string | null;
  variants: ShowcaseVariant[];
  images: ShowcaseImage[];
}

interface ShowcaseModel {
  id: string;
  slug: string;
  brandName: string;
  brandSlug: string;
  modelCode: string | null;
  modelName: string | null;
  categoryCode: string | null;
  categoryPath: string | null;
  descriptionNl: string | null;
  shortDescriptionNl: string | null;
  publicationStatus: string;
  variantCount: number;
  colorGroups: ShowcaseColorGroup[];
}

interface ShowcaseExportMeta {
  totalModels: number;
  totalVariants: number;
  totalImages: number;
  exportedAt: string;
}

interface ShowcaseExportResponse {
  categoryTree: ShowcaseCategory[];
  models: ShowcaseModel[];
  meta: ShowcaseExportMeta;
}

interface ShowcaseChangeReport {
  hasChanges: boolean;
  lastExportAt: string | null;
  changes: {
    modelsAdded: number;
    modelsUpdated: number;
    modelsRemoved: number;
    imagesChanged: number;
    pricesChanged: number;
    categoriesChanged: number;
  };
  changedModelIds: string[];
  dataFingerprint: string;
}

// Frontend model shape (camelCase, with image paths)
interface FrontendColorGroup {
  colorRaw: string;
  colorCode: string;
  colorName: string;
  hexCode: string;
  secondaryHex: string | null;
  secondaryName: string | null;
  variants: {
    ean: string;
    sizeRaw: string;
    sizeDisplay: string;
    priceCents: number;
  }[];
  images: {
    ean: string;
    sequenceNumber: number;
    imageType: string;
    path: string;
    thumbPath: string;
  }[];
}

interface FrontendModel {
  id: string;
  slug: string;
  brandName: string;
  brandSlug: string;
  modelCode: string;
  modelName: string;
  categoryCode: string;
  categoryPath: string;
  descriptionNl: string;
  shortDescriptionNl: string;
  publicationStatus: string;
  variantCount: number;
  colorGroups: FrontendColorGroup[];
}

interface FrontendCategory {
  code: string;
  nameNl: string;
  level: number;
  parentCode: string | null;
  sortOrder: number;
  children: FrontendCategory[];
}

interface SyncManifest {
  lastSyncAt: string;
  fingerprint: string;
  modelSlugs: string[];
  imageFiles: string[];
  totalModels: number;
  totalImages: number;
}

// MiniSearch document
interface SearchDocument {
  id: string;
  slug: string;
  name: string;
  brand: string;
  brandSlug: string;
  articleNumber: string;
  keywords: string;
  description: string;
  categoryPath: string;
  thumbPath: string;
  imagePath: string;
  minPrice: number;
  publicationStatus: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const FLAG_FORCE = args.includes('--force');
const FLAG_BUILD = args.includes('--build');
const FLAG_DRY_RUN = args.includes('--dry-run');
const FLAG_DEPLOY = args.includes('--deploy');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string) {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] ${message}`);
}

function logError(message: string) {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.error(`[${timestamp}] ERROR: ${message}`);
}

function apiUrl(endpoint: string): string {
  return `${BACKEND_URL}${API_PREFIX}${endpoint}`;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (AGENT_SECRET) {
    headers['X-Agent-Secret'] = AGENT_SECRET;
  }
  return headers;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      const isLast = attempt === maxRetries;
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      if (isLast) {
        throw error;
      }
      logError(`Attempt ${attempt}/${maxRetries} failed: ${error}. Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Unreachable');
}

// ---------------------------------------------------------------------------
// Image download helpers
// ---------------------------------------------------------------------------

interface ImageTarget {
  ean: string;
  seq: number;
  fileName: string;
}

/** Collect all unique images from all models. */
function collectAllImageTargets(models: FrontendModel[]): ImageTarget[] {
  const targets: ImageTarget[] = [];
  const seen = new Set<string>();
  for (const model of models) {
    for (const cg of model.colorGroups) {
      for (const img of cg.images) {
        const key = `${img.ean}-${img.sequenceNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          targets.push({ ean: img.ean, seq: img.sequenceNumber, fileName: `${key}.webp` });
        }
      }
    }
  }
  return targets;
}

/** Download images from the backend API with concurrency control. */
async function downloadImages(
  targets: ImageTarget[],
  destDir: string,
  size: 'full' | 'thumb',
  label: string,
): Promise<string[]> {
  await ensureDir(destDir);

  // Check which files already exist locally
  let existingFiles: Set<string>;
  try {
    const files = await fs.readdir(destDir);
    existingFiles = new Set(files);
  } catch {
    existingFiles = new Set();
  }

  const toDownload = targets.filter((t) => !existingFiles.has(t.fileName));
  const skipped = targets.length - toDownload.length;
  if (skipped > 0) {
    log(`  ${label}: ${skipped} already cached, ${toDownload.length} to download`);
  }

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < toDownload.length; i += IMAGE_CONCURRENCY) {
    const batch = toDownload.slice(i, i + IMAGE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (t) => {
        const sizeParam = size === 'thumb' ? '?size=thumb' : '';
        const url = `${BACKEND_URL}${API_PREFIX}/image/${t.ean}/${t.seq}${sizeParam}`;
        const resp = await fetchWithRetry(url, {
          headers: { 'X-Agent-Secret': AGENT_SECRET },
        });
        const buffer = Buffer.from(await resp.arrayBuffer());
        await fs.writeFile(path.join(destDir, t.fileName), buffer);
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        downloaded++;
      } else {
        failed++;
      }
    }
    const progress = Math.min(i + IMAGE_CONCURRENCY, toDownload.length);
    if (progress % 500 === 0 || progress === toDownload.length) {
      log(`  ${label}: ${progress}/${toDownload.length} downloaded`);
    }
  }

  if (failed > 0) {
    logError(`${failed} ${label.toLowerCase()} failed to download`);
  }

  return targets.map((t) => t.fileName);
}

/** Remove image files that are no longer needed. */
async function cleanStaleImages(destDir: string, validFiles: Set<string>): Promise<number> {
  let removed = 0;
  try {
    const existing = await fs.readdir(destDir);
    for (const file of existing) {
      if (file.endsWith('.webp') && !validFiles.has(file)) {
        await fs.unlink(path.join(destDir, file));
        removed++;
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Step 1: Check for changes
// ---------------------------------------------------------------------------

async function checkChanges(): Promise<ShowcaseChangeReport> {
  log('Checking for changes...');

  const response = await fetch(apiUrl('/changes'), {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to check changes: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ShowcaseChangeReport;
}

// ---------------------------------------------------------------------------
// Step 2: Export model data
// ---------------------------------------------------------------------------

const EXPORT_BATCH_SIZE = 200;

async function fetchAllModelIds(): Promise<string[]> {
  const response = await fetchWithRetry(
    apiUrl('/export/model-ids'),
    { headers: authHeaders() },
  );
  const data = (await response.json()) as { model_ids: string[]; total: number };
  log(`Backend reports ${data.total} showcase-eligible models`);
  return data.model_ids;
}

async function exportModels(changedModelIds: string[]): Promise<ShowcaseExportResponse> {
  log('Exporting model data...');

  // For full exports (no specific IDs), fetch all IDs first so we can batch
  if (changedModelIds.length === 0) {
    const allIds = await fetchAllModelIds();
    if (allIds.length <= EXPORT_BATCH_SIZE) {
      return exportModelsSingle(allIds);
    }
    // Re-enter with all IDs to use batching logic
    return exportModels(allIds);
  }

  // For small exports (< batch size), do a single request
  if (changedModelIds.length <= EXPORT_BATCH_SIZE) {
    return exportModelsSingle(changedModelIds);
  }

  // For large exports, batch by model IDs to avoid Cloudflare timeouts
  log(`Large export: ${changedModelIds.length} models, splitting into batches of ${EXPORT_BATCH_SIZE}`);

  const allModels: ShowcaseModel[] = [];
  let categoryTree: ShowcaseCategory[] = [];
  let totalVariants = 0;
  let totalImages = 0;

  const batches = [];
  for (let i = 0; i < changedModelIds.length; i += EXPORT_BATCH_SIZE) {
    batches.push(changedModelIds.slice(i, i + EXPORT_BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log(`  Batch ${i + 1}/${batches.length}: ${batch.length} models...`);

    const data = await exportModelsSingle(batch);
    allModels.push(...data.models);
    totalVariants += data.meta.totalVariants;
    totalImages += data.meta.totalImages;

    // Take category tree from first batch (same for all)
    if (i === 0) {
      categoryTree = data.categoryTree;
    }
  }

  log(`Exported ${allModels.length} models, ${totalVariants} variants in ${batches.length} batches`);

  return {
    categoryTree,
    models: allModels,
    meta: {
      totalModels: allModels.length,
      totalVariants,
      totalImages,
      exportedAt: new Date().toISOString(),
    },
  };
}

async function exportModelsSingle(modelIds?: string[]): Promise<ShowcaseExportResponse> {
  const params = modelIds ? `?model_ids=${modelIds.join('&model_ids=')}` : '';
  const response = await fetchWithRetry(
    apiUrl(`/export${params}`),
    { method: 'POST', headers: authHeaders() },
  );

  return (await response.json()) as ShowcaseExportResponse;
}

// ---------------------------------------------------------------------------
// Step 3: Transform models to frontend shape
// ---------------------------------------------------------------------------

function transformCategory(cat: ShowcaseCategory): FrontendCategory {
  return {
    code: cat.code,
    nameNl: cat.nameNl,
    level: cat.level,
    parentCode: cat.parentCode,
    sortOrder: cat.sortOrder,
    children: cat.children.map(transformCategory),
  };
}

function transformModel(model: ShowcaseModel): FrontendModel {
  return {
    id: String(model.id),
    slug: model.slug,
    brandName: model.brandName,
    brandSlug: model.brandSlug,
    modelCode: model.modelCode ?? '',
    modelName: model.modelName ?? '',
    categoryCode: model.categoryCode ?? '',
    categoryPath: model.categoryPath ?? '',
    descriptionNl: model.descriptionNl ?? '',
    shortDescriptionNl: model.shortDescriptionNl ?? '',
    publicationStatus: model.publicationStatus,
    variantCount: model.variantCount,
    colorGroups: model.colorGroups.map((cg) => ({
      colorRaw: cg.colorRaw,
      colorCode: cg.colorCode ?? '',
      colorName: cg.colorName ?? '',
      hexCode: cg.hexCode ?? '',
      secondaryHex: cg.secondaryHex,
      secondaryName: cg.secondaryName,
      variants: cg.variants.map((v) => ({
        ean: v.ean,
        sizeRaw: v.sizeRaw,
        sizeDisplay: v.sizeDisplay ?? v.sizeRaw,
        priceCents: v.priceCents ?? 0,
      })),
      images: cg.images.map((img) => ({
        ean: img.ean,
        sequenceNumber: img.sequenceNumber,
        imageType: img.imageType ?? 'front',
        // Sprite key for runtime lookup via sprite-map.json
        path: `${img.ean}-${img.sequenceNumber}`,
        thumbPath: `${img.ean}-${img.sequenceNumber}`,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Step 5: Build search index
// ---------------------------------------------------------------------------

function buildSearchIndex(models: FrontendModel[]): string {
  log('Building search index...');

  const miniSearch = new MiniSearch<SearchDocument>({
    fields: [
      'name',
      'brand',
      'keywords',
      'articleNumber',
      'description',
      'categoryPath',
    ],
    storeFields: [
      'id',
      'slug',
      'name',
      'brand',
      'brandSlug',
      'articleNumber',
      'keywords',
      'description',
      'categoryPath',
      'thumbPath',
      'imagePath',
      'minPrice',
      'publicationStatus',
    ],
    searchOptions: {
      boost: {
        name: 3,
        brand: 2.5,
        articleNumber: 2.5,
        keywords: 2,
        categoryPath: 1.5,
        description: 1,
      },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  });

  const documents: SearchDocument[] = models.map((model) => {
    // Find first thumb path and full image path
    let thumbPath = '';
    let imagePath = '';
    for (const cg of model.colorGroups) {
      for (const img of cg.images) {
        if (img.thumbPath && !thumbPath) {
          thumbPath = img.thumbPath;
        }
        if (img.path && !imagePath) {
          imagePath = img.path;
        }
        if (thumbPath && imagePath) break;
      }
      if (thumbPath && imagePath) break;
    }

    // Find minimum price
    let minPrice = Infinity;
    for (const cg of model.colorGroups) {
      for (const v of cg.variants) {
        if (v.priceCents > 0 && v.priceCents < minPrice) {
          minPrice = v.priceCents;
        }
      }
    }
    if (minPrice === Infinity) minPrice = 0;

    // Build keywords
    const colorNames = model.colorGroups
      .map((cg) => cg.colorName)
      .filter(Boolean)
      .join(' ');
    const keywords = [model.brandName, model.modelName, model.modelCode, colorNames]
      .filter(Boolean)
      .join(' ');

    return {
      id: String(model.id),
      slug: model.slug,
      name: model.modelName || model.modelCode,
      brand: model.brandName,
      brandSlug: model.brandSlug,
      articleNumber: model.modelCode,
      keywords,
      description: model.shortDescriptionNl,
      categoryPath: model.categoryPath,
      thumbPath,
      imagePath,
      minPrice,
      publicationStatus: model.publicationStatus,
    };
  });

  miniSearch.addAll(documents);

  const serialized = JSON.stringify(miniSearch);
  log(`Search index built: ${documents.length} documents, ${(serialized.length / 1024).toFixed(0)} KB`);

  return serialized;
}

// ---------------------------------------------------------------------------
// Step 6: Write output files
// ---------------------------------------------------------------------------

async function writeDataFiles(
  models: FrontendModel[],
  categoryTree: FrontendCategory[],
  searchIndex: string,
  imageFiles: string[],
  fingerprint: string,
): Promise<void> {
  await ensureDir(DATA_DIR);

  // model-cards: split into chunks to stay under Cloudflare 25MB limit
  const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15MB per chunk (safe margin under CF 25MB limit)
  const fullJson = JSON.stringify(models);

  if (fullJson.length <= MAX_CHUNK_SIZE) {
    // Single file is fine
    const modelCardsPath = path.join(DATA_DIR, 'model-cards-0.json');
    await fs.writeFile(modelCardsPath, fullJson, 'utf-8');
    const metaPath = path.join(DATA_DIR, 'model-cards-meta.json');
    await fs.writeFile(metaPath, JSON.stringify({ chunks: 1, totalModels: models.length }), 'utf-8');
    log(`Written ${modelCardsPath} (${models.length} models, single chunk)`);
  } else {
    // Split into chunks
    const modelsPerChunk = Math.ceil(models.length / Math.ceil(fullJson.length / MAX_CHUNK_SIZE));
    const chunks: FrontendModel[][] = [];
    for (let i = 0; i < models.length; i += modelsPerChunk) {
      chunks.push(models.slice(i, i + modelsPerChunk));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = path.join(DATA_DIR, `model-cards-${i}.json`);
      await fs.writeFile(chunkPath, JSON.stringify(chunks[i]), 'utf-8');
      const sizeMB = (JSON.stringify(chunks[i]).length / 1024 / 1024).toFixed(1);
      log(`Written ${chunkPath} (${chunks[i].length} models, ${sizeMB} MB)`);
    }

    const metaPath = path.join(DATA_DIR, 'model-cards-meta.json');
    await fs.writeFile(metaPath, JSON.stringify({ chunks: chunks.length, totalModels: models.length }), 'utf-8');
    log(`Split model-cards into ${chunks.length} chunks`);
  }

  // Remove old chunk files and legacy single file
  const chunkCount = fullJson.length <= MAX_CHUNK_SIZE ? 1 : Math.ceil(models.length / Math.ceil(fullJson.length / MAX_CHUNK_SIZE));
  for (let i = chunkCount; i < 20; i++) {
    try {
      await fs.unlink(path.join(DATA_DIR, `model-cards-${i}.json`));
      log(`Removed stale chunk: model-cards-${i}.json`);
    } catch {
      break; // No more old chunks
    }
  }
  try {
    await fs.unlink(path.join(DATA_DIR, 'model-cards.json'));
  } catch {
    // Doesn't exist, fine
  }

  // category-tree.json
  const categoryTreePath = path.join(DATA_DIR, 'category-tree.json');
  await fs.writeFile(categoryTreePath, JSON.stringify(categoryTree), 'utf-8');
  log(`Written ${categoryTreePath}`);

  // search-index.json
  const searchIndexPath = path.join(DATA_DIR, 'search-index.json');
  await fs.writeFile(searchIndexPath, searchIndex, 'utf-8');
  log(`Written ${searchIndexPath}`);

  // sync-manifest.json
  const manifest: SyncManifest = {
    lastSyncAt: new Date().toISOString(),
    fingerprint,
    modelSlugs: models.map((m) => m.slug),
    imageFiles,
    totalModels: models.length,
    totalImages: imageFiles.length,
  };
  const manifestPath = path.join(DATA_DIR, 'sync-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  log(`Written ${manifestPath}`);
}

// ---------------------------------------------------------------------------
// Step 7: Notify backend of sync completion
// ---------------------------------------------------------------------------

async function notifySyncComplete(
  fingerprint: string,
  modelCount: number,
  variantCount: number,
  imageCount: number,
  durationMs: number,
): Promise<void> {
  log('Notifying backend of sync completion...');

  const response = await fetch(apiUrl('/sync-complete'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      fingerprint,
      modelCount,
      variantCount,
      imageCount,
      durationMs,
    }),
  });

  if (!response.ok) {
    logError(`Failed to notify sync complete: ${response.status} ${response.statusText}`);
    return;
  }

  const result = await response.json();
  log(`Sync marked complete at ${result.exportedAt ?? result.exported_at}`);
}

// ---------------------------------------------------------------------------
// Step 8 (optional): Run next build
// ---------------------------------------------------------------------------

function runBuild(): void {
  log('Running next build...');
  try {
    execSync('npx next build', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    log('Build completed successfully');
  } catch (error) {
    logError('Build failed');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Step 9 (optional): Deploy to Cloudflare Pages
// ---------------------------------------------------------------------------

function runDeploy(): void {
  log('Deploying to Cloudflare Pages...');
  try {
    execSync('npx wrangler pages deploy out --project-name=workwear-showcase', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });
    log('Deploy completed successfully');
  } catch (error) {
    logError('Deploy failed');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();

  log('=== Showcase Sync ===');
  log(`Backend: ${BACKEND_URL}`);
  log(`Flags: force=${FLAG_FORCE}, build=${FLAG_BUILD}, deploy=${FLAG_DEPLOY}, dry-run=${FLAG_DRY_RUN}`);

  if (!AGENT_SECRET) {
    logError('AGENT_SECRET environment variable is required');
    process.exit(1);
  }

  // Step 1: Check for changes
  const changeReport = await checkChanges();

  // Check if local data exists; if not, force a full sync regardless of change detection
  const metaExists = await fs.access(path.join(DATA_DIR, 'model-cards-meta.json')).then(() => true).catch(() => false);

  if (!changeReport.hasChanges && !FLAG_FORCE && metaExists) {
    log('Geen wijzigingen sinds laatste export. Gebruik --force om toch te synchroniseren.');
    return;
  }

  if (!metaExists) {
    log('No local data found — forcing full sync.');
  }

  const isIncremental = changeReport.changedModelIds.length > 0 && !FLAG_FORCE;

  if (changeReport.hasChanges) {
    const c = changeReport.changes;
    log(`Changes detected (${isIncremental ? 'incremental' : 'full'} sync):`);
    if (c.modelsAdded > 0) log(`  + ${c.modelsAdded} models added`);
    if (c.modelsUpdated > 0) log(`  ~ ${c.modelsUpdated} models updated`);
    if (c.modelsRemoved > 0) log(`  - ${c.modelsRemoved} models removed`);
    if (c.imagesChanged > 0) log(`  * ${c.imagesChanged} images changed`);
    if (c.pricesChanged > 0) log(`  $ ${c.pricesChanged} prices changed`);
    if (c.categoriesChanged > 0) log(`  # ${c.categoriesChanged} categories changed`);
  } else {
    log('No changes detected, but --force flag is set. Proceeding...');
  }

  if (FLAG_DRY_RUN) {
    log('Dry run - no files will be written.');
    log(`Fingerprint: ${changeReport.dataFingerprint}`);
    log(`Changed model IDs: ${changeReport.changedModelIds.length}`);
    return;
  }

  // Step 2: Export model data (batched to avoid Cloudflare timeouts)
  // When --force is set, export ALL eligible models (not just changed ones)
  const modelIdsToExport = FLAG_FORCE ? [] : changeReport.changedModelIds;
  const exportData = await exportModels(modelIdsToExport);

  // Step 3: Transform to frontend shape
  // Images are served by the backend API (not downloaded locally)
  // Image URLs are absolute: ${IMAGE_BASE_URL}/{ean}/{seq}
  log('Transforming data to frontend format...');
  log(`Image base URL: ${IMAGE_BASE_URL}`);
  const exportedModels = exportData.models.map(transformModel);
  const frontendCategories = exportData.categoryTree.map(transformCategory);

  // Step 3b: Merge with existing data for incremental sync
  let allModels: FrontendModel[];

  if (isIncremental) {
    log('Incremental sync: merging with existing data...');

    // Load existing chunks
    const metaPath = path.join(DATA_DIR, 'model-cards-meta.json');
    let existingModels: FrontendModel[] = [];
    try {
      const metaRaw = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw) as { chunks: number };
      for (let i = 0; i < meta.chunks; i++) {
        const chunkPath = path.join(DATA_DIR, `model-cards-${i}.json`);
        const chunk: FrontendModel[] = JSON.parse(await fs.readFile(chunkPath, 'utf-8'));
        existingModels.push(...chunk);
      }
    } catch {
      log('No existing model-cards chunks found, doing full write');
    }

    if (existingModels.length > 0) {
      const modelMap = new Map(existingModels.map((m) => [m.id, m]));

      for (const model of exportedModels) {
        modelMap.set(model.id, model);
      }

      if (changeReport.changes.modelsRemoved > 0) {
        const fullExport = await exportModels([]);
        const eligibleIds = new Set(
          fullExport.models.map((m) => String(m.id)),
        );
        for (const [id] of modelMap) {
          if (!eligibleIds.has(id)) {
            modelMap.delete(id);
          }
        }
      }

      allModels = Array.from(modelMap.values());
      log(`  Merged: ${exportedModels.length} changed + ${existingModels.length} existing = ${allModels.length} total`);
    } else {
      allModels = exportedModels;
    }
  } else {
    allModels = exportedModels;
  }

  // Step 4: Brand-grouped sprite generation
  const spriteMapExists = await fs.access(SPRITE_MAP_PATH).then(() => true).catch(() => false);
  const c = changeReport.changes;
  const needsSpriteRegen = FLAG_FORCE
    || !spriteMapExists
    || !metaExists
    || c.imagesChanged > 0
    || c.modelsAdded > 0
    || c.modelsRemoved > 0;

  const allImageTargets = collectAllImageTargets(allModels);

  if (!needsSpriteRegen) {
    // Data-only sync: skip image downloads + sprite generation entirely
    log('No image changes detected — reusing existing sprites (skipping download + generation)');
  } else {
    // Download all images needed for sprites
    const imageTargets = isIncremental && spriteMapExists
      ? collectAllImageTargets(allModels.filter((m) => new Set(changeReport.changedModelIds).has(m.id)))
      : allImageTargets;

    if (imageTargets.length > 0) {
      log(`Downloading ${imageTargets.length} images (thumbs + full)...`);
      await downloadImages(imageTargets, THUMBS_DIR, 'thumb', 'Thumbs');
      await downloadImages(imageTargets, FULL_DIR, 'full', 'Full');
    }

    // Generate brand-grouped sprites (paired thumb + full per brand chunk)
    const brandSpriteModels: BrandSpriteModel[] = allModels.map((m) => ({
      slug: m.slug,
      brandSlug: m.brandSlug,
      colorGroups: m.colorGroups,
    }));

    log(`Generating brand-grouped sprites for ${allModels.length} models...`);
    await generateBrandSprites(
      brandSpriteModels,
      THUMBS_DIR,
      FULL_DIR,
      SPRITES_DIR,
      SPRITE_MAP_PATH,
      IMAGE_BASE_URL,
      log,
    );
  }

  // Clean up stale individual image files (keep valid ones as download cache)
  const validImageFiles = new Set(allImageTargets.map((t) => t.fileName));
  const staleThumbsRemoved = await cleanStaleImages(THUMBS_DIR, validImageFiles);
  const staleFullRemoved = await cleanStaleImages(FULL_DIR, validImageFiles);
  if (staleThumbsRemoved > 0 || staleFullRemoved > 0) {
    log(`  Cleaned up ${staleThumbsRemoved} stale thumbs, ${staleFullRemoved} stale full images`);
  }

  // Step 5: Build search index (always from full model set)
  const searchIndex = buildSearchIndex(allModels);

  // Step 6: Write output files
  const totalImages = allModels.reduce((sum, m) =>
    sum + m.colorGroups.reduce((s, cg) => s + cg.images.length, 0), 0);

  const imageFileNames = allImageTargets.map((t) => t.fileName);
  await writeDataFiles(
    allModels,
    frontendCategories,
    searchIndex,
    imageFileNames,
    changeReport.dataFingerprint,
  );

  const durationMs = Date.now() - startTime;

  // Step 7: Notify backend
  const totalVariants = allModels.reduce((sum, m) =>
    sum + m.colorGroups.reduce((s, cg) => s + cg.variants.length, 0), 0);
  await notifySyncComplete(
    changeReport.dataFingerprint,
    allModels.length,
    totalVariants,
    totalImages,
    durationMs,
  );

  log(`=== Sync completed in ${(durationMs / 1000).toFixed(1)}s ===`);
  log(`  Mode:   ${isIncremental ? 'incremental' : 'full'}`);
  log(`  Models: ${allModels.length} (${exportedModels.length} exported)`);
  log(`  Images: ${totalImages} (${imageFileNames.length} image files, sprites: ${needsSpriteRegen ? 'regenerated' : 'reused'})`);
  log(`  Index:  ${(searchIndex.length / 1024).toFixed(0)} KB`);

  // Step 8 (optional): Build
  if (FLAG_BUILD || FLAG_DEPLOY) {
    runBuild();
  }

  // Step 9 (optional): Deploy
  if (FLAG_DEPLOY) {
    runDeploy();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((error) => {
  logError(String(error));
  process.exit(1);
});
