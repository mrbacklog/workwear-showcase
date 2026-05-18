'use client';

/**
 * Hook for loading model summaries for browse/search pages.
 *
 * Fetches /data/model-summary.json (a single ~300KB Brotli request) instead
 * of loading all model-cards chunks. Provides the same filter helpers as
 * useModelCards but operates on the lightweight ModelSummary type.
 *
 * @example
 * ```tsx
 * const { summaries, isLoading, getBySlug, getByCategory, getBrands } = useModelSummaries();
 * const broeken = getByCategory('werkbroeken');
 * const brands = getBrands();
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ModelSummary, UseModelSummariesReturn } from '@/types/summary';
import type { BrandInfo } from '@/hooks/useModelCards';

const MODEL_SUMMARY_PATH = '/data/model-summary.json';

export function useModelSummaries(): UseModelSummariesReturn {
  const [summaries, setSummaries] = useState<ModelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /** Slug -> summary lookup for O(1) access */
  const slugMapRef = useRef<Map<string, ModelSummary>>(new Map());
  /** Category code -> summaries lookup for O(1) category filtering */
  const categoryMapRef = useRef<Map<string, ModelSummary[]>>(new Map());
  /** Cached brand list, computed once after load */
  const brandsRef = useRef<BrandInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(MODEL_SUMMARY_PATH);
        if (!response.ok) {
          throw new Error(`Failed to fetch model-summary.json: ${response.status}`);
        }
        const data: ModelSummary[] = await response.json();
        if (cancelled) return;

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

        slugMapRef.current = slugMap;
        categoryMapRef.current = categoryMap;
        brandsRef.current = Array.from(brandCountMap.values())
          .map((b) => ({ name: b.name, slug: b.slug, modelCount: b.count }))
          .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

        setSummaries(data);
        setIsLoading(false);
      } catch (error) {
        console.error('[useModelSummaries] Failed to load model-summary.json:', error);
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

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
