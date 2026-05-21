/**
 * Lightweight model summary type for browse/search pages.
 *
 * Contains only the fields needed for listing, filtering, and card rendering.
 * Fetched from /data/model-summary.json as a single request (~300KB Brotli)
 * instead of loading all model-cards chunks (6+ MB).
 *
 * For full model detail (descriptions, variants, images), use useModelDetail
 * which lazy-loads the specific chunk via slug-index.json.
 */

import type { BrandInfo } from '@/hooks/useModelCards';

export interface ModelSummaryColorGroup {
  hexCode: string;
  secondaryHex: string | null;
  tertiaryHex: string | null;
  isFluorescent: boolean;
  isHighVisibility: boolean;
  /** Primary color family code for filter matching (e.g. "BLK", "WHT") */
  colorCode?: string;
  /** Secondary color family code for filter matching */
  secondaryCode?: string | null;
  /** Tertiary color family code for filter matching */
  tertiaryCode?: string | null;
}

export interface ModelSummary {
  slug: string;
  brandSlug: string;
  brandName: string;
  modelName: string;
  modelCode: string;
  categoryCode: string;
  categoryPath: string;
  publicationStatus: string;
  /** Thumbnail WebP URL for card display */
  thumbWebp: string;
  /** Minimum price in EUR cents across all variants */
  minPrice: number;
  colorGroups: ModelSummaryColorGroup[];
  /** All unique color codes across ALL colorGroups (uncapped). Used for filter accuracy. */
  colorCodeSet?: string[];
}

export interface UseModelSummariesReturn {
  summaries: ModelSummary[];
  isLoading: boolean;
  getBySlug: (slug: string) => ModelSummary | null;
  getByCategory: (code: string) => ModelSummary[];
  getBrands: () => BrandInfo[];
}
