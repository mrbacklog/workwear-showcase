'use client';

import { useMemo } from 'react';
import type { ColorGroup } from '@/types/product';
import { formatPrice } from '@/lib/format';
import { compareSizes } from '@/lib/size-sort';

interface ColorSizeMatrixProps {
  colorGroups: ColorGroup[];
}

/** Colors that need a visible border because they blend with white backgrounds. */
function needsBorder(hex: string): boolean {
  const normalized = hex.toLowerCase();
  const match = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (match) {
    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    return r > 230 && g > 230 && b > 230;
  }
  return false;
}

export function ColorSizeMatrix({ colorGroups }: ColorSizeMatrixProps) {
  // Collect all unique sizes across all color groups, preserving order
  const allSizes = useMemo(() => {
    const sizeSet = new Map<string, string>(); // sizeRaw -> sizeDisplay
    for (const group of colorGroups) {
      for (const variant of group.variants) {
        if (!sizeSet.has(variant.sizeRaw)) {
          sizeSet.set(variant.sizeRaw, variant.sizeDisplay);
        }
      }
    }
    return Array.from(sizeSet.entries())
      .map(([raw, display]) => ({ raw, display }))
      .sort((a, b) => compareSizes(a.raw, b.raw));
  }, [colorGroups]);

  // Build lookup: colorCode -> sizeRaw -> priceCents
  const priceMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, number>>();
    for (const group of colorGroups) {
      const sizeMap = new Map<string, number>();
      for (const variant of group.variants) {
        sizeMap.set(variant.sizeRaw, variant.priceCents);
      }
      matrix.set(group.colorCode, sizeMap);
    }
    return matrix;
  }, [colorGroups]);

  if (colorGroups.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left font-medium text-gray-500">
              Kleur
            </th>
            {allSizes.map((size) => (
              <th
                key={size.raw}
                className="px-3 py-2 text-center font-medium text-gray-500"
              >
                {size.display}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {colorGroups.map((group) => {
            const sizeMap = priceMatrix.get(group.colorCode);
            return (
              <tr key={group.colorCode} className="hover:bg-gray-50">
                {/* Color column with swatch + name */}
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-4 w-4 shrink-0 rounded-full ${
                        needsBorder(group.hexCode) ? 'border border-gray-300' : ''
                      }`}
                      style={{ backgroundColor: group.hexCode }}
                      aria-hidden="true"
                    />
                    <span className="text-gray-900">{group.colorRaw || group.colorName}</span>
                  </div>
                </td>

                {/* Size cells */}
                {allSizes.map((size) => {
                  const price = sizeMap?.get(size.raw);
                  return (
                    <td
                      key={size.raw}
                      className="whitespace-nowrap px-3 py-2 text-center text-gray-700"
                    >
                      {price !== undefined ? formatPrice(price) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
