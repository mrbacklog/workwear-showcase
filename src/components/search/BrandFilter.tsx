'use client';

import { useState, useMemo } from 'react';
import type { BrandInfo } from '@/hooks/useModelCards';

interface BrandFilterProps {
  brands: BrandInfo[];
  selectedSlugs: Set<string>;
  onToggle: (slug: string) => void;
}

const COLLAPSED_LIMIT = 12;

export function BrandFilter({ brands, selectedSlugs, onToggle }: BrandFilterProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const isSearching = search.trim().length > 0;

  const sortedBrands = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? brands.filter((b) => b.name.toLowerCase().includes(needle))
      : brands;

    // Show selected brands first
    return [...filtered].sort((a, b) => {
      const aSelected = selectedSlugs.has(a.slug) ? 0 : 1;
      const bSelected = selectedSlugs.has(b.slug) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return a.name.localeCompare(b.name, 'nl');
    });
  }, [brands, search, selectedSlugs]);

  const showToggle = !isSearching && sortedBrands.length > COLLAPSED_LIMIT;
  const visibleBrands =
    isSearching || expanded
      ? sortedBrands
      : sortedBrands.slice(0, COLLAPSED_LIMIT);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Merken
        </h2>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setExpanded(false);
          }}
          placeholder="Zoek..."
          className="w-28 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visibleBrands.map((brand) => {
          const isSelected = selectedSlugs.has(brand.slug);
          const isDisabled = brand.modelCount === 0 && !isSelected;

          return (
            <button
              key={brand.slug}
              type="button"
              onClick={() => onToggle(brand.slug)}
              disabled={isDisabled}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                isSelected
                  ? 'bg-gray-800 text-white'
                  : isDisabled
                    ? 'bg-gray-50 text-gray-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {brand.name}
              <span className={`${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                {brand.modelCount}
              </span>
            </button>
          );
        })}

        {showToggle && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          >
            {expanded ? 'Minder' : `+${sortedBrands.length - COLLAPSED_LIMIT} meer`}
          </button>
        )}
      </div>
    </div>
  );
}
