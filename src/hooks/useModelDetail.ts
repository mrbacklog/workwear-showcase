'use client';

/**
 * Hook for lazy-loading the full model detail for a single product.
 *
 * Uses slug-index.json to find which chunk file contains the model,
 * then fetches only that chunk. Both slug-index and chunks are cached
 * at module level to avoid redundant fetches across navigation.
 *
 * @example
 * ```tsx
 * const { model, isLoading, error } = useModelDetail('havep-attitude-werkbroek-80229');
 * ```
 */

import { useState, useEffect } from 'react';
import type { ShowcaseModel } from '@/types/product';

export interface UseModelDetailReturn {
  model: ShowcaseModel | null;
  isLoading: boolean;
  error: string | null;
}

// Module-level caches persist across component mounts / route navigations.
let slugIndexCache: Record<string, string> | null = null;
const chunkCache = new Map<string, ShowcaseModel[]>();

async function getSlugIndex(): Promise<Record<string, string>> {
  if (slugIndexCache) return slugIndexCache;
  const response = await fetch('/data/slug-index.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch slug-index.json: ${response.status}`);
  }
  slugIndexCache = await response.json() as Record<string, string>;
  return slugIndexCache;
}

async function getChunk(chunkFile: string): Promise<ShowcaseModel[]> {
  const cached = chunkCache.get(chunkFile);
  if (cached) return cached;
  const response = await fetch(`/data/${chunkFile}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch chunk ${chunkFile}: ${response.status}`);
  }
  const data = await response.json() as ShowcaseModel[];
  chunkCache.set(chunkFile, data);
  return data;
}

export function useModelDetail(slug: string): UseModelDetailReturn {
  const [model, setModel] = useState<ShowcaseModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setError('Geen slug opgegeven');
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setModel(null);

      try {
        const slugIndex = await getSlugIndex();
        if (cancelled) return;

        const chunkFile = slugIndex[slug];
        if (!chunkFile) {
          if (!cancelled) {
            setError('Product niet gevonden');
            setIsLoading(false);
          }
          return;
        }

        const chunk = await getChunk(chunkFile);
        if (cancelled) return;

        const found = chunk.find((m) => m.slug === slug) ?? null;
        if (!cancelled) {
          if (found) {
            setModel(found);
          } else {
            setError('Product niet gevonden in chunk');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[useModelDetail] Failed to load model:', err);
        if (!cancelled) {
          setError('Fout bij laden van product');
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { model, isLoading, error };
}
