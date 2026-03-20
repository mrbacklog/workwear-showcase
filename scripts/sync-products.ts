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
const IMAGE_CONCURRENCY = 50;

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

interface FrontendImageSprite {
  thumbSrc: string;
  fullSrc: string;
  col: number;
  row: number;
  cols: number;
  rows: number;
}

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
    sprite?: FrontendImageSprite;
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
// Sprite embedding: inline sprite coordinates into model-cards
// ---------------------------------------------------------------------------

interface SpriteMapEntry {
  t: string;
  f: string;
  cols: number;
  rows: number;
  img: Record<string, [number, number]>;
}

interface SpriteMapFile {
  thumbCell: number;
  fullCell: number;
  cols: number;
  imageBase: string;
  models: Record<string, SpriteMapEntry>;
}

/**
 * Embed sprite coordinates from sprite-map.json directly into each image
 * within the model-cards. This eliminates the need to load sprite-map.json
 * at runtime for images that have been embedded.
 */
function embedSpriteInfoIntoModels(
  models: FrontendModel[],
  spriteMap: SpriteMapFile,
): FrontendModel[] {
  return models.map((model) => {
    const spriteEntry = spriteMap.models[model.slug];
    if (!spriteEntry) return model;

    return {
      ...model,
      colorGroups: model.colorGroups.map((cg) => ({
        ...cg,
        images: cg.images.map((img) => {
          const imageKey = img.path; // path = "ean-seq" sprite key
          const pos = spriteEntry.img[imageKey];
          if (!pos) return img;

          const [col, row] = pos;
          return {
            ...img,
            sprite: {
              thumbSrc: spriteEntry.t,
              fullSrc: spriteEntry.f,
              col,
              row,
              cols: spriteEntry.cols,
              rows: spriteEntry.rows,
            },
          };
        }),
      })),
    };
  });
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
// Category-based chunk helpers
// ---------------------------------------------------------------------------

/**
 * Build a lookup map: leaf category code → L1 root category code.
 * Traverses the category tree recursively.
 */
function buildCategoryL1Map(
  nodes: FrontendCategory[],
  l1Code: string | null = null,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    const currentL1 = l1Code ?? node.code;
    map.set(node.code, currentL1);
    for (const [k, v] of buildCategoryL1Map(node.children, currentL1)) {
      map.set(k, v);
    }
  }
  return map;
}

/**
 * Derive a filesystem-safe chunk key from an L1 category code.
 * E.g. "ALG-KLEDING" → "cat-alg-kleding"
 */
function l1CodeToChunkKey(code: string): string {
  return `cat-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

// ---------------------------------------------------------------------------
// Step 6: Write output files
// ---------------------------------------------------------------------------

interface CategoryChunkEntry {
  file: string;
  modelCount: number;
  categoryName: string;
}

async function writeDataFiles(
  models: FrontendModel[],
  categoryTree: FrontendCategory[],
  searchIndex: string,
  imageFiles: string[],
  fingerprint: string,
): Promise<void> {
  await ensureDir(DATA_DIR);

  // Build category → L1 lookup
  const categoryL1Map = buildCategoryL1Map(categoryTree);

  // Build L1 code → category name lookup
  const l1NameMap = new Map<string, string>();
  for (const node of categoryTree) {
    l1NameMap.set(node.code, node.nameNl);
  }

  // Group models by L1 category
  const buckets = new Map<string, FrontendModel[]>(); // key = chunk key, value = models

  for (const model of models) {
    let chunkKey: string;
    if (model.categoryCode) {
      const l1Code = categoryL1Map.get(model.categoryCode);
      chunkKey = l1Code ? l1CodeToChunkKey(l1Code) : 'cat-uncategorized';
    } else {
      chunkKey = 'cat-uncategorized';
    }
    const bucket = buckets.get(chunkKey);
    if (bucket) {
      bucket.push(model);
    } else {
      buckets.set(chunkKey, [model]);
    }
  }

  // Write each category chunk and build meta
  const chunksMeta: Record<string, CategoryChunkEntry> = {};

  for (const [chunkKey, chunkModels] of buckets.entries()) {
    const fileName = `model-cards-${chunkKey}.json`;
    const filePath = path.join(DATA_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(chunkModels), 'utf-8');
    const sizeMB = (Buffer.byteLength(JSON.stringify(chunkModels), 'utf-8') / 1024 / 1024).toFixed(1);

    // Determine category name
    let categoryName = chunkKey;
    if (chunkKey !== 'cat-uncategorized') {
      // Reverse lookup: find the L1 code from the chunk key
      for (const [l1Code, name] of l1NameMap.entries()) {
        if (l1CodeToChunkKey(l1Code) === chunkKey) {
          categoryName = name;
          break;
        }
      }
    } else {
      categoryName = 'Uncategorized';
    }

    chunksMeta[chunkKey] = {
      file: fileName,
      modelCount: chunkModels.length,
      categoryName,
    };

    log(`Written ${fileName} (${chunkModels.length} models, ${sizeMB} MB, category: ${categoryName})`);
  }

  // Write new-format meta
  const meta = {
    totalModels: models.length,
    chunks: chunksMeta,
  };
  const metaPath = path.join(DATA_DIR, 'model-cards-meta.json');
  await fs.writeFile(metaPath, JSON.stringify(meta), 'utf-8');
  log(`Written model-cards-meta.json (${buckets.size} category chunks, ${models.length} models)`);

  // Remove legacy numeric chunk files (model-cards-0.json, model-cards-1.json, ...)
  for (let i = 0; i < 20; i++) {
    try {
      await fs.unlink(path.join(DATA_DIR, `model-cards-${i}.json`));
      log(`Removed legacy chunk: model-cards-${i}.json`);
    } catch {
      // File doesn't exist, stop trying
      break;
    }
  }
  // Remove legacy single file
  try {
    await fs.unlink(path.join(DATA_DIR, 'model-cards.json'));
  } catch {
    // Doesn't exist, fine
  }

  // Remove stale category chunk files (chunks from previous runs not in current set)
  try {
    const existingFiles = await fs.readdir(DATA_DIR);
    const currentChunkFiles = new Set(Object.values(chunksMeta).map((c) => c.file));
    for (const file of existingFiles) {
      if (file.startsWith('model-cards-cat-') && file.endsWith('.json') && !currentChunkFiles.has(file)) {
        await fs.unlink(path.join(DATA_DIR, file));
        log(`Removed stale chunk: ${file}`);
      }
    }
  } catch {
    // Ignore readdir errors
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

    // Load existing chunks — supports both legacy numeric and new category-based meta
    const metaPath = path.join(DATA_DIR, 'model-cards-meta.json');
    let existingModels: FrontendModel[] = [];
    try {
      const metaRaw = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw) as { chunks: number | Record<string, { file: string }> };

      if (typeof meta.chunks === 'number') {
        // Legacy numeric format
        for (let i = 0; i < meta.chunks; i++) {
          const chunkPath = path.join(DATA_DIR, `model-cards-${i}.json`);
          const chunk: FrontendModel[] = JSON.parse(await fs.readFile(chunkPath, 'utf-8'));
          existingModels.push(...chunk);
        }
      } else {
        // New category-based format
        for (const entry of Object.values(meta.chunks)) {
          const chunkPath = path.join(DATA_DIR, entry.file);
          const chunk: FrontendModel[] = JSON.parse(await fs.readFile(chunkPath, 'utf-8'));
          existingModels.push(...chunk);
        }
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

  // Step 4: Brand-grouped sprite generation (incremental via per-brand fingerprinting)
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
    // Always download all images so cached source files are available for sprite generation
    if (allImageTargets.length > 0) {
      log(`Downloading ${allImageTargets.length} images (thumbs + full)...`);
      await downloadImages(allImageTargets, THUMBS_DIR, 'thumb', 'Thumbs');
      await downloadImages(allImageTargets, FULL_DIR, 'full', 'Full');
    }

    // Generate brand-grouped sprites (incremental: only changed brands regenerate)
    const brandSpriteModels: BrandSpriteModel[] = allModels.map((m) => ({
      slug: m.slug,
      brandSlug: m.brandSlug,
      colorGroups: m.colorGroups,
    }));

    log(`Generating brand-grouped sprites for ${allModels.length} models (incremental)...`);
    await generateBrandSprites(
      brandSpriteModels,
      THUMBS_DIR,
      FULL_DIR,
      SPRITES_DIR,
      SPRITE_MAP_PATH,
      IMAGE_BASE_URL,
      log,
      FLAG_FORCE,
    );
  }

  // Clean up stale individual image files (keep valid ones as download cache)
  const validImageFiles = new Set(allImageTargets.map((t) => t.fileName));
  const staleThumbsRemoved = await cleanStaleImages(THUMBS_DIR, validImageFiles);
  const staleFullRemoved = await cleanStaleImages(FULL_DIR, validImageFiles);
  if (staleThumbsRemoved > 0 || staleFullRemoved > 0) {
    log(`  Cleaned up ${staleThumbsRemoved} stale thumbs, ${staleFullRemoved} stale full images`);
  }

  // Step 4b: Embed sprite info into model-cards (if sprite-map.json is available)
  let modelsWithSprites = allModels;
  try {
    const spriteMapRaw = await fs.readFile(SPRITE_MAP_PATH, 'utf-8');
    const spriteMapData = JSON.parse(spriteMapRaw) as SpriteMapFile;
    modelsWithSprites = embedSpriteInfoIntoModels(allModels, spriteMapData);
    const embeddedCount = modelsWithSprites.filter((m) =>
      m.colorGroups.some((cg) => cg.images.some((img) => img.sprite))
    ).length;
    log(`Embedded sprite info into ${embeddedCount}/${modelsWithSprites.length} models`);
  } catch {
    log('No sprite-map.json available — skipping sprite embedding');
  }

  // Step 5: Build search index (always from full model set)
  const searchIndex = buildSearchIndex(modelsWithSprites);

  // Step 6: Write output files
  const totalImages = allModels.reduce((sum, m) =>
    sum + m.colorGroups.reduce((s, cg) => s + cg.images.length, 0), 0);

  const imageFileNames = allImageTargets.map((t) => t.fileName);
  await writeDataFiles(
    modelsWithSprites,
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
