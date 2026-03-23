'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { CategorySidebar } from '@/components/category/CategorySidebar';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { useModelCards } from '@/hooks/useModelCards';
import { buildAggregatedCounts, getDescendantCodes } from '@/lib/category-utils';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatPrice } from '@/lib/format';
import type { CategoryNode, ShowcaseModel } from '@/types/product';

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------

function ProductCard({ model }: { model: ShowcaseModel }) {
  const displayImage = useMemo(() => {
    for (const cg of model.colorGroups) {
      if (cg.images.length > 0) {
        return cg.images[0];
      }
    }
    return null;
  }, [model]);

  const minPrice = useMemo(() => {
    let lowest = Infinity;
    for (const cg of model.colorGroups) {
      for (const v of cg.variants) {
        if (v.priceCents > 0 && v.priceCents < lowest) {
          lowest = v.priceCents;
        }
      }
    }
    return lowest === Infinity ? 0 : lowest;
  }, [model]);

  return (
    <a
      href={`/product/${model.slug}/`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-gray-50">
        {displayImage ? (
          <ProductImage
            src={displayImage.thumb400Webp}
            alt={`${model.brandName} ${model.modelName}`}
            className="h-full w-full object-contain"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">
            Geen afbeelding
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {model.brandName}
        </p>
        <h3 className="mt-1 text-sm font-medium text-gray-900 line-clamp-2">
          {model.modelName || model.modelCode}
        </h3>
        {model.modelCode && model.modelName && (
          <p className="mt-0.5 text-xs text-gray-400">Art. {model.modelCode}</p>
        )}
        {model.colorGroups.length > 1 && (
          <div className="mt-2 flex gap-1">
            {model.colorGroups.slice(0, 5).map((cg) => (
              <span
                key={cg.colorCode || cg.colorRaw}
                className="inline-block h-4 w-4 rounded-full border border-gray-200"
                style={{ backgroundColor: cg.hexCode || '#cccccc' }}
                title={cg.colorName || cg.colorRaw}
              />
            ))}
            {model.colorGroups.length > 5 && (
              <span className="text-xs text-gray-400 self-center ml-1">
                +{model.colorGroups.length - 5}
              </span>
            )}
          </div>
        )}
        {minPrice > 0 && (
          <p className="mt-auto pt-2 text-sm font-semibold text-gray-900">
            vanaf {formatPrice(minPrice)}
          </p>
        )}
      </div>
    </a>
  );
}

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
              <a href={`/category/${node.code}/`} className="hover:text-gray-700">
                {node.nameNl}
              </a>
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

  const handleSearchChange = useCallback((value: string) => {
    setHeaderSearch(value);
    if (value.trim()) {
      window.location.href = `/search/?q=${encodeURIComponent(value.trim())}`;
    }
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
      <Header searchValue={headerSearch} onSearchChange={handleSearchChange} />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block sticky top-8 self-start max-h-[calc(100vh-4rem)] overflow-y-auto">
            {!isCategoryLoading && (
              <CategorySidebar
                tree={tree}
                currentCode={categoryCode}
                counts={aggregatedCounts}
              />
            )}
          </aside>

          {/* Main content */}
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

                <p className="mt-4 text-sm text-gray-500">
                  {categoryModels.length}{' '}
                  {categoryModels.length === 1 ? 'product' : 'producten'}
                </p>

                {categoryModels.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-gray-400">
                      Geen producten in deze categorie.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {categoryModels.map((model) => (
                      <ProductCard key={model.slug} model={model} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
