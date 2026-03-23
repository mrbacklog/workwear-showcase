'use client';

import { useEffect, useCallback } from 'react';
import { CategorySidebar } from '@/components/category/CategorySidebar';
import { ColorFilter } from '@/components/search/ColorFilter';
import type { CategoryNode } from '@/types/product';
import type { ColorInfo } from '@/components/search/ColorFilter';
import type { BrandInfo } from '@/hooks/useModelCards';

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Category
  categoryTree: CategoryNode[];
  currentCategory: string | null;
  categoryCounts: Record<string, number>;
  onCategorySelect: (code: string) => void;
  isCategoryLoading: boolean;
  // Brands
  brands: BrandInfo[];
  selectedBrands: Set<string>;
  onBrandToggle: (slug: string) => void;
  // Colors
  colors: ColorInfo[];
  selectedColors: Set<string>;
  onColorToggle: (code: string) => void;
  // Active count for display
  activeFilterCount: number;
}

export function FilterBottomSheet({
  isOpen,
  onClose,
  categoryTree,
  currentCategory,
  categoryCounts,
  onCategorySelect,
  isCategoryLoading,
  brands,
  selectedBrands,
  onBrandToggle,
  colors,
  selectedColors,
  onColorToggle,
  activeFilterCount,
}: FilterBottomSheetProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleCategorySelect = useCallback(
    (code: string) => {
      onCategorySelect(code);
    },
    [onCategorySelect],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Sluiten"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Categories */}
          {isCategoryLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <CategorySidebar
              tree={categoryTree}
              currentCode={currentCategory ?? undefined}
              counts={categoryCounts}
              onSelect={handleCategorySelect}
            />
          )}

          <hr className="border-gray-200" />

          {/* Brands */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Merken</h2>
            <div className="flex flex-wrap gap-2">
              {brands.map((brand) => (
                <button
                  key={brand.slug}
                  type="button"
                  onClick={() => onBrandToggle(brand.slug)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    selectedBrands.has(brand.slug)
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {brand.name}
                  <span className="ml-1 text-xs opacity-60">{brand.modelCount}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Colors */}
          <ColorFilter
            colors={colors}
            selectedCodes={selectedColors}
            onToggle={onColorToggle}
          />
        </div>

        {/* Footer with result button */}
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-black py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:bg-gray-900"
          >
            Toon resultaten
          </button>
        </div>
      </div>
    </>
  );
}
