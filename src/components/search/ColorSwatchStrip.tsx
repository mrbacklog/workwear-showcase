'use client';

interface ColorSwatch {
  code: string;
  hexCode: string;
  colorRaw?: string;
}

interface ColorSwatchStripProps {
  colors: ColorSwatch[];
  onHover?: (code: string | null) => void;
  activeColor?: string | null;
}

/** Colors that need a visible border because they blend with white backgrounds. */
const LIGHT_COLORS = new Set(['#ffffff', '#fff', '#fafafa', '#f5f5dc', '#fffff0', '#fdf5e6']);

function needsBorder(hex: string): boolean {
  const normalized = hex.toLowerCase();
  if (LIGHT_COLORS.has(normalized)) return true;

  // Also check if the color is very light by checking RGB values
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

export function ColorSwatchStrip({ colors, onHover, activeColor }: ColorSwatchStripProps) {
  if (colors.length === 0) return null;

  const visibleColors = colors.slice(0, MAX_VISIBLE);
  const overflowCount = colors.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1">
      {visibleColors.map((color) => (
        <button
          key={color.code}
          type="button"
          className={`h-5 w-5 shrink-0 rounded-full transition-all ${
            activeColor === color.code ? 'scale-110 ring-1 ring-gray-500 ring-offset-1' : ''
          } ${needsBorder(color.hexCode) ? 'border border-gray-300' : ''}`}
          style={{ backgroundColor: color.hexCode }}
          onMouseEnter={() => onHover?.(color.code)}
          onMouseLeave={() => onHover?.(null)}
          aria-label={`Kleur ${color.colorRaw || color.code}`}
        />
      ))}
      {overflowCount > 0 && (
        <span className="ml-0.5 text-xs text-gray-400">+{overflowCount}</span>
      )}
    </div>
  );
}
