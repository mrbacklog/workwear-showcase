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
 * Build srcSet with all available size tiers.
 * AVIF: 300w, 600w, 800w
 * WebP: 80w, 300w, 600w, 800w (80px only available as WebP)
 */
function buildSrcSet(src: string): string {
  const match = src.match(/\/(\d+)\//);
  if (!match) return src;
  const baseSize = match[1];
  const isAvif = src.endsWith('.avif');
  const sizes = isAvif ? [300, 600, 800] : [80, 300, 600, 800];
  return sizes
    .map((size) => `${src.replace(`/${baseSize}/`, `/${size}/`)} ${size}w`)
    .join(', ');
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
