'use client';

/**
 * Hook for loading model summaries for browse/search pages.
 *
 * Sprint 2 — Core/Extended split:
 * - On mount: fetches /data/model-summary-core.json (fast path, LOCKED state).
 *   Falls back to /data/model-summary.json if core file returns 404 (e.g. old build).
 * - When isUnlocked === true: lazily fetches /data/model-summary-extended.json and
 *   merges it into the existing indexes. Extended data is kept in memory even after
 *   re-lock so a subsequent unlock is instant.
 * - Falls back gracefully on 404 for extended file: core-only set is shown, no crash.
 *
 * Consumer API is unchanged: summaries, isLoading, getBySlug, getByCategory, getBrands.
 *
 * @example
 * ```tsx
 * const { summaries, isLoading, getBySlug, getByCategory, getBrands } = useModelSummaries();
 * const broeken = getByCategory('werkbroeken');
 * const brands = getBrands();
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import type { ModelSummary, UseModelSummariesReturn } from '@/types/summary';
import type { BrandInfo } from '@/hooks/useModelCards';

const CORE_PATH = '/data/model-summary-core.json';
const EXTENDED_PATH = '/data/model-summary-extended.json';
const FALLBACK_PATH = '/data/model-summary.json';

/** Build slug/category/brand indexes from a list of summaries. */
function buildIndexes(data: ModelSummary[]): {
  slugMap: Map<string, ModelSummary>;
  categoryMap: Map<string, ModelSummary[]>;
  brands: BrandInfo[];
} {
  const slugMap = new Map<string, ModelSummary>();
  const categoryMap = new Map<string, ModelSummary[]>();
  const brandCountMap = new Map<string, { name: string; slug: string; count: number }>();

  for (const summary of data) {
    slugMap.set(summary.slug, summary);

    const existing = categoryMap.get(summary.categoryCode);
    if (existing) {
      existing.push(summary);
    } else {
      categoryMap.set(summary.categoryCode, [summary]);
    }

    const entry = brandCountMap.get(summary.brandSlug);
    if (entry) {
      entry.count += 1;
    } else {
      brandCountMap.set(summary.brandSlug, {
        name: summary.brandName,
        slug: summary.brandSlug,
        count: 1,
      });
    }
  }

  const brands = Array.from(brandCountMap.values())
    .map((b) => ({ name: b.name, slug: b.slug, modelCount: b.count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  return { slugMap, categoryMap, brands };
}

export function useModelSummaries(): UseModelSummariesReturn {
  // coreSummaries: loaded on mount, never cleared
  const coreSummariesRef = useRef<ModelSummary[]>([]);
  // extendedSummaries: loaded once when unlocked, kept in memory on re-lock
  const extendedSummariesRef = useRef<ModelSummary[]>([]);
  // Whether extended has been fetched (success or 404)
  const extendedFetchedRef = useRef(false);

  const [summaries, setSummaries] = useState<ModelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const slugMapRef = useRef<Map<string, ModelSummary>>(new Map());
  const categoryMapRef = useRef<Map<string, ModelSummary[]>>(new Map());
  const brandsRef = useRef<BrandInfo[]>([]);

  const { isUnlocked } = useShowcaseAuth();

  /** Rebuild indexes from combined core + optional extended, then push state. */
  const rebuildState = useCallback((core: ModelSummary[], extended: ModelSummary[]) => {
    const combined = extended.length > 0 ? [...core, ...extended] : core;
    const { slugMap, categoryMap, brands } = buildIndexes(combined);
    slugMapRef.current = slugMap;
    categoryMapRef.current = categoryMap;
    brandsRef.current = brands;
    setSummaries(combined);
  }, []);

  // — Phase 1: load core on mount —
  useEffect(() => {
    let cancelled = false;

    async function loadCore() {
      try {
        let response = await fetch(CORE_PATH);

        if (response.status === 404) {
          // Fallback: old build without split files
          console.warn('[useModelSummaries] model-summary-core.json not found, falling back to model-summary.json');
          response = await fetch(FALLBACK_PATH);
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch model summaries: ${response.status}`);
        }

        const data: ModelSummary[] = await response.json();
        if (cancelled) return;

        coreSummariesRef.current = data;
        rebuildState(data, extendedSummariesRef.current);
        setIsLoading(false);
      } catch (error) {
        console.error('[useModelSummaries] Failed to load core summaries:', error);
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCore();
    return () => { cancelled = true; };
  }, [rebuildState]);

  // — Phase 2: load extended lazily when unlocked —
  useEffect(() => {
    if (!isUnlocked) return;
    // Already fetched (success or 404) — just rebuild with what we have
    if (extendedFetchedRef.current) {
      rebuildState(coreSummariesRef.current, extendedSummariesRef.current);
      return;
    }

    let cancelled = false;

    async function loadExtended() {
      try {
        const response = await fetch(EXTENDED_PATH);

        if (response.status === 404) {
          console.warn('[useModelSummaries] model-summary-extended.json not found; showing core set only.');
          extendedFetchedRef.current = true;
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch extended summaries: ${response.status}`);
        }

        const data: ModelSummary[] = await response.json();
        if (cancelled) return;

        extendedSummariesRef.current = data;
        extendedFetchedRef.current = true;
        rebuildState(coreSummariesRef.current, data);
      } catch (error) {
        console.warn('[useModelSummaries] Extended summaries unavailable; showing core set only:', error);
        if (!cancelled) extendedFetchedRef.current = true;
      }
    }

    loadExtended();
    return () => { cancelled = true; };
  }, [isUnlocked, rebuildState]);

  const getBySlug = useCallback((slug: string): ModelSummary | null => {
    return slugMapRef.current.get(slug) ?? null;
  }, []);

  const getByCategory = useCallback((code: string): ModelSummary[] => {
    return categoryMapRef.current.get(code) ?? [];
  }, []);

  const getBrands = useCallback((): BrandInfo[] => {
    return brandsRef.current;
  }, []);

  return {
    summaries,
    isLoading,
    getBySlug,
    getByCategory,
    getBrands,
  };
}
