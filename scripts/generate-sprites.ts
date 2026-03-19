/**
 * Sprite generation for showcase images.
 *
 * Combines per-model images into sprite sheets using sharp.composite().
 * Two sprites per model: thumbs (64px cells) and full (400px cells).
 */
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const THUMB_CELL = 64;
export const FULL_CELL = 400;
export const FULL_MAX_COLS = 10; // max 4000px wide
export const THUMB_MAX_COLS = 200; // max 12800px wide (WebP limit: 16383px)
export const WEBP_QUALITY = 82;
const WEBP_MAX_DIMENSION = 16383;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageEntry {
  /** Image key "ean-seq" */
  key: string;
  /** Source file path on disk */
  sourcePath: string;
}

interface SpriteResult {
  /** Relative path from public/ for use in URLs */
  relativePath: string;
  /** Number of columns */
  cols: number;
  /** Map of image key → [col, row] */
  positions: Record<string, [number, number]>;
}

export interface ModelSpriteData {
  slug: string;
  thumbSprite: SpriteResult;
  fullSprite: SpriteResult;
}

// ---------------------------------------------------------------------------
// Sprite generation
// ---------------------------------------------------------------------------

async function generateSingleSprite(
  entries: ImageEntry[],
  outputPath: string,
  cellSize: number,
  maxCols: number,
): Promise<SpriteResult> {
  if (entries.length === 0) {
    throw new Error('Cannot generate sprite with zero entries');
  }

  const cols = Math.min(entries.length, maxCols);
  const maxRows = Math.floor(WEBP_MAX_DIMENSION / cellSize);
  const maxImages = cols * maxRows;

  // Truncate entries if they would exceed WebP dimension limits
  if (entries.length > maxImages) {
    entries = entries.slice(0, maxImages);
  }

  const rows = Math.ceil(entries.length / cols);
  const totalWidth = cols * cellSize;
  const totalHeight = rows * cellSize;

  // Read and resize all source images in parallel
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
        // Create placeholder for missing/corrupt images
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

  // Create canvas and composite all images
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

  // Build position map
  const positions: Record<string, [number, number]> = {};
  entries.forEach((entry, i) => {
    positions[entry.key] = [i % cols, Math.floor(i / cols)];
  });

  return {
    relativePath: outputPath,
    cols,
    positions,
  };
}

/**
 * Generate thumb + full sprites for a single model.
 */
export async function generateModelSprites(
  slug: string,
  imageKeys: string[],
  thumbsDir: string,
  fullDir: string | null,
  outputDir: string,
): Promise<ModelSpriteData> {
  const thumbOutDir = path.join(outputDir, 't');
  const fullOutDir = path.join(outputDir, 'f');
  await fs.mkdir(thumbOutDir, { recursive: true });
  await fs.mkdir(fullOutDir, { recursive: true });

  const thumbEntries: ImageEntry[] = imageKeys.map((key) => ({
    key,
    sourcePath: path.join(thumbsDir, `${key}.webp`),
  }));

  const fullEntries: ImageEntry[] = imageKeys.map((key) => ({
    key,
    sourcePath: fullDir
      ? path.join(fullDir, `${key}.webp`)
      : path.join(thumbsDir, `${key}.webp`),
  }));

  const thumbOutputPath = path.join(thumbOutDir, `${slug}.webp`);
  const fullOutputPath = path.join(fullOutDir, `${slug}.webp`);

  const [thumbSprite, fullSprite] = await Promise.all([
    generateSingleSprite(thumbEntries, thumbOutputPath, THUMB_CELL, THUMB_MAX_COLS),
    generateSingleSprite(fullEntries, fullOutputPath, FULL_CELL, FULL_MAX_COLS),
  ]);

  thumbSprite.relativePath = `/images/sprites/t/${slug}.webp`;
  fullSprite.relativePath = `/images/sprites/f/${slug}.webp`;

  return { slug, thumbSprite, fullSprite };
}

/**
 * Generate sprites for all models and write the sprite map JSON.
 */
export async function generateAllSprites(
  models: Array<{ slug: string; colorGroups: Array<{ images: Array<{ ean: string; sequenceNumber: number }> }> }>,
  thumbsDir: string,
  fullDir: string | null,
  spritesDir: string,
  spriteMapPath: string,
  imageBaseUrl: string,
  logFn: (msg: string) => void,
): Promise<void> {
  await fs.mkdir(path.join(spritesDir, 't'), { recursive: true });
  await fs.mkdir(path.join(spritesDir, 'f'), { recursive: true });

  const spriteMap: {
    thumbCell: number;
    fullCell: number;
    fullCols: number;
    imageBase: string;
    models: Record<string, {
      t: string;
      f: string;
      cols: number;
      img: Record<string, [number, number]>;
    }>;
  } = {
    thumbCell: THUMB_CELL,
    fullCell: FULL_CELL,
    fullCols: FULL_MAX_COLS,
    imageBase: imageBaseUrl,
    models: {},
  };

  let processed = 0;
  const total = models.length;
  const BATCH_SIZE = 25;

  for (let i = 0; i < models.length; i += BATCH_SIZE) {
    const batch = models.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (model) => {
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

        if (imageKeys.length === 0) return null;

        try {
          return await generateModelSprites(model.slug, imageKeys, thumbsDir, fullDir, spritesDir);
        } catch (err) {
          logFn(`  WARNING: Sprite generation failed for ${model.slug} (${imageKeys.length} images): ${err}`);
          return null;
        }
      }),
    );

    for (const result of results) {
      if (!result) continue;
      spriteMap.models[result.slug] = {
        t: result.thumbSprite.relativePath,
        f: result.fullSprite.relativePath,
        cols: result.fullSprite.cols,
        img: result.fullSprite.positions,
      };
    }

    processed += batch.length;
    if (processed % 100 === 0 || processed === total) {
      logFn(`  Sprites: ${processed}/${total} models processed`);
    }
  }

  await fs.mkdir(path.dirname(spriteMapPath), { recursive: true });
  await fs.writeFile(spriteMapPath, JSON.stringify(spriteMap), 'utf-8');
  logFn(`  Written sprite-map.json (${Object.keys(spriteMap.models).length} models)`);

  // Clean stale sprites
  for (const subdir of ['t', 'f']) {
    const dir = path.join(spritesDir, subdir);
    try {
      const files = await fs.readdir(dir);
      const validSlugs = new Set(Object.keys(spriteMap.models));
      for (const file of files) {
        const slug = file.replace('.webp', '');
        if (!validSlugs.has(slug)) {
          await fs.unlink(path.join(dir, file));
        }
      }
    } catch {
      // directory might not exist yet
    }
  }
}

/**
 * Incrementally update sprites for a subset of changed models.
 * Reads the existing sprite-map.json, regenerates only the changed models,
 * and merges back. Removes entries for models no longer in allModels.
 */
export async function generateIncrementalSprites(
  changedModels: Array<{ slug: string; colorGroups: Array<{ images: Array<{ ean: string; sequenceNumber: number }> }> }>,
  allModels: Array<{ slug: string }>,
  thumbsDir: string,
  fullDir: string | null,
  spritesDir: string,
  spriteMapPath: string,
  imageBaseUrl: string,
  logFn: (msg: string) => void,
): Promise<void> {
  // Load existing sprite map
  let existingSpriteMap: {
    thumbCell: number;
    fullCell: number;
    fullCols: number;
    imageBase: string;
    models: Record<string, { t: string; f: string; cols: number; img: Record<string, [number, number]> }>;
  };
  try {
    const raw = await fs.readFile(spriteMapPath, 'utf-8');
    existingSpriteMap = JSON.parse(raw);
  } catch {
    logFn('  No existing sprite-map.json, falling back to full generation');
    return generateAllSprites(changedModels, thumbsDir, fullDir, spritesDir, spriteMapPath, imageBaseUrl, logFn);
  }

  await fs.mkdir(path.join(spritesDir, 't'), { recursive: true });
  await fs.mkdir(path.join(spritesDir, 'f'), { recursive: true });

  // Regenerate sprites only for changed models
  let processed = 0;
  for (const model of changedModels) {
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
    if (imageKeys.length === 0) {
      delete existingSpriteMap.models[model.slug];
      continue;
    }

    let result: ModelSpriteData;
    try {
      result = await generateModelSprites(model.slug, imageKeys, thumbsDir, fullDir, spritesDir);
    } catch (err) {
      logFn(`  WARNING: Sprite generation failed for ${model.slug} (${imageKeys.length} images): ${err}`);
      continue;
    }
    existingSpriteMap.models[model.slug] = {
      t: result.thumbSprite.relativePath,
      f: result.fullSprite.relativePath,
      cols: result.fullSprite.cols,
      img: result.fullSprite.positions,
    };

    processed++;
    if (processed % 50 === 0 || processed === changedModels.length) {
      logFn(`  Sprites (incremental): ${processed}/${changedModels.length} models updated`);
    }
  }

  // Remove entries for models no longer in the full set
  const validSlugs = new Set(allModels.map((m) => m.slug));
  for (const slug of Object.keys(existingSpriteMap.models)) {
    if (!validSlugs.has(slug)) {
      delete existingSpriteMap.models[slug];
      // Clean up sprite files
      try { await fs.unlink(path.join(spritesDir, 't', `${slug}.webp`)); } catch { /* ok */ }
      try { await fs.unlink(path.join(spritesDir, 'f', `${slug}.webp`)); } catch { /* ok */ }
    }
  }

  // Update imageBase in case it changed
  existingSpriteMap.imageBase = imageBaseUrl;

  await fs.mkdir(path.dirname(spriteMapPath), { recursive: true });
  await fs.writeFile(spriteMapPath, JSON.stringify(existingSpriteMap), 'utf-8');
  logFn(`  Written sprite-map.json (${Object.keys(existingSpriteMap.models).length} models, ${processed} updated)`);
}
