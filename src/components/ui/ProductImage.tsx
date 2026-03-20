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
      <source type="image/avif" srcSet={avifSrc} sizes={sizes} />
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
