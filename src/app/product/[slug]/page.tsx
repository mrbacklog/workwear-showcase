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

/** Build a slug → chunkFile map from the data directory at build time. */
function buildSlugChunkMap(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const dataDir = path.join(process.cwd(), 'public', 'data');
    const metaPath = path.join(dataDir, 'model-cards-meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    let chunkFiles: string[];
    if (typeof meta.chunks === 'object' && !Array.isArray(meta.chunks)) {
      chunkFiles = [];
      for (const entry of Object.values(meta.chunks as Record<string, CategoryChunkEntry>)) {
        if (entry.subChunks && entry.subChunks.length > 0) {
          chunkFiles.push(...entry.subChunks);
        } else {
          chunkFiles.push(entry.file);
        }
      }
    } else {
      chunkFiles = Array.from({ length: meta.chunks as number }, (_, i) => `model-cards-${i}.json`);
    }

    for (const file of chunkFiles) {
      const chunkPath = path.join(dataDir, file);
      if (fs.existsSync(chunkPath)) {
        const chunk: ModelCard[] = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
        for (const model of chunk) {
          map.set(model.slug, file);
        }
      }
    }
  } catch {
    // build-time only — silently ignore
  }
  return map;
}

// Build once at module load time (Next.js SSG evaluates this per page at build time)
const slugChunkMap = buildSlugChunkMap();

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  return { alternates: { canonical: `/product/${slug}/` } };
}

export function generateStaticParams() {
  return Array.from(slugChunkMap.keys()).map((slug) => ({ slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chunkFile = slugChunkMap.get(slug) ?? null;

  return (
    <>
      {chunkFile && (
        <link
          rel="preload"
          as="fetch"
          crossOrigin="anonymous"
          href={`/data/${chunkFile}`}
        />
      )}
      <ProductClient />
    </>
  );
}
