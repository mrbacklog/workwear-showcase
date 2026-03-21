'use client';

/**
 * VirtualGrid — virtualized grid using @tanstack/react-virtual.
 *
 * Renders only visible rows (+ overscan) for large lists of ModelCards.
 * Columns are calculated from container width to match Tailwind responsive grid:
 *   - < 640px  (mobile)  → 2 columns  (grid-cols-2)
 *   - ≥ 640px  (sm)      → 3 columns  (sm:grid-cols-3)
 *   - ≥ 1024px (lg)      → 4 columns  (lg:grid-cols-4)
 *   - ≥ 1440px (xl)      → 5 columns
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ModelCard } from '@/components/search/ModelCard';
import type { ShowcaseModel } from '@/types/product';

const GAP_PX = 16; // gap-4 = 1rem = 16px
const ESTIMATED_ROW_HEIGHT = 350; // approximate ModelCard height
const OVERSCAN = 3;

function getColumnCount(width: number): number {
  if (width >= 1440) return 5;
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

interface VirtualGridProps {
  items: ShowcaseModel[];
  preferredColorCodes?: Set<string>;
}

export function VirtualGrid({ items, preferredColorCodes }: VirtualGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(2);

  // Observe container width and update column count
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setColumnCount(getColumnCount(width));
      }
    });

    observer.observe(el);

    // Set initial column count
    setColumnCount(getColumnCount(el.getBoundingClientRect().width));

    return () => observer.disconnect();
  }, []);

  // Split items into rows
  const rowCount = Math.ceil(items.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.documentElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT + GAP_PX,
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
      {/* Outer container with total virtual height */}
      <div
        style={{ height: totalHeight, position: 'relative' }}
      >
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
