/**
 * Rebuild search-index.json from model-cards.json.
 * Run from showcase directory: node scripts/rebuild-search-index.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import MiniSearch from 'minisearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');
const modelsPath = join(DATA_DIR, 'model-cards.json');
const indexPath = join(DATA_DIR, 'search-index.json');

const models = JSON.parse(readFileSync(modelsPath, 'utf8'));
console.log(`Loaded ${models.length} models from model-cards.json`);

const SEARCH_FIELDS = ['name', 'brand', 'keywords', 'articleNumber', 'description', 'categoryPath'];
const STORE_FIELDS = ['id', 'slug', 'name', 'brand', 'brandSlug', 'articleNumber', 'keywords', 'description', 'categoryPath', 'thumbWebp', 'imagePath', 'minPrice', 'publicationStatus'];

const miniSearch = new MiniSearch({
  fields: SEARCH_FIELDS,
  storeFields: STORE_FIELDS,
  searchOptions: {
    boost: { name: 3, brand: 2.5, articleNumber: 2.5, keywords: 2, categoryPath: 1.5, description: 1 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND',
  },
});

const documents = models.map((model) => {
  let thumbWebp = '';
  let imagePath = '';
  if (Array.isArray(model.colorGroups)) {
    for (const cg of model.colorGroups) {
      if (Array.isArray(cg.images)) {
        for (const img of cg.images) {
          if (img.thumb400Webp && !thumbWebp) thumbWebp = img.thumb400Webp;
          if (img.path && !imagePath) imagePath = img.path;
          if (thumbWebp && imagePath) break;
        }
      }
      if (thumbWebp && imagePath) break;
    }
  }

  let minPrice = Infinity;
  if (Array.isArray(model.colorGroups)) {
    for (const cg of model.colorGroups) {
      if (Array.isArray(cg.variants)) {
        for (const v of cg.variants) {
          if (v.priceCents > 0 && v.priceCents < minPrice) minPrice = v.priceCents;
        }
      }
    }
  }
  if (minPrice === Infinity) minPrice = 0;

  const colorNames = Array.isArray(model.colorGroups)
    ? model.colorGroups.map((cg) => cg.colorName).filter(Boolean).join(' ')
    : '';
  const keywords = [model.brandName, model.modelName, model.modelCode, colorNames]
    .filter(Boolean)
    .join(' ');

  return {
    id: String(model.id),
    slug: model.slug,
    name: model.modelName || model.modelCode || '',
    brand: model.brandName || '',
    brandSlug: model.brandSlug || '',
    articleNumber: model.modelCode || '',
    keywords,
    description: model.shortDescriptionNl || model.descriptionNl || '',
    categoryPath: model.categoryPath || '',
    thumbWebp,
    imagePath,
    minPrice,
    publicationStatus: model.publicationStatus || '',
  };
});

miniSearch.addAll(documents);

const serialized = JSON.stringify(miniSearch);
writeFileSync(indexPath, serialized, 'utf8');

const withCat = documents.filter(d => d.categoryPath).length;
console.log(`Search index rebuilt: ${documents.length} documents, ${(serialized.length / 1024).toFixed(0)} KB`);
console.log(`Models with categoryPath: ${withCat}/${documents.length}`);
console.log(`Written to: ${indexPath}`);
