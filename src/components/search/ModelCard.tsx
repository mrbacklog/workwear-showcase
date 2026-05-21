'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import Link from 'next/link';
import type { ModelSummary } from '@/types/summary';
import { formatPrice } from '@/lib/format';
import { ColorSwatchStrip } from '@/components/search/ColorSwatchStrip';
import { ProductImage } from '@/components/ui/ProductImage';
import { getColorCodes, type ColorFilterGroup } from '@/lib/color-filter-utils';
import type { ViewMode } from '@/components/search/ViewSwitcher';

interface ModelCardProps {
  model: ModelSummary;
  preferredColorCodes?: Set<string>;
  /** AND/OR filter groups — used to select the best matching colorGroup */
  colorFilterGroups?: ColorFilterGroup[];
  viewMode?: ViewMode;
  /** Pass true for the first ~6 visible cards to enable eager/high-priority loading (LCP) */
  priority?: boolean;
}

function ModelCardInner({ model, preferredColorCodes, colorFilterGroups, viewMode = 'grid', priority = false }: ModelCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const initialGroupIndex = useMemo(() => {
    if (colorFilterGroups && colorFilterGroups.length > 0) {
      for (const group of colorFilterGroups) {
        if (group.length > 1) {
          const idx = model.colorGroups.findIndex((cg) => {
            const cgCodes: string[] = [];
            if (cg.hexCode) cgCodes.push(cg.hexCode);
            return group.every((code) => cgCodes.includes(code));
          });
          if (idx >= 0) return idx;
        }
      }
    }
    // Fallback: find first colorGroup matching any selected color via hex
    // The color-filter-utils getColorCodes works on ColorGroup (ShowcaseModel),
    // but ModelSummary colorGroups don't have colorCode. We match on hexCode.
    if (preferredColorCodes && preferredColorCodes.size > 0) {
      // No colorCode on ModelSummary — prefer first group (color filter already applied upstream)
    }
    return 0;
  }, [model.colorGroups, preferredColorCodes, colorFilterGroups]);

  const displayGroupIndex = hoveredIndex ?? initialGroupIndex;
  const displayHex = model.colorGroups[displayGroupIndex]?.hexCode ?? '#cccccc';

  const priceText = formatPrice(model.minPrice);

  const linkHref = `/product/${model.slug}/`;

  const imageNode = model.thumbWebp ? (
    <ProductImage
      src={model.thumbWebp}
      alt={`${model.brandName} ${model.modelName}`}
      className="h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
      priority={priority}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">
      Geen afbeelding
    </div>
  );

  const handleCardLeave = useCallback(() => {
    // no-op
  }, []);

  const swatches = useMemo(
    () =>
      model.colorGroups.map((cg, i) => ({
        index: i,
        hexCode: cg.hexCode,
        secondaryHex: cg.secondaryHex,
      })),
    [model.colorGroups],
  );

  if (viewMode === 'gallery') {
    return (
      <Link
        href={linkHref}
        className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200 hover:shadow-md"
        onMouseLeave={handleCardLeave}
      >
        <div className="flex flex-1 min-h-0">
          <div className="relative flex-1 overflow-hidden bg-gray-50 aspect-[4/5]">
            {imageNode}
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-gray-400">{model.brandName}</p>
            <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{priceText}</p>
          </div>
          <h3 className="mt-0.5 text-sm font-medium text-gray-900 group-hover:text-gray-700 truncate">
            {model.modelName}
          </h3>
        </div>
      </Link>
    );
  }

  if (viewMode === 'hover') {
    return (
      <Link
        href={linkHref}
        className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200 hover:shadow-md"
        onMouseLeave={handleCardLeave}
      >
        <div className={`relative aspect-square overflow-hidden ${model.thumbWebp ? 'bg-gray-50' : 'bg-gray-700'}`}>
          {imageNode}

          <div className={`absolute inset-x-0 bottom-0 p-3 pt-12 transition-opacity duration-200 group-hover:opacity-0 ${model.thumbWebp ? 'bg-gradient-to-t from-black/70 via-black/30 to-transparent' : 'bg-gradient-to-t from-black/50 to-transparent'}`}>
            <p className="text-xs uppercase tracking-wide text-white/70">{model.brandName}</p>
            <h3 className="text-sm font-medium text-white truncate">{model.modelName}</h3>
            <p className="mt-0.5 text-xs font-semibold text-white/90">{priceText}</p>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-md p-3 pt-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="text-xs uppercase tracking-wide text-gray-400">{model.brandName}</p>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-900 truncate">{model.modelName}</h3>
              <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{priceText}</p>
            </div>
            {swatches.length > 1 && (
              <div className="mt-2">
                <ColorSwatchStrip
                  swatches={swatches}
                  activeIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                  thumbSize={32}
                />
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Default: grid view
  return (
    <Link
      href={linkHref}
      className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200 hover:shadow-md"
      onMouseLeave={handleCardLeave}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-50">
        {imageNode}
        {/* Hover color highlight */}
        {hoveredIndex !== null && (
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundColor: displayHex }}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-gray-400">{model.brandName}</p>
          <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{priceText}</p>
        </div>
        <h3 className="mt-0.5 text-sm font-medium text-gray-900 group-hover:text-gray-700 truncate">
          {model.modelName}
        </h3>

        <div className="flex-1" />

        <div className="mt-2 min-h-[32px]">
          {swatches.length > 1 && (
            <ColorSwatchStrip
              swatches={swatches}
              activeIndex={hoveredIndex}
              onHover={setHoveredIndex}
              thumbSize={24}
            />
          )}
        </div>
      </div>
    </Link>
  );
}

export const ModelCard = memo(ModelCardInner);
