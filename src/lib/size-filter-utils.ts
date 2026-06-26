'use client';

import { sortByStandard } from '@/lib/size-standards';
import type { SizeItem } from '@/types/summary';

export type SizeGroup = 'confectie' | 'kledingmaten' | 'schoenmaten' | 'broeksmaten' | 'kindermaten' | 'handschoenmaten' | 'hoofdmaten' | 'riemmaten';

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
  'handschoenmaten',
  'hoofdmaten',
  'riemmaten',
];

export const GROUP_LABELS: Record<SizeGroup, string> = {
  confectie:       'Confectie',
  kledingmaten:    'Kledingmaten',
  schoenmaten:     'Schoenmaten',
  broeksmaten:     'Broeksmaten',
  kindermaten:     'Kindermaten',
  handschoenmaten: 'Handschoenmaten',
  hoofdmaten:      'Hoofdmaten',
  riemmaten:       'Riemmaten',
};

const CATEGORY_TO_GROUP: Record<string, SizeGroup | null> = {
  CONF:    'confectie',
  SHOE:    'schoenmaten',
  PANT:    'broeksmaten',
  NUM:     'kledingmaten',
  KIDS:    'kindermaten',
  UNI:     null,
  GLOVE:   'handschoenmaten',
  HEAD:    'hoofdmaten',
  BELT:    'riemmaten',
};

// Regex patronen voor UNKNOWN-fallback classificatie
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

// Broeksmaten: W oplopend, dan L oplopend — geen vaste standaard
function sortBroeksmaten(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const da = displayFromSizeKey(a);
    const db = displayFromSizeKey(b);
    const wa = parseInt(da.replace(/^W?(\d+).*/, '$1'), 10);
    const wb = parseInt(db.replace(/^W?(\d+).*/, '$1'), 10);
    if (wa !== wb) return wa - wb;
    const la = parseInt(da.replace(/.*\/L?(\d+)$/, '$1'), 10);
    const lb = parseInt(db.replace(/.*\/L?(\d+)$/, '$1'), 10);
    return la - lb;
  });
}

const SORT_FNS: Record<SizeGroup, (s: string[]) => string[]> = {
  confectie:       sortByStandard,
  kledingmaten:    sortByStandard,
  schoenmaten:     sortByStandard,
  broeksmaten:     sortBroeksmaten,
  kindermaten:     sortByStandard,
  handschoenmaten: sortByStandard,
  hoofdmaten:      sortByStandard,
  riemmaten:       sortByStandard,
};

// Haal de weergavewaarde op uit een typed filtersleutel ("SHOE:36" → "36")
export function displayFromSizeKey(key: string): string {
  const idx = key.indexOf(':');
  return idx >= 0 ? key.slice(idx + 1) : key;
}

// Mascot 4-cijferige schoencodes → EU-maat:
//   830–850  (prefix 8): EU = n − 800   (bijv. 835 → EU 35)
//   1030–1060 (prefix 10): EU = n − 1000  (bijv. 1036 → EU 36)
//   1130–1165 (prefix 11): EU = n − 1100  (bijv. 1139 → EU 39)
export function mascotToEuSize(value: string): string | null {
  if (!/^[01]\d{3}$/.test(value)) return null;
  const n = parseInt(value, 10);
  if (n >= 830 && n <= 850) return String(n - 800);
  if (n >= 1030 && n <= 1060) return String(n - 1000);
  if (n >= 1130 && n <= 1165) return String(n - 1100);
  return null;
}

export function buildSizeGroups(models: ModelSummaryLike[]): SizeGroupMap {
  const grouped: Record<SizeGroup, Set<string>> = {
    confectie:       new Set(),
    kledingmaten:    new Set(),
    schoenmaten:     new Set(),
    broeksmaten:     new Set(),
    kindermaten:     new Set(),
    handschoenmaten: new Set(),
    hoofdmaten:      new Set(),
    riemmaten:       new Set(),
  };

  for (const model of models) {
    const items = model.sizeItems ?? (model.sizeSet?.map(v => ({ value: v, category: 'UNKNOWN' as const })) ?? []);
    for (const item of items) {
      const group = resolveGroup(item);
      if (!group) continue;
      // Mascot 4-cijferige codes naar EU-maat normaliseren voor de filter:
      // "1036" → "36", "0835" → "35", "1139" → "39"
      const filterValue = group === 'schoenmaten'
        ? (mascotToEuSize(item.value) ?? item.value)
        : item.value;
      grouped[group].add(`${item.category}:${filterValue}`);
    }
  }

  return {
    confectie:       SORT_FNS.confectie(Array.from(grouped.confectie)),
    kledingmaten:    SORT_FNS.kledingmaten(Array.from(grouped.kledingmaten)),
    schoenmaten:     SORT_FNS.schoenmaten(Array.from(grouped.schoenmaten)),
    broeksmaten:     SORT_FNS.broeksmaten(Array.from(grouped.broeksmaten)),
    kindermaten:     SORT_FNS.kindermaten(Array.from(grouped.kindermaten)),
    handschoenmaten: SORT_FNS.handschoenmaten(Array.from(grouped.handschoenmaten)),
    hoofdmaten:      SORT_FNS.hoofdmaten(Array.from(grouped.hoofdmaten)),
    riemmaten:       SORT_FNS.riemmaten(Array.from(grouped.riemmaten)),
  };
}

// Expandeer combinatiematen voor filtermatching: "L-XL" → ["L-XL", "L", "XL"]
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

  // Pre-expand combinatiematen in de selectie: "CONF:L-XL" matcht ook variant "CONF:L"
  const expandedSelected = new Set<string>();
  for (const key of selected) {
    expandedSelected.add(key);
    const idx = key.indexOf(':');
    if (idx >= 0) {
      const cat = key.slice(0, idx);
      const val = key.slice(idx + 1);
      for (const exp of expandSize(val)) {
        expandedSelected.add(`${cat}:${exp}`);
      }
    }
  }

  const items = model.sizeItems ?? (model.sizeSet?.map(v => ({ value: v, category: 'UNKNOWN' as const })) ?? []);
  for (const item of items) {
    if (expandedSelected.has(`${item.category}:${item.value}`)) return true;
    // Mascot SHOE codes: filter op EU-maat (bijv. "SHOE:36" matcht variant met "SHOE:1036")
    if (item.category === 'SHOE') {
      const eu = mascotToEuSize(item.value);
      if (eu && expandedSelected.has(`SHOE:${eu}`)) return true;
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
