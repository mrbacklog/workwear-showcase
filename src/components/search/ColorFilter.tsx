'use client';

export const COLOR_PALETTE: Array<{ code: string; name: string; hexCode: string }> = [
  { code: 'BLK', name: 'Zwart',        hexCode: '#1a1a1a' },
  { code: 'NVY', name: 'Marineblauw',  hexCode: '#1b2a4a' },
  { code: 'GRY', name: 'Grijs',        hexCode: '#808080' },
  { code: 'BLU', name: 'Blauw',        hexCode: '#2563eb' },
  { code: 'WHT', name: 'Wit',          hexCode: '#ffffff' },
  { code: 'GRN', name: 'Groen',        hexCode: '#22c55e' },
  { code: 'ORG', name: 'Oranje',       hexCode: '#f97316' },
  { code: 'RED', name: 'Rood',         hexCode: '#ef4444' },
  { code: 'YEL', name: 'Geel',         hexCode: '#eab308' },
  { code: 'BGE', name: 'Beige',        hexCode: '#d4b896' },
  { code: 'BRN', name: 'Bruin',        hexCode: '#78350f' },
  { code: 'MUL', name: 'Multicolor',   hexCode: 'conic-gradient(red,yellow,green,blue,red)' },
  { code: 'PNK', name: 'Roze',         hexCode: '#ec4899' },
  { code: 'PUR', name: 'Paars',        hexCode: '#a855f7' },
];

export interface ColorInfo {
  code: string;
  name: string;
  hexCode: string;
  modelCount: number;
}

interface ColorFilterProps {
  colors: ColorInfo[];
  selectedCodes: Set<string>;
  onToggle: (code: string) => void;
}

function needsBorder(hex: string): boolean {
  if (hex.startsWith('conic')) return false;
  const normalized = hex.toLowerCase();
  if (['#ffffff', '#fff', '#fafafa', '#f5f5dc', '#fffff0', '#fdf5e6'].includes(normalized)) return true;
  const match = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (match) {
    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    return r > 230 && g > 230 && b > 230;
  }
  return false;
}

function isLightColor(hex: string): boolean {
  if (hex.startsWith('conic')) return false;
  const normalized = hex.toLowerCase();
  if (['#ffffff', '#fff', '#fafafa', '#f5f5dc', '#fffff0', '#fdf5e6'].includes(normalized)) return true;
  const match = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (match) {
    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    return r > 200 && g > 200 && b > 200;
  }
  return false;
}

export function ColorFilter({ colors, selectedCodes, onToggle }: ColorFilterProps) {
  return (
    <nav aria-label="Kleuren filter">
      <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Kleuren
      </h2>

      <div className="flex flex-wrap gap-2 px-2">
        {colors.map((color) => {
          const isSelected = selectedCodes.has(color.code);
          const isMulticolor = color.hexCode.startsWith('conic');
          const light = needsBorder(color.hexCode);
          const lightCheck = isLightColor(color.hexCode);
          const title = `${color.name} (${color.modelCount})`;

          return (
            <button
              key={color.code}
              type="button"
              onClick={() => onToggle(color.code)}
              title={title}
              aria-label={title}
              className={`relative flex h-7 w-7 items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-110 ${
                isSelected ? 'ring-2 ring-offset-2 ring-gray-700' : ''
              } ${light ? 'border border-gray-300' : ''} ${
                color.modelCount === 0 ? 'opacity-30' : ''
              }`}
              style={
                isMulticolor
                  ? { background: color.hexCode }
                  : { backgroundColor: color.hexCode }
              }
            >
              {isSelected && (
                <svg
                  className={`h-3.5 w-3.5 drop-shadow-sm ${
                    lightCheck ? 'text-gray-600' : 'text-white'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
