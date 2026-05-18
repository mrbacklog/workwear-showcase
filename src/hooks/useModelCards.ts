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

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';

const idleRun = <T,>(fn: () => T): Promise<T> =>
  new Promise((resolve) => {
    const cb = () => resolve(fn());
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void })
        .requestIdleCallback(cb, { timeout: 500 });
    } else {
      setTimeout(cb, 0);
    }
  });
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
  subChunks?: string[]; // present when category was split into multiple files
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
  /** Deduplication set shared across progressive chunk loads */
  const seenSlugsRef = useRef<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Merge a chunk of models into the shared indexes and update state
  // ---------------------------------------------------------------------------

  const mergeChunk = useCallback((chunk: ShowcaseModel[]) => {
    const slugMap = slugMapRef.current;
    const categoryMap = categoryMapRef.current;

    for (const model of chunk) {
      if (seenSlugsRef.current.has(model.slug)) continue;
      seenSlugsRef.current.add(model.slug);

      slugMap.set(model.slug, model);

      const existing = categoryMap.get(model.categoryCode);
      if (existing) {
        existing.push(model);
      } else {
        categoryMap.set(model.categoryCode, [model]);
      }
    }

    // Rebuild brand list from the full slug map
    const brandCountMap = new Map<string, { name: string; slug: string; count: number }>();
    for (const model of slugMap.values()) {
      const entry = brandCountMap.get(model.brandSlug);
      if (entry) {
        entry.count += 1;
      } else {
        brandCountMap.set(model.brandSlug, {
          name: model.brandName,
          slug: model.brandSlug,
          count: 1,
        });
      }
    }
    brandsRef.current = Array.from(brandCountMap.values())
      .map((b) => ({ name: b.name, slug: b.slug, modelCount: b.count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

    setModels(Array.from(slugMap.values()));
  }, []);

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

        if (chunkFiles.length === 0) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Load first chunk immediately to show results fast, then load the rest
        const [firstFile, ...remainingFiles] = chunkFiles;

        const fetchChunk = (file: string): Promise<ShowcaseModel[]> =>
          fetch(`/data/${file}`).then((r) => {
            if (!r.ok) throw new Error(`Failed to fetch chunk ${file}: ${r.status}`);
            return r.json() as Promise<ShowcaseModel[]>;
          });

        // Show first chunk as soon as it arrives
        const firstChunk = await fetchChunk(firstFile);
        if (cancelled) return;
        mergeChunk(firstChunk);
        // Signal that the initial content is ready (stops skeleton)
        setIsLoading(false);

        const elapsed0 = (performance.now() - start).toFixed(1);
        console.debug(
          `[useModelCards] First chunk (${firstChunk.length} models) shown in ${elapsed0}ms`
        );

        // Load remaining chunks and merge progressively. Use requestIdleCallback
        // (via idleRun) to defer CPU-heavy mergeChunk work off the critical path,
        // wrapped in startTransition so React can deprioritize these state updates.
        if (remainingFiles.length > 0) {
          const remainingPromises = remainingFiles.map((file) =>
            fetchChunk(file).then((chunk) => {
              if (!cancelled) {
                return idleRun(() => startTransition(() => mergeChunk(chunk)));
              }
            })
          );
          await Promise.all(remainingPromises);
        }

        const elapsed = (performance.now() - start).toFixed(1);
        console.debug(
          `[useModelCards] All ${seenSlugsRef.current.size} models loaded in ${elapsed}ms`
        );
      } catch (error) {
        console.error('[useModelCards] Failed to load model cards:', error);
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [mergeChunk]);

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
    // New format: { chunks: { "cat-alg-kleding": { file, subChunks?, ... }, ... } }
    // When a category was split into sub-chunks, use subChunks list; otherwise use file.
    const files: string[] = [];
    for (const entry of Object.values(meta.chunks)) {
      if (entry.subChunks && entry.subChunks.length > 0) {
        files.push(...entry.subChunks);
      } else {
        files.push(entry.file);
      }
    }
    return files;
  }

  // Legacy format: { chunks: 3 } → model-cards-0.json, model-cards-1.json, ...
  const count = meta.chunks as number;
  return Array.from({ length: count }, (_, i) => `model-cards-${i}.json`);
}
