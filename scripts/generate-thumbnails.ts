import sharp from 'sharp';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { UploadManifest } from './r2-upload';

const SIZE_CONFIG = [
  { width: 80, formats: ['webp'] as const },
  { width: 300, formats: ['avif', 'webp'] as const },
  { width: 600, formats: ['avif', 'webp'] as const },
  { width: 800, formats: ['avif', 'webp'] as const },
];

const AVIF_QUALITY = 65;
const WEBP_QUALITY = 75;

export interface ThumbResult {
  imageKey: string;        // e.g. "8712345678901-1"
  files: Array<{
    r2Key: string;         // e.g. "300/8712345678901-1.avif"
    localPath: string;     // local path to generated file
    contentType: string;   // e.g. "image/avif"
  }>;
}

/** All expected R2 keys for a given image key. */
export function expectedR2Keys(imageKey: string): string[] {
  const keys: string[] = [];
  for (const tier of SIZE_CONFIG) {
    for (const fmt of tier.formats) {
      keys.push(`${tier.width}/${imageKey}.${fmt}`);
    }
  }
  return keys;
}

/**
 * Generate 80w + 300w + 600w + 800w thumbnails from source images.
 * Skips images whose output keys all exist in the manifest.
 * Returns array of generated file info for R2 upload.
 */
export async function generateThumbnails(
  imageKeys: string[],
  sourceDir: string,
  outputDir: string,
  logFn: (msg: string) => void,
  concurrency = 20,
  manifest?: UploadManifest,
): Promise<ThumbResult[]> {
  // Ensure output dirs exist
  for (const tier of SIZE_CONFIG) {
    mkdirSync(path.join(outputDir, String(tier.width)), { recursive: true });
  }

  // Filter out images already fully uploaded
  let keysToProcess = imageKeys;
  let skippedByManifest = 0;
  if (manifest) {
    keysToProcess = imageKeys.filter((imageKey) => {
      const allExist = expectedR2Keys(imageKey).every((k) => manifest.uploadedKeys.has(k));
      if (allExist) skippedByManifest++;
      return !allExist;
    });
    if (skippedByManifest > 0) {
      logFn(`  Thumbnails: ${skippedByManifest} already in manifest, ${keysToProcess.length} to generate`);
    }
  }

  const results: ThumbResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < keysToProcess.length; i += concurrency) {
    const batch = keysToProcess.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (imageKey) => {
        const sourcePath = path.join(sourceDir, `${imageKey}.webp`);
        if (!existsSync(sourcePath)) {
          errors.push(imageKey);
          return null;
        }

        const files: ThumbResult['files'] = [];

        // Generate all sizes and formats in parallel
        const tasks: Promise<void>[] = [];
        for (const tier of SIZE_CONFIG) {
          const pipeline = sharp(sourcePath).resize(tier.width, null, {
            fit: 'inside',
            withoutEnlargement: true,
          });

          for (const fmt of tier.formats) {
            const ext = fmt;
            const filePath = path.join(outputDir, String(tier.width), `${imageKey}.${ext}`);
            const r2Key = `${tier.width}/${imageKey}.${ext}`;
            const contentType = fmt === 'avif' ? 'image/avif' : 'image/webp';

            const task = (fmt === 'avif'
              ? pipeline.clone().avif({ quality: AVIF_QUALITY }).toFile(filePath)
              : pipeline.clone().webp({ quality: WEBP_QUALITY }).toFile(filePath)
            ).then(() => {
              files.push({ r2Key, localPath: filePath, contentType });
            });
            tasks.push(task);
          }
        }

        await Promise.all(tasks);
        return { imageKey, files };
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    const progress = Math.min(i + concurrency, keysToProcess.length);
    if (progress % 200 === 0 || progress === keysToProcess.length) {
      logFn(`  Thumbnails: ${progress}/${keysToProcess.length} generated`);
    }
  }

  if (errors.length > 0) {
    logFn(`  \u26a0 ${errors.length} source images not found, skipped`);
  }

  return results;
}
