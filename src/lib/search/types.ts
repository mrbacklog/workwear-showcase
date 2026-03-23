/**
 * Search index document and result types for MiniSearch.
 *
 * SearchDocument is the shape stored in the search index.
 * SearchResult extends it with MiniSearch scoring metadata.
 */

import type { PublicationStatus } from '@/types/product';

// ---------------------------------------------------------------------------
// Search document (stored in the index)
// ---------------------------------------------------------------------------

export interface SearchDocument {
  /** Unique document identifier (model id as string) */
  id: string;
  /** URL-safe model slug */
  slug: string;
  /** Product model name */
  name: string;
  /** Brand display name */
  brand: string;
  /** URL-safe brand slug */
  brandSlug: string;
  /** Manufacturer article/model code */
  articleNumber: string;
  /** Space-separated keywords for search matching */
  keywords: string;
  /** Product description for full-text search */
  description: string;
  /** Full category path (e.g. "Werkkleding > Broeken > Werkbroeken") */
  categoryPath: string;
  /** Thumbnail WebP URL (R2 CDN, 400w) for result cards */
  thumbWebp: string;
  /** Full-size image path for result cards */
  imagePath: string;
  /** Lowest price in EUR cents across all variants */
  minPrice: number;
  /** Publication status for filtering */
  publicationStatus: PublicationStatus;
}

// ---------------------------------------------------------------------------
// Search result (document + MiniSearch scoring)
// ---------------------------------------------------------------------------

export interface SearchResult extends SearchDocument {
  /** MiniSearch relevance score */
  score: number;
  /** Object mapping matched fields to matched terms */
  match: Record<string, string[]>;
  /** Terms that matched in the query */
  terms: string[];
}

// ---------------------------------------------------------------------------
// Auto-suggest result
// ---------------------------------------------------------------------------

export interface SuggestResult {
  /** Suggested search term */
  suggestion: string;
  /** Relevance score */
  score: number;
  /** Terms that contributed to the suggestion */
  terms: string[];
}
