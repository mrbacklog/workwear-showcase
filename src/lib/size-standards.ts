'use client';

/**
 * Canonieke maatstandaarden per size-categorie.
 *
 * Bronnen:
 *  CONF  — werkkleding confectie-praktijk (XXS t/m 8XL)
 *  SHOE  — EU-schoenmaten (28–54, incl. halve maten)
 *  KIDS  — EN 13402 lichaamshoogten in cm (56–176)
 *  GLOVE — EN 420 handschoenmaten (4–12)
 *  HEAD  — hoofdomtrek in cm (51–63)
 *  BELT  — riemlente in cm (60–140)
 *
 * NUM en PANT hebben geen vaste standaard:
 *  NUM  valt terug op numerieke sortering
 *  PANT wordt gesorteerd op W dan L (zie sortBroeksmaten in size-filter-utils.ts)
 *
 * Combinatiematen ("110-116", "L-XL") staan NIET in de lijsten — de sort-logica
 * plaatst ze automatisch op positie(eersteComponent) + 0.5, dus altijd ná het
 * eerste en vóór het tweede enkelvoud.
 */

const CONF_ORDER: readonly string[] = [
  '3XS', 'XXS',
  'XS', 'XS-S', 'XS/S',
  'S', 'S-M', 'S/M',
  'M', 'M-L', 'M/L',
  'L', 'L-XL', 'L/XL',
  'XL', 'XL-XXL', 'XL/XXL',
  'XXL', 'XXL-3XL', 'XXL/3XL',
  '3XL', '3XL-4XL', '3XL/4XL',
  '4XL', '4XL-5XL', '4XL/5XL',
  '5XL', '5XL-6XL', '5XL/6XL',
  '6XL', '6XL-7XL', '6XL/7XL',
  '7XL', '7XL-8XL', '7XL/8XL',
  '8XL',
];

const SHOE_ORDER: readonly string[] = [
  '28', '29', '30', '31', '32', '33', '34',
  '35', '36', '37', '37.5', '38', '38.5', '39', '39.5',
  '40', '40.5', '41', '42', '42.5', '43', '44', '45',
  '46', '47', '48', '49', '50', '51', '52', '53', '54',
];

const KIDS_ORDER: readonly string[] = [
  '56', '62', '68', '74', '80', '86', '92', '98',
  '104', '110', '116', '122', '128', '134', '140',
  '146', '152', '158', '164', '170', '176',
];

// EN 420 handschoenmaten
const GLOVE_ORDER: readonly string[] = [
  '4', '5', '6', '7', '8', '9', '10', '11', '12',
];

// Hoofdomtrek in cm
const HEAD_ORDER: readonly string[] = [
  '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63',
];

// Riemlente in cm
const BELT_ORDER: readonly string[] = [
  '60', '65', '70', '75', '80', '85', '90', '95',
  '100', '105', '110', '115', '120', '125', '130', '135', '140',
];

export const SIZE_ORDER_MAP: Readonly<Record<string, readonly string[]>> = {
  CONF: CONF_ORDER,
  SHOE: SHOE_ORDER,
  KIDS: KIDS_ORDER,
  GLOVE: GLOVE_ORDER,
  HEAD: HEAD_ORDER,
  BELT: BELT_ORDER,
};

/**
 * Geeft de sorteerpositie van een maatwaarde binnen een categorie.
 *
 * - Directe match → index in standaard
 * - Combinatiemaat ("110-116", "L-XL") → index eerste component + 0.5
 * - Buiten standaard → standaard.length + numerieke waarde (achteraan)
 * - Geen standaard (NUM, PANT) → numerieke waarde of Infinity
 */
export function standardSortPosition(value: string, category: string): number {
  const order = SIZE_ORDER_MAP[category];

  if (!order) {
    const n = parseFloat(value);
    return isNaN(n) ? Infinity : n;
  }

  const direct = order.indexOf(value);
  if (direct >= 0) return direct;

  // Combinatiemaat: positie op basis van eerste component
  const sepIdx = value.search(/[-/]/);
  if (sepIdx > 0) {
    const first = value.slice(0, sepIdx);
    const firstPos = order.indexOf(first);
    if (firstPos >= 0) return firstPos + 0.5;
  }

  // Buiten standaard: achteraan, numeriek gesorteerd
  const n = parseFloat(value);
  return order.length + (isNaN(n) ? 9999 : n / 10000);
}

/**
 * Sorteert een array van typed filtersleutels ("CONF:L-XL", "SHOE:36")
 * op canonieke standaardvolgorde. De categorie wordt uit de sleutel geëxtraheerd.
 */
export function sortByStandard(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const aIdx = a.indexOf(':');
    const bIdx = b.indexOf(':');
    const catA = aIdx >= 0 ? a.slice(0, aIdx) : 'UNKNOWN';
    const catB = bIdx >= 0 ? b.slice(0, bIdx) : 'UNKNOWN';
    const valA = aIdx >= 0 ? a.slice(aIdx + 1) : a;
    const valB = bIdx >= 0 ? b.slice(bIdx + 1) : b;

    const posA = standardSortPosition(valA, catA);
    const posB = standardSortPosition(valB, catB);
    if (posA !== posB) return posA - posB;
    return valA.localeCompare(valB, 'nl', { numeric: true });
  });
}
