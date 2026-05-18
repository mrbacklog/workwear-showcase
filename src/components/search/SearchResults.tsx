'use client';

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SearchResult } from '@/lib/search/types';
import type { ModelSummary } from '@/types/summary';
import { ModelCard } from '@/components/search/ModelCard';

interface SearchResultsProps {
  results: SearchResult[];
  modelCards: Map<string, ModelSummary>;
}

/** Number of columns per breakpoint (matched via JS for virtualization). */
const CARD_HEIGHT_ESTIMATE = 380;

export function SearchResults({ results, modelCards }: SearchResultsProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Determine column count based on window width (with SSR fallback)
  const columnCount = useMemo(() => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width < 640) return 1;
    if (width < 768) return 2;
    if (width < 1024) return 3;
    return 4;
  }, []);

  // Group results into rows for virtualization
  const rows = useMemo(() => {
    const grouped: SearchResult[][] = [];
    for (let i = 0; i < results.length; i += columnCount) {
      grouped.push(results.slice(i, i + columnCount));
    }
    return grouped;
  }, [results, columnCount]);

  const useVirtualization = results.length >= 100;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT_ESTIMATE,
    overscan: 3,
    enabled: useVirtualization,
  });

  if (results.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        Geen producten gevonden
      </div>
    );
  }

  // Non-virtualized grid for small result sets
  if (!useVirtualization) {
    return (
      <div>
        <p className="mb-4 text-sm text-gray-600">
          {results.length} {results.length === 1 ? 'product' : 'producten'} gevonden
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {results.map((result) => {
            const model = modelCards.get(result.slug);
            if (!model) return null;
            return <ModelCard key={result.id} model={model} />;
          })}
        </div>
      </div>
    );
  }

  // Virtualized grid for large result sets
  return (
    <div>
      <p className="mb-4 text-sm text-gray-600">
        {results.length} {results.length === 1 ? 'product' : 'producten'} gevonden
      </p>
      <div
        ref={parentRef}
        className="h-[calc(100vh-12rem)] overflow-auto"
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 right-0 grid gap-4"
                style={{
                  top: `${virtualRow.start}px`,
                  height: `${virtualRow.size}px`,
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                }}
              >
                {row.map((result) => {
                  const model = modelCards.get(result.slug);
                  if (!model) return null;
                  return <ModelCard key={result.id} model={model} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
