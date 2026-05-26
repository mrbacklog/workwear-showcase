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
    // Altijd alfabetisch — een geselecteerd merk blijft op zijn plek staan i.p.v.
    // naar boven te springen (backlog 0e730c27).
    return [...brands].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }, [brands]);

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Merken
      </h2>
      <div className="flex flex-wrap gap-2">
        {sortedBrands.map((brand) => {
          const isSelected = selectedSlugs.has(brand.slug);
          const isDisabled = brand.modelCount === 0 && !isSelected;

          return (
            <button
              key={brand.slug}
              type="button"
              onClick={() => onToggle(brand.slug)}
              disabled={isDisabled}
              className={`rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${
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
    </div>
  );
}
