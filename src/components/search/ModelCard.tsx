'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { ShowcaseModel } from '@/types/product';
import { formatPrice, formatPriceRange } from '@/lib/format';
import { VariantThumbnailStrip } from '@/components/search/VariantThumbnailStrip';
import { ProductImage } from '@/components/ui/ProductImage';
import type { ViewMode } from '@/components/search/ViewSwitcher';

interface ModelCardProps {
  model: ShowcaseModel;
  preferredColorCodes?: Set<string>;
  viewMode?: ViewMode;
}

export function ModelCard({ model, preferredColorCodes, viewMode = 'grid' }: ModelCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const initialGroupIndex = useMemo(() => {
    if (preferredColorCodes && preferredColorCodes.size > 0) {
      const idx = model.colorGroups.findIndex((cg) => preferredColorCodes.has(cg.colorCode));
      if (idx >= 0) return idx;
    }
    return 0;
  }, [model.colorGroups, preferredColorCodes]);

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

  const variantThumbs = useMemo(
    () =>
      model.colorGroups.map((cg) => {
        const firstImg = cg.images[0];
        return {
          code: cg.colorCode,
          thumbWebp: firstImg?.thumbWebp ?? null,
          hexCode: cg.hexCode,
          colorRaw: cg.colorRaw,
        };
      }),
    [model.colorGroups],
  );

  const displayGroupIndex = hoveredIndex ?? initialGroupIndex;
  const displayGroup = model.colorGroups[displayGroupIndex];
  const displayImage = displayGroup?.images[0] ?? null;

  const linkHref = useMemo(() => {
    if (hoveredIndex !== null && hoveredIndex !== initialGroupIndex) {
      const colorRaw = model.colorGroups[hoveredIndex]?.colorRaw;
      if (colorRaw) return `/product/${model.slug}/?color=${encodeURIComponent(colorRaw)}`;
    }
    return `/product/${model.slug}/`;
  }, [hoveredIndex, initialGroupIndex, model.slug, model.colorGroups]);

  const priceText =
    minPrice === maxPrice ? formatPrice(minPrice) : formatPriceRange(minPrice, maxPrice);

  const singleVariantName = model.colorGroups.length === 1
    ? (model.colorGroups[0].colorName || model.colorGroups[0].colorRaw)
    : null;

  const imageNode = displayImage ? (
    <ProductImage
      src={displayImage.thumb400Webp}
      alt={`${model.brandName} ${model.modelName}`}
      className="h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">
      Geen afbeelding
    </div>
  );

  const handleCardLeave = useCallback(() => {
    // no-op
  }, []);

  if (viewMode === 'gallery') {
    return (
      <Link
        href={linkHref}
        className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200 hover:shadow-md"
        onMouseLeave={handleCardLeave}
      >
        {/* Image area with optional vertical thumbnail strip */}
        <div className="flex flex-1 min-h-0">
          {/* Vertical thumbnail strip (left) */}
          {variantThumbs.length > 1 && (
            <div className="shrink-0 p-1.5 pr-0">
              <VariantThumbnailStrip
                variants={variantThumbs}
                onHover={setHoveredIndex}
                activeIndex={hoveredIndex}
                direction="vertical"
                thumbSize={48}
                maxHeight={280}
              />
            </div>
          )}

          {/* Main image */}
          <div className="relative flex-1 overflow-hidden bg-gray-50 aspect-[4/5]">
            {imageNode}
          </div>
        </div>

        {/* Details */}
        <div className="p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-gray-400">{model.brandName}</p>
            <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{priceText}</p>
          </div>
          <h3 className="mt-0.5 text-sm font-medium text-gray-900 group-hover:text-gray-700 truncate">
            {model.modelName}
          </h3>
          {singleVariantName && (
            <p className="mt-1 text-xs italic text-gray-400">
              {singleVariantName} — enige uitvoering
            </p>
          )}
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
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          {imageNode}

          {/* Default gradient overlay with brand/name/price */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-12 transition-opacity duration-200 group-hover:opacity-0">
            <p className="text-xs uppercase tracking-wide text-white/70">{model.brandName}</p>
            <h3 className="text-sm font-medium text-white truncate">{model.modelName}</h3>
            <p className="mt-0.5 text-xs font-semibold text-white/90">{priceText}</p>
          </div>

          {/* Hover overlay with frosted glass + thumbnails */}
          <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-md p-3 pt-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="text-xs uppercase tracking-wide text-gray-400">{model.brandName}</p>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-900 truncate">{model.modelName}</h3>
              <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{priceText}</p>
            </div>
            {variantThumbs.length > 1 ? (
              <div className="mt-2">
                <VariantThumbnailStrip
                  variants={variantThumbs}
                  onHover={setHoveredIndex}
                  activeIndex={hoveredIndex}
                  thumbSize={40}
                />
              </div>
            ) : singleVariantName ? (
              <p className="mt-1.5 text-xs italic text-gray-400">
                {singleVariantName} — enige uitvoering
              </p>
            ) : null}
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
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-50">
        {imageNode}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-gray-400">{model.brandName}</p>
          <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{priceText}</p>
        </div>
        <h3 className="mt-0.5 text-sm font-medium text-gray-900 group-hover:text-gray-700 truncate">
          {model.modelName}
        </h3>

        {/* Spacer pushes thumbnails to bottom */}
        <div className="flex-1" />

        {/* Variant thumbnails or single-variant label */}
        <div className="mt-2 min-h-[48px]">
          {variantThumbs.length > 1 ? (
            <VariantThumbnailStrip
              variants={variantThumbs}
              onHover={setHoveredIndex}
              activeIndex={hoveredIndex}
              thumbSize={44}
            />
          ) : singleVariantName ? (
            <p className="text-xs italic text-gray-400 pt-3">
              {singleVariantName} — enige uitvoering
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
