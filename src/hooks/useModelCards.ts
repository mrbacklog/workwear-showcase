'use client';

/**
 * React hook for loading and querying the model cards dataset.
 *
 * Fetches /data/model-cards-meta.json on mount and loads all chunks in
 * parallel. Supports both the legacy numeric chunk format (model-cards-0.json)
 * and the new category-based chunk format (model-cards-cat-<key>.json).
 *
 * @example
 * ```tsx
 * const { models, isLoading, getBySlug, getByCategory, getBrands, loadChunk } = useModelCards();
 * const model = getBySlug('havep-attitude-werkbroek-80229');
 * const broeken = getByCategory('werkbroeken');
 * const brands = getBrands();
 * await loadChunk('cat-alg-kleding'); // future: load single category on demand
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ShowcaseModel } from '@/types/product';

const MODEL_CARDS_META_PATH = '/data/model-cards-meta.json';

// ---------------------------------------------------------------------------
// Meta format types
// ---------------------------------------------------------------------------

/** New category-based chunk entry */
interface CategoryChunkEntry {
  file: string;
  modelCount: number;
  categoryName: string;
}

/** New meta format: chunks keyed by category key */
interface CategoryMeta {
  totalModels: number;
  chunks: Record<string, CategoryChunkEntry>;
}

/** Legacy meta format: numbered chunks */
interface LegacyMeta {
  totalModels: number;
  chunks: number;
}

type ModelCardsMeta = CategoryMeta | LegacyMeta;

function isCategoryMeta(meta: ModelCardsMeta): meta is CategoryMeta {
  return typeof meta.chunks === 'object' && !Array.isArray(meta.chunks);
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface BrandInfo {
  /** Brand display name */
  name: string;
  /** URL-safe brand slug */
  slug: string;
  /** Number of models for this brand */
  modelCount: number;
}

export interface UseModelCardsReturn {
  /** All loaded model cards */
  models: ShowcaseModel[];
  /** Whether the data is currently being loaded */
  isLoading: boolean;
  /** Find a single model by its slug */
  getBySlug: (slug: string) => ShowcaseModel | null;
  /** Filter models by category code (exact match on categoryCode) */
  getByCategory: (code: string) => ShowcaseModel[];
  /** Get a deduplicated, sorted list of brands with model counts */
  getBrands: () => BrandInfo[];
  /**
   * Load a specific chunk by its category key (e.g. "cat-alg-kleding").
   * Currently a no-op when all chunks are loaded eagerly on mount, but
   * exposed for future selective loading.
   */
  loadChunk: (categoryKey: string) => Promise<void>;
}

export function useModelCards(): UseModelCardsReturn {
  const [models, setModels] = useState<ShowcaseModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /** Slug -> model lookup for O(1) access */
  const slugMapRef = useRef<Map<string, ShowcaseModel>>(new Map());
  /** Category code -> models lookup for O(1) category filtering */
  const categoryMapRef = useRef<Map<string, ShowcaseModel[]>>(new Map());
  /** Cached brand list, computed once after load */
  const brandsRef = useRef<BrandInfo[]>([]);

  // ---------------------------------------------------------------------------
  // Fetch model cards on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const start = performance.now();

      try {
        // Load chunk metadata first
        const metaResponse = await fetch(MODEL_CARDS_META_PATH);
        if (!metaResponse.ok) {
          throw new Error(`Failed to fetch model-cards meta: ${metaResponse.status}`);
        }
        const meta: ModelCardsMeta = await metaResponse.json();

        // Resolve chunk file paths from either meta format
        const chunkFiles: string[] = resolveChunkFiles(meta);

        // Load all chunks in parallel
        const chunkPromises = chunkFiles.map((file) =>
          fetch(`/data/${file}`).then((r) => {
            if (!r.ok) throw new Error(`Failed to fetch chunk ${file}: ${r.status}`);
            return r.json() as Promise<ShowcaseModel[]>;
          })
        );
        const chunks = await Promise.all(chunkPromises);
        const rawData: ShowcaseModel[] = chunks.flat();

        // Deduplicate by slug (keep first occurrence)
        const seenSlugs = new Set<string>();
        const data: ShowcaseModel[] = [];
        for (const model of rawData) {
          if (!seenSlugs.has(model.slug)) {
            seenSlugs.add(model.slug);
            data.push(model);
          }
        }

        if (cancelled) return;

        // Build indexes
        const slugMap = new Map<string, ShowcaseModel>();
        const categoryMap = new Map<string, ShowcaseModel[]>();
        const brandCountMap = new Map<string, { name: string; slug: string; count: number }>();

        for (const model of data) {
          // Slug index
          slugMap.set(model.slug, model);

          // Category index
          const existing = categoryMap.get(model.categoryCode);
          if (existing) {
            existing.push(model);
          } else {
            categoryMap.set(model.categoryCode, [model]);
          }

          // Brand aggregation
          const brandEntry = brandCountMap.get(model.brandSlug);
          if (brandEntry) {
            brandEntry.count += 1;
          } else {
            brandCountMap.set(model.brandSlug, {
              name: model.brandName,
              slug: model.brandSlug,
              count: 1,
            });
          }
        }

        // Build sorted brand list
        const brands: BrandInfo[] = Array.from(brandCountMap.values())
          .map((b) => ({
            name: b.name,
            slug: b.slug,
            modelCount: b.count,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

        slugMapRef.current = slugMap;
        categoryMapRef.current = categoryMap;
        brandsRef.current = brands;
        setModels(data);

        const elapsed = (performance.now() - start).toFixed(1);
        console.debug(
          `[useModelCards] Loaded ${data.length} models, ${brands.length} brands in ${elapsed}ms`
        );
      } catch (error) {
        console.error('[useModelCards] Failed to load model cards:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Query helpers
  // ---------------------------------------------------------------------------

  const getBySlug = useCallback(
    (slug: string): ShowcaseModel | null => {
      return slugMapRef.current.get(slug) ?? null;
    },
    []
  );

  const getByCategory = useCallback(
    (code: string): ShowcaseModel[] => {
      return categoryMapRef.current.get(code) ?? [];
    },
    []
  );

  const getBrands = useCallback((): BrandInfo[] => {
    return brandsRef.current;
  }, []);

  /**
   * Exposed for future selective loading. Currently a no-op because all chunks
   * are loaded eagerly on mount.
   */
  const loadChunk = useCallback(async (_categoryKey: string): Promise<void> => {
    // No-op: all chunks are loaded eagerly on mount.
    // Future enhancement: load only the requested chunk and merge into state.
  }, []);

  return {
    models,
    isLoading,
    getBySlug,
    getByCategory,
    getBrands,
    loadChunk,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the list of chunk filenames from either the new category-based meta
 * or the legacy numeric-chunks meta.
 */
function resolveChunkFiles(meta: ModelCardsMeta): string[] {
  if (isCategoryMeta(meta)) {
    // New format: { chunks: { "cat-alg-kleding": { file: "model-cards-cat-alg-kleding.json", ... }, ... } }
    return Object.values(meta.chunks).map((entry) => entry.file);
  }

  // Legacy format: { chunks: 3 } → model-cards-0.json, model-cards-1.json, ...
  const count = meta.chunks as number;
  return Array.from({ length: count }, (_, i) => `model-cards-${i}.json`);
}
