'use client';

import { useState, useMemo } from 'react';
import type { CategoryNode } from '@/types/product';

interface CategoryPickerProps {
  tree: CategoryNode[];
  currentCategoryCode: string;
  onSelect: (code: string) => void;
}

/** Flatten tree to leaf nodes (level 3) for selection */
function getLeafCategories(nodes: CategoryNode[]): CategoryNode[] {
  const leaves: CategoryNode[] = [];
  function walk(node: CategoryNode) {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        walk(child);
      }
    }
  }
  for (const node of nodes) {
    walk(node);
  }
  return leaves;
}

/** Get display path for a leaf category */
function getCategoryDisplayPath(
  node: CategoryNode,
  tree: CategoryNode[],
): string {
  // Walk up to find parent names
  const lookup = new Map<string, CategoryNode>();
  function buildLookup(nodes: CategoryNode[]) {
    for (const n of nodes) {
      lookup.set(n.code, n);
      if (n.children.length > 0) buildLookup(n.children);
    }
  }
  buildLookup(tree);

  const parts: string[] = [node.nameNl];
  let current = node.parentCode;
  while (current) {
    const parent = lookup.get(current);
    if (!parent) break;
    parts.unshift(parent.nameNl);
    current = parent.parentCode;
  }
  return parts.join(' > ');
}

export function CategoryPicker({
  tree,
  currentCategoryCode,
  onSelect,
}: CategoryPickerProps) {
  const [search, setSearch] = useState('');

  const leaves = useMemo(() => getLeafCategories(tree), [tree]);

  const filteredLeaves = useMemo(() => {
    if (!search.trim()) return leaves;
    const q = search.toLowerCase();
    return leaves.filter((leaf) => {
      const path = getCategoryDisplayPath(leaf, tree).toLowerCase();
      return path.includes(q);
    });
  }, [leaves, search, tree]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Zoek categorie..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500/20"
      />

      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
        {filteredLeaves.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-gray-400">
            Geen categorieën gevonden
          </div>
        ) : (
          filteredLeaves.map((leaf) => {
            const displayPath = getCategoryDisplayPath(leaf, tree);
            const isCurrent = leaf.code === currentCategoryCode;
            return (
              <button
                key={leaf.code}
                type="button"
                onClick={() => onSelect(leaf.code)}
                disabled={isCurrent}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  isCurrent
                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="block">{displayPath}</span>
                {isCurrent && (
                  <span className="text-xs text-gray-400">(huidige)</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
