import fs from 'fs';
import path from 'path';
import ProductClient from './ProductClient';

interface ModelCard {
  slug: string;
}

export function generateStaticParams() {
  try {
    const dataDir = path.join(process.cwd(), 'public', 'data');
    const metaPath = path.join(dataDir, 'model-cards-meta.json');
    const meta: { chunks: number } = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    const allModels: ModelCard[] = [];
    for (let i = 0; i < meta.chunks; i++) {
      const chunkPath = path.join(dataDir, `model-cards-${i}.json`);
      const chunk: ModelCard[] = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
      allModels.push(...chunk);
    }

    return allModels.map((m) => ({ slug: m.slug }));
  } catch {
    return [];
  }
}

export default function ProductPage() {
  return <ProductClient />;
}
