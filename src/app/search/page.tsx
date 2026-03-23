'use client';

import { Suspense, useEffect, useMemo, useState, useCallback, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { CategorySidebar } from '@/components/category/CategorySidebar';
import { VirtualGrid } from '@/components/search/VirtualGrid';
import { ViewSwitcher } from '@/components/search/ViewSwitcher';
import type { ViewMode } from '@/components/search/ViewSwitcher';
import { useSearch } from '@/hooks/useSearch';
import { useModelCards } from '@/hooks/useModelCards';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { buildAggregatedCounts, getDescendantCodes } from '@/lib/category-utils';
import { BrandFilter } from '@/components/search/BrandFilter';
import { ColorFilter, COLOR_PALETTE } from '@/components/search/ColorFilter';
import { FilterBottomSheet } from '@/components/search/FilterBottomSheet';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import type { BrandInfo } from '@/hooks/useModelCards';
import type { ColorInfo } from '@/components/search/ColorFilter';

// ---------------------------------------------------------------------------
// Skeleton grid shown while model cards data is loading
// ---------------------------------------------------------------------------

const SkeletonGrid = memo(function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-100 bg-white">
          <div className="aspect-square bg-gray-100" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="h-4 w-32 rounded bg-gray-100" />
            <div className="h-4 w-20 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Search Page Content (uses useSearchParams, must be inside Suspense)
// ---------------------------------------------------------------------------

function SearchPageContent() {
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('q') ?? '';
  const categoryParam = searchParams.get('cat') ?? null;

  const { query, setQuery, activate, results, isReady, isLoading: isSearching } = useSearch({
    initialQuery,
  });
  const { models, isLoading: isModelsLoading, getBySlug, getBrands } = useModelCards();
  const { tree, isLoading: isCategoryLoading, findCategory } = useCategoryTree();
  const { isUnlocked } = useShowcaseAuth();

  const [headerValue, setHeaderValue] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const brandsParam = searchParams.get('brands') ?? '';
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    () => new Set(brandsParam ? brandsParam.split(',').filter(Boolean) : [])
  );
  const colorsParam = searchParams.get('colors') ?? '';
  const [selectedColors, setSelectedColors] = useState<Set<string>>(
    () => new Set(colorsParam ? colorsParam.split(',').filter(Boolean) : [])
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('showcase-view-mode') as ViewMode) || 'grid';
  });

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('showcase-view-mode', mode);
  }, []);

  // Sync URL query to search hook on mount and when q changes
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    if (q && q !== query) {
      setQuery(q);
      setHeaderValue(q);
    }
    // Only react to searchParams changes, not query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Visibility filter: only core products when locked
  const visibleModels = useMemo(() => {
    if (isUnlocked) return models;
    return models.filter((m) => m.publicationStatus === 'core');
  }, [models, isUnlocked]);

  // Brand-filtered models (applied before category/search filtering)
  const brandFilteredModels = useMemo(() => {
    if (selectedBrands.size === 0) return visibleModels;
    return visibleModels.filter((m) => selectedBrands.has(m.brandSlug));
  }, [visibleModels, selectedBrands]);

  // Color-filtered models (applied after brand, before category/search)
  const colorFilteredModels = useMemo(() => {
    if (selectedColors.size === 0) return brandFilteredModels;
    return brandFilteredModels.filter((m) =>
      m.colorGroups.some((cg) => selectedColors.has(cg.colorCode))
    );
  }, [brandFilteredModels, selectedColors]);

  // ---------------------------------------------------------------------------
  // Leaf counts: how many models belong directly to each category code
  // ---------------------------------------------------------------------------

  const leafCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const model of colorFilteredModels) {
      if (model.categoryCode) {
        counts[model.categoryCode] = (counts[model.categoryCode] ?? 0) + 1;
      }
    }
    return counts;
  }, [colorFilteredModels]);

  // Aggregated counts (including descendants)
  const aggregatedCounts = useMemo(
    () => buildAggregatedCounts(tree, leafCounts),
    [tree, leafCounts],
  );

  // ---------------------------------------------------------------------------
  // Category filtering on search results
  // ---------------------------------------------------------------------------

  const validCodesSet = useMemo(() => {
    if (!selectedCategory) return null;
    const node = findCategory(selectedCategory);
    if (!node) return null;
    return new Set(getDescendantCodes(node));
  }, [selectedCategory, findCategory]);

  const filteredResults = useMemo(() => {
    let filtered = results;
    // Visibility filter: only core when locked
    if (!isUnlocked) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && model.publicationStatus === 'core';
      });
    }
    if (validCodesSet) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && validCodesSet.has(model.categoryCode);
      });
    }
    if (selectedBrands.size > 0) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && selectedBrands.has(model.brandSlug);
      });
    }
    if (selectedColors.size > 0) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && model.colorGroups.some((cg) => selectedColors.has(cg.colorCode));
      });
    }
    return filtered;
  }, [results, isUnlocked, validCodesSet, selectedBrands, selectedColors, getBySlug]);

  // Browse mode: no query but category selected → show all models in category
  const browseModels = useMemo(() => {
    if (!selectedCategory || !validCodesSet) return [];
    return colorFilteredModels.filter((m) => validCodesSet.has(m.categoryCode));
  }, [selectedCategory, validCodesSet, colorFilteredModels]);

  // Contextual color counts: based on brand + category selection (not color selection)
  const colorsForFilter = useMemo((): ColorInfo[] => {
    let base = visibleModels;
    if (selectedBrands.size > 0)
      base = base.filter((m) => selectedBrands.has(m.brandSlug));
    if (validCodesSet)
      base = base.filter((m) => validCodesSet.has(m.categoryCode));

    const countMap = new Map<string, number>();
    for (const m of base) {
      const seen = new Set<string>();
      for (const cg of m.colorGroups) {
        if (!seen.has(cg.colorCode)) {
          seen.add(cg.colorCode);
          countMap.set(cg.colorCode, (countMap.get(cg.colorCode) ?? 0) + 1);
        }
      }
    }

    return COLOR_PALETTE.map((c) => ({
      ...c,
      modelCount: countMap.get(c.code) ?? 0,
    }));
  }, [visibleModels, selectedBrands, validCodesSet]);

  // Contextual brand counts: based on category + color selection (not brand selection)
  const brandsForFilter = useMemo((): BrandInfo[] => {
    let base = validCodesSet
      ? visibleModels.filter((m) => validCodesSet.has(m.categoryCode))
      : visibleModels;
    if (selectedColors.size > 0)
      base = base.filter((m) => m.colorGroups.some((cg) => selectedColors.has(cg.colorCode)));

    const countMap = new Map<string, { name: string; slug: string; count: number }>();
    for (const m of base) {
      const entry = countMap.get(m.brandSlug);
      if (entry) {
        entry.count += 1;
      } else {
        countMap.set(m.brandSlug, { name: m.brandName, slug: m.brandSlug, count: 1 });
      }
    }

    return Array.from(countMap.values())
      .map((b) => ({ name: b.name, slug: b.slug, modelCount: b.count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }, [visibleModels, validCodesSet, selectedColors]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSearchChange = useCallback(
    (value: string) => {
      setHeaderValue(value);
      setQuery(value);

      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      window.history.replaceState(null, '', `/search/?${params.toString()}`);
    },
    [setQuery, searchParams],
  );

  const handleCategorySelect = useCallback(
    (code: string) => {
      const newCode = code === selectedCategory ? null : code;
      setSelectedCategory(newCode);

      const params = new URLSearchParams(searchParams.toString());
      if (newCode) {
        params.set('cat', newCode);
      } else {
        params.delete('cat');
      }
      window.history.replaceState(null, '', `/search/?${params.toString()}`);
    },
    [selectedCategory, searchParams],
  );

  const handleBrandToggle = useCallback(
    (slug: string) => {
      const next = new Set(selectedBrands);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);

      setSelectedBrands(next);

      const params = new URLSearchParams(searchParams.toString());
      if (next.size > 0) {
        params.set('brands', [...next].sort().join(','));
      } else {
        params.delete('brands');
      }
      window.history.replaceState(null, '', `/search/?${params.toString()}`);
    },
    [selectedBrands, searchParams],
  );

  const handleColorToggle = useCallback(
    (code: string) => {
      const next = new Set(selectedColors);
      if (next.has(code)) next.delete(code);
      else next.add(code);

      setSelectedColors(next);

      const params = new URLSearchParams(searchParams.toString());
      if (next.size > 0) {
        params.set('colors', [...next].sort().join(','));
      } else {
        params.delete('colors');
      }
      window.history.replaceState(null, '', `/search/?${params.toString()}`);
    },
    [selectedColors, searchParams],
  );

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasQuery = !!query.trim();
  const selectedCategoryNode = selectedCategory ? findCategory(selectedCategory) : null;
  const activeFilterCount = (selectedCategory ? 1 : 0) + selectedColors.size + selectedBrands.size;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Header searchValue={headerValue} onSearchChange={handleSearchChange} onSearchFocus={activate} />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Sidebar — categories + colors, hidden on mobile */}
          <aside className="hidden w-64 shrink-0 lg:block sticky top-8 self-start max-h-[calc(100vh-4rem)] overflow-y-auto">
            {isCategoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : (
              <CategorySidebar
                tree={tree}
                currentCode={selectedCategory ?? undefined}
                counts={aggregatedCounts}
                onSelect={handleCategorySelect}
              />
            )}

            <hr className="my-4 border-gray-200" />

            <ColorFilter
              colors={colorsForFilter}
              selectedCodes={selectedColors}
              onToggle={handleColorToggle}
            />

            <hr className="my-4 border-gray-200" />

            <BrandFilter
              brands={brandsForFilter}
              selectedSlugs={selectedBrands}
              onToggle={handleBrandToggle}
            />
          </aside>

          {/* Main content */}
          <div className="flex-1">
            {/* Active filter chips */}
            {(selectedCategoryNode || selectedColors.size > 0 || selectedBrands.size > 0) && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {selectedCategoryNode && (
                  <>
                    <span className="text-sm text-gray-500">Categorie:</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
                      {selectedCategoryNode.nameNl}
                      <button
                        onClick={() => handleCategorySelect(selectedCategory!)}
                        className="ml-1 text-gray-400 hover:text-gray-600"
                        aria-label="Categorie verwijderen"
                      >
                        &#x2715;
                      </button>
                    </span>
                  </>
                )}
                {[...selectedColors].map((code) => {
                  const color = COLOR_PALETTE.find((c) => c.code === code);
                  if (!color) return null;
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={color.code === 'MUL' ? { background: color.hexCode } : { backgroundColor: color.hexCode }}
                      />
                      {color.name}
                      <button
                        onClick={() => handleColorToggle(code)}
                        className="ml-1 text-gray-400 hover:text-gray-600"
                        aria-label={`${color.name} verwijderen`}
                      >
                        &#x2715;
                      </button>
                    </span>
                  );
                })}
                {[...selectedBrands].map((slug) => {
                  const brand = getBrands().find((b) => b.slug === slug);
                  if (!brand) return null;
                  return (
                    <span
                      key={slug}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
                    >
                      {brand.name}
                      <button
                        onClick={() => handleBrandToggle(slug)}
                        className="ml-1 text-gray-400 hover:text-gray-600"
                        aria-label={`${brand.name} verwijderen`}
                      >
                        &#x2715;
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search results mode */}
            {hasQuery ? (
              !isReady || isSearching ? (
                <div className="py-24 text-center">
                  <p className="text-gray-400">Zoeken...</p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="py-24 text-center">
                  <p className="text-lg text-gray-500">
                    Geen resultaten gevonden voor &ldquo;{query}&rdquo;
                    {selectedCategoryNode && (
                      <> in {selectedCategoryNode.nameNl}</>
                    )}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    Probeer een andere zoekterm
                    {selectedCategoryNode && ' of verwijder het categoriefilter'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {filteredResults.length}{' '}
                      {filteredResults.length === 1 ? 'resultaat' : 'resultaten'} voor
                      &ldquo;{query}&rdquo;
                      {selectedCategoryNode && (
                        <> in {selectedCategoryNode.nameNl}</>
                      )}
                    </p>
                    <ViewSwitcher mode={viewMode} onChange={handleViewChange} />
                  </div>
                  <VirtualGrid
                    items={filteredResults.flatMap((result) => {
                      const model = getBySlug(result.slug);
                      return model ? [model] : [];
                    })}
                    preferredColorCodes={selectedColors.size > 0 ? selectedColors : undefined}
                    viewMode={viewMode}
                  />
                </>
              )
            ) : selectedCategory ? (
              /* Browse mode: no query, category selected */
              isCategoryLoading ? (
                <div className="py-24 text-center">
                  <p className="text-gray-400">Laden...</p>
                </div>
              ) : browseModels.length === 0 ? (
                <div className="py-24 text-center">
                  <p className="text-lg text-gray-500">
                    Geen producten in {selectedCategoryNode?.nameNl ?? 'deze categorie'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {browseModels.length}{' '}
                      {browseModels.length === 1 ? 'product' : 'producten'} in{' '}
                      {selectedCategoryNode?.nameNl}
                    </p>
                    <ViewSwitcher mode={viewMode} onChange={handleViewChange} />
                  </div>
                  <VirtualGrid
                    items={browseModels}
                    preferredColorCodes={selectedColors.size > 0 ? selectedColors : undefined}
                    viewMode={viewMode}
                  />
                </>
              )
            ) : isModelsLoading && colorFilteredModels.length === 0 ? (
              /* Loading state: show skeleton grid while first chunk loads */
              <>
                <p className="mb-6 text-sm text-gray-400 animate-pulse">Producten laden...</p>
                <SkeletonGrid />
              </>
            ) : (
              /* Default: show all products */
              <>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {colorFilteredModels.length}{' '}
                    {colorFilteredModels.length === 1 ? 'product' : 'producten'}
                  </p>
                  <ViewSwitcher mode={viewMode} onChange={handleViewChange} />
                </div>
                <VirtualGrid
                  items={colorFilteredModels}
                  preferredColorCodes={selectedColors.size > 0 ? selectedColors : undefined}
                  viewMode={viewMode}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter button — floating, hidden on lg+ */}
      <button
        type="button"
        onClick={() => setFilterSheetOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 lg:hidden"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
        Filters
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Mobile filter bottom sheet */}
      <FilterBottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        categoryTree={tree}
        currentCategory={selectedCategory}
        categoryCounts={aggregatedCounts}
        onCategorySelect={handleCategorySelect}
        isCategoryLoading={isCategoryLoading}
        brands={brandsForFilter}
        selectedBrands={selectedBrands}
        onBrandToggle={handleBrandToggle}
        colors={colorsForFilter}
        selectedColors={selectedColors}
        onColorToggle={handleColorToggle}
        activeFilterCount={activeFilterCount}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Search Page (wrapped in Suspense for static export compatibility)
// ---------------------------------------------------------------------------

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center">
          <p className="text-gray-400">Laden...</p>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
