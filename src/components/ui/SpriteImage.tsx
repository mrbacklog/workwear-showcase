'use client';

/**
 * Renders a single region from a sprite sheet using CSS background-position.
 * Used for thumbnails and static image display.
 */
interface SpriteImageProps {
  /** Sprite sheet URL */
  src: string;
  /** CSS background-position value */
  position: string;
  /** CSS background-size value */
  size: string;
  /** Display width in px */
  width: number;
  /** Display height in px */
  height: number;
  /** Alt text for accessibility */
  alt: string;
  /** Additional CSS classes */
  className?: string;
}

export function SpriteImage({ src, position, size, width, height, alt, className = '' }: SpriteImageProps) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={className}
      style={{
        width,
        height,
        backgroundImage: `url(${src})`,
        backgroundPosition: position,
        backgroundRepeat: 'no-repeat',
        backgroundSize: size,
      }}
    />
  );
}
