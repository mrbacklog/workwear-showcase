/**
 * MiniSearch configuration for the showcase product search.
 *
 * Defines indexed fields, boosting weights, stored fields for result cards,
 * and default search/autosuggest options.
 */

import type { Options as MiniSearchOptions } from 'minisearch';
import type { SearchDocument } from './types';

// ---------------------------------------------------------------------------
// Field boost weights
// ---------------------------------------------------------------------------

/**
 * Boost multipliers per field. Higher values mean matches in that field
 * contribute more to the relevance score.
 */
export const FIELD_BOOSTS: Record<string, number> = {
  name: 3,
  brand: 2.5,
  articleNumber: 2.5,
  keywords: 2,
  categoryPath: 1.5,
  description: 1,
} as const;

// ---------------------------------------------------------------------------
// Fields configuration
// ---------------------------------------------------------------------------

/** Fields indexed for full-text search */
export const SEARCH_FIELDS: Array<keyof SearchDocument> = [
  'name',
  'brand',
  'keywords',
  'articleNumber',
  'description',
  'categoryPath',
];

/** Fields stored on each document for rendering result cards */
export const STORE_FIELDS: Array<keyof SearchDocument> = [
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
];

// ---------------------------------------------------------------------------
// MiniSearch options
// ---------------------------------------------------------------------------

/**
 * Complete MiniSearch options for building and querying the index.
 *
 * Usage:
 * ```ts
 * const index = new MiniSearch<SearchDocument>(MINISEARCH_OPTIONS);
 * ```
 */
export const MINISEARCH_OPTIONS: MiniSearchOptions<SearchDocument> = {
  fields: SEARCH_FIELDS as string[],
  storeFields: STORE_FIELDS as string[],
  searchOptions: {
    boost: FIELD_BOOSTS,
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND',
  },
};

// ---------------------------------------------------------------------------
// Auto-suggest options
// ---------------------------------------------------------------------------

/**
 * Options passed to MiniSearch.autoSuggest().
 * Uses lighter boosting and OR combination for broader suggestions.
 */
export const AUTOSUGGEST_OPTIONS = {
  boost: FIELD_BOOSTS,
  prefix: true,
  fuzzy: 0.2,
  combineWith: 'OR' as const,
};
