// src/lib/size-filter-utils.ts

export type SizeGroup = 'confectie' | 'numeriek' | 'broek' | 'overig';

export type SizeGroupMap = Record<SizeGroup, string[]>;

export interface ModelSummaryLike {
  sizeSet?: string[];
}

const CONFECTIE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];

/**
 * Classifies a sizeDisplay value into a size group.
 */
export function classifySizeGroup(size: string): SizeGroup {
  const s = size.trim();
  // Confectie: XS, S, M, L, XL, XXL, 3XL, etc.
  if (/^(XS|S|M|L|XL|XXL|\d+XL)$/i.test(s)) return 'confectie';
  // Broeksmaten: W32/L34, 32/34
  if (/^W?\d{2}\/L?\d{2}$/i.test(s)) return 'broek';
  // Numeriek: 2–3 cijfers (28–70 range)
  if (/^\d{2,3}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 28 && n <= 70) return 'numeriek';
  }
  return 'overig';
}

function sortConfectie(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = CONFECTIE_ORDER.indexOf(a.toUpperCase());
    const ib = CONFECTIE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function sortNumeriek(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function sortBroek(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const wa = parseInt(a.replace(/^W?(\d+).*/, '$1'), 10);
    const wb = parseInt(b.replace(/^W?(\d+).*/, '$1'), 10);
    return wa - wb;
  });
}

/**
 * Builds a grouped, sorted map of all unique size values from a set of models.
 * Groups with no values are returned as empty arrays.
 */
export function buildSizeGroups(models: ModelSummaryLike[]): SizeGroupMap {
  const grouped: Record<SizeGroup, Set<string>> = {
    confectie: new Set(),
    numeriek: new Set(),
    broek: new Set(),
    overig: new Set(),
  };

  for (const model of models) {
    for (const size of model.sizeSet ?? []) {
      grouped[classifySizeGroup(size)].add(size);
    }
  }

  return {
    confectie: sortConfectie(Array.from(grouped.confectie)),
    numeriek: sortNumeriek(Array.from(grouped.numeriek)),
    broek: sortBroek(Array.from(grouped.broek)),
    overig: Array.from(grouped.overig).sort(),
  };
}

/**
 * Returns true if the model has at least one variant with a size in `selected`.
 */
export function modelMatchesSizeFilter(
  model: ModelSummaryLike,
  selected: Set<string>,
): boolean {
  if (selected.size === 0) return true;
  for (const size of model.sizeSet ?? []) {
    if (selected.has(size)) return true;
  }
  return false;
}

/**
 * Parse URL sizes param: comma-separated sizeDisplay values.
 * "M,XL,W32/L34" → Set(['M', 'XL', 'W32/L34'])
 */
export function parseSizeParam(param: string): Set<string> {
  if (!param) return new Set();
  return new Set(param.split(',').filter(Boolean).map(decodeURIComponent));
}

/**
 * Serialize selected sizes to URL param.
 * Set(['M', 'XL']) → "M,XL"
 */
export function serializeSizeParam(selected: Set<string>): string {
  return Array.from(selected).map(encodeURIComponent).join(',');
}
