/**
 * Maatvolgorde voor de showcase.
 *
 * Spiegelt backend/app/shared/utils/size_sort.py in het platform, zodat de
 * showcase dezelfde volgorde toont als de export levert. Maten worden in vier
 * groepen ingedeeld:
 *
 *   0. standaardmaten   XXS < XS < S < M < L < XL < 2XL < … < 6XL
 *   1. puur numeriek    44 < 46 < 48
 *   2. taille/been      W28/L30 < W28/L32 < W30/L30
 *   3. overig           natuurlijk: C44 < C46 < C100
 *
 * Groep 3 sorteert natuurlijk en niet alfabetisch: ruim een kwart van de
 * varianten in de catalogus zijn confectiematen (C44–C64, D84–D120) of
 * kindermaten (122/128), en daar zet een tekstsortering "C100" vóór "C44".
 */

const SIZE_ORDER: Record<string, number> = {
  XXS: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5,
  '2XL': 6, '3XL': 7, '4XL': 8, '5XL': 9, '6XL': 10,
};

const SIZE_ALIAS: Record<string, string> = {
  '2XS': 'XXS',
  XXL: '2XL',
  XXXL: '3XL',
  XXXXL: '4XL',
  XXXXXL: '5XL',
  XXXXXXL: '6XL',
};

const WAIST_LEG = /^W(\d+)[\s/-]*L?(\d+)$/;

type SizeKey = {
  group: number;
  primary: number;
  secondary: number;
  tokens: Array<{ isNumber: boolean; num: number; text: string }>;
};

/** Splitst "C46" in tekst- en getal-tokens, zodat C46 < C100. */
function naturalTokens(value: string): SizeKey['tokens'] {
  return value
    .split(/(\d+)/)
    .filter((part) => part !== '')
    .map((part) =>
      /^\d+$/.test(part)
        ? { isNumber: true, num: parseInt(part, 10), text: '' }
        : { isNumber: false, num: 0, text: part }
    );
}

function sizeKey(size: string): SizeKey {
  const normalised = (size ?? '').trim().toUpperCase();
  if (!normalised) return { group: 4, primary: 0, secondary: 0, tokens: [] };

  const canonical = SIZE_ALIAS[normalised] ?? normalised;
  const rank = SIZE_ORDER[canonical];
  if (rank !== undefined) return { group: 0, primary: rank, secondary: 0, tokens: [] };

  if (/^\d+$/.test(normalised)) {
    return { group: 1, primary: parseInt(normalised, 10), secondary: 0, tokens: [] };
  }

  const waistLeg = WAIST_LEG.exec(normalised);
  if (waistLeg) {
    return {
      group: 2,
      primary: parseInt(waistLeg[1], 10),
      secondary: parseInt(waistLeg[2], 10),
      tokens: [],
    };
  }

  return { group: 3, primary: 0, secondary: 0, tokens: naturalTokens(normalised) };
}

export function compareSizes(a: string, b: string): number {
  const ka = sizeKey(a);
  const kb = sizeKey(b);

  if (ka.group !== kb.group) return ka.group - kb.group;
  if (ka.primary !== kb.primary) return ka.primary - kb.primary;
  if (ka.secondary !== kb.secondary) return ka.secondary - kb.secondary;

  const len = Math.min(ka.tokens.length, kb.tokens.length);
  for (let i = 0; i < len; i++) {
    const ta = ka.tokens[i];
    const tb = kb.tokens[i];
    // Tekst sorteert vóór een getal op dezelfde positie.
    if (ta.isNumber !== tb.isNumber) return ta.isNumber ? 1 : -1;
    if (ta.isNumber) {
      if (ta.num !== tb.num) return ta.num - tb.num;
    } else if (ta.text !== tb.text) {
      return ta.text.localeCompare(tb.text);
    }
  }
  return ka.tokens.length - kb.tokens.length;
}
