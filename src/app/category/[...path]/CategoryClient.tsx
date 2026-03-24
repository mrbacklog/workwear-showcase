'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { ModelCard } from '@/components/search/ModelCard';
import { ViewSwitcher } from '@/components/search/ViewSwitcher';
import type { ViewMode } from '@/components/search/ViewSwitcher';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { useModelCards } from '@/hooks/useModelCards';
import { buildAggregatedCounts, getDescendantCodes } from '@/lib/category-utils';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import type { CategoryNode, ShowcaseModel } from '@/types/product';

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

function Breadcrumbs({ path }: { path: CategoryNode[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-1 text-sm text-gray-500">
        <li>
          <Link href="/" className="hover:text-gray-700">
            Home
          </Link>
        </li>
        {path.map((node, idx) => (
          <li key={node.code} className="flex items-center gap-1">
            <svg
              className="h-4 w-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            {idx === path.length - 1 ? (
              <span className="font-medium text-gray-900">{node.nameNl}</span>
            ) : (
              <Link href={`/category/${node.code}/`} className="hover:text-gray-700">
                {node.nameNl}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Category Page Client Component
// ---------------------------------------------------------------------------

export default function CategoryClient() {
  const params = useParams<{ path: string[] }>();
  const pathSegments = params.path ?? [];
  const categoryCode = pathSegments[pathSegments.length - 1] ?? '';

  const { tree, isLoading: isCategoryLoading, findCategory, getCategoryPath } = useCategoryTree();
  const { getByCategory, models, isLoading: isModelsLoading } = useModelCards();
  const { isUnlocked } = useShowcaseAuth();
  const [headerSearch, setHeaderSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('showcase-view-mode') as ViewMode) || 'grid';
  });

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('showcase-view-mode', mode);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setHeaderSearch(value);
    if (value.trim()) {
      window.location.href = `/search/?q=${encodeURIComponent(value.trim())}`;
    }
  }, []);

  const handleCategorySelect = useCallback((code: string) => {
    window.location.href = `/category/${code}/`;
  }, []);

  const category = findCategory(categoryCode);
  const breadcrumbPath = getCategoryPath(categoryCode);

  // Collect models for this category and all descendant categories
  const categoryModels = useMemo(() => {
    if (isModelsLoading || !categoryCode) return [];

    const codes = new Set<string>();
    if (category) {
      for (const c of getDescendantCodes(category)) {
        codes.add(c);
      }
    } else {
      codes.add(categoryCode);
    }

    const result: ShowcaseModel[] = [];
    for (const code of codes) {
      const matching = getByCategory(code);
      result.push(...matching);
    }

    const seen = new Set<string>();
    return result.filter((m) => {
      if (seen.has(m.slug)) return false;
      seen.add(m.slug);
      return isUnlocked || m.publicationStatus === 'core';
    });
  }, [category, categoryCode, getByCategory, isModelsLoading, isUnlocked]);

  // Leaf counts for sidebar (only visible models)
  const leafCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const model of models) {
      if (model.categoryCode && (isUnlocked || model.publicationStatus === 'core')) {
        counts[model.categoryCode] = (counts[model.categoryCode] ?? 0) + 1;
      }
    }
    return counts;
  }, [models, isUnlocked]);

  const aggregatedCounts = useMemo(
    () => buildAggregatedCounts(tree, leafCounts),
    [tree, leafCounts],
  );

  const isLoading = isCategoryLoading || isModelsLoading;

  return (
    <>
      <Header
        searchValue={headerSearch}
        onSearchChange={handleSearchChange}
        categoryTree={tree}
        categoryCounts={aggregatedCounts}
        activeCategory={categoryCode}
        onCategorySelect={handleCategorySelect}
      />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex-1">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 w-48 rounded bg-gray-100" />
                <div className="mt-4 h-8 w-64 rounded bg-gray-100" />
                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-lg bg-gray-100" />
                  ))}
                </div>
              </div>
            ) : !category ? (
              <div className="py-24 text-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Categorie niet gevonden
                </h1>
                <p className="mt-2 text-gray-500">
                  De categorie &ldquo;{categoryCode}&rdquo; bestaat niet.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Terug naar catalogus
                </Link>
              </div>
            ) : (
              <>
                <Breadcrumbs path={breadcrumbPath} />

                <h1 className="text-2xl font-bold text-gray-900">
                  {category.nameNl}
                </h1>

                {/* Subcategory chips */}
                {category.children.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {category.children.map((child) => (
                      <a
                        key={child.code}
                        href={`/category/${child.code}/`}
                        className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {child.nameNl}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {categoryModels.length}{' '}
                    {categoryModels.length === 1 ? 'product' : 'producten'}
                  </p>
                  <ViewSwitcher mode={viewMode} onChange={handleViewChange} />
                </div>

                {categoryModels.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-gray-400">
                      Geen producten in deze categorie.
                    </p>
                  </div>
                ) : (
                  <div className={`mt-6 grid gap-4 ${
                    viewMode === 'gallery'
                      ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                  }`}>
                    {categoryModels.map((model) => (
                      <ModelCard key={model.slug} model={model} viewMode={viewMode} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
      </div>
    </>
  );
}
