'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SpriteMap, ModelSpriteEntry } from '@/types/product';

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

  /** Get sprite info for a specific image within a model */
  const getSpriteInfo = useCallback(
    (slug: string, imageKey: string): SpriteInfo | null => {
      if (!spriteMap) return null;
      const entry = spriteMap.models[slug];
      if (!entry) return null;
      const pos = entry.img[imageKey];
      if (!pos) return null;

      const [col, row] = pos;
      const totalImages = Object.keys(entry.img).length;
      const fullCols = entry.cols;
      const fullRows = Math.ceil(totalImages / fullCols);
      const thumbCols = totalImages; // thumb sprites are single-row horizontal strips
      const thumbRows = 1;

      // Percentage-based background-position: col/(cols-1)*100% for multi-cell
      const thumbPosX = thumbCols <= 1 ? '0%' : `${(col / (thumbCols - 1)) * 100}%`;
      const thumbPosY = '0%';
      const fullPosX = fullCols <= 1 ? '0%' : `${(col / (fullCols - 1)) * 100}%`;
      const fullPosY = fullRows <= 1 ? '0%' : `${(row / (fullRows - 1)) * 100}%`;

      // Parse ean and seq from key "ean-seq"
      const lastDash = imageKey.lastIndexOf('-');
      const ean = imageKey.substring(0, lastDash);
      const seq = imageKey.substring(lastDash + 1);

      return {
        thumbSrc: entry.t,
        fullSrc: entry.f,
        thumbPos: `${thumbPosX} ${thumbPosY}`,
        fullPos: `${fullPosX} ${fullPosY}`,
        thumbSize: `${thumbCols * 100}% ${thumbRows * 100}%`,
        fullSize: `${fullCols * 100}% ${fullRows * 100}%`,
        originalUrl: `${spriteMap.imageBase}/${ean}/${seq}?size=original`,
      };
    },
    [spriteMap],
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
