/**
 * Showcase sync script.
 *
 * Bridges the backend PIM API with the static Showcase frontend by:
 *   1. Checking for changes via the distribution API
 *   2. Exporting model data (JSON)
 *   3. Building a MiniSearch index for client-side full-text search
 *   4. Writing static JSON files to public/data/
 *   5. Optionally triggering `next build` for a full static export
 *
 * Images are handled by the backend (R2 uploads). This script only builds
 * R2 CDN URLs from the r2Key returned by the export API.
 *
 * Usage:
 *   npx tsx scripts/sync-products.ts [--force] [--build] [--dry-run]
 *
 * Environment:
 *   BACKEND_URL   - Backend base URL (default: http://localhost:8001)
 *   AGENT_SECRET  - Required for API authentication
 *   R2_PUBLIC_URL - Public CDN base URL for image URLs
 */

import * as fs from 'fs/promises';
import { readdirSync, existsSync } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import MiniSearch from 'minisearch';
import { buildUrlLookup } from '../src/lib/stable-url';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8001';
const AGENT_SECRET = process.env.AGENT_SECRET ?? '';
const API_PREFIX = '/api/v1/distribution/showcase';

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');

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
  id?: string;
  ean: string;
  sequenceNumber: number;
  imageType: string | null;
  webpBase64: string | null;
  thumbBase64: string | null;
  r2Key?: string;
  isCover?: boolean;
}

interface ShowcaseVariant {
  ean: string;
  sizeRaw: string;
  sizeDisplay: string | null;
  sizeCategory: string | null;   // SizeCategory code (CONF/SHOE/PANT/NUM/KIDS) of null
  priceCents: number | null;
}

interface ShowcaseColorGroup {
  colorRaw: string;
  colorCode: string | null;
  colorName: string | null;
  hexCode: string | null;
  secondaryHex: string | null;
  secondaryName: string | null;
  secondaryCode: string | null;
  tertiaryHex: string | null;
  tertiaryName: string | null;
  tertiaryCode: string | null;
  isFluorescent: boolean;
  isHighVisibility: boolean;
  color_variant_id?: string | null;
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
  material: string | null;
  gender: string | null;
  safetyNorms: string | null;
  careInstructions: string | null;
  countryOfOrigin: string | null;
  fabricTypeWeight: string | null;
  model_public_id?: string | null;
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

// Frontend model shape (camelCase, with R2 image URLs)

interface FrontendColorGroup {
  colorRaw: string;
  colorCode: string;
  colorName: string;
  hexCode: string;
  secondaryHex: string | null;
  secondaryName: string | null;
  secondaryCode: string | null;
  tertiaryHex: string | null;
  tertiaryName: string | null;
  tertiaryCode: string | null;
  isFluorescent: boolean;
  isHighVisibility: boolean;
  colorVariantId: string | null;
  variants: {
    ean: string;
    sizeRaw: string;
    sizeDisplay: string;
    sizeCategory: string | null;
    priceCents: number;
  }[];
  images: {
    id: string;
    ean: string;
    sequenceNumber: number;
    imageType: string;
    path: string;
    thumbWebp: string;       // 80px
    thumb400Webp: string;    // 400px
    thumb800Webp: string;    // 800px
    isCover: boolean;
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
  material: string | null;
  gender: string | null;
  safetyNorms: string | null;
  careInstructions: string | null;
  countryOfOrigin: string | null;
  fabricTypeWeight: string | null;
  modelPublicId: string | null;
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
  totalModels: number;
  totalImages: number;
}

interface SizeItem {
  value: string;
  category: 'CONF' | 'SHOE' | 'PANT' | 'NUM' | 'KIDS' | 'UNKNOWN';
}

interface ModelSummary {
  slug: string;
  brandSlug: string;
  brandName: string;
  modelName: string;
  modelCode: string;
  categoryCode: string;
  categoryPath: string;
  publicationStatus: string;
  thumbWebp: string;
  minPrice: number;
  colorGroups: Array<{
    hexCode: string;
    secondaryHex: string | null;
    tertiaryHex: string | null;
    colorCode: string;
    secondaryCode: string | null;
    tertiaryCode: string | null;
    isFluorescent: boolean;
    isHighVisibility: boolean;
  }>;
  /** All unique sizeDisplay values across all variants. Used for client-side size filtering. */
  sizeSet?: string[];
  /** Unieke maten per model met SizeCategory code. UNKNOWN = nog niet verrijkt. */
  sizeItems?: SizeItem[];
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
  thumbWebp: string;
  imagePath: string;
  minPrice: number;
  publicationStatus: string;
  gender: string | null;
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

    // Retry up to 3 times on transient network errors (e.g. "TypeError: terminated")
    let data: Awaited<ReturnType<typeof exportModelsSingle>> | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        data = await exportModelsSingle(batch);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (attempt < 3) {
          const backoffMs = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
          log(`  Batch ${i + 1}/${batches.length} attempt ${attempt} failed (${errMsg}). Retry in ${backoffMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        } else {
          log(`  Batch ${i + 1}/${batches.length} attempt ${attempt} failed (${errMsg}). Giving up.`);
        }
      }
    }
    if (data === null) {
      throw lastError instanceof Error ? lastError : new Error(`Batch ${i + 1} failed after 3 attempts`);
    }

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

const IMAGE_TYPE_PRIORITY: Record<string, number> = {
  front: 0,
  lifestyle: 1,
  default: 2,
  side: 3,
  back: 4,
  detail: 5,
};

function transformModel(model: ShowcaseModel): FrontendModel {
  const colorGroups = model.colorGroups.map((cg) => ({
    colorRaw: cg.colorRaw,
    colorCode: cg.colorCode ?? '',
    colorName: cg.colorName ?? '',
    hexCode: cg.hexCode ?? '',
    secondaryHex: cg.secondaryHex,
    secondaryName: cg.secondaryName,
    secondaryCode: cg.secondaryCode,
    tertiaryHex: cg.tertiaryHex,
    tertiaryName: cg.tertiaryName,
    tertiaryCode: cg.tertiaryCode,
    isFluorescent: cg.isFluorescent ?? false,
    isHighVisibility: cg.isHighVisibility ?? false,
    colorVariantId: cg.color_variant_id ?? null,
    variants: cg.variants.map((v) => ({
      ean: v.ean,
      sizeRaw: v.sizeRaw,
      sizeDisplay: v.sizeDisplay ?? v.sizeRaw,
      sizeCategory: v.sizeCategory ?? null,
      priceCents: v.priceCents ?? 0,
    })),
    images: cg.images.map((img) => {
      const r2Key = img.r2Key || `${img.ean}-${img.sequenceNumber}`;
      return {
        id: img.id ?? '',
        ean: img.ean,
        sequenceNumber: img.sequenceNumber,
        imageType: img.imageType ?? 'front',
        path: r2Key,
        thumbWebp: `${R2_PUBLIC_URL}/80/${r2Key}.webp`,
        thumb400Webp: `${R2_PUBLIC_URL}/400/${r2Key}.webp`,
        thumb800Webp: `${R2_PUBLIC_URL}/800/${r2Key}.webp`,
        isCover: img.isCover ?? false,
      };
    }),
  }));

  // Sort images within each color group so hero (front-view) is always first
  for (const cg of colorGroups) {
    cg.images.sort((a, b) => {
      const pa = IMAGE_TYPE_PRIORITY[a.imageType] ?? 99;
      const pb = IMAGE_TYPE_PRIORITY[b.imageType] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.sequenceNumber - b.sequenceNumber;
    });
  }

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
    material: model.material ?? null,
    gender: model.gender ?? null,
    safetyNorms: model.safetyNorms ?? null,
    careInstructions: model.careInstructions ?? null,
    countryOfOrigin: model.countryOfOrigin ?? null,
    fabricTypeWeight: model.fabricTypeWeight ?? null,
    modelPublicId: model.model_public_id ?? null,
    colorGroups,
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
      'thumbWebp',
      'imagePath',
      'minPrice',
      'publicationStatus',
      'gender',
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
    // Find first thumb WebP URL and full image path key
    let thumbWebp = '';
    let imagePath = '';
    for (const cg of model.colorGroups) {
      for (const img of cg.images) {
        if (img.thumb400Webp && !thumbWebp) {
          thumbWebp = img.thumb400Webp;
        }
        if (img.path && !imagePath) {
          imagePath = img.path;
        }
        if (thumbWebp && imagePath) break;
      }
      if (thumbWebp && imagePath) break;
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
      thumbWebp,
      imagePath,
      minPrice,
      publicationStatus: model.publicationStatus,
      gender: model.gender ?? null,
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
  subChunks?: string[]; // set when category exceeds MAX_CHUNK_BYTES and is split
}

// Cloudflare Pages hard limit is 25 MB; target well below to leave headroom.
const MAX_CHUNK_BYTES = 20 * 1024 * 1024; // 20 MB

async function writeDataFiles(
  models: FrontendModel[],
  categoryTree: FrontendCategory[],
  searchIndex: string,
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
  const slugToChunkFile = new Map<string, string>();

  for (const [chunkKey, chunkModels] of buckets.entries()) {
    // Determine category name
    let categoryName = chunkKey;
    if (chunkKey !== 'cat-uncategorized') {
      for (const [l1Code, name] of l1NameMap.entries()) {
        if (l1CodeToChunkKey(l1Code) === chunkKey) {
          categoryName = name;
          break;
        }
      }
    } else {
      categoryName = 'Uncategorized';
    }

    const serialized = JSON.stringify(chunkModels);
    const totalBytes = Buffer.byteLength(serialized, 'utf-8');

    if (totalBytes <= MAX_CHUNK_BYTES) {
      // Fits in a single file — write as before
      const fileName = `model-cards-${chunkKey}.json`;
      const filePath = path.join(DATA_DIR, fileName);
      await fs.writeFile(filePath, serialized, 'utf-8');
      const sizeMB = (totalBytes / 1024 / 1024).toFixed(1);
      chunksMeta[chunkKey] = { file: fileName, modelCount: chunkModels.length, categoryName };
      for (const m of chunkModels) slugToChunkFile.set(m.slug, fileName);
      log(`Written ${fileName} (${chunkModels.length} models, ${sizeMB} MB, category: ${categoryName})`);
    } else {
      // Category too large — split into numbered sub-chunks of ≤ MAX_CHUNK_BYTES
      const subChunkFiles: string[] = [];
      let subIndex = 0;
      let subModels: FrontendModel[] = [];
      let subBytes = 2; // account for [] brackets

      for (const model of chunkModels) {
        const modelJson = JSON.stringify(model);
        const modelBytes = Buffer.byteLength(modelJson, 'utf-8') + (subModels.length > 0 ? 1 : 0); // +1 for comma
        if (subModels.length > 0 && subBytes + modelBytes > MAX_CHUNK_BYTES) {
          // Flush current sub-chunk
          const subKey = `${chunkKey}-${subIndex}`;
          const subFile = `model-cards-${subKey}.json`;
          await fs.writeFile(path.join(DATA_DIR, subFile), JSON.stringify(subModels), 'utf-8');
          const sizeMB = (Buffer.byteLength(JSON.stringify(subModels), 'utf-8') / 1024 / 1024).toFixed(1);
          log(`Written ${subFile} (${subModels.length} models, ${sizeMB} MB, sub-chunk ${subIndex} of ${categoryName})`);
          for (const m of subModels) slugToChunkFile.set(m.slug, subFile);
          subChunkFiles.push(subFile);
          subIndex++;
          subModels = [model];
          subBytes = 2 + Buffer.byteLength(modelJson, 'utf-8');
        } else {
          subModels.push(model);
          subBytes += modelBytes;
        }
      }
      // Flush last sub-chunk
      if (subModels.length > 0) {
        const subKey = `${chunkKey}-${subIndex}`;
        const subFile = `model-cards-${subKey}.json`;
        await fs.writeFile(path.join(DATA_DIR, subFile), JSON.stringify(subModels), 'utf-8');
        const sizeMB = (Buffer.byteLength(JSON.stringify(subModels), 'utf-8') / 1024 / 1024).toFixed(1);
        log(`Written ${subFile} (${subModels.length} models, ${sizeMB} MB, sub-chunk ${subIndex} of ${categoryName})`);
        for (const m of subModels) slugToChunkFile.set(m.slug, subFile);
        subChunkFiles.push(subFile);
      }

      // Store meta with first sub-chunk file as canonical + subChunks list
      chunksMeta[chunkKey] = {
        file: subChunkFiles[0],
        modelCount: chunkModels.length,
        categoryName,
        subChunks: subChunkFiles,
      };
      log(`Category ${categoryName} split into ${subChunkFiles.length} sub-chunks (${(totalBytes / 1024 / 1024).toFixed(1)} MB total)`);
    }
  }

  // Write new-format meta
  const meta = {
    totalModels: models.length,
    chunks: chunksMeta,
  };
  const metaPath = path.join(DATA_DIR, 'model-cards-meta.json');
  await fs.writeFile(metaPath, JSON.stringify(meta), 'utf-8');
  log(`Written model-cards-meta.json (${buckets.size} category chunks, ${models.length} models)`);

  // model-summary.json
  let cappedModelCount = 0;
  let totalCappedColorGroups = 0;
  const summaries: ModelSummary[] = models.map((m) => {
    let thumbWebp = '';
    outer: for (const cg of m.colorGroups) {
      for (const img of cg.images) {
        if (img.isCover) {
          thumbWebp = img.thumb400Webp;
          break outer;
        }
      }
    }
    if (!thumbWebp && m.colorGroups.length > 0 && m.colorGroups[0].images.length > 0) {
      thumbWebp = m.colorGroups[0].images[0].thumb400Webp;
    }

    const prices: number[] = [];
    for (const cg of m.colorGroups) {
      for (const v of cg.variants) {
        if (v.priceCents > 0) prices.push(v.priceCents);
      }
    }
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

    // Build complete color code set from ALL colorGroups (for filter accuracy)
    const allColorCodes = new Set<string>();
    for (const cg of m.colorGroups) {
      if (cg.colorCode) allColorCodes.add(cg.colorCode);
      if (cg.secondaryCode) allColorCodes.add(cg.secondaryCode);
      if (cg.tertiaryCode) allColorCodes.add(cg.tertiaryCode);
    }

    // Collect sizeItems (value + category) — dedupliceer op value, houd eerste category
    const seenSizeValues = new Set<string>();
    const sizeItems: SizeItem[] = [];
    for (const cg of m.colorGroups) {
      for (const v of cg.variants) {
        if (v.sizeDisplay && !seenSizeValues.has(v.sizeDisplay)) {
          seenSizeValues.add(v.sizeDisplay);
          sizeItems.push({
            value: v.sizeDisplay,
            category: (v.sizeCategory as SizeItem['category']) ?? 'UNKNOWN',
          });
        }
      }
    }
    // Backwards-compat: sizeSet = alle waarden (voor consumers die nog niet op sizeItems zijn)
    const allSizes = new Set(sizeItems.map(i => i.value));

    const totalColorGroups = m.colorGroups.length;
    const COLOR_GROUPS_CAP = 12;
    if (totalColorGroups > COLOR_GROUPS_CAP) {
      cappedModelCount++;
      totalCappedColorGroups += totalColorGroups;
    }

    return {
      slug: m.slug,
      brandSlug: m.brandSlug,
      brandName: m.brandName,
      modelName: m.modelName,
      modelCode: m.modelCode,
      categoryCode: m.categoryCode,
      categoryPath: m.categoryPath,
      publicationStatus: m.publicationStatus,
      thumbWebp,
      minPrice,
      // Cap at 12 for display (swatches on ModelCard) — saves ~70% of summary size on outliers
      colorGroups: m.colorGroups.slice(0, COLOR_GROUPS_CAP).map((cg) => ({
        hexCode: cg.hexCode,
        secondaryHex: cg.secondaryHex,
        tertiaryHex: cg.tertiaryHex,
        colorCode: cg.colorCode,
        secondaryCode: cg.secondaryCode,
        tertiaryCode: cg.tertiaryCode,
        isFluorescent: cg.isFluorescent,
        isHighVisibility: cg.isHighVisibility,
      })),
      // Complete set of color codes for accurate filter matching (uncapped)
      colorCodeSet: allColorCodes.size > 0 ? Array.from(allColorCodes) : undefined,
      sizeSet: allSizes.size > 0 ? Array.from(allSizes) : undefined,
      sizeItems: sizeItems.length > 0 ? sizeItems : undefined,
    };
  });
  if (cappedModelCount > 0) {
    log(
      `colorGroups capped: ${cappedModelCount} models had >${12} kleurgroepen (totaal ${totalCappedColorGroups} → max 12 per model in summary)`,
    );
  }
  const summaryJson = JSON.stringify(summaries);
  await fs.writeFile(path.join(DATA_DIR, 'model-summary.json'), summaryJson, 'utf-8');
  const summarySizeMB = (Buffer.byteLength(summaryJson, 'utf-8') / 1024 / 1024).toFixed(2);
  log(`Written model-summary.json (${summaries.length} models, ${summarySizeMB} MB)`);

  // model-summary-core.json — only publicationStatus === 'core' (fast path, LOCKED state)
  const summariesCore = summaries.filter((s) => s.publicationStatus === 'core');
  const summariesExtended = summaries.filter((s) => s.publicationStatus !== 'core');

  const coreSummaryJson = JSON.stringify(summariesCore);
  await fs.writeFile(path.join(DATA_DIR, 'model-summary-core.json'), coreSummaryJson, 'utf-8');
  const coreSizeMB = (Buffer.byteLength(coreSummaryJson, 'utf-8') / 1024 / 1024).toFixed(2);
  log(`Written model-summary-core.json (${summariesCore.length} models, ${coreSizeMB} MB)`);

  // model-summary-extended.json — all non-core models (lazy-loaded when UNLOCKED)
  const extendedSummaryJson = JSON.stringify(summariesExtended);
  await fs.writeFile(path.join(DATA_DIR, 'model-summary-extended.json'), extendedSummaryJson, 'utf-8');
  const extendedSizeMB = (Buffer.byteLength(extendedSummaryJson, 'utf-8') / 1024 / 1024).toFixed(2);
  log(`Written model-summary-extended.json (${summariesExtended.length} models, ${extendedSizeMB} MB)`);

  // slug-index.json
  const slugIndex: Record<string, string> = Object.fromEntries(slugToChunkFile);
  const slugIndexJson = JSON.stringify(slugIndex);
  await fs.writeFile(path.join(DATA_DIR, 'slug-index.json'), slugIndexJson, 'utf-8');
  log(`Written slug-index.json (${Object.keys(slugIndex).length} slugs)`);

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
    // Preserve both canonical files AND sub-chunk files; otherwise sub-chunks
    // beyond the first get deleted right after being written, breaking lookup
    // of any model that lives in a sub-chunk (issue: AWD JC001J / Kids' Cool T).
    const currentChunkFiles = new Set<string>();
    for (const meta of Object.values(chunksMeta)) {
      currentChunkFiles.add(meta.file);
      if (meta.subChunks) {
        for (const sub of meta.subChunks) {
          currentChunkFiles.add(sub);
        }
      }
    }
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

  // url-lookup/ shards (stable deep-link tail -> { slug, color?, size? })
  const urlLookupDir = path.join(DATA_DIR, 'url-lookup');
  try { await fs.rm(urlLookupDir, { recursive: true, force: true }); } catch { /* ignore */ }
  await fs.mkdir(urlLookupDir, { recursive: true });
  // Cast: FrontendModel is structurally compatible for the fields buildUrlLookup accesses
  // (slug, modelPublicId, colorGroups[].{colorVariantId,colorRaw,variants[].{ean,sizeRaw}})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const urlLookup = buildUrlLookup(models as any);
  let totalTails = 0;
  for (const [shard, entries] of Object.entries(urlLookup)) {
    await fs.writeFile(path.join(urlLookupDir, `${shard}.json`), JSON.stringify(entries), 'utf-8');
    totalTails += Object.keys(entries).length;
  }
  log(`Written url-lookup/ (${Object.keys(urlLookup).length} shards, ${totalTails} tails)`);

  // sync-manifest.json
  const totalImages = models.reduce((sum, m) =>
    sum + m.colorGroups.reduce((s, cg) => s + cg.images.length, 0), 0);
  const manifest: SyncManifest = {
    lastSyncAt: new Date().toISOString(),
    fingerprint,
    modelSlugs: models.map((m) => m.slug),
    totalModels: models.length,
    totalImages,
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
  log('Running pre-deploy cleanup (removing RSC .txt payloads)...');
  execSync('tsx scripts/pre-deploy-cleanup.ts', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });

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

  // Step 1: Check for changes (skip when --force: assume full sync needed)
  const changeReport: ShowcaseChangeReport = FLAG_FORCE
    ? { hasChanges: true, dataFingerprint: 'force', lastExportAt: null, changedModelIds: [], changes: { modelsAdded: 0, modelsUpdated: 0, modelsRemoved: 0, imagesChanged: 0, pricesChanged: 0, categoriesChanged: 0 } }
    : await checkChanges();

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
  log('Transforming data to frontend format...');
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

  // Step 5: Build search index (always from full model set)
  const searchIndex = buildSearchIndex(allModels);

  // Step 6: Write output files
  const totalImages = allModels.reduce((sum, m) =>
    sum + m.colorGroups.reduce((s, cg) => s + cg.images.length, 0), 0);

  await writeDataFiles(
    allModels,
    frontendCategories,
    searchIndex,
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
  log(`  Images: ${totalImages} (R2 CDN)`);
  log(`  Index:  ${(searchIndex.length / 1024).toFixed(0)} KB`);

  // Step 8 (optional): Build
  if (FLAG_BUILD || FLAG_DEPLOY) {
    runBuild();

    // File count monitoring — Cloudflare Pages limit is 20,000 files
    function countFilesRecursive(dir: string): number {
      let count = 0;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          count += countFilesRecursive(path.join(dir, entry.name));
        } else {
          count++;
        }
      }
      return count;
    }

    if (existsSync('out')) {
      const fileCount = countFilesRecursive('out');
      const WARN_THRESHOLD = 18000;
      const ERROR_THRESHOLD = 19500;
      if (fileCount > ERROR_THRESHOLD) {
        log(`CRITICAL: ${fileCount} files exceeds Cloudflare limit (20,000)`);
        process.exit(1);
      } else if (fileCount > WARN_THRESHOLD) {
        log(`WARNING: ${fileCount} files approaching Cloudflare limit (20,000)`);
      } else {
        log(`File count: ${fileCount} (well within 20,000 limit)`);
      }
    }
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
