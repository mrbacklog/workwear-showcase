'use client';

import type { CategoryNode } from '@/types/product';
import { CategoryTreeNode } from '@/components/category/CategoryTreeNode';

interface CategorySidebarProps {
  tree: CategoryNode[];
  currentCode?: string;
  /** Article counts per category code (aggregated including descendants) */
  counts?: Record<string, number>;
  /** Callback for filter mode — if provided, clicking selects instead of navigating */
  onSelect?: (code: string) => void;
}

export function CategorySidebar({ tree, currentCode, counts, onSelect }: CategorySidebarProps) {
  const sortedTree = [...tree].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <nav className="w-64 shrink-0" aria-label="Categorieen">
      <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Categorieen
      </h2>
      <ul className="space-y-0.5">
        {sortedTree.map((node) => (
          <CategoryTreeNode
            key={node.code}
            node={node}
            depth={0}
            currentCode={currentCode}
            counts={counts}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  );
}
