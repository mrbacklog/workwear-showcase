'use client';

import { Fragment, Suspense, useEffect, useMemo, useState, useCallback, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { VirtualGrid } from '@/components/search/VirtualGrid';
import { ViewSwitcher } from '@/components/search/ViewSwitcher';
import type { ViewMode } from '@/components/search/ViewSwitcher';
import { useSearch } from '@/hooks/useSearch';
import { useModelSummaries } from '@/hooks/useModelSummaries';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { buildAggregatedCounts, getDescendantCodes } from '@/lib/category-utils';
import { BrandFilter } from '@/components/search/BrandFilter';
import { ColorFilter, COLOR_PALETTE } from '@/components/search/ColorFilter';
import { SpecialColorFilter } from '@/components/search/SpecialColorFilter';
import { FilterBottomSheet } from '@/components/search/FilterBottomSheet';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import {
  parseColorParam,
  serializeColorParam,
  flattenColorGroups,
  modelMatchesColorFilter,
  getColorCodes,
  type ColorFilterGroup,
} from '@/lib/color-filter-utils';
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
  const { summaries: models, isLoading: isModelsLoading, getBySlug, getBrands } = useModelSummaries();
  const { tree, isLoading: isCategoryLoading, findCategory } = useCategoryTree();
  const { isUnlocked } = useShowcaseAuth();

  const [headerValue, setHeaderValue] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const brandsParam = searchParams.get('brands') ?? '';
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    () => new Set(brandsParam ? brandsParam.split(',').filter(Boolean) : [])
  );

  // Color filter groups: array of AND-groups, OR between groups
  const colorsParam = searchParams.get('colors') ?? '';
  const [colorFilterGroups, setColorFilterGroups] = useState<ColorFilterGroup[]>(
    () => parseColorParam(colorsParam)
  );

  // Derived flat set for swatch UI and backward compat
  const selectedColors = useMemo(() => flattenColorGroups(colorFilterGroups), [colorFilterGroups]);

  // Hi-vis / Fluorescent toggles
  const [hiVisActive, setHiVisActive] = useState(() => searchParams.get('hivis') === '1');
  const [fluorescentActive, setFluorescentActive] = useState(() => searchParams.get('fluorescent') === '1');

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('showcase-view-mode') as ViewMode) || 'grid';
  });

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void })
          .requestIdleCallback(() => localStorage.setItem('showcase-view-mode', mode), { timeout: 1000 });
      } else {
        setTimeout(() => localStorage.setItem('showcase-view-mode', mode), 0);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // URL sync helper
  // ---------------------------------------------------------------------------

  const syncUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      window.history.replaceState(null, '', `/search/?${params.toString()}`);
    },
    [searchParams],
  );

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

  // ---------------------------------------------------------------------------
  // Filter pipeline
  // ---------------------------------------------------------------------------

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

  // Color-filtered models (matches primary + secondary + tertiary, AND/OR groups)
  const colorFilteredModels = useMemo(() => {
    if (colorFilterGroups.length === 0) return brandFilteredModels;
    return brandFilteredModels.filter((m) => modelMatchesColorFilter(m, colorFilterGroups));
  }, [brandFilteredModels, colorFilterGroups]);

  // Special color filtered models (hi-vis / fluorescent, AND on top of color filter)
  const specialFilteredModels = useMemo(() => {
    let result = colorFilteredModels;
    if (hiVisActive) {
      result = result.filter((m) => m.colorGroups.some((cg) => cg.isHighVisibility));
    }
    if (fluorescentActive) {
      result = result.filter((m) => m.colorGroups.some((cg) => cg.isFluorescent));
    }
    return result;
  }, [colorFilteredModels, hiVisActive, fluorescentActive]);

  // ---------------------------------------------------------------------------
  // Leaf counts: how many models belong directly to each category code
  // ---------------------------------------------------------------------------

  const leafCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const model of specialFilteredModels) {
      if (model.categoryCode) {
        counts[model.categoryCode] = (counts[model.categoryCode] ?? 0) + 1;
      }
    }
    return counts;
  }, [specialFilteredModels]);

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
    if (colorFilterGroups.length > 0) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && modelMatchesColorFilter(model, colorFilterGroups);
      });
    }
    if (hiVisActive) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && model.colorGroups.some((cg) => cg.isHighVisibility);
      });
    }
    if (fluorescentActive) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && model.colorGroups.some((cg) => cg.isFluorescent);
      });
    }
    return filtered;
  }, [results, isUnlocked, validCodesSet, selectedBrands, colorFilterGroups, hiVisActive, fluorescentActive, getBySlug]);

  // Browse mode: no query but category selected → show all models in category
  const browseModels = useMemo(() => {
    if (!selectedCategory || !validCodesSet) return [];
    return specialFilteredModels.filter((m) => validCodesSet.has(m.categoryCode));
  }, [selectedCategory, validCodesSet, specialFilteredModels]);

  // Contextual color counts: based on brand + category selection (not color selection)
  // Now counts across primary + secondary + tertiary
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
        for (const code of getColorCodes(cg)) {
          if (!seen.has(code)) {
            seen.add(code);
            countMap.set(code, (countMap.get(code) ?? 0) + 1);
          }
        }
      }
    }

    return COLOR_PALETTE.map((c) => ({
      ...c,
      modelCount: countMap.get(c.code) ?? 0,
    }));
  }, [visibleModels, selectedBrands, validCodesSet]);

  // Contextual special color counts
  const specialCounts = useMemo(() => {
    let base = visibleModels;
    if (selectedBrands.size > 0)
      base = base.filter((m) => selectedBrands.has(m.brandSlug));
    if (validCodesSet)
      base = base.filter((m) => validCodesSet.has(m.categoryCode));

    let hiVisCount = 0;
    let fluorescentCount = 0;
    for (const m of base) {
      if (m.colorGroups.some((cg) => cg.isHighVisibility)) hiVisCount++;
      if (m.colorGroups.some((cg) => cg.isFluorescent)) fluorescentCount++;
    }
    return { hiVisCount, fluorescentCount };
  }, [visibleModels, selectedBrands, validCodesSet]);

  // Contextual brand counts: based on category + color selection (not brand selection)
  const brandsForFilter = useMemo((): BrandInfo[] => {
    let base = validCodesSet
      ? visibleModels.filter((m) => validCodesSet.has(m.categoryCode))
      : visibleModels;
    if (colorFilterGroups.length > 0)
      base = base.filter((m) => modelMatchesColorFilter(m, colorFilterGroups));

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
  }, [visibleModels, validCodesSet, colorFilterGroups]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSearchChange = useCallback(
    (value: string) => {
      setHeaderValue(value);
      setQuery(value);
      syncUrl({ q: value.trim() || null });
    },
    [setQuery, syncUrl],
  );

  const handleCategorySelect = useCallback(
    (code: string) => {
      const newCode = code === selectedCategory ? null : code;
      setSelectedCategory(newCode);
      syncUrl({ cat: newCode });
    },
    [selectedCategory, syncUrl],
  );

  const handleBrandToggle = useCallback(
    (slug: string) => {
      const next = new Set(selectedBrands);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      setSelectedBrands(next);
      syncUrl({ brands: next.size > 0 ? [...next].sort().join(',') : null });
    },
    [selectedBrands, syncUrl],
  );

  // Toggle a color code: add as new OR group or remove from existing group
  const handleColorToggle = useCallback(
    (code: string) => {
      let next: ColorFilterGroup[];
      // Check if color exists in any group
      const existingGroupIdx = colorFilterGroups.findIndex((g) => g.includes(code));
      if (existingGroupIdx >= 0) {
        // Remove color from its group
        next = colorFilterGroups
          .map((g, i) => (i === existingGroupIdx ? g.filter((c) => c !== code) : g))
          .filter((g) => g.length > 0);
      } else {
        // Add as new single-color OR group
        next = [...colorFilterGroups, [code]];
      }
      setColorFilterGroups(next);
      const serialized = serializeColorParam(next);
      syncUrl({ colors: serialized || null });
    },
    [colorFilterGroups, syncUrl],
  );

  // Link two adjacent groups into one AND group
  const handleLinkGroups = useCallback(
    (leftIdx: number, rightIdx: number) => {
      const next = [...colorFilterGroups];
      const merged = [...next[leftIdx], ...next[rightIdx]];
      // Replace left with merged, remove right
      next[leftIdx] = merged;
      next.splice(rightIdx, 1);
      setColorFilterGroups(next);
      syncUrl({ colors: serializeColorParam(next) || null });
    },
    [colorFilterGroups, syncUrl],
  );

  // Unlink a group: split each color into its own OR group
  const handleUnlinkGroup = useCallback(
    (groupIdx: number) => {
      const next = [...colorFilterGroups];
      const group = next[groupIdx];
      // Replace the group with individual single-color groups
      next.splice(groupIdx, 1, ...group.map((c) => [c]));
      setColorFilterGroups(next);
      syncUrl({ colors: serializeColorParam(next) || null });
    },
    [colorFilterGroups, syncUrl],
  );

  // Remove a single color from a specific group
  const handleRemoveColor = useCallback(
    (groupIdx: number, code: string) => {
      const next = colorFilterGroups
        .map((g, i) => (i === groupIdx ? g.filter((c) => c !== code) : g))
        .filter((g) => g.length > 0);
      setColorFilterGroups(next);
      syncUrl({ colors: serializeColorParam(next) || null });
    },
    [colorFilterGroups, syncUrl],
  );

  const handleToggleHiVis = useCallback(() => {
    const next = !hiVisActive;
    setHiVisActive(next);
    syncUrl({ hivis: next ? '1' : null });
  }, [hiVisActive, syncUrl]);

  const handleToggleFluorescent = useCallback(() => {
    const next = !fluorescentActive;
    setFluorescentActive(next);
    syncUrl({ fluorescent: next ? '1' : null });
  }, [fluorescentActive, syncUrl]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasQuery = !!query.trim();
  const selectedCategoryNode = selectedCategory ? findCategory(selectedCategory) : null;
  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    selectedColors.size +
    selectedBrands.size +
    (hiVisActive ? 1 : 0) +
    (fluorescentActive ? 1 : 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Header
        searchValue={headerValue}
        onSearchChange={handleSearchChange}
        onSearchFocus={activate}
        categoryTree={tree}
        categoryCounts={aggregatedCounts}
        activeCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
      />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Sidebar — colors + special + brands, hidden on mobile */}
          <aside className="hidden w-56 shrink-0 lg:block sticky top-36 self-start">
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">
              <ColorFilter
                colors={colorsForFilter}
                selectedCodes={selectedColors}
                onToggle={handleColorToggle}
              />

              <hr className="my-4 border-gray-200" />

              <SpecialColorFilter
                hiVisCount={specialCounts.hiVisCount}
                fluorescentCount={specialCounts.fluorescentCount}
                hiVisActive={hiVisActive}
                fluorescentActive={fluorescentActive}
                onToggleHiVis={handleToggleHiVis}
                onToggleFluorescent={handleToggleFluorescent}
              />

              <hr className="my-4 border-gray-200" />

              <BrandFilter
                brands={brandsForFilter}
                selectedSlugs={selectedBrands}
                onToggle={handleBrandToggle}
              />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            {/* Active filter chips */}
            {(selectedCategoryNode || colorFilterGroups.length > 0 || selectedBrands.size > 0 || hiVisActive || fluorescentActive) && (
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

                {/* Color filter chips with AND/OR grouping */}
                {colorFilterGroups.map((group, groupIdx) => (
                  <Fragment key={`cg-${groupIdx}`}>
                    {group.length > 1 ? (
                      // AND group: wrapped in a shared background
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-1.5 py-0.5">
                        {group.map((code, codeIdx) => {
                          const color = COLOR_PALETTE.find((c) => c.code === code);
                          if (!color) return null;
                          return (
                            <Fragment key={code}>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-sm font-medium text-gray-800">
                                <span
                                  className="inline-block h-3 w-3 rounded-full"
                                  style={color.code === 'MUL' ? { background: color.hexCode } : { backgroundColor: color.hexCode }}
                                />
                                {color.name}
                                <button
                                  onClick={() => handleRemoveColor(groupIdx, code)}
                                  className="ml-0.5 text-gray-400 hover:text-gray-600"
                                  aria-label={`${color.name} verwijderen`}
                                >
                                  &#x2715;
                                </button>
                              </span>
                              {codeIdx < group.length - 1 && (
                                <span className="text-xs font-bold text-gray-400">+</span>
                              )}
                            </Fragment>
                          );
                        })}
                        {/* Unlink button */}
                        <button
                          onClick={() => handleUnlinkGroup(groupIdx)}
                          className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-300 hover:text-gray-600 transition-colors"
                          title="Ontkoppelen"
                          aria-label="Kleuren ontkoppelen"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4 4 0 0 1 5.32.638l.04.044a4 4 0 0 1-.638 5.32M10.819 15.32a4 4 0 0 1-5.32-.638l-.04-.044a4 4 0 0 1 .638-5.32M8.5 15.5l7-7" />
                          </svg>
                        </button>
                      </span>
                    ) : (
                      // Single color chip
                      (() => {
                        const color = COLOR_PALETTE.find((c) => c.code === group[0]);
                        if (!color) return null;
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={color.code === 'MUL' ? { background: color.hexCode } : { backgroundColor: color.hexCode }}
                            />
                            {color.name}
                            <button
                              onClick={() => handleRemoveColor(groupIdx, group[0])}
                              className="ml-1 text-gray-400 hover:text-gray-600"
                              aria-label={`${color.name} verwijderen`}
                            >
                              &#x2715;
                            </button>
                          </span>
                        );
                      })()
                    )}

                    {/* Link button between adjacent groups */}
                    {groupIdx < colorFilterGroups.length - 1 && (
                      <button
                        onClick={() => handleLinkGroups(groupIdx, groupIdx + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors"
                        title="Kleuren koppelen (EN)"
                        aria-label="Kleuren koppelen"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </button>
                    )}
                  </Fragment>
                ))}

                {/* Hi-vis / Fluorescent chips */}
                {hiVisActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                    Hi-Vis
                    <button
                      onClick={handleToggleHiVis}
                      className="ml-1 text-yellow-500 hover:text-yellow-700"
                      aria-label="Hi-Vis verwijderen"
                    >
                      &#x2715;
                    </button>
                  </span>
                )}
                {fluorescentActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1 text-sm font-medium text-lime-800">
                    Fluorescerend
                    <button
                      onClick={handleToggleFluorescent}
                      className="ml-1 text-lime-500 hover:text-lime-700"
                      aria-label="Fluorescerend verwijderen"
                    >
                      &#x2715;
                    </button>
                  </span>
                )}

                {/* Brand chips */}
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
                    colorFilterGroups={colorFilterGroups.length > 0 ? colorFilterGroups : undefined}
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
                    colorFilterGroups={colorFilterGroups.length > 0 ? colorFilterGroups : undefined}
                    viewMode={viewMode}
                  />
                </>
              )
            ) : isModelsLoading && specialFilteredModels.length === 0 ? (
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
                    {specialFilteredModels.length}{' '}
                    {specialFilteredModels.length === 1 ? 'product' : 'producten'}
                  </p>
                  <ViewSwitcher mode={viewMode} onChange={handleViewChange} />
                </div>
                <VirtualGrid
                  items={specialFilteredModels}
                  preferredColorCodes={selectedColors.size > 0 ? selectedColors : undefined}
                  colorFilterGroups={colorFilterGroups.length > 0 ? colorFilterGroups : undefined}
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
        brands={brandsForFilter}
        selectedBrands={selectedBrands}
        onBrandToggle={handleBrandToggle}
        colors={colorsForFilter}
        selectedColors={selectedColors}
        onColorToggle={handleColorToggle}
        hiVisActive={hiVisActive}
        fluorescentActive={fluorescentActive}
        hiVisCount={specialCounts.hiVisCount}
        fluorescentCount={specialCounts.fluorescentCount}
        onToggleHiVis={handleToggleHiVis}
        onToggleFluorescent={handleToggleFluorescent}
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
