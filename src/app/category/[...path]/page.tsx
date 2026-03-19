import fs from 'fs';
import path from 'path';
import CategoryClient from './CategoryClient';

interface CategoryNode {
  code: string;
  children: CategoryNode[];
}

function collectPaths(nodes: CategoryNode[]): { path: string[] }[] {
  const result: { path: string[] }[] = [];
  for (const node of nodes) {
    result.push({ path: [node.code] });
    if (node.children?.length) {
      result.push(...collectPaths(node.children));
    }
  }
  return result;
}

export function generateStaticParams() {
  try {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'category-tree.json');
    const tree: CategoryNode[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    return collectPaths(tree);
  } catch {
    return [];
  }
}

export default function CategoryPage() {
  return <CategoryClient />;
}
