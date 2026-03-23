'use client';

import { useRef, useEffect } from 'react';
import { ProductImage } from '@/components/ui/ProductImage';

export interface VariantThumb {
  code: string;
  thumbWebp: string | null;
  hexCode: string;
  colorRaw?: string;
}

interface VariantThumbnailStripProps {
  variants: VariantThumb[];
  onHover?: (index: number | null) => void;
  activeIndex?: number | null;
  direction?: 'horizontal' | 'vertical';
  thumbSize?: number;
  maxHeight?: number;
}

export function VariantThumbnailStrip({
  variants,
  onHover,
  activeIndex,
  direction = 'horizontal',
  thumbSize = 44,
  maxHeight,
}: VariantThumbnailStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mouse wheel → horizontal scroll
  useEffect(() => {
    if (direction !== 'horizontal') return;
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [direction]);

  // Gradient fade mask
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const isH = direction === 'horizontal';
      const pos = isH ? el.scrollLeft : el.scrollTop;
      const max = isH
        ? el.scrollWidth - el.clientWidth
        : el.scrollHeight - el.clientHeight;
      if (max <= 0) {
        el.style.maskImage = 'none';
        return;
      }
      const atStart = pos < 4;
      const atEnd = pos > max - 4;
      const dir = isH ? 'to right' : 'to bottom';
      if (atStart && atEnd) {
        el.style.maskImage = 'none';
      } else if (atStart) {
        el.style.maskImage = `linear-gradient(${dir}, black 85%, transparent 100%)`;
      } else if (atEnd) {
        el.style.maskImage = `linear-gradient(${dir}, transparent 0%, black 15%)`;
      } else {
        el.style.maskImage = `linear-gradient(${dir}, transparent 0%, black 10%, black 90%, transparent 100%)`;
      }
    };
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [direction]);

  if (variants.length <= 1) return null;

  const isHorizontal = direction === 'horizontal';

  const containerStyle: React.CSSProperties = isHorizontal
    ? {}
    : { maxHeight: maxHeight !== undefined ? maxHeight : undefined };

  return (
    <div
      ref={scrollRef}
      className={[
        'no-scrollbar',
        isHorizontal
          ? 'flex flex-row overflow-x-auto scroll-snap-x'
          : 'flex flex-col overflow-y-auto scroll-snap-y',
        'gap-1.5',
      ].join(' ')}
      style={containerStyle}
    >
      {variants.map((v, i) => {
        const isActive = activeIndex === i;
        return (
          <button
            key={`${v.code}-${i}`}
            type="button"
            className={[
              'scroll-snap-start shrink-0 overflow-hidden rounded-lg bg-gray-50 border-2 transition-colors',
              isActive ? 'border-gray-500' : 'border-transparent',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ width: thumbSize, height: thumbSize }}
            onMouseEnter={() => onHover?.(i)}
            onMouseLeave={() => onHover?.(null)}
            aria-label={`Kleur ${v.colorRaw || v.code}`}
          >
            {v.thumbWebp ? (
              <ProductImage
                src={v.thumbWebp}
                alt={v.colorRaw || v.code}
                className="h-full w-full object-contain rounded"
                sizes={`${thumbSize}px`}
              />
            ) : (
              <span
                className="block h-full w-full rounded-full"
                style={{ backgroundColor: v.hexCode }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
