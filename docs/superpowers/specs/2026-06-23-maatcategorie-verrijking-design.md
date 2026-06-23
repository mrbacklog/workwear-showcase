# Design: Maatcategorie-verrijking via brand pipeline

**Datum:** 2026-06-23
**Status:** Goedgekeurd voor implementatie

---

## Probleemstelling

De showcase maatfilter (gebouwd 2026-06-23) groepeert maten via regex-heuristieken in `size-filter-utils.ts`. Dit werkt voor confectie en broeksmaten, maar faalt voor:

1. **Schoenmaten vs. EU confectie** — "42" is ononderscheidbaar zonder context
2. **Kindermaten** — 68–176 (cm-gebaseerd) valt buiten het huidige numerieke bereik en belandt in "Overig"
3. **Overig-groep** — catch-all die geen filterwaarde heeft

De root cause: `ProductVariant.size_display` is een losse string zonder categorie-indicatie. De benodigde context (productcategorie) is pas beschikbaar ná categorisatie — precies het moment waarop de brand pipeline verrijking uitvoert.

---

## Gekozen oplossing

Voeg maatcategorie-toewijzing toe als verrijkingsstap in de brand pipeline, ná categorisatie. Op dat moment is de productcategorie bekend en kan "42" bij schoenen ondubbelzinnig als SHOE worden geclassificeerd.

### Waarom deze aanpak

- De `SizeCategory`-tabel bestaat al (CONF / SHOE / PANT / UNI / NUM / KIDS) met seed-data
- Volgt het bestaande patroon van de brand pipeline (kleur-normalisatie, categorisatie)
- Eenmalige opslag in de backend; alle consumers (showcase, toekomstige kanalen) profiteren
- Geen regex-heuristieken meer in de showcase

---

## Wat al bestaat (niet herbouwen)

| Component | Locatie | Inhoud |
|-----------|---------|--------|
| `SizeCategory` model | `backend/app/shared/models/size.py:19` | Codes CONF/SHOE/PANT/UNI/NUM/KIDS |
| `SizeValue` model | `backend/app/shared/models/size.py:46` | Individuele waarden per categorie |
| Seed data | `backend/alembic/versions/001_v1_consolidated.py:212–270` | Alle waarden per categorie |
| Brand pipeline | `backend/app/services/assortment/promotion_pipeline.py` | Fase 1–3 orchestratie |
| `size_display` veld | `backend/app/shared/models/product_variant.py:47` | Reeds gevuld door normalizer |
| Showcase `sizeSet` | `workwear-showcase/src/lib/size-filter-utils.ts` | Huidig werkende regex-filter |

---

## Architectuur

### Data flow (nieuw)

```
Import → size_display ingevuld (string, geen categorie)
  → Categorisatie (brand pipeline Fase 2) → product_category bekend
  → SizeCategoryEnrichment (nieuw, Fase 2b) → size_category_id opgeslagen
  → Showcase sync → sizeItems [{value, category}] geëxporteerd
  → Showcase filter → groepeert op categorie uit data (geen regex)
```

### Nieuwe filtergroepen in de showcase

| Groep | SizeCategory code | UI-label | Voorbeelden |
|-------|------------------|----------|-------------|
| confectie | CONF | Confectie | XS, S, M, L, L-XL, XL, XXL, 3XL |
| kledingmaten | NUM | Kledingmaten | 44, 46, 48, 50, 52 |
| schoenmaten | SHOE | Schoenmaten | 38, 39, 40, 41, 42, 43 |
| broeksmaten | PANT | Broeksmaten | W32/L34, 34/32 |
| kindermaten | KIDS | Kindermaten | 92, 104, 116, 128, 140 |

> **Overig-groep verdwijnt.** Maten die niet geclassificeerd zijn (UNI, onbekend) worden niet getoond in de filter.

---

## Nieuwe en gewijzigde bestanden

### Backend (platform monorepo)

| Bestand | Actie | Inhoud |
|---------|-------|--------|
| `backend/alembic/versions/<hash>_size_category_on_variant.py` | Aanmaken | Voeg nullable `size_category_id` FK toe aan `product_variants` |
| `backend/app/shared/models/product_variant.py` | Wijzigen | Voeg `size_category_id` + `size_category` relationship toe |
| `backend/app/services/size_normalization/category_mapping.py` | Aanmaken | Productcategorie → toegestane SizeCategory codes mapping |
| `backend/app/services/size_normalization/size_category_enrichment.py` | Aanmaken | `SizeCategoryEnrichmentService` klasse |
| `backend/app/services/assortment/promotion_pipeline.py` | Wijzigen | Roep `SizeCategoryEnrichmentService` aan na categorisatie |

### Showcase sync (`workwear-showcase`)

| Bestand | Actie | Inhoud |
|---------|-------|--------|
| `scripts/sync-products.ts` | Wijzigen | Exporteer `sizeItems` (waarde + categorie) i.p.v. `sizeSet` (losse strings) |
| `src/types/summary.ts` | Wijzigen | Vervang `sizeSet?: string[]` door `sizeItems?: SizeItem[]` |

### Showcase filter (`workwear-showcase`)

| Bestand | Actie | Inhoud |
|---------|-------|--------|
| `src/lib/size-filter-utils.ts` | Wijzigen | Gebruik `sizeItems` categorie, verwijder regex heuristieken; behoud fallback voor niet-verrijkte data |
| `src/components/search/SizeFilter.tsx` | Wijzigen | Nieuwe groepslabels en -volgorde (5 groepen, geen Overig) |

---

## Gedetailleerde specificaties per component

### 1. Migratie: `size_category_id` op `product_variants`

```python
# Nullable FK zodat bestaande + toekomstige niet-verrijkte varianten werken
op.add_column('product_variants',
    sa.Column('size_category_id', sa.Integer(),
              sa.ForeignKey('size_categories.id', ondelete='SET NULL'),
              nullable=True))
op.create_index('ix_product_variants_size_category_id',
                'product_variants', ['size_category_id'])
```

### 2. Productcategorie → maat-categorie mapping

Locatie: `backend/app/services/size_normalization/category_mapping.py`

```python
# Mapping: categorie-slug(s) → toegestane SizeCategory codes
# Bij één code: directe toewijzing
# Bij meerdere codes: kies op basis van size_display patroon
CATEGORY_SIZE_TYPES: dict[str, list[str]] = {
    "schoenen":             ["SHOE"],
    "veiligheidsschoenen":  ["SHOE"],
    "laarzen":              ["SHOE"],
    "broeken":              ["PANT", "NUM"],
    "werkbroeken":          ["PANT", "NUM"],
    "jassen":               ["CONF", "NUM"],
    "shirts":               ["CONF", "NUM"],
    "overalls":             ["CONF", "NUM"],
    "kinderkleding":        ["KIDS"],
    "handschoenen":         ["NUM", "CONF"],
}
# Fallback voor onbekende categorieën: gebruik regex (bestaande logica)
DEFAULT_FALLBACK = "regex"
```

> **Uitbreidbaar:** nieuwe categorieën toevoegen aan deze dict. Geen migratie nodig.

### 3. `SizeCategoryEnrichmentService`

Locatie: `backend/app/services/size_normalization/size_category_enrichment.py`

```python
class SizeCategoryEnrichmentService:
    async def enrich_brand(self, db: AsyncSession, brand_id: int) -> int:
        """
        Wijst size_category_id toe aan alle varianten van een merk
        waarvan size_display gevuld is maar size_category_id nog NULL.
        Retourneert aantal bijgewerkte varianten.
        """
```

**Logica per variant:**
1. Haal productcategorie op via `variant → product_model → product_category`
2. Zoek toegestane codes op uit `CATEGORY_SIZE_TYPES`
3. Bij één toegestane code → directe toewijzing
4. Bij meerdere codes → match `size_display` tegen `size_values` tabel per code; eerste match wint
5. Bij geen match of geen categorie → `size_category_id = NULL` (fallback naar regex in showcase)

### 4. Brand pipeline integratie

In `promotion_pipeline.py`, na de categorisatie-stap:

```python
from app.services.size_normalization.size_category_enrichment import SizeCategoryEnrichmentService

# Na categorisatie (Fase 2), vóór Fase 3
size_cat_service = SizeCategoryEnrichmentService()
await size_cat_service.enrich_brand(db, brand_id)
```

### 5. Showcase sync: `sizeItems` i.p.v. `sizeSet`

In `scripts/sync-products.ts`, in de summaries `.map()`:

```typescript
// Vervang sizeSet collectie door sizeItems
const sizeItems: Array<{value: string; category: string}> = [];
for (const cg of m.colorGroups) {
  for (const v of cg.variants) {
    if (v.sizeDisplay && v.sizeCategory) {
      sizeItems.push({ value: v.sizeDisplay, category: v.sizeCategory });
    } else if (v.sizeDisplay) {
      // Fallback: nog niet verrijkt, category onbekend
      sizeItems.push({ value: v.sizeDisplay, category: 'UNKNOWN' });
    }
  }
}
// Dedupliceer op value (houd eerste category)
const seen = new Set<string>();
const uniqueItems = sizeItems.filter(i => seen.has(i.value) ? false : (seen.add(i.value), true));
```

### 6. `ModelSummary` type update

```typescript
// src/types/summary.ts
export interface SizeItem {
  value: string;
  category: 'CONF' | 'SHOE' | 'PANT' | 'NUM' | 'KIDS' | 'UNKNOWN';
}

export interface ModelSummary {
  // ... bestaande velden ...
  /** @deprecated gebruik sizeItems */
  sizeSet?: string[];
  sizeItems?: SizeItem[];
}
```

> `sizeSet` tijdelijk behouden voor backwards-compatibiliteit tijdens de transitie.

### 7. `size-filter-utils.ts` update

```typescript
// Nieuw type
export type SizeGroup = 'confectie' | 'kledingmaten' | 'schoenmaten' | 'broeksmaten' | 'kindermaten';

// GROUP_ORDER (geen 'overig' meer)
export const GROUP_ORDER: SizeGroup[] = ['confectie', 'kledingmaten', 'schoenmaten', 'broeksmaten', 'kindermaten'];

// UI-labels per groep
export const GROUP_LABELS: Record<SizeGroup, string> = {
  confectie:    'Confectie',
  kledingmaten: 'Kledingmaten',
  schoenmaten:  'Schoenmaten',
  broeksmaten:  'Broeksmaten',
  kindermaten:  'Kindermaten',
};

// Mapping SizeCategory code → SizeGroup
const CATEGORY_TO_GROUP: Record<string, SizeGroup | null> = {
  CONF: 'confectie',
  SHOE: 'schoenmaten',
  PANT: 'broeksmaten',
  NUM:  'kledingmaten',
  KIDS: 'kindermaten',
  UNI:  null,      // niet tonen
  UNKNOWN: null,   // niet tonen (of fallback regex)
};

// buildSizeGroups gebruikt sizeItems.category i.p.v. regex
export function buildSizeGroups(models: ModelSummaryLike[]): SizeGroupMap { ... }
```

**Fallback voor UNKNOWN:** als category = 'UNKNOWN', pas de huidige `classifySizeGroup` regex toe als best-effort. Dit zorgt dat niet-verrijkte data nog steeds (deels) werkt.

### 8. Combinatiematen: classificatie en filterlogica

**Classificatie** — CONF-regex uitbreiden met `X-Y` patroon:

```typescript
// Herkent "L-XL", "S-M", "XL-XXL", "2XL-3XL" etc. als CONF
const COMBINATION_CONF = /^(XS|S|M|L|XL|XXL|\d+XL)-(XS|S|M|L|XL|XXL|\d+XL)$/i;
```

**Filterlogica** — `modelMatchesSizeFilter` expandeert combinatiematen bij het matchen:

```typescript
// "L-XL" → ["L-XL", "L", "XL"] — model matcht als gebruiker L, XL of L-XL selecteert
function expandSize(size: string): string[] {
  const match = size.match(/^(.+)-(.+)$/);
  if (match && isCombinationConfectie(size)) {
    return [size, match[1].toUpperCase(), match[2].toUpperCase()];
  }
  return [size];
}

export function modelMatchesSizeFilter(model: ModelSummaryLike, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  for (const item of model.sizeItems ?? []) {
    for (const expanded of expandSize(item.value)) {
      if (selected.has(expanded)) return true;
    }
  }
  return false;
}
```

**Sortering in CONF-groep** — combinatiematen sorteren ná hun laagste component:
`CONFECTIE_ORDER` uitbreiden met combinaties: `[..., 'L', 'L-XL', 'XL', 'XL-XXL', 'XXL', ...]`

**Backend** — `SizeCategoryEnrichmentService` herkent "L-XL" als CONF via dezelfde regex (exact match in `size_values` faalt → pattern-fallback classificeert als CONF).

---

## Afhankelijkheden en volgorde

```
Stap 1: Migratie (backend) — size_category_id op product_variants
Stap 2: SizeCategoryEnrichmentService (backend)
Stap 3: category_mapping.py (backend) — samen met Stap 2
Stap 4: Brand pipeline integratie (backend)
Stap 5: Deploy backend → Stap 5b: backfill bestaande merken via `python scripts/backfill_size_categories.py` (aan te maken als onderdeel van dit plan)
Stap 6: Showcase sync update (sizeItems exporteren)
Stap 7: ModelSummary type update (summary.ts)
Stap 8: size-filter-utils.ts + SizeFilter.tsx update (showcase filter)
Stap 9: Showcase sync draaien → deploy showcase
```

> Stap 1–5 zijn **platform monorepo** wijzigingen. Stap 6–9 zijn **workwear-showcase** wijzigingen.

---

## Risico's en mitigaties

| Risico | Mitigatie |
|--------|-----------|
| Bestaande varianten zonder categorie | `size_category_id` nullable + regex-fallback in showcase |
| Onbekende productcategorieën in mapping | `DEFAULT_FALLBACK = "regex"` — huidige gedrag blijft |
| UNI (One Size) verdwijnt uit filter | Bewuste keuze; geen actie |
| Showcase sync niet opnieuw gedraaid na backend deploy | Backfill script + handmatige sync trigger |
| `category_mapping.py` onvolledig bij nieuwe leverancier | Mapping uitbreidbaar zonder migratie; fallback vangt onbekende categorieën |

---

## Wat niet in scope is

- Schoenmaatgroepen voor kinderen (aparte regex, later)
- UI voor het beheren van de category_mapping (altijd via code)
- Terugschrijven van size_category naar Gripp of andere kanalen
- Verwijderen van `sizeSet` uit ModelSummary (pas na volledige migratie van alle consumers)
