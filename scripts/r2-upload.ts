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
