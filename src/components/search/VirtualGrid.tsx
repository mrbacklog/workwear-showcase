'use client';

/**
 * VirtualGrid — virtualized grid using @tanstack/react-virtual.
 *
 * Renders only visible rows (+ overscan) for large lists of ModelCards.
 * Supports multiple view modes with different column counts and row heights.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ModelCard } from '@/components/search/ModelCard';
import type { ShowcaseModel } from '@/types/product';
import type { ViewMode } from '@/components/search/ViewSwitcher';

const GAP_PX = 16;
const OVERSCAN = 3;

function getColumnCount(width: number, viewMode: ViewMode): number {
  if (viewMode === 'gallery') {
    if (width >= 1440) return 3;
    if (width >= 1024) return 2;
    return 1;
  }
  if (viewMode === 'hover') {
    if (width >= 1440) return 4;
    if (width >= 1024) return 3;
    if (width >= 640) return 3;
    return 2;
  }
  // grid
  if (width >= 1440) return 5;
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

function getEstimatedRowHeight(viewMode: ViewMode): number {
  if (viewMode === 'gallery') return 380;
  if (viewMode === 'grid') return 420;
  return 300; // hover — smaller tiles, 3-4 per row
}

interface VirtualGridProps {
  items: ShowcaseModel[];
  preferredColorCodes?: Set<string>;
  viewMode?: ViewMode;
}

export function VirtualGrid({ items, preferredColorCodes, viewMode = 'grid' }: VirtualGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setColumnCount(getColumnCount(width, viewMode));
      }
    });

    observer.observe(el);
    setColumnCount(getColumnCount(el.getBoundingClientRect().width, viewMode));

    return () => observer.disconnect();
  }, [viewMode]);

  const rowCount = Math.ceil(items.length / columnCount);
  const estimatedHeight = getEstimatedRowHeight(viewMode);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.documentElement,
    estimateSize: () => estimatedHeight + GAP_PX,
    overscan: OVERSCAN,
  });

  const getItemsForRow = useCallback(
    (rowIndex: number): ShowcaseModel[] => {
      const start = rowIndex * columnCount;
      return items.slice(start, start + columnCount);
    },
    [items, columnCount]
  );

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  return (
    <div ref={containerRef} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualRows.map((virtualRow) => {
          const rowItems = getItemsForRow(virtualRow.index);
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: GAP_PX,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  gap: GAP_PX,
                }}
              >
                {rowItems.map((model) => (
                  <ModelCard
                    key={model.slug}
                    model={model}
                    preferredColorCodes={preferredColorCodes}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
