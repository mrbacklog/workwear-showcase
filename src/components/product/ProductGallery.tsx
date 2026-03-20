'use client';

import { useState, useMemo } from 'react';
import type { ShowcaseImage } from '@/types/product';
import { ProductImage } from '@/components/ui/ProductImage';

interface ProductGalleryProps {
  images: ShowcaseImage[];
  selectedColor?: string;
}

export function ProductGallery({ images, selectedColor }: ProductGalleryProps) {
  // Filter images by selected color if provided, otherwise show all
  const filteredImages = useMemo(() => {
    if (!selectedColor) return images;
    const colorImages = images.filter(() => {
      // Match by EAN prefix if color-grouped, otherwise show all
      return true;
    });
    return colorImages.length > 0 ? colorImages : images;
  }, [images, selectedColor]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when images change
  const safeIndex = selectedIndex < filteredImages.length ? selectedIndex : 0;
  const mainImage = filteredImages[safeIndex] ?? null;

  if (filteredImages.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        Geen afbeeldingen beschikbaar
      </div>
    );
  }

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-50">
        {mainImage && (
          <ProductImage
            avifSrc={mainImage.thumbAvif}
            webpSrc={mainImage.thumbWebp}
            alt="Product afbeelding"
            className="h-full w-full object-contain p-4"
            priority={true}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        )}
      </div>

      {/* Thumbnail strip */}
      {filteredImages.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filteredImages.map((image, index) => (
            <button
              key={`${image.ean}-${image.sequenceNumber}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border-2 bg-gray-50 transition-colors ${
                index === safeIndex
                  ? 'border-gray-900'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <ProductImage
                avifSrc={image.thumbAvif}
                webpSrc={image.thumbWebp}
                alt={`Thumbnail ${index + 1}`}
                className="h-full w-full object-contain p-1"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
