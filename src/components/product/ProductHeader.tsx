import Link from 'next/link';
import type { ShowcaseModel } from '@/types/product';
import { formatPriceRange } from '@/lib/format';
import { useMemo } from 'react';

interface ProductHeaderProps {
  model: ShowcaseModel;
  actionSlot?: React.ReactNode;
  showBadge?: boolean;
}

export function ProductHeader({ model, actionSlot, showBadge = true }: ProductHeaderProps) {
  // Compute price range
  const { minPrice, maxPrice } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const group of model.colorGroups) {
      for (const variant of group.variants) {
        if (variant.priceCents < min) min = variant.priceCents;
        if (variant.priceCents > max) max = variant.priceCents;
      }
    }
    return { minPrice: min === Infinity ? 0 : min, maxPrice: max === -Infinity ? 0 : max };
  }, [model.colorGroups]);

  // Split category path into breadcrumb segments
  const categorySegments = model.categoryPath
    ? model.categoryPath.split(' > ')
    : [];

  // Publication status badge
  const statusLabel = model.publicationStatus === 'core' ? 'Kern' : 'Rand';
  const statusClasses =
    model.publicationStatus === 'core'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';

  return (
    <div>
      {/* Category breadcrumb */}
      {categorySegments.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-gray-500" aria-label="Breadcrumb">
          {categorySegments.map((segment, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && (
                <svg
                  className="h-3 w-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
              <span>{segment}</span>
            </span>
          ))}
        </nav>
      )}

      {/* Brand */}
      <Link
        href={`/category/${model.brandSlug}`}
        className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
      >
        {model.brandName}
      </Link>

      {/* Model name + status badge */}
      <div className="mt-1 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{model.modelName}</h1>
        {showBadge && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Action slot (nomination button) */}
      {actionSlot && <div className="mt-3">{actionSlot}</div>}

      {/* Price range */}
      <p className="mt-2 text-xl font-semibold text-gray-900">
        {formatPriceRange(minPrice, maxPrice)}
      </p>
    </div>
  );
}
