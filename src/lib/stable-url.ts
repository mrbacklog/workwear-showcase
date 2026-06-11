/**
 * Stabiele Showcase-URL helpers — gedeeld door de sync (writer) en de edge Function (reader).
 * Spiegelt de backend `parse_showcase_tail` / URL-bouwers.
 *
 * URL-vorm: /product/{leesbaar}-{staart}. Alleen de STAART resolvet:
 *   - 13-cijferige EAN  -> level 'ean'   (model + kleur + maat)
 *   - 'm' + public_id   -> level 'model' (kale modelpagina, canoniek)
 *   - 'c' + cv_hex      -> level 'color' (model + kleur)
 */
export type TailLevel = 'ean' | 'model' | 'color';

export interface ParsedTail {
  level: TailLevel;
  key: string;
}

const EAN_RE = /^\d{13}$/;
/** Hex-only, minimum 4 chars (UUID hex without dashes = 32 chars; shortest practical CV id >= 4). */
const CV_HEX_RE = /^[0-9a-f]{4,}$/i;
/** Alphanumeric public_id (base62-style), minimum 4 chars. */
const MODEL_ID_RE = /^[0-9a-zA-Z]{4,}$/;

/** Parse the last '-'-segment of a slug/tail into a level+key, or null if not a stable tail. */
export function parseShowcaseTail(slugOrTail: string): ParsedTail | null {
  const tail = slugOrTail.split('-').pop() ?? '';
  if (EAN_RE.test(tail)) return { level: 'ean', key: tail };
  if (tail.charAt(0) === 'm') {
    const key = tail.slice(1);
    if (MODEL_ID_RE.test(key)) return { level: 'model', key };
  }
  if (tail.charAt(0) === 'c') {
    const key = tail.slice(1);
    if (CV_HEX_RE.test(key)) return { level: 'color', key };
  }
  return null;
}

/**
 * Shard bucket for the lookup files. MUST be identical in the sync writer and the
 * Function reader. Uses the last 2 chars of the tail, lowercased and sanitised.
 */
export function shardOf(tail: string): string {
  const raw = tail.length >= 2 ? tail.slice(-2) : tail;
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return cleaned.length > 0 ? cleaned : '_';
}

/** The lookup value the Function needs to build the redirect target. */
export interface UrlLookupEntry {
  /** Canonical readable model slug (the existing static page). */
  slug: string;
  /** colorRaw to preselect via ?color= (omitted for model-level). */
  color?: string;
  /** sizeRaw to preselect via ?size= (only for ean-level). */
  size?: string;
}

import type { ShowcaseModel } from '@/types/product';

/**
 * Build the stable-URL lookup, grouped by shard. Key = the exact URL tail:
 *   - bare EAN (13 digits)        -> { slug, color, size }
 *   - 'c' + colorVariantId.hex    -> { slug, color }
 *   - 'm' + modelPublicId         -> { slug }
 * Returns shard -> { tail -> entry }. Pure (no IO) so it is unit-testable.
 */
export function buildUrlLookup(
  models: ShowcaseModel[],
): Record<string, Record<string, UrlLookupEntry>> {
  const shards: Record<string, Record<string, UrlLookupEntry>> = {};
  const put = (tail: string, entry: UrlLookupEntry): void => {
    const shard = shardOf(tail);
    (shards[shard] ??= {})[tail] = entry;
  };
  for (const model of models) {
    if (model.modelPublicId) {
      put(`m${model.modelPublicId}`, { slug: model.slug });
    }
    for (const cg of model.colorGroups) {
      if (cg.colorVariantId) {
        const hex = cg.colorVariantId.replace(/-/g, '');
        put(`c${hex}`, { slug: model.slug, color: cg.colorRaw });
      }
      for (const v of cg.variants) {
        if (v.ean) {
          put(v.ean, { slug: model.slug, color: cg.colorRaw, size: v.sizeRaw });
        }
      }
    }
  }
  return shards;
}
