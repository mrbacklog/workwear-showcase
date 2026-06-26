# Design: Showcase Maatfilter

**Datum:** 2026-06-23
**Status:** Goedgekeurd voor implementatie

---

## Probleemstelling

De showcase heeft al filters voor merk, kleur en hi-vis. Maat ontbreekt. Bezoekers kunnen niet filteren op confectiemaat, EU-numerieke maat of broeksmaat — een basisbehoefte in workwear.

## Beslissingen

| Vraag | Beslissing |
|-------|-----------|
| Filter semantiek | Model zichtbaar als het **minstens één variant** heeft met de geselecteerde maat (OR over varianten) |
| UI-stijl | Per-groep scrollbaar kader met checkboxen (geen pills) |
| Groepen | Confectie · Numeriek · Broeksmaten · Overig (alleen indien aanwezig) |
| Producttelling per maat | Niet in v1 |
| Backend aanpassing | Geen — `sizeDisplay` zit al in model-cards JSON |

---

## Architectuur

### Data flow

`sizeDisplay` zit al in elke variant in `model-cards-{N}.json`. De filterpagina gebruikt echter `ModelSummary` (geladen uit `model-summary-core.json`), niet de volledige model-cards. De summary bevat momenteel geen maatdata.

**Oplossing:** `scripts/sync-products.ts` (showcase repo) verzamelt al `colorCodeSet` — op dezelfde wijze voegen we `sizeSet: string[]` toe: alle unieke `sizeDisplay`-waarden van alle varianten van een model.

Geen wijzigingen aan het Python backend (`showcase_export.py`). Alles zit in de showcase repo.

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/lib/size-filter-utils.ts` | Groepsclassificatie, sortering, filterlogica |
| `src/components/search/SizeFilter.tsx` | UI-component |

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|----------|
| `scripts/sync-products.ts` | `ModelSummary` interface + `sizeSet` collectie in summary-generatie |
| `src/types/summary.ts` | `sizeSet?: string[]` toevoegen aan `ModelSummary` |
| `src/app/search/page.tsx` | State, URL-sync, filterpipeline uitbreiden |
| `src/components/search/FilterBottomSheet.tsx` | SizeFilter integreren in mobiel panel |

---

## Groepsclassificatie (`size-filter-utils.ts`)

Elke `sizeDisplay`-waarde wordt via regex geclassificeerd:

| Groep | Regex-patroon | Voorbeelden | Sortering |
|-------|--------------|-------------|-----------|
| `confectie` | `/^(XS|S|M|L|XL|XXL|\d+XL)$/i` | XS, M, 3XL | Vaste volgorde: XS→S→M→L→XL→XXL→3XL→4XL→5XL |
| `numeriek` | `/^\d{2,3}$/` (getal 28–70) | 44, 50, 62 | Numeriek oplopend |
| `broek` | `/^W\d+\/L\d+$/i` of `/^\d+\/\d+$/` | W32/L34, 32/34 | Op taille (eerste getal) oplopend |
| `overig` | alles wat niet matcht | One size, FR 42 | Alfabetisch |

Groepen worden alleen getoond als ze minstens één beschikbare maat bevatten.

### Exporteerde functies

```ts
// Classificeert één sizeDisplay-waarde naar groep
export function classifySizeGroup(size: string): SizeGroup

// Geeft alle unieke sizeDisplay-waarden voor een modelset, gegroepeerd en gesorteerd
export function buildSizeGroups(models: ModelLike[]): SizeGroupMap

// Controleert of een model de gezochte maten heeft (OR-logica)
export function modelMatchesSizeFilter(model: ModelLike, selected: Set<string>): boolean

// URL serialisatie/deserialisatie
export function parseSizeParam(param: string): Set<string>
export function serializeSizeParam(selected: Set<string>): string
```

---

## Component: SizeFilter

```ts
interface SizeFilterProps {
  available: SizeGroupMap   // berekend uit huidige gefilterde modelset (brand/kleur/hi-vis reeds toegepast)
  selected: Set<string>
  onChange: (sizes: Set<string>) => void
}
```

### Visueel gedrag

- Per groep: een scrollbaar kader (`max-height: ~120px, overflow-y: auto`) met label (bijv. "Confectie") als header
- Elke maat: checkbox + label, checkbox-rij is 32px hoog voor touch
- Geselecteerde maat: gevulde checkbox, vette tekst
- Actieve selectie in een groep toont een kleine badge in de header ("2 geselecteerd")
- Lege staat (niets geselecteerd) = geen filter actief
- Groepen met nul beschikbare maten worden niet getoond

### Stijl

Consistent met bestaande filtercomponenten (Tailwind, geen extra dependencies).

---

## Filterpipeline (`search/page.tsx`)

Volgorde na deze wijziging:

```
visibleModels          (auth: core-only of alles)
  → brandFilteredModels      (merk)
  → colorFilteredModels      (kleur AND/OR-groepen)
  → specialFilteredModels    (hi-vis / fluorescent)
  → sizeFilteredModels       ← NIEUW
  → categorie + zoekquery
```

`available` in SizeFilter wordt berekend uit `specialFilteredModels` (vóór maatfilter), zodat de beschikbare maatopties meeschrompelen als je eerst op merk of kleur filtert.

### URL-parameter

`?sizes=M%2CXL%2CW32%2FL34` — komma-gescheiden `sizeDisplay`-waarden, elk `encodeURIComponent`-encoded.

---

## Mobiel: FilterBottomSheet

SizeFilter wordt toegevoegd aan het bestaande mobiele filterpanel naast merk, kleur en hi-vis. Geen structurele wijziging aan de bottom sheet — alleen de nieuwe component toevoegen.

---

## Wat niet in v1 zit

- Producttelling per maat (later)
- Schoenmaatgroep (later, aparte regex als leveranciers dit aanleveren)
- Geslacht-, materiaal- of normfilters (apart traject)
