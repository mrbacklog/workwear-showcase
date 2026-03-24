import type { ColorGroup, ShowcaseModel } from '@/types/product';

/**
 * Color filter group: an array of color codes that must ALL be present (AND).
 * Multiple groups use OR logic between them.
 */
export type ColorFilterGroup = string[];

/** Get all color codes from a color group (primary + secondary + tertiary). */
export function getColorCodes(cg: ColorGroup): string[] {
  const codes: string[] = [];
  if (cg.colorCode) codes.push(cg.colorCode);
  if (cg.secondaryCode) codes.push(cg.secondaryCode);
  if (cg.tertiaryCode) codes.push(cg.tertiaryCode);
  return codes;
}

/** Collect all unique color codes across all color groups of a model. */
export function getAllModelColorCodes(model: ShowcaseModel): Set<string> {
  const codes = new Set<string>();
  for (const cg of model.colorGroups) {
    for (const code of getColorCodes(cg)) {
      codes.add(code);
    }
  }
  return codes;
}

/**
 * Parse URL color param into filter groups.
 * Dot (.) = AND within group, comma (,) = OR between groups.
 *
 * "BLK.BLU,RED" → [['BLK','BLU'], ['RED']]
 * "BLK,RED"     → [['BLK'], ['RED']]         (backward compatible)
 * "BLK"         → [['BLK']]
 * ""            → []
 */
export function parseColorParam(param: string): ColorFilterGroup[] {
  if (!param) return [];
  return param
    .split(',')
    .filter(Boolean)
    .map((group) => group.split('.').filter(Boolean));
}

/**
 * Serialize filter groups to URL param.
 * [['BLK','BLU'], ['RED']] → "BLK.BLU,RED"
 */
export function serializeColorParam(groups: ColorFilterGroup[]): string {
  return groups
    .filter((g) => g.length > 0)
    .map((g) => [...g].sort().join('.'))
    .join(',');
}

/**
 * Derive a flat set of all selected color codes from filter groups.
 * Used for the ColorFilter swatch UI (which still operates as toggle).
 */
export function flattenColorGroups(groups: ColorFilterGroup[]): Set<string> {
  const set = new Set<string>();
  for (const g of groups) {
    for (const code of g) {
      set.add(code);
    }
  }
  return set;
}

/**
 * Check if a model matches the color filter groups.
 * OR between groups, AND within each group.
 *
 * Single-color groups: match if ANY colorGroup contains that color
 * (primary, secondary, or tertiary).
 *
 * AND groups (linked colors): match only if a SINGLE colorGroup
 * contains ALL linked colors. E.g., linking black+red means we want
 * variants that are literally black-red (both in one colorGroup),
 * not a model that has a black variant AND a separate red variant.
 */
export function modelMatchesColorFilter(
  model: ShowcaseModel,
  groups: ColorFilterGroup[],
): boolean {
  if (groups.length === 0) return true;

  return groups.some((group) => {
    if (group.length === 1) {
      // Single color: match across any colorGroup
      const code = group[0];
      return model.colorGroups.some((cg) => getColorCodes(cg).includes(code));
    }
    // AND group: a single colorGroup must contain ALL linked colors
    return model.colorGroups.some((cg) => {
      const cgCodes = getColorCodes(cg);
      return group.every((code) => cgCodes.includes(code));
    });
  });
}
