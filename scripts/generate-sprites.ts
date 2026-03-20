/**
 * Sprite generation for showcase images.
 *
 * Combines images into BRAND-level sprite sheets using sharp.composite().
 * Both thumb (128px) and full (800px) sprites use the same grid layout (10 cols),
 * so one position map works for both. Large brands are chunked to stay within
 * WebP dimension limits (16383px). Max 20 rows per chunk at 800px = 16000px.
 *
 * Result: ~200-300 sprite files instead of ~11,000 per-model files.
 */
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const THUMB_CELL = 128;
export const FULL_CELL = 800;
export const SPRITE_COLS = 10; // Both thumb and full use 10 columns
export const WEBP_QUALITY = 82;
const WEBP_MAX_DIMENSION = 16383;
const MAX_ROWS_FULL = Math.floor(WEBP_MAX_DIMENSION / FULL_CELL); // 20
const MAX_IMAGES_PER_CHUNK = SPRITE_COLS * MAX_ROWS_FULL; // 200

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageEntry {
  key: string;
  sourcePath: string;
}

interface SpriteResult {
  relativePath: string;
  cols: number;
  rows: number;
  positions: Record<string, [number, number]>;
}

export interface BrandSpriteModel {
  slug: string;
  brandSlug: string;
  colorGroups: Array<{
    images: Array<{ ean: string; sequenceNumber: number }>;
  }>;
}

// ---------------------------------------------------------------------------
// Core sprite compositing
// ---------------------------------------------------------------------------

async function generateSingleSprite(
  entries: ImageEntry[],
  outputPath: string,
  cellSize: number,
): Promise<SpriteResult> {
  if (entries.length === 0) {
    throw new Error('Cannot generate sprite with zero entries');
  }

  const cols = Math.min(entries.length, SPRITE_COLS);
  const maxRows = Math.floor(WEBP_MAX_DIMENSION / cellSize);
  const maxImages = cols * maxRows;

  if (entries.length > maxImages) {
    entries = entries.slice(0, maxImages);
  }

  const rows = Math.ceil(entries.length / cols);
  const totalWidth = cols * cellSize;
  const totalHeight = rows * cellSize;

  const composites: sharp.OverlayOptions[] = await Promise.all(
    entries.map(async (entry, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      let input: Buffer;
      try {
        input = await sharp(entry.sourcePath)
          .resize(cellSize, cellSize, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
      } catch {
        input = await sharp({
          create: {
            width: cellSize,
            height: cellSize,
            channels: 4,
            background: { r: 240, g: 240, b: 240, alpha: 255 },
          },
        })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
      }

      return {
        input,
        left: col * cellSize,
        top: row * cellSize,
      };
    }),
  );

  await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);

  const positions: Record<string, [number, number]> = {};
  entries.forEach((entry, i) => {
    positions[entry.key] = [i % cols, Math.floor(i / cols)];
  });

  return {
    relativePath: outputPath,
    cols,
    rows,
    positions,
  };
}

// ---------------------------------------------------------------------------
// Brand-level sprite generation
// ---------------------------------------------------------------------------

interface ModelKeyRange {
  slug: string;
  keys: string[];
  startIdx: number;
}

/**
 * Generate brand-grouped sprites for all models.
 *
 * Groups all models by brandSlug, then generates paired thumb+full sprite
 * chunks per brand. Both use the same 10-column grid layout so positions
 * are shared. Large brands are chunked at model boundaries (max 400 images).
 */
export async function generateBrandSprites(
  models: BrandSpriteModel[],
  thumbsDir: string,
  fullDir: string | null,
  spritesDir: string,
  spriteMapPath: string,
  imageBaseUrl: string,
  logFn: (msg: string) => void,
): Promise<void> {
  await fs.mkdir(path.join(spritesDir, 't'), { recursive: true });
  await fs.mkdir(path.join(spritesDir, 'f'), { recursive: true });

  // Step 1: Collect image keys per model, grouped by brand
  const brandModels = new Map<string, Array<{ slug: string; imageKeys: string[] }>>();

  for (const model of models) {
    const imageKeys: string[] = [];
    const seen = new Set<string>();
    for (const cg of model.colorGroups) {
      for (const img of cg.images) {
        const key = `${img.ean}-${img.sequenceNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          imageKeys.push(key);
        }
      }
    }
    if (imageKeys.length === 0) continue;

    if (!brandModels.has(model.brandSlug)) {
      brandModels.set(model.brandSlug, []);
    }
    brandModels.get(model.brandSlug)!.push({ slug: model.slug, imageKeys });
  }

  // Step 2: Build sprite map
  const spriteMap: {
    thumbCell: number;
    fullCell: number;
    cols: number;
    imageBase: string;
    models: Record<string, {
      t: string;
      f: string;
      cols: number;
      rows: number;
      img: Record<string, [number, number]>;
    }>;
  } = {
    thumbCell: THUMB_CELL,
    fullCell: FULL_CELL,
    cols: SPRITE_COLS,
    imageBase: imageBaseUrl,
    models: {},
  };

  let brandsProcessed = 0;
  const totalBrands = brandModels.size;
  const BRAND_BATCH = 5;

  // Process brands in small batches to control memory
  const brandEntries = Array.from(brandModels.entries());

  for (let bi = 0; bi < brandEntries.length; bi += BRAND_BATCH) {
    const batch = brandEntries.slice(bi, bi + BRAND_BATCH);

    await Promise.all(batch.map(async ([brandSlug, modelInfos]) => {
      // Collect all unique image keys for this brand, preserving model order
      const allKeys: string[] = [];
      const globalSeen = new Set<string>();
      const modelRanges: ModelKeyRange[] = [];

      for (const info of modelInfos) {
        const modelStart = allKeys.length;
        const modelKeys: string[] = [];
        for (const key of info.imageKeys) {
          if (!globalSeen.has(key)) {
            globalSeen.add(key);
            allKeys.push(key);
            modelKeys.push(key);
          }
        }
        if (modelKeys.length > 0) {
          modelRanges.push({ slug: info.slug, startIdx: modelStart, keys: modelKeys });
        }
      }

      if (allKeys.length === 0) return;

      // Chunk at model boundaries (max MAX_IMAGES_PER_CHUNK per chunk)
      const chunks: { keys: string[]; startGlobal: number; modelRanges: ModelKeyRange[] }[] = [];
      let curKeys: string[] = [];
      let curStart = 0;
      let curModelRanges: ModelKeyRange[] = [];

      for (const range of modelRanges) {
        if (curKeys.length > 0 && curKeys.length + range.keys.length > MAX_IMAGES_PER_CHUNK) {
          chunks.push({ keys: curKeys, startGlobal: curStart, modelRanges: curModelRanges });
          curStart += curKeys.length;
          curKeys = [];
          curModelRanges = [];
        }
        // Adjust range startIdx relative to chunk
        curModelRanges.push({ ...range, startIdx: curKeys.length });
        curKeys.push(...range.keys);
      }
      if (curKeys.length > 0) {
        chunks.push({ keys: curKeys, startGlobal: curStart, modelRanges: curModelRanges });
      }

      // Generate paired thumb + full sprites per chunk
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const suffix = chunks.length === 1 ? '' : `-${ci}`;

        const thumbEntries = chunk.keys.map((key) => ({
          key,
          sourcePath: path.join(thumbsDir, `${key}.webp`),
        }));
        const fullEntries = chunk.keys.map((key) => ({
          key,
          sourcePath: fullDir
            ? path.join(fullDir, `${key}.webp`)
            : path.join(thumbsDir, `${key}.webp`),
        }));

        const thumbOutPath = path.join(spritesDir, 't', `${brandSlug}${suffix}.webp`);
        const fullOutPath = path.join(spritesDir, 'f', `${brandSlug}${suffix}.webp`);

        let thumbResult: SpriteResult;
        let fullResult: SpriteResult;
        try {
          [thumbResult, fullResult] = await Promise.all([
            generateSingleSprite(thumbEntries, thumbOutPath, THUMB_CELL),
            generateSingleSprite(fullEntries, fullOutPath, FULL_CELL),
          ]);
        } catch (err) {
          logFn(`  WARNING: Sprite generation failed for brand ${brandSlug} chunk ${ci}: ${err}`);
          continue;
        }

        thumbResult.relativePath = `/images/sprites/t/${brandSlug}${suffix}.webp`;
        fullResult.relativePath = `/images/sprites/f/${brandSlug}${suffix}.webp`;

        // Map model entries — positions from full sprite (same grid as thumb)
        for (const range of chunk.modelRanges) {
          const modelImg: Record<string, [number, number]> = {};
          for (const key of range.keys) {
            const pos = fullResult.positions[key];
            if (pos) {
              modelImg[key] = pos;
            }
          }
          if (Object.keys(modelImg).length === 0) continue;

          spriteMap.models[range.slug] = {
            t: thumbResult.relativePath,
            f: fullResult.relativePath,
            cols: fullResult.cols,
            rows: fullResult.rows,
            img: modelImg,
          };
        }
      }
    }));

    brandsProcessed += batch.length;
    if (brandsProcessed % 10 === 0 || brandsProcessed >= totalBrands) {
      logFn(`  Brand sprites: ${brandsProcessed}/${totalBrands} brands processed`);
    }
  }

  // Write sprite map
  await fs.mkdir(path.dirname(spriteMapPath), { recursive: true });
  await fs.writeFile(spriteMapPath, JSON.stringify(spriteMap), 'utf-8');
  logFn(`  Written sprite-map.json (${Object.keys(spriteMap.models).length} models across ${totalBrands} brands)`);

  // Clean stale sprite files
  const validSpriteFiles = new Set<string>();
  for (const entry of Object.values(spriteMap.models)) {
    const tFile = entry.t.split('/').pop();
    const fFile = entry.f.split('/').pop();
    if (tFile) validSpriteFiles.add(tFile);
    if (fFile) validSpriteFiles.add(fFile);
  }

  for (const subdir of ['t', 'f']) {
    const dir = path.join(spritesDir, subdir);
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.webp') && !validSpriteFiles.has(file)) {
          await fs.unlink(path.join(dir, file));
        }
      }
    } catch {
      // directory might not exist yet
    }
  }
}
