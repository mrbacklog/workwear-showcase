'use client';

import { useState, useMemo } from 'react';
import type { BrandInfo } from '@/hooks/useModelCards';

interface BrandFilterProps {
  brands: BrandInfo[];
  selectedSlugs: Set<string>;
  onToggle: (slug: string) => void;
}

const COLLAPSED_LIMIT = 15;
const SEARCH_THRESHOLD = 10;

export function BrandFilter({ brands, selectedSlugs, onToggle }: BrandFilterProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const isSearching = search.trim().length > 0;

  const sortedBrands = useMemo(() => {
    const needle = search.trim().toLowerCase();

    // Filter by search query when active
    const filtered = needle
      ? brands.filter((b) => b.name.toLowerCase().includes(needle))
      : brands;

    // Split into selected and unselected, each group already alphabetical (input is sorted)
    const selected: BrandInfo[] = [];
    const unselected: BrandInfo[] = [];

    for (const brand of filtered) {
      if (selectedSlugs.has(brand.slug)) {
        selected.push(brand);
      } else {
        unselected.push(brand);
      }
    }

    return [...selected, ...unselected];
  }, [brands, selectedSlugs, search]);

  const showSearch = brands.length > SEARCH_THRESHOLD;
  const showToggle = !isSearching && sortedBrands.length > COLLAPSED_LIMIT;
  const visibleBrands =
    isSearching || expanded
      ? sortedBrands
      : sortedBrands.slice(0, COLLAPSED_LIMIT);

  return (
    <nav aria-label="Merken filter">
      <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Merken
      </h2>

      {showSearch && (
        <div className="mb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              // Reset expand state when user starts searching
              setExpanded(false);
            }}
            placeholder="Zoek merk..."
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
      )}

      <ul className="space-y-0.5">
        {visibleBrands.map((brand) => {
          const isSelected = selectedSlugs.has(brand.slug);
          const isDisabled = brand.modelCount === 0 && !isSelected;

          return (
            <li key={brand.slug}>
              <button
                type="button"
                onClick={() => onToggle(brand.slug)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? 'bg-gray-100 font-semibold text-gray-900'
                    : isDisabled
                      ? 'text-gray-300'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {/* Checkbox indicator */}
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isSelected
                      ? 'border-gray-700 bg-gray-700'
                      : 'border-gray-300'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>

                {brand.name}

                <span className="ml-auto font-normal text-gray-400">
                  ({brand.modelCount})
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 px-2 text-xs text-gray-500 hover:text-gray-700"
        >
          {expanded
            ? 'Toon minder'
            : `Toon alle ${sortedBrands.length} merken`}
        </button>
      )}
    </nav>
  );
}
