'use client';

import { useRef, useState, useEffect } from 'react';

/**
 * Dual-layer crossfade between sprite regions.
 * Only animates `opacity` (GPU-composited, 60fps).
 */
interface CrossfadeSpriteProps {
  /** Sprite sheet URL */
  src: string;
  /** CSS background-position value for current image */
  position: string;
  /** CSS background-size value */
  size: string;
  /** Transition duration in ms */
  duration?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Alt text */
  alt: string;
  /** Click handler (for lightbox) */
  onClick?: () => void;
}

export function CrossfadeSprite({
  src,
  position,
  size,
  duration = 250,
  className = '',
  alt,
  onClick,
}: CrossfadeSpriteProps) {
  const [layers, setLayers] = useState<Array<{ src: string; position: string; size: string; opacity: number; key: number }>>([
    { src, position, size, opacity: 1, key: 0 },
  ]);
  const nextKey = useRef(1);
  const prevRef = useRef(`${src}|${position}`);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const current = `${src}|${position}`;
    if (current === prevRef.current) return;
    prevRef.current = current;

    const key = nextKey.current++;

    setLayers((prev) => [
      ...prev.map((l) => ({ ...l, opacity: 0 })),
      { src, position, size, opacity: 1, key },
    ]);

    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    cleanupTimer.current = setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.opacity === 1));
    }, duration + 50);
  }, [src, position, size, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role="img"
      aria-label={alt}
      onClick={onClick}
      style={{ cursor: onClick ? 'zoom-in' : undefined }}
    >
      {layers.map((layer) => (
        <div
          key={layer.key}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${layer.src})`,
            backgroundPosition: layer.position,
            backgroundRepeat: 'no-repeat',
            backgroundSize: layer.size,
            opacity: layer.opacity,
            transition: `opacity ${duration}ms ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}
