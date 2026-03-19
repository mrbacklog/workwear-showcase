/**
 * ONE-TIME script: Generate a diverse sample dataset for offline development.
 *
 * Fetches all models from the backend API, selects a diverse subset (~60-80 models),
 * and writes fixture JSON files matching the sync-products.ts output format.
 *
 * Usage:
 *   BACKEND_URL=http://localhost:8001 AGENT_SECRET=xxx npx tsx scripts/generate-sample-dataset.ts
 *
 * Output: fixtures/sample-data/*.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import MiniSearch from 'minisearch';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8001';
const AGENT_SECRET = process.env.AGENT_SECRET ?? '';
const API_PREFIX = '/api/v1/distribution/showcase';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'fixtures', 'sample-data');

// ---------------------------------------------------------------------------
// Types (same as sync-products.ts)
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

interface ShowcaseExportResponse {
  categoryTree: ShowcaseCategory[];
  models: ShowcaseModel[];
  meta: {
    totalModels: number;
    totalVariants: number;
    totalImages: number;
    exportedAt: string;
  };
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

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BACKEND_URL}${API_PREFIX}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Agent-Secret': AGENT_SECRET,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${endpoint} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Transform (same logic as sync-products.ts)
// ---------------------------------------------------------------------------

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
        path: `${img.ean}-${img.sequenceNumber}`,
        thumbPath: `${img.ean}-${img.sequenceNumber}`,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Diverse selection
// ---------------------------------------------------------------------------

function selectDiverseSubset(models: ShowcaseModel[], targetCount: number): ShowcaseModel[] {
  const selected: ShowcaseModel[] = [];
  const usedBrands = new Set<string>();
  const usedCategories = new Set<string>();
  const usedStatuses = new Set<string>();

  // Sort models into buckets for diversity
  const multiColor = models.filter(m => m.colorGroups.length >= 3);
  const manyVariants = models.filter(m => m.variantCount >= 10);
  const fewVariants = models.filter(m => m.variantCount <= 2);
  const noImages = models.filter(m => m.colorGroups.every(cg => cg.images.length === 0));
  const coreModels = models.filter(m => m.publicationStatus === 'core');
  const extendedModels = models.filter(m => m.publicationStatus === 'extended');

  function addModel(model: ShowcaseModel): boolean {
    if (selected.some(s => s.id === model.id)) return false;
    selected.push(model);
    usedBrands.add(model.brandName);
    if (model.categoryCode) usedCategories.add(model.categoryCode);
    usedStatuses.add(model.publicationStatus);
    return true;
  }

  // Phase 1: Ensure brand diversity (pick 1 from each brand, up to 10 brands)
  const brandGroups = new Map<string, ShowcaseModel[]>();
  for (const m of models) {
    if (!brandGroups.has(m.brandName)) brandGroups.set(m.brandName, []);
    brandGroups.get(m.brandName)!.push(m);
  }

  const sortedBrands = [...brandGroups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  for (const [, brandModels] of sortedBrands) {
    // Pick one with images and multiple colors if possible
    const best = brandModels.find(m => m.colorGroups.length >= 2 && m.colorGroups.some(cg => cg.images.length > 0))
      || brandModels[0];
    addModel(best);
  }

  // Phase 2: Ensure category diversity
  const categoryGroups = new Map<string, ShowcaseModel[]>();
  for (const m of models) {
    const cat = m.categoryCode ?? 'uncategorized';
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(m);
  }

  for (const [cat, catModels] of categoryGroups) {
    if (!usedCategories.has(cat) && selected.length < targetCount) {
      addModel(catModels[0]);
    }
  }

  // Phase 3: Ensure edge cases
  // Multi-color models
  for (const m of multiColor) {
    if (selected.length >= targetCount) break;
    if (selected.filter(s => s.colorGroups.length >= 3).length < 5) {
      addModel(m);
    }
  }

  // Many variants
  for (const m of manyVariants) {
    if (selected.length >= targetCount) break;
    if (selected.filter(s => s.variantCount >= 10).length < 3) {
      addModel(m);
    }
  }

  // Few variants (edge case)
  for (const m of fewVariants) {
    if (selected.length >= targetCount) break;
    if (selected.filter(s => s.variantCount <= 2).length < 3) {
      addModel(m);
    }
  }

  // No-image models (edge case)
  for (const m of noImages) {
    if (selected.length >= targetCount) break;
    if (selected.filter(s => s.colorGroups.every(cg => cg.images.length === 0)).length < 2) {
      addModel(m);
    }
  }

  // Phase 4: Ensure status mix
  if (!usedStatuses.has('core')) {
    const core = coreModels.find(m => !selected.some(s => s.id === m.id));
    if (core) addModel(core);
  }
  if (!usedStatuses.has('extended')) {
    const ext = extendedModels.find(m => !selected.some(s => s.id === m.id));
    if (ext) addModel(ext);
  }

  // Phase 5: Fill remaining slots with diverse picks
  // Alternate between core and extended to get a good mix
  const remaining = models.filter(m => !selected.some(s => s.id === m.id));
  const coreRemaining = remaining.filter(m => m.publicationStatus === 'core');
  const extRemaining = remaining.filter(m => m.publicationStatus === 'extended');

  let ci = 0, ei = 0;
  while (selected.length < targetCount) {
    // Alternate: add a core, then an extended
    if (ci < coreRemaining.length && selected.length < targetCount) {
      addModel(coreRemaining[ci++]);
    }
    if (ei < extRemaining.length && selected.length < targetCount) {
      addModel(extRemaining[ei++]);
    }
    if (ci >= coreRemaining.length && ei >= extRemaining.length) break;
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Category tree filtering
// ---------------------------------------------------------------------------

function filterCategoryTree(fullTree: ShowcaseCategory[], usedCodes: Set<string>): FrontendCategory[] {
  // Collect all ancestor codes
  const allCodes = new Set(usedCodes);
  const codeToNode = new Map<string, ShowcaseCategory>();

  function indexTree(nodes: ShowcaseCategory[]) {
    for (const node of nodes) {
      codeToNode.set(node.code, node);
      indexTree(node.children);
    }
  }
  indexTree(fullTree);

  // Walk up to include all parents
  for (const code of usedCodes) {
    let current = codeToNode.get(code);
    while (current?.parentCode) {
      allCodes.add(current.parentCode);
      current = codeToNode.get(current.parentCode);
    }
  }

  function filterNodes(nodes: ShowcaseCategory[]): FrontendCategory[] {
    return nodes
      .filter(n => allCodes.has(n.code))
      .map(n => ({
        code: n.code,
        nameNl: n.nameNl,
        level: n.level,
        parentCode: n.parentCode,
        sortOrder: n.sortOrder,
        children: filterNodes(n.children),
      }));
  }

  return filterNodes(fullTree);
}

// ---------------------------------------------------------------------------
// Search index builder (same as sync-products.ts)
// ---------------------------------------------------------------------------

function buildSearchIndex(models: FrontendModel[]): string {
  const miniSearch = new MiniSearch({
    fields: ['name', 'brand', 'keywords', 'articleNumber', 'description', 'categoryPath'],
    storeFields: [
      'id', 'slug', 'name', 'brand', 'brandSlug', 'articleNumber',
      'keywords', 'description', 'categoryPath', 'thumbPath', 'imagePath',
      'minPrice', 'publicationStatus',
    ],
    searchOptions: {
      boost: { name: 3, brand: 2.5, articleNumber: 2.5, keywords: 2, categoryPath: 1.5, description: 1 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  });

  const documents = models.map((model) => {
    let thumbPath = '';
    let imagePath = '';
    for (const cg of model.colorGroups) {
      for (const img of cg.images) {
        if (img.thumbPath && !thumbPath) thumbPath = img.thumbPath;
        if (img.path && !imagePath) imagePath = img.path;
        if (thumbPath && imagePath) break;
      }
      if (thumbPath && imagePath) break;
    }

    let minPrice = Infinity;
    for (const cg of model.colorGroups) {
      for (const v of cg.variants) {
        if (v.priceCents > 0 && v.priceCents < minPrice) minPrice = v.priceCents;
      }
    }
    if (minPrice === Infinity) minPrice = 0;

    const colorNames = model.colorGroups.map(cg => cg.colorName).filter(Boolean).join(' ');
    const keywords = [model.brandName, model.modelName, model.modelCode, colorNames].filter(Boolean).join(' ');

    return {
      id: model.id,
      slug: model.slug,
      name: `${model.brandName} ${model.modelName}`.trim(),
      brand: model.brandName,
      brandSlug: model.brandSlug,
      articleNumber: model.modelCode,
      keywords,
      description: model.shortDescriptionNl || model.descriptionNl,
      categoryPath: model.categoryPath,
      thumbPath,
      imagePath,
      minPrice,
      publicationStatus: model.publicationStatus,
    };
  });

  miniSearch.addAll(documents);
  return JSON.stringify(miniSearch);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!AGENT_SECRET) {
    console.error('AGENT_SECRET is required. Set it in .env.local or as environment variable.');
    process.exit(1);
  }

  console.log(`Fetching all models from ${BACKEND_URL}...`);

  // Fetch full export (all models)
  const response = await apiFetch<ShowcaseExportResponse>('/export', { method: 'POST' });
  console.log(`Received ${response.models.length} models, ${response.categoryTree.length} top-level categories`);

  // Select diverse subset
  const TARGET_COUNT = 70;
  const subset = selectDiverseSubset(response.models, TARGET_COUNT);
  console.log(`Selected ${subset.length} diverse models`);

  // Log diversity stats
  const brands = new Set(subset.map(m => m.brandName));
  const categories = new Set(subset.map(m => m.categoryCode).filter(Boolean));
  const statuses = new Set(subset.map(m => m.publicationStatus));
  const multiColorCount = subset.filter(m => m.colorGroups.length >= 3).length;
  const manyVariantCount = subset.filter(m => m.variantCount >= 10).length;
  const fewVariantCount = subset.filter(m => m.variantCount <= 2).length;

  console.log(`  Brands: ${brands.size} (${[...brands].join(', ')})`);
  console.log(`  Categories: ${categories.size}`);
  console.log(`  Statuses: ${[...statuses].join(', ')}`);
  console.log(`  Multi-color (3+): ${multiColorCount}`);
  console.log(`  Many variants (10+): ${manyVariantCount}`);
  console.log(`  Few variants (1-2): ${fewVariantCount}`);

  // Transform to frontend shape (strip base64 image data)
  const frontendModels = subset.map(transformModel);

  // Filter category tree to only include used categories
  const usedCategoryCodes = new Set(frontendModels.map(m => m.categoryCode).filter(Boolean));
  const filteredTree = filterCategoryTree(response.categoryTree, usedCategoryCodes);

  // Build search index
  const searchIndex = buildSearchIndex(frontendModels);

  // Build manifest
  const manifest = {
    lastSyncAt: new Date().toISOString(),
    fingerprint: 'sample-dataset-fixture',
    modelSlugs: frontendModels.map(m => m.slug),
    imageFiles: [],
    totalModels: frontendModels.length,
    totalImages: 0,
  };

  // Build sprite-map (empty for sample — no real sprites)
  const spriteMap = {
    thumbCell: 64,
    fullCell: 400,
    fullCols: 5,
    imageBase: 'https://api.databiz.app/api/v1/distribution/showcase/image',
    models: {} as Record<string, unknown>,
  };

  // Write files
  await fs.mkdir(FIXTURES_DIR, { recursive: true });

  await fs.writeFile(
    path.join(FIXTURES_DIR, 'model-cards-0.json'),
    JSON.stringify(frontendModels),
  );

  await fs.writeFile(
    path.join(FIXTURES_DIR, 'model-cards-meta.json'),
    JSON.stringify({ chunks: 1, totalModels: frontendModels.length }),
  );

  await fs.writeFile(
    path.join(FIXTURES_DIR, 'category-tree.json'),
    JSON.stringify(filteredTree),
  );

  await fs.writeFile(
    path.join(FIXTURES_DIR, 'search-index.json'),
    searchIndex,
  );

  await fs.writeFile(
    path.join(FIXTURES_DIR, 'sync-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  await fs.writeFile(
    path.join(FIXTURES_DIR, 'sprite-map.json'),
    JSON.stringify(spriteMap),
  );

  console.log(`\nFixtures written to ${FIXTURES_DIR}/`);
  console.log('Files:');
  console.log(`  model-cards-0.json (${frontendModels.length} models)`);
  console.log('  model-cards-meta.json');
  console.log(`  category-tree.json (${filteredTree.length} top-level categories)`);
  console.log('  search-index.json');
  console.log('  sync-manifest.json');
  console.log('  sprite-map.json');
  console.log('\nDone! Run "npm run dev:offline" to test.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
