import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import ProductClient from './ProductClient';

interface ModelCard {
  slug: string;
}

interface CategoryChunkEntry {
  file: string;
  subChunks?: string[];
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  return { alternates: { canonical: `/product/${slug}/` } };
}

export function generateStaticParams() {
  try {
    const dataDir = path.join(process.cwd(), 'public', 'data');
    const metaPath = path.join(dataDir, 'model-cards-meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    // Resolve chunk filenames from either category-based or legacy format
    let chunkFiles: string[];
    if (typeof meta.chunks === 'object' && !Array.isArray(meta.chunks)) {
      // Category format: { chunks: { "cat-key": { file, subChunks? } } }
      // When subChunks is present the category was split for size limits;
      // use those instead of the (typically only first) main file.
      chunkFiles = [];
      for (const entry of Object.values(meta.chunks as Record<string, CategoryChunkEntry>)) {
        if (entry.subChunks && entry.subChunks.length > 0) {
          chunkFiles.push(...entry.subChunks);
        } else {
          chunkFiles.push(entry.file);
        }
      }
    } else {
      // Legacy format: { chunks: 3 } → model-cards-0.json, model-cards-1.json, ...
      chunkFiles = Array.from({ length: meta.chunks as number }, (_, i) => `model-cards-${i}.json`);
    }

    const allModels: ModelCard[] = [];
    for (const file of chunkFiles) {
      const chunkPath = path.join(dataDir, file);
      if (fs.existsSync(chunkPath)) {
        const chunk: ModelCard[] = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
        allModels.push(...chunk);
      }
    }

    return allModels.map((m) => ({ slug: m.slug }));
  } catch {
    return [];
  }
}

export default function ProductPage() {
  return <ProductClient />;
}
