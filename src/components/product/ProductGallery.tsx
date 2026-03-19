'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { ShowcaseImage } from '@/types/product';

interface ProductGalleryProps {
  images: ShowcaseImage[];
  selectedColor?: string;
}

export function ProductGallery({ images, selectedColor }: ProductGalleryProps) {
  // Filter images by selected color if provided, otherwise show all
  const filteredImages = useMemo(() => {
    if (!selectedColor) return images;
    const colorImages = images.filter((img) => {
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
          <Image
            src={mainImage.path}
            alt="Product afbeelding"
            width={600}
            height={600}
            className="h-full w-full object-contain p-4"
            priority
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
              <Image
                src={image.thumbPath}
                alt={`Thumbnail ${index + 1}`}
                width={64}
                height={64}
                className="h-full w-full object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
