'use client';

import { useMemo } from 'react';
import type { BrandInfo } from '@/hooks/useModelCards';

interface BrandFilterProps {
  brands: BrandInfo[];
  selectedSlugs: Set<string>;
  onToggle: (slug: string) => void;
}

export function BrandFilter({ brands, selectedSlugs, onToggle }: BrandFilterProps) {
  const sortedBrands = useMemo(() => {
    // Selected brands first, then alphabetical
    return [...brands].sort((a, b) => {
      const aSelected = selectedSlugs.has(a.slug) ? 0 : 1;
      const bSelected = selectedSlugs.has(b.slug) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return a.name.localeCompare(b.name, 'nl');
    });
  }, [brands, selectedSlugs]);

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Merken
      </span>
      {sortedBrands.map((brand) => {
        const isSelected = selectedSlugs.has(brand.slug);
        const isDisabled = brand.modelCount === 0 && !isSelected;

        return (
          <button
            key={brand.slug}
            type="button"
            onClick={() => onToggle(brand.slug)}
            disabled={isDisabled}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-gray-800 text-white'
                : isDisabled
                  ? 'bg-gray-50 text-gray-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {brand.name}
            <span className={`ml-1 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
              {brand.modelCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
