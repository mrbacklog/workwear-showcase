interface ProductImageProps {
  avifSrc: string;
  webpSrc: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
}

/**
 * Build srcSet with 300w and 600w variants.
 * Input: "https://cdn/300/ean-1.avif" → "https://cdn/300/ean-1.avif 300w, https://cdn/600/ean-1.avif 600w"
 */
function buildSrcSet(src: string): string {
  // src is like https://workwear-images.databiz.app/300/ean-seq.ext
  const src600 = src.replace('/300/', '/600/');
  if (src600 === src) return src; // fallback if no /300/ in path
  return `${src} 300w, ${src600} 600w`;
}

export function ProductImage({
  avifSrc,
  webpSrc,
  alt,
  className = '',
  loading = 'lazy',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  priority = false,
  onLoad,
}: ProductImageProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={buildSrcSet(avifSrc)} sizes={sizes} />
      <source type="image/webp" srcSet={buildSrcSet(webpSrc)} sizes={sizes} />
      <img
        src={webpSrc}
        alt={alt}
        loading={priority ? 'eager' : loading}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : undefined}
        sizes={sizes}
        className={className}
        onLoad={onLoad}
        draggable={false}
      />
    </picture>
  );
}
