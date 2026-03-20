import sharp from 'sharp';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const SIZES = [300, 600] as const;
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

/**
 * Generate 300w + 600w AVIF + WebP thumbnails from source images.
 * Returns array of generated file info for R2 upload.
 */
export async function generateThumbnails(
  imageKeys: string[],
  sourceDir: string,       // directory with source .webp files (e.g. public/images/thumbs)
  outputDir: string,       // temp dir for generated thumbnails
  logFn: (msg: string) => void,
  concurrency = 20,
): Promise<ThumbResult[]> {
  // Ensure output dirs exist
  for (const size of SIZES) {
    mkdirSync(path.join(outputDir, String(size)), { recursive: true });
  }

  const results: ThumbResult[] = [];
  const errors: string[] = [];

  // Process in batches for concurrency control
  for (let i = 0; i < imageKeys.length; i += concurrency) {
    const batch = imageKeys.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (imageKey) => {
        const sourcePath = path.join(sourceDir, `${imageKey}.webp`);
        if (!existsSync(sourcePath)) {
          errors.push(imageKey);
          return null;
        }

        const files: ThumbResult['files'] = [];

        for (const size of SIZES) {
          const pipeline = sharp(sourcePath).resize(size, null, {
            fit: 'inside',
            withoutEnlargement: true,
          });

          // AVIF
          const avifPath = path.join(outputDir, String(size), `${imageKey}.avif`);
          await pipeline.clone().avif({ quality: AVIF_QUALITY }).toFile(avifPath);
          files.push({
            r2Key: `${size}/${imageKey}.avif`,
            localPath: avifPath,
            contentType: 'image/avif',
          });

          // WebP
          const webpPath = path.join(outputDir, String(size), `${imageKey}.webp`);
          await pipeline.clone().webp({ quality: WEBP_QUALITY }).toFile(webpPath);
          files.push({
            r2Key: `${size}/${imageKey}.webp`,
            localPath: webpPath,
            contentType: 'image/webp',
          });
        }

        return { imageKey, files };
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    if ((i + concurrency) % 200 === 0 || i + concurrency >= imageKeys.length) {
      logFn(`  Thumbnails: ${Math.min(i + concurrency, imageKeys.length)}/${imageKeys.length} processed`);
    }
  }

  if (errors.length > 0) {
    logFn(`  \u26a0 ${errors.length} source images not found, skipped`);
  }

  return results;
}
