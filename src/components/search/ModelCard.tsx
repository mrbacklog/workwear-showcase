'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { ShowcaseModel } from '@/types/product';
import { formatPrice, formatPriceRange } from '@/lib/format';
import { VariantThumbnailStrip } from '@/components/search/VariantThumbnailStrip';
import { useSpriteMap } from '@/hooks/useSpriteMap';

interface ModelCardProps {
  model: ShowcaseModel;
  preferredColorCodes?: Set<string>;
}

export function ModelCard({ model, preferredColorCodes }: ModelCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { getSpriteInfo, prefetchFullSprite } = useSpriteMap();

  const initialGroupIndex = useMemo(() => {
    if (preferredColorCodes && preferredColorCodes.size > 0) {
      const idx = model.colorGroups.findIndex((cg) => preferredColorCodes.has(cg.colorCode));
      if (idx >= 0) return idx;
    }
    return 0;
  }, [model.colorGroups, preferredColorCodes]);

  // Compute price range across all variants
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

  // Build variant thumbnails for the strip
  const variantThumbs = useMemo(
    () =>
      model.colorGroups.map((cg) => {
        const firstImg = cg.images[0];
        const imageKey = firstImg ? firstImg.path : null;
        return {
          code: cg.colorCode,
          imageKey,
          hexCode: cg.hexCode,
          colorRaw: cg.colorRaw,
        };
      }),
    [model.colorGroups],
  );

  // Determine which color group to display
  const displayGroupIndex = hoveredIndex ?? initialGroupIndex;
  const displayGroup = model.colorGroups[displayGroupIndex];
  // Get sprite info for the display image
  const displaySprite = useMemo(() => {
    if (!displayGroup || displayGroup.images.length === 0) return null;
    const firstImg = displayGroup.images[0];
    return getSpriteInfo(model.slug, firstImg.path);
  }, [displayGroup, model.slug, getSpriteInfo]);

  // Prefetch full sprite on card hover
  const handleCardHover = useCallback(() => {
    prefetchFullSprite(model.slug);
  }, [model.slug, prefetchFullSprite]);

  // Build link URL: include color code when hovering a specific thumb
  const linkHref = useMemo(() => {
    if (hoveredIndex !== null && hoveredIndex !== initialGroupIndex) {
      const colorCode = model.colorGroups[hoveredIndex]?.colorCode;
      if (colorCode) return `/product/${model.slug}/?color=${encodeURIComponent(colorCode)}`;
    }
    return `/product/${model.slug}/`;
  }, [hoveredIndex, initialGroupIndex, model.slug, model.colorGroups]);

  return (
    <Link
      href={linkHref}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
      onMouseEnter={handleCardHover}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50">
        {displaySprite ? (
          <div
            role="img"
            aria-label={`${model.brandName} ${model.modelName}`}
            className="h-full w-full"
            style={{
              backgroundImage: `url(${displaySprite.fullSrc})`,
              backgroundPosition: displaySprite.fullPos,
              backgroundRepeat: 'no-repeat',
              backgroundSize: displaySprite.fullSize,
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">
            Geen afbeelding
          </div>
        )}
      </div>

      {/* Details — flex column so thumbnails stick to bottom */}
      <div className="flex flex-1 flex-col p-3">
        <p className="text-xs text-gray-500">{model.brandName}</p>
        <h3 className="mt-0.5 text-sm font-medium text-gray-900 group-hover:text-gray-700 line-clamp-2">
          {model.modelName}
        </h3>
        <p className="mt-1 text-sm font-semibold text-gray-900">
          {minPrice === maxPrice ? formatPrice(minPrice) : formatPriceRange(minPrice, maxPrice)}
        </p>

        {/* Spacer pushes thumbnails to bottom */}
        <div className="flex-1" />

        {/* Variant thumbnails - always at bottom */}
        <div className="h-[36px]">
          {variantThumbs.length > 1 && (
            <VariantThumbnailStrip
              variants={variantThumbs}
              modelSlug={model.slug}
              onHover={setHoveredIndex}
              activeIndex={hoveredIndex}
            />
          )}
        </div>
      </div>
    </Link>
  );
}
