interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
}

function buildSrcSet(src: string): string {
  const match = src.match(/\/(\d+)\//);
  if (!match) return src;
  const baseSize = match[1];
  return [80, 400, 800]
    .map((size) => `${src.replace(`/${baseSize}/`, `/${size}/`)} ${size}w`)
    .join(', ');
}

export function ProductImage({
  src,
  alt,
  className = '',
  loading = 'lazy',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  priority = false,
  onLoad,
}: ProductImageProps) {
  return (
    <img
      src={src}
      srcSet={buildSrcSet(src)}
      alt={alt}
      loading={priority ? 'eager' : loading}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      sizes={sizes}
      className={className}
      onLoad={onLoad}
      draggable={false}
    />
  );
}
