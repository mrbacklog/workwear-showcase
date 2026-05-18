'use client';

export interface SwatchItem {
  index: number;
  hexCode: string;
  secondaryHex: string | null;
}

interface ColorSwatchStripProps {
  swatches: SwatchItem[];
  onHover?: (index: number | null) => void;
  activeIndex?: number | null;
  thumbSize?: number;
}

/** Colors that need a visible border because they blend with white backgrounds. */
function needsBorder(hex: string): boolean {
  const normalized = hex.toLowerCase();
  const match = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (match) {
    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    return r > 230 && g > 230 && b > 230;
  }
  return false;
}

const MAX_VISIBLE = 8;

export function ColorSwatchStrip({ swatches, onHover, activeIndex, thumbSize = 20 }: ColorSwatchStripProps) {
  if (swatches.length === 0) return null;

  const visibleSwatches = swatches.slice(0, MAX_VISIBLE);
  const overflowCount = swatches.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1">
      {visibleSwatches.map((swatch) => {
        const isActive = activeIndex === swatch.index;
        const hasBorder = needsBorder(swatch.hexCode);
        return (
          <button
            key={swatch.index}
            type="button"
            className={[
              'shrink-0 rounded-full transition-all',
              isActive ? 'scale-110 ring-1 ring-gray-500 ring-offset-1' : '',
              hasBorder ? 'border border-gray-300' : '',
            ].filter(Boolean).join(' ')}
            style={{
              width: thumbSize,
              height: thumbSize,
              background: swatch.secondaryHex
                ? `linear-gradient(135deg, ${swatch.hexCode} 50%, ${swatch.secondaryHex} 50%)`
                : swatch.hexCode,
            }}
            onMouseEnter={() => onHover?.(swatch.index)}
            onMouseLeave={() => onHover?.(null)}
            aria-label={`Kleur ${swatch.index + 1}`}
          />
        );
      })}
      {overflowCount > 0 && (
        <span className="ml-0.5 text-xs text-gray-400">+{overflowCount}</span>
      )}
    </div>
  );
}
