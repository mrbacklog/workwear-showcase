'use client';

import type { SizeItem } from '@/types/summary';

export type SizeGroup = 'confectie' | 'kledingmaten' | 'schoenmaten' | 'broeksmaten' | 'kindermaten';

export type SizeGroupMap = Record<SizeGroup, string[]>;

export interface ModelSummaryLike {
  sizeItems?: SizeItem[];
  sizeSet?: string[];   // backwards-compat fallback
}

export const GROUP_ORDER: SizeGroup[] = [
  'confectie',
  'kledingmaten',
  'schoenmaten',
  'broeksmaten',
  'kindermaten',
];

export const GROUP_LABELS: Record<SizeGroup, string> = {
  confectie:    'Confectie',
  kledingmaten: 'Kledingmaten',
  schoenmaten:  'Schoenmaten',
  broeksmaten:  'Broeksmaten',
  kindermaten:  'Kindermaten',
};

const CATEGORY_TO_GROUP: Record<string, SizeGroup | null> = {
  CONF:    'confectie',
  SHOE:    'schoenmaten',
  PANT:    'broeksmaten',
  NUM:     'kledingmaten',
  KIDS:    'kindermaten',
  UNI:     null,
  UNKNOWN: null,  // UNKNOWN valt terug op regex hieronder
};

// Sorteervolgorde voor confectie
const CONFECTIE_ORDER = [
  'XS', 'S', 'M', 'L', 'L-XL', 'XL', 'XL-XXL', 'XXL', 'XXL-3XL',
  '3XL', '3XL-4XL', '4XL', '5XL', '6XL',
];

// Regex patronen voor UNKNOWN-fallback
const CONF_RE = /^(XS|S|M|L|XL|XXL|\d+XL)$/i;
const COMBINATION_CONF_RE = /^(XS|S|M|L|XL|XXL|\d+XL)-(XS|S|M|L|XL|XXL|\d+XL)$/i;
const PANT_RE = /^W?\d{2,3}\/L?\d{2,3}$/i;

function fallbackClassify(size: string): SizeGroup | null {
  const s = size.trim();
  if (CONF_RE.test(s) || COMBINATION_CONF_RE.test(s)) return 'confectie';
  if (PANT_RE.test(s)) return 'broeksmaten';
  if (/^\d{2,3}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 50 && n <= 176) return 'kindermaten';
    if (n >= 28) return 'kledingmaten';
  }
  return null;
}

function resolveGroup(item: SizeItem): SizeGroup | null {
  const mapped = CATEGORY_TO_GROUP[item.category];
  if (mapped !== undefined) return mapped;
  return fallbackClassify(item.value);
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

function sortKledingmaten(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function sortSchoenmaten(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function sortBroeksmaten(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const wa = parseInt(a.replace(/^W?(\d+).*/, '$1'), 10);
    const wb = parseInt(b.replace(/^W?(\d+).*/, '$1'), 10);
    if (wa !== wb) return wa - wb;
    const la = parseInt(a.replace(/.*\/L?(\d+)$/, '$1'), 10);
    const lb = parseInt(b.replace(/.*\/L?(\d+)$/, '$1'), 10);
    return la - lb;
  });
}

function sortKindermaten(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

const SORT_FNS: Record<SizeGroup, (s: string[]) => string[]> = {
  confectie:    sortConfectie,
  kledingmaten: sortKledingmaten,
  schoenmaten:  sortSchoenmaten,
  broeksmaten:  sortBroeksmaten,
  kindermaten:  sortKindermaten,
};

export function buildSizeGroups(models: ModelSummaryLike[]): SizeGroupMap {
  const grouped: Record<SizeGroup, Set<string>> = {
    confectie:    new Set(),
    kledingmaten: new Set(),
    schoenmaten:  new Set(),
    broeksmaten:  new Set(),
    kindermaten:  new Set(),
  };

  for (const model of models) {
    const items = model.sizeItems ?? (model.sizeSet?.map(v => ({ value: v, category: 'UNKNOWN' as const })) ?? []);
    for (const item of items) {
      const group = resolveGroup(item);
      if (group) grouped[group].add(item.value);
    }
  }

  return {
    confectie:    SORT_FNS.confectie(Array.from(grouped.confectie)),
    kledingmaten: SORT_FNS.kledingmaten(Array.from(grouped.kledingmaten)),
    schoenmaten:  SORT_FNS.schoenmaten(Array.from(grouped.schoenmaten)),
    broeksmaten:  SORT_FNS.broeksmaten(Array.from(grouped.broeksmaten)),
    kindermaten:  SORT_FNS.kindermaten(Array.from(grouped.kindermaten)),
  };
}

// Expandeer combinatiematen: "L-XL" → ["L-XL", "L", "XL"]
export function expandSize(value: string): string[] {
  const match = value.match(/^(.+)-(.+)$/);
  if (match && COMBINATION_CONF_RE.test(value)) {
    return [value, match[1].toUpperCase(), match[2].toUpperCase()];
  }
  return [value];
}

export function modelMatchesSizeFilter(
  model: ModelSummaryLike,
  selected: Set<string>,
): boolean {
  if (selected.size === 0) return true;
  const items = model.sizeItems ?? (model.sizeSet?.map(v => ({ value: v, category: 'UNKNOWN' as const })) ?? []);
  for (const item of items) {
    for (const expanded of expandSize(item.value)) {
      if (selected.has(expanded)) return true;
    }
  }
  return false;
}

export function parseSizeParam(param: string): Set<string> {
  if (!param) return new Set();
  return new Set(param.split(',').filter(Boolean).map(decodeURIComponent));
}

export function serializeSizeParam(selected: Set<string>): string {
  return Array.from(selected).map(encodeURIComponent).join(',');
}
