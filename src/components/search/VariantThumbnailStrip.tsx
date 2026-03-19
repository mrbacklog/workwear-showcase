'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSpriteMap } from '@/hooks/useSpriteMap';

interface VariantThumb {
  code: string;
  imageKey: string | null;
  hexCode: string;
  colorRaw?: string;
}

interface VariantThumbnailStripProps {
  variants: VariantThumb[];
  modelSlug: string;
  onHover?: (index: number | null) => void;
  activeIndex?: number | null;
}

/** Layout constants (px) */
const THUMB_SIZE = 32;
const GAP = 6;
const STEP = THUMB_SIZE + GAP; // 38px per thumbnail slot
const MAX_VISIBLE = 5;
const CONTAINER_WIDTH = MAX_VISIBLE * THUMB_SIZE + (MAX_VISIBLE - 1) * GAP; // 184px

/** Scroll speed: px per frame at ~60fps → ~30px/sec */
const SCROLL_SPEED = 0.5;

/** Snap to nearest STEP multiple */
function snap(offset: number): number {
  return Math.round(offset / STEP) * STEP;
}

export function VariantThumbnailStrip({ variants, modelSlug, onHover, activeIndex }: VariantThumbnailStripProps) {
  const { getSpriteInfo } = useSpriteMap();
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const directionRef = useRef<'left' | 'right' | null>(null);

  // Extra padding (+GAP) so the last thumb (with scale/ring) is fully visible
  const maxOffset = Math.max(0, (variants.length - MAX_VISIBLE) * STEP + GAP);
  const needsNav = variants.length > MAX_VISIBLE;

  const canGoLeft = offset > 0;
  const canGoRight = offset < maxOffset;

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Continuous scroll loop via requestAnimationFrame
  const startScrolling = useCallback((direction: 'left' | 'right') => {
    directionRef.current = direction;
    // Disable CSS transition for smooth per-frame updates
    setIsAnimating(false);

    const tick = () => {
      setOffset((prev) => {
        const delta = direction === 'right' ? SCROLL_SPEED : -SCROLL_SPEED;
        return Math.max(0, Math.min(maxOffset, prev + delta));
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [maxOffset]);

  const stopScrolling = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    directionRef.current = null;
    // Snap to nearest thumbnail with transition
    setIsAnimating(true);
    setOffset((prev) => Math.max(0, Math.min(maxOffset, snap(prev))));
  }, [maxOffset]);

  // Click: jump to next/prev snap position
  const handleClick = useCallback((direction: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Stop any ongoing hover-scroll
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsAnimating(true);
    setOffset((prev) => {
      const snapped = snap(prev);
      const jump = STEP * MAX_VISIBLE;
      const next = direction === 'right' ? snapped + jump : snapped - jump;
      return Math.max(0, Math.min(maxOffset, next));
    });
  }, [maxOffset]);

  const handleMouseEnter = useCallback((direction: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startScrolling(direction);
  }, [startScrolling]);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stopScrolling();
  }, [stopScrolling]);

  // Chevron SVG
  const chevron = useCallback((direction: 'left' | 'right') => (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  ), []);

  return (
    <div className="flex items-center gap-1">
      {/* Left arrow */}
      {needsNav && (
        <button
          type="button"
          onClick={(e) => handleClick('left', e)}
          onMouseEnter={(e) => handleMouseEnter('left', e)}
          onMouseLeave={handleMouseLeave}
          disabled={!canGoLeft}
          className={`flex h-6 w-4 shrink-0 items-center justify-center rounded transition-colors ${
            canGoLeft ? 'text-gray-500 hover:text-gray-900' : 'text-gray-200'
          }`}
          aria-label="Vorige kleur"
        >
          {chevron('left')}
        </button>
      )}

      {/* Sliding thumbnail strip */}
      <div
        className="overflow-hidden"
        style={{ width: needsNav ? CONTAINER_WIDTH : undefined }}
      >
        <div
          className="flex items-center"
          style={{
            gap: GAP,
            transform: `translateX(-${offset}px)`,
            transition: isAnimating ? 'transform 250ms ease' : 'none',
          }}
          onTransitionEnd={() => setIsAnimating(false)}
        >
          {variants.map((v, i) => {
            const isActive = activeIndex === i;
            return (
              <button
                key={`${v.code}-${i}`}
                type="button"
                className={`relative shrink-0 overflow-hidden rounded-md bg-gray-50 transition-transform ${
                  isActive ? 'scale-110 ring-2 ring-gray-400 ring-offset-1' : ''
                }`}
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                onMouseEnter={() => onHover?.(i)}
                onMouseLeave={() => onHover?.(null)}
                aria-label={`Kleur ${v.colorRaw || v.code}`}
              >
                {(() => {
                  const sprite = v.imageKey ? getSpriteInfo(modelSlug, v.imageKey) : null;
                  if (sprite) {
                    return (
                      <div
                        className="h-full w-full"
                        style={{
                          backgroundImage: `url(${sprite.thumbSrc})`,
                          backgroundPosition: sprite.thumbPos,
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: sprite.thumbSize,
                        }}
                      />
                    );
                  }
                  return (
                    <span
                      className="absolute inset-1 rounded-full"
                      style={{ backgroundColor: v.hexCode }}
                    />
                  );
                })()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right arrow */}
      {needsNav && (
        <button
          type="button"
          onClick={(e) => handleClick('right', e)}
          onMouseEnter={(e) => handleMouseEnter('right', e)}
          onMouseLeave={handleMouseLeave}
          disabled={!canGoRight}
          className={`flex h-6 w-4 shrink-0 items-center justify-center rounded transition-colors ${
            canGoRight ? 'text-gray-500 hover:text-gray-900' : 'text-gray-200'
          }`}
          aria-label="Volgende kleur"
        >
          {chevron('right')}
        </button>
      )}
    </div>
  );
}
