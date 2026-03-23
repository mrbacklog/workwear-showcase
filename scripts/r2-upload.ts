import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'workwear-images';

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export async function r2Upload(
  key: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const body = readFileSync(filePath);
  await getClient().send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

export interface R2UploadItem {
  r2Key: string;
  localPath: string;
  contentType: string;
}

/**
 * Upload multiple files to R2 in parallel batches.
 * Skips files already in the manifest. Saves manifest periodically.
 */
export async function r2UploadBatch(
  items: R2UploadItem[],
  manifest: UploadManifest,
  concurrency: number = 50,
  logFn?: (msg: string) => void,
): Promise<{ uploaded: number; skipped: number }> {
  const toUpload = items.filter(i => !manifest.uploadedKeys.has(i.r2Key));
  const skipped = items.length - toUpload.length;
  let uploaded = 0;

  for (let i = 0; i < toUpload.length; i += concurrency) {
    const batch = toUpload.slice(i, i + concurrency);
    await Promise.all(batch.map(async (item) => {
      await r2Upload(item.r2Key, item.localPath, item.contentType);
      manifest.uploadedKeys.add(item.r2Key);
    }));
    uploaded += batch.length;
    if (uploaded % 200 === 0 || uploaded === toUpload.length) {
      saveUploadManifest(manifest);
      if (logFn) logFn(`  R2 progress: ${uploaded}/${toUpload.length} uploaded`);
    }
  }

  return { uploaded, skipped };
}

export interface UploadManifest {
  uploadedKeys: Set<string>;
}

// Store manifest in project ROOT, NOT in public/data/ (prevents deploy to Pages)
const MANIFEST_PATH = path.join(process.cwd(), '.r2-manifest.json');

export function loadUploadManifest(): UploadManifest {
  if (existsSync(MANIFEST_PATH)) {
    const data = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    return { uploadedKeys: new Set(data.uploadedKeys || []) };
  }
  return { uploadedKeys: new Set() };
}

export function saveUploadManifest(manifest: UploadManifest): void {
  const data = { uploadedKeys: [...manifest.uploadedKeys] };
  writeFileSync(MANIFEST_PATH, JSON.stringify(data));
}

export function getR2PublicUrl(key: string): string {
  const baseUrl = process.env.R2_PUBLIC_URL || '';
  return `${baseUrl}/${key}`;
}
