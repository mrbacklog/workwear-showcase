'use client';

import { useEffect } from 'react';
import { ColorFilter } from '@/components/search/ColorFilter';
import { BrandFilter } from '@/components/search/BrandFilter';
import { SpecialColorFilter } from '@/components/search/SpecialColorFilter';
import { SizeFilter } from '@/components/search/SizeFilter';
import { GenderFilter } from '@/components/search/GenderFilter';
import type { ColorInfo } from '@/components/search/ColorFilter';
import type { BrandInfo } from '@/hooks/useModelCards';
import type { SizeGroupMap } from '@/lib/size-filter-utils';
import type { GenderInfo } from '@/components/search/GenderFilter';

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Brands
  brands: BrandInfo[];
  selectedBrands: Set<string>;
  onBrandToggle: (slug: string) => void;
  // Colors
  colors: ColorInfo[];
  selectedColors: Set<string>;
  onColorToggle: (code: string) => void;
  // Special colors
  hiVisActive: boolean;
  fluorescentActive: boolean;
  hiVisCount: number;
  fluorescentCount: number;
  onToggleHiVis: () => void;
  onToggleFluorescent: () => void;
  // Genders
  genders: GenderInfo[];
  selectedGenders: Set<string>;
  onGenderToggle: (code: string) => void;
  // Sizes
  availableSizes: SizeGroupMap;
  selectedSizes: Set<string>;
  onSizeChange: (sizes: Set<string>) => void;
  // Active count for display
  activeFilterCount: number;
}

export function FilterBottomSheet({
  isOpen,
  onClose,
  brands,
  selectedBrands,
  onBrandToggle,
  colors,
  selectedColors,
  onColorToggle,
  hiVisActive,
  fluorescentActive,
  hiVisCount,
  fluorescentCount,
  onToggleHiVis,
  onToggleFluorescent,
  genders,
  selectedGenders,
  onGenderToggle,
  availableSizes,
  selectedSizes,
  onSizeChange,
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

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

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
          {/* Colors */}
          <ColorFilter
            colors={colors}
            selectedCodes={selectedColors}
            onToggle={onColorToggle}
          />

          {/* Special colors */}
          <SpecialColorFilter
            hiVisCount={hiVisCount}
            fluorescentCount={fluorescentCount}
            hiVisActive={hiVisActive}
            fluorescentActive={fluorescentActive}
            onToggleHiVis={onToggleHiVis}
            onToggleFluorescent={onToggleFluorescent}
          />

          <hr className="border-gray-200" />

          {/* Brands */}
          <BrandFilter
            brands={brands}
            selectedSlugs={selectedBrands}
            onToggle={onBrandToggle}
          />

          {/* Geslacht */}
          <GenderFilter
            genders={genders}
            selected={selectedGenders}
            onToggle={onGenderToggle}
          />

          <hr className="border-gray-200" />

          {/* Maten */}
          <SizeFilter
            available={availableSizes}
            selected={selectedSizes}
            onChange={onSizeChange}
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
