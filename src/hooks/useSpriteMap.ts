'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SpriteMap, ModelSpriteEntry, EmbeddedSpriteInfo } from '@/types/product';

/** Global singleton: loaded once, shared across all components */
let cachedSpriteMap: SpriteMap | null = null;
let loadPromise: Promise<SpriteMap> | null = null;

async function loadSpriteMap(): Promise<SpriteMap> {
  if (cachedSpriteMap) return cachedSpriteMap;
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/data/sprite-map.json')
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load sprite-map.json: ${res.status}`);
      return res.json() as Promise<SpriteMap>;
    })
    .then((data) => {
      cachedSpriteMap = data;
      return data;
    });

  return loadPromise;
}

/** Preload a sprite image into browser cache */
function preloadImage(url: string): void {
  if (typeof window === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = 'image';
  document.head.appendChild(link);
}

export interface SpriteInfo {
  /** Thumb sprite URL */
  thumbSrc: string;
  /** Full sprite URL */
  fullSrc: string;
  /** CSS background-position for thumb (percentage-based) */
  thumbPos: string;
  /** CSS background-position for full (percentage-based) */
  fullPos: string;
  /** CSS background-size for thumb sprite */
  thumbSize: string;
  /** CSS background-size for full sprite */
  fullSize: string;
  /** Original image URL (backend API) */
  originalUrl: string;
}

export function useSpriteMap() {
  const [spriteMap, setSpriteMap] = useState<SpriteMap | null>(cachedSpriteMap);
  const [isLoading, setIsLoading] = useState(!cachedSpriteMap);

  useEffect(() => {
    if (cachedSpriteMap) {
      setSpriteMap(cachedSpriteMap);
      setIsLoading(false);
      return;
    }
    loadSpriteMap().then((data) => {
      setSpriteMap(data);
      setIsLoading(false);
    });
  }, []);

  /**
   * Build SpriteInfo from embedded sprite data (no sprite-map.json needed).
   * Used when model-cards have been synced with embedded sprite coordinates.
   */
  const getSpriteInfoFromEmbedded = useCallback(
    (embedded: EmbeddedSpriteInfo, imageKey: string, imageBase?: string): SpriteInfo => {
      const { col, row, cols: spriteCols, rows: spriteRows, thumbSrc, fullSrc } = embedded;

      const posX = spriteCols <= 1 ? '0%' : `${(col / (spriteCols - 1)) * 100}%`;
      const posY = spriteRows <= 1 ? '0%' : `${(row / (spriteRows - 1)) * 100}%`;

      const lastDash = imageKey.lastIndexOf('-');
      const ean = imageKey.substring(0, lastDash);
      const seq = imageKey.substring(lastDash + 1);
      const base = imageBase ?? spriteMap?.imageBase ?? '';

      return {
        thumbSrc,
        fullSrc,
        thumbPos: `${posX} ${posY}`,
        fullPos: `${posX} ${posY}`,
        thumbSize: `${spriteCols * 100}% ${spriteRows * 100}%`,
        fullSize: `${spriteCols * 100}% ${spriteRows * 100}%`,
        originalUrl: base ? `${base}/${ean}/${seq}?size=original` : '',
      };
    },
    [spriteMap],
  );

  /** Get sprite info for a specific image within a model.
   *
   * Accepts an optional embedded sprite object. When present, it is used
   * directly and the sprite-map.json fallback is skipped, which means the
   * hook does not need to be loaded at all for those images.
   */
  const getSpriteInfo = useCallback(
    (
      slug: string,
      imageKey: string,
      embedded?: EmbeddedSpriteInfo | null,
    ): SpriteInfo | null => {
      // Fast path: use embedded sprite data from model-cards
      if (embedded) {
        return getSpriteInfoFromEmbedded(embedded, imageKey);
      }

      // Fallback: look up in sprite-map.json (backwards compatibility)
      if (!spriteMap) return null;
      const entry = spriteMap.models[slug];
      if (!entry) return null;
      const pos = entry.img[imageKey];
      if (!pos) return null;

      const [col, row] = pos;
      // Brand sprites: thumb and full share the same grid layout (cols × rows)
      const spriteCols = entry.cols;
      const spriteRows = entry.rows ?? Math.ceil(Object.keys(entry.img).length / spriteCols);

      // Percentage-based background-position
      const posX = spriteCols <= 1 ? '0%' : `${(col / (spriteCols - 1)) * 100}%`;
      const posY = spriteRows <= 1 ? '0%' : `${(row / (spriteRows - 1)) * 100}%`;

      // Parse ean and seq from key "ean-seq"
      const lastDash = imageKey.lastIndexOf('-');
      const ean = imageKey.substring(0, lastDash);
      const seq = imageKey.substring(lastDash + 1);

      return {
        thumbSrc: entry.t,
        fullSrc: entry.f,
        thumbPos: `${posX} ${posY}`,
        fullPos: `${posX} ${posY}`,
        thumbSize: `${spriteCols * 100}% ${spriteRows * 100}%`,
        fullSize: `${spriteCols * 100}% ${spriteRows * 100}%`,
        originalUrl: `${spriteMap.imageBase}/${ean}/${seq}?size=original`,
      };
    },
    [spriteMap, getSpriteInfoFromEmbedded],
  );

  /** Get the model sprite entry for prefetching */
  const getModelEntry = useCallback(
    (slug: string): ModelSpriteEntry | null => {
      if (!spriteMap) return null;
      return spriteMap.models[slug] ?? null;
    },
    [spriteMap],
  );

  /** Prefetch full sprite for a model (call on hover) */
  const prefetchFullSprite = useCallback(
    (slug: string): void => {
      if (!spriteMap) return;
      const entry = spriteMap.models[slug];
      if (entry) preloadImage(entry.f);
    },
    [spriteMap],
  );

  return {
    spriteMap,
    isLoading,
    getSpriteInfo,
    getModelEntry,
    prefetchFullSprite,
  };
}
