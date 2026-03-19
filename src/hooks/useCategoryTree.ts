'use client';

/**
 * React hook for loading and navigating the category tree.
 *
 * Fetches /data/category-tree.json on mount and provides helpers
 * to find nodes and build breadcrumb paths.
 *
 * @example
 * ```tsx
 * const { tree, isLoading, findCategory, getCategoryPath } = useCategoryTree();
 * const node = findCategory('werkbroeken');
 * const breadcrumbs = getCategoryPath('werkbroeken');
 * // => [{ code: 'werkkleding', nameNl: 'Werkkleding', ... }, ...]
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CategoryNode } from '@/types/product';

const CATEGORY_TREE_PATH = '/data/category-tree.json';

export interface UseCategoryTreeReturn {
  /** Root-level category nodes */
  tree: CategoryNode[];
  /** Whether the tree is currently being loaded */
  isLoading: boolean;
  /** Find a single category node by its code */
  findCategory: (code: string) => CategoryNode | null;
  /** Get the breadcrumb path from root to the given category code */
  getCategoryPath: (code: string) => CategoryNode[];
}

export function useCategoryTree(): UseCategoryTreeReturn {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /** Flat lookup cache: code -> node. Built once after fetch. */
  const lookupRef = useRef<Map<string, CategoryNode>>(new Map());
  /** Parent lookup: child code -> parent code. Built once after fetch. */
  const parentMapRef = useRef<Map<string, string>>(new Map());

  // ---------------------------------------------------------------------------
  // Fetch category tree on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(CATEGORY_TREE_PATH);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch category tree: ${response.status} ${response.statusText}`
          );
        }

        const data: CategoryNode[] = await response.json();

        if (cancelled) return;

        // Build flat lookup and parent map
        const lookup = new Map<string, CategoryNode>();
        const parentMap = new Map<string, string>();
        buildLookup(data, lookup, parentMap);

        lookupRef.current = lookup;
        parentMapRef.current = parentMap;
        setTree(data);
      } catch (error) {
        console.error('[useCategoryTree] Failed to load category tree:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Find a category by code
  // ---------------------------------------------------------------------------

  const findCategory = useCallback(
    (code: string): CategoryNode | null => {
      return lookupRef.current.get(code) ?? null;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Get breadcrumb path from root to target category
  // ---------------------------------------------------------------------------

  const getCategoryPath = useCallback(
    (code: string): CategoryNode[] => {
      const path: CategoryNode[] = [];
      let current = code;

      // Walk up the tree collecting ancestors
      while (current) {
        const node = lookupRef.current.get(current);
        if (!node) break;
        path.unshift(node);
        const parent = parentMapRef.current.get(current);
        if (!parent) break;
        current = parent;
      }

      return path;
    },
    []
  );

  return {
    tree,
    isLoading,
    findCategory,
    getCategoryPath,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively traverse the tree and populate flat lookup + parent maps.
 */
function buildLookup(
  nodes: CategoryNode[],
  lookup: Map<string, CategoryNode>,
  parentMap: Map<string, string>
): void {
  for (const node of nodes) {
    lookup.set(node.code, node);

    for (const child of node.children) {
      parentMap.set(child.code, node.code);
    }

    if (node.children.length > 0) {
      buildLookup(node.children, lookup, parentMap);
    }
  }
}
