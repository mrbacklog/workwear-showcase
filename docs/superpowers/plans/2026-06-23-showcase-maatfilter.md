# Showcase Maatfilter — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een gegroepeerd maatfilter toe aan de showcase zodat bezoekers kunnen filteren op confectiematen, EU-numerieke maten en broeksmaten.

**Architecture:** `scripts/sync-products.ts` verzamelt unieke `sizeDisplay`-waarden per model en schrijft ze als `sizeSet` naar de summary JSON. Client-side filter utility (`size-filter-utils.ts`) classificeert en filtert op basis van die set. De filtercomponent volgt hetzelfde patroon als de bestaande `BrandFilter`.

**Tech Stack:** TypeScript, Next.js 15, Tailwind CSS, React 19. Geen extra dependencies.

## Global Constraints

- TypeScript strict: alle nieuwe code passeert `npm run type-check` zonder fouten
- ESLint: `npm run lint` zonder nieuwe fouten
- Tailwind only: geen inline `style={}` behalve dynamic kleuren
- Geen extra npm packages
- URL-parameter naam: `sizes` (komma-gescheiden `sizeDisplay`-waarden)
- Filter semantiek: model zichtbaar als het minstens één variant heeft met de geselecteerde maat (OR-logica)
- Alle bestanden in `workwear-showcase/` repo (niet in platform monorepo)

---

### Task 1: `sizeSet` toevoegen aan ModelSummary

**Files:**
- Modify: `scripts/sync-products.ts:219-240` (ModelSummary interface)
- Modify: `scripts/sync-products.ts:829-891` (summary-generatie loop)
- Modify: `src/types/summary.ts:28-44` (ModelSummary type)

**Interfaces:**
- Produces: `ModelSummary.sizeSet?: string[]` — array van unieke `sizeDisplay`-waarden voor dit model

- [ ] **Stap 1: Voeg `sizeSet` toe aan de `ModelSummary` interface in `scripts/sync-products.ts`**

Zoek de interface op regel 219 en voeg het veld toe:

```typescript
// scripts/sync-products.ts:219-240 — VOOR
interface ModelSummary {
  slug: string;
  // ... bestaande velden ...
  colorGroups: Array<{ ... }>;
}

// NA — voeg toe na colorGroups, vóór de sluitende }
  /** All unique sizeDisplay values across all variants. Used for client-side size filtering. */
  sizeSet?: string[];
}
```

- [ ] **Stap 2: Verzamel `sizeSet` in de summary-generatie (rond regel 866)**

In de `.map((m) => { ... })` loop na de `colorCodeSet`-verzameling (regel 851-857), voeg toe:

```typescript
    // Collect all unique sizeDisplay values for size filter
    const allSizes = new Set<string>();
    for (const cg of m.colorGroups) {
      for (const v of cg.variants) {
        if (v.sizeDisplay) allSizes.add(v.sizeDisplay);
      }
    }
```

En in het return-object (na `colorCodeSet: ...`):

```typescript
      sizeSet: allSizes.size > 0 ? Array.from(allSizes) : undefined,
```

- [ ] **Stap 3: Voeg `sizeSet` toe aan de frontend `ModelSummary` type**

In `src/types/summary.ts`, voeg toe aan `ModelSummary` (na `colorCodeSet`):

```typescript
  /** All unique sizeDisplay values across all variants. Used for client-side size filtering. */
  sizeSet?: string[];
```

- [ ] **Stap 4: Verifieer type-check**

```bash
cd workwear-showcase && npm run type-check
```

Verwacht: geen fouten.

- [ ] **Stap 5: Commit**

```bash
git add scripts/sync-products.ts src/types/summary.ts
git commit -m "feat(summary): voeg sizeSet toe aan ModelSummary voor maatfilter"
```

---

### Task 2: `size-filter-utils.ts`

**Files:**
- Create: `src/lib/size-filter-utils.ts`

**Interfaces:**
- Consumes: `ModelSummary.sizeSet?: string[]` (uit Task 1)
- Produces:
  - `type SizeGroup = 'confectie' | 'numeriek' | 'broek' | 'overig'`
  - `type SizeGroupMap = Record<SizeGroup, string[]>` (gesorteerd)
  - `classifySizeGroup(size: string): SizeGroup`
  - `buildSizeGroups(models: ModelSummaryLike[]): SizeGroupMap`
  - `modelMatchesSizeFilter(model: ModelSummaryLike, selected: Set<string>): boolean`
  - `parseSizeParam(param: string): Set<string>`
  - `serializeSizeParam(selected: Set<string>): string`

- [ ] **Stap 1: Maak het bestand aan**

```typescript
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
  return sizes.sort((a, b) => {
    const ia = CONFECTIE_ORDER.indexOf(a.toUpperCase());
    const ib = CONFECTIE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function sortNumeriek(sizes: string[]): string[] {
  return sizes.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function sortBroek(sizes: string[]): string[] {
  return sizes.sort((a, b) => {
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
```

- [ ] **Stap 2: Verifieer type-check**

```bash
npm run type-check
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/lib/size-filter-utils.ts
git commit -m "feat(size-filter): voeg size-filter-utils.ts toe"
```

---

### Task 3: `SizeFilter.tsx` component

**Files:**
- Create: `src/components/search/SizeFilter.tsx`

**Interfaces:**
- Consumes:
  - `SizeGroupMap` van `size-filter-utils.ts` (Task 2)
  - `Set<string>` selected sizes
  - `onChange: (sizes: Set<string>) => void`
- Produces: `<SizeFilter>` component

- [ ] **Stap 1: Maak het component aan**

```typescript
// src/components/search/SizeFilter.tsx
'use client';

import type { SizeGroupMap, SizeGroup } from '@/lib/size-filter-utils';

interface SizeFilterProps {
  available: SizeGroupMap;
  selected: Set<string>;
  onChange: (sizes: Set<string>) => void;
}

const GROUP_LABELS: Record<SizeGroup, string> = {
  confectie: 'Confectie',
  numeriek: 'Numeriek (EU)',
  broek: 'Broeksmaten',
  overig: 'Overig',
};

const GROUP_ORDER: SizeGroup[] = ['confectie', 'numeriek', 'broek', 'overig'];

export function SizeFilter({ available, selected, onChange }: SizeFilterProps) {
  const visibleGroups = GROUP_ORDER.filter((g) => available[g].length > 0);

  if (visibleGroups.length === 0) return null;

  function toggle(size: string) {
    const next = new Set(selected);
    if (next.has(size)) next.delete(size);
    else next.add(size);
    onChange(next);
  }

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Maat
      </h2>

      <div className="flex flex-col gap-2">
        {visibleGroups.map((group) => {
          const sizes = available[group];
          const activeInGroup = sizes.filter((s) => selected.has(s)).length;

          return (
            <div key={group} className="rounded border border-gray-200 overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between bg-gray-50 px-2 py-1.5 border-b border-gray-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {GROUP_LABELS[group]}
                </span>
                {activeInGroup > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white">
                    {activeInGroup}
                  </span>
                )}
              </div>

              {/* Scrollable size list */}
              <div className="max-h-28 overflow-y-auto">
                {sizes.map((size) => {
                  const isSelected = selected.has(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggle(size)}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                        isSelected ? 'bg-gray-50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-gray-900 bg-gray-900'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="h-2.5 w-2.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}>
                        {size}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Stap 2: Verifieer type-check en lint**

```bash
npm run type-check && npm run lint
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/components/search/SizeFilter.tsx
git commit -m "feat(size-filter): voeg SizeFilter component toe"
```

---

### Task 4: Integreer in `search/page.tsx` en `FilterBottomSheet.tsx`

**Files:**
- Modify: `src/app/search/page.tsx`
- Modify: `src/components/search/FilterBottomSheet.tsx`

**Interfaces:**
- Consumes:
  - `SizeFilter` component (Task 3)
  - `buildSizeGroups`, `modelMatchesSizeFilter`, `parseSizeParam`, `serializeSizeParam` (Task 2)
  - `SizeGroupMap` type (Task 2)

- [ ] **Stap 1: Voeg imports toe aan `search/page.tsx`**

Voeg toe boven de bestaande imports:

```typescript
import { SizeFilter } from '@/components/search/SizeFilter';
import {
  buildSizeGroups,
  modelMatchesSizeFilter,
  parseSizeParam,
  serializeSizeParam,
  type SizeGroupMap,
} from '@/lib/size-filter-utils';
```

- [ ] **Stap 2: Voeg size filter state toe (na `fluorescentActive` state, regel ~85)**

```typescript
  // Size filter
  const sizesParam = searchParams.get('sizes') ?? '';
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(
    () => parseSizeParam(sizesParam)
  );
```

- [ ] **Stap 3: Voeg `sizeFilteredModels` toe aan de filter pipeline (na `specialFilteredModels`, rond regel 167)**

```typescript
  // Size-filtered models (OR: model zichtbaar als minstens één variant de maat heeft)
  const sizeFilteredModels = useMemo(() => {
    if (selectedSizes.size === 0) return specialFilteredModels;
    return specialFilteredModels.filter((m) => modelMatchesSizeFilter(m, selectedSizes));
  }, [specialFilteredModels, selectedSizes]);
```

- [ ] **Stap 4: Voeg `sizesForFilter` useMemo toe (na `sizeFilteredModels`)**

`available` wordt berekend uit `specialFilteredModels` (vóór maatfilter) zodat de opties meeschrompelen bij merk/kleur-filter maar de geselecteerde maten zelf nooit verdwijnen:

```typescript
  const sizesForFilter = useMemo((): SizeGroupMap => {
    return buildSizeGroups(specialFilteredModels);
  }, [specialFilteredModels]);
```

- [ ] **Stap 5: Voeg `handleSizeToggle` handler toe (na `handleToggleFluorescent`)**

```typescript
  const handleSizeToggle = useCallback(
    (sizes: Set<string>) => {
      setSelectedSizes(sizes);
      syncUrl({ sizes: sizes.size > 0 ? serializeSizeParam(sizes) : null });
    },
    [syncUrl],
  );
```

- [ ] **Stap 6: Voeg size chips toe aan active filter chips sectie**

In het chips-blok (rond regel 486), voeg toe na de brand chips:

```typescript
                {/* Size filter chips */}
                {[...selectedSizes].map((size) => (
                  <span
                    key={size}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
                  >
                    {size}
                    <button
                      onClick={() => {
                        const next = new Set(selectedSizes);
                        next.delete(size);
                        handleSizeToggle(next);
                      }}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                      aria-label={`Maat ${size} verwijderen`}
                    >
                      &#x2715;
                    </button>
                  </span>
                ))}
```

- [ ] **Stap 7: Voeg `SizeFilter` toe aan de sidebar (na `BrandFilter` in de aside)**

```typescript
              <hr className="my-4 border-gray-200" />

              <SizeFilter
                available={sizesForFilter}
                selected={selectedSizes}
                onChange={handleSizeToggle}
              />
```

- [ ] **Stap 8: Vervang `specialFilteredModels` door `sizeFilteredModels` in de render-secties**

Zoek alle plekken waar `specialFilteredModels` gebruikt wordt als de te tonen modellen (niet als input voor counts) en vervang door `sizeFilteredModels`:

- `leafCounts` useMemo: blijft `specialFilteredModels` (category counts vóór maatfilter)
- `browseModels` useMemo: verander `specialFilteredModels` → `sizeFilteredModels`
- De "Alle producten" teller en `VirtualGrid` in de default render-sectie: verander naar `sizeFilteredModels`
- `filteredResults` useMemo: voeg size-filter toe na de hi-vis/fluorescent checks:

```typescript
    if (selectedSizes.size > 0) {
      filtered = filtered.filter((r) => {
        const model = getBySlug(r.slug);
        return model && modelMatchesSizeFilter(model, selectedSizes);
      });
    }
```

- [ ] **Stap 9: Update `activeFilterCount`**

```typescript
  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    selectedColors.size +
    selectedBrands.size +
    selectedSizes.size +
    (hiVisActive ? 1 : 0) +
    (fluorescentActive ? 1 : 0);
```

- [ ] **Stap 10: Pas de chips-conditie aan (regel ~486)**

De huidige conditie `if (selectedCategoryNode || colorFilterGroups.length > 0 || selectedBrands.size > 0 || hiVisActive || fluorescentActive)` uitbreiden met `selectedSizes.size > 0`:

```typescript
            {(selectedCategoryNode || colorFilterGroups.length > 0 || selectedBrands.size > 0 || selectedSizes.size > 0 || hiVisActive || fluorescentActive) && (
```

- [ ] **Stap 11: Update `FilterBottomSheet.tsx` — props interface**

Voeg toe aan de `FilterBottomSheetProps` interface:

```typescript
  // Sizes
  availableSizes: SizeGroupMap;
  selectedSizes: Set<string>;
  onSizeChange: (sizes: Set<string>) => void;
```

Voeg ook toe aan de imports bovenaan:

```typescript
import { SizeFilter } from '@/components/search/SizeFilter';
import type { SizeGroupMap } from '@/lib/size-filter-utils';
```

- [ ] **Stap 12: Destructure en render `SizeFilter` in `FilterBottomSheet`**

Voeg de nieuwe props toe aan de destructuring en render de component in het scrollable gedeelte (na `BrandFilter`):

```typescript
// Destructuring toevoegen:
  availableSizes,
  selectedSizes,
  onSizeChange,

// In JSX, na de BrandFilter sectie:
          <hr className="border-gray-200" />

          {/* Maten */}
          <SizeFilter
            available={availableSizes}
            selected={selectedSizes}
            onChange={onSizeChange}
          />
```

- [ ] **Stap 13: Pas de `<FilterBottomSheet>` aanroep in `search/page.tsx` aan**

Voeg de drie nieuwe props toe aan de `<FilterBottomSheet>` render:

```typescript
        availableSizes={sizesForFilter}
        selectedSizes={selectedSizes}
        onSizeChange={handleSizeToggle}
```

- [ ] **Stap 14: Verifieer type-check en lint**

```bash
npm run type-check && npm run lint
```

Verwacht: geen fouten.

- [ ] **Stap 15: Commit**

```bash
git add src/app/search/page.tsx src/components/search/FilterBottomSheet.tsx
git commit -m "feat(search): integreer maatfilter in zoekpagina en bottom sheet"
```

---

### Task 5: E2E verificatie

**Files:**
- Test: bestaande Playwright setup (`playwright.config.ts`, `tests/`)

- [ ] **Stap 1: Start de dev server**

```bash
npm run dev:offline
```

Verwacht: server draait op `http://localhost:8500`

- [ ] **Stap 2: Open de zoekpagina en verifieer het maatfilter**

Ga naar `http://localhost:8500/search/`

Controleer:
- [ ] Maatfilter zichtbaar in sidebar (desktop)
- [ ] Groepen "Confectie", "Numeriek (EU)" en/of "Broeksmaten" aanwezig
- [ ] Klikken op een maat selecteert hem (checkbox gevuld)
- [ ] Aantal producten in de grid verminkt na selectie
- [ ] Active filter chip verschijnt boven het grid
- [ ] Chip-klik verwijdert de maat
- [ ] URL bevat `?sizes=M` of vergelijkbaar na selectie
- [ ] Mobiel: Filterknop → Maat zichtbaar in bottom sheet

- [ ] **Stap 3: Verifieer URL-persistentie**

Ga naar `http://localhost:8500/search/?sizes=M,XL` — beide maten moeten geselecteerd zijn na laden.

- [ ] **Stap 4: Commit als alles werkt**

```bash
git add .
git commit -m "test(size-filter): visuele verificatie maatfilter geslaagd"
```

> **Opmerking:** `sizeSet` in de JSON is pas actief na een `npm run sync` of `npm run dev:offline` (die fixtures laadt). Bij dev:offline worden fixture-data gebruikt; controleer of de fixtures `sizeSet` bevatten. Als ze dat niet doen, zie 'Sync-note' hieronder.

**Sync-note:** Na de wijzigingen aan `sync-products.ts` moeten de summary-bestanden opnieuw gegenereerd worden. In productie gebeurt dit via `npm run sync:deploy`. Lokaal: `npm run dev:offline` laadt fixtures die al `sizeSet` kunnen bevatten als de fixture-generator bijgewerkt is, anders run `npm run sync:dry-run` om te controleren.

---

## Volgorde

1. Task 1 (sizeSet in sync + types) — fundament
2. Task 2 (utils) — puur logica, geen UI-dependencies
3. Task 3 (SizeFilter component) — bouwt op utils
4. Task 4 (integratie page + bottom sheet) — bouwt op alle voorgaande
5. Task 5 (E2E verificatie) — sluitstuk
