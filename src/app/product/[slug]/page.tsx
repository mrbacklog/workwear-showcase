import fs from 'fs';
import path from 'path';
import ProductClient from './ProductClient';

interface ModelCard {
  slug: string;
}

interface CategoryChunkEntry {
  file: string;
}

export function generateStaticParams() {
  try {
    const dataDir = path.join(process.cwd(), 'public', 'data');
    const metaPath = path.join(dataDir, 'model-cards-meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    // Resolve chunk filenames from either category-based or legacy format
    let chunkFiles: string[];
    if (typeof meta.chunks === 'object' && !Array.isArray(meta.chunks)) {
      // Category format: { chunks: { "cat-key": { file: "model-cards-cat-key.json" } } }
      chunkFiles = Object.values(meta.chunks as Record<string, CategoryChunkEntry>).map((e) => e.file);
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
