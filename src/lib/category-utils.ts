import type { CategoryNode } from '@/types/product';

/**
 * Build aggregated counts for each category node (own + descendants).
 *
 * @param tree  Root category nodes
 * @param leafCounts  Direct model counts per category code (leaf-level)
 * @returns Counts per category code including all descendant counts
 */
export function buildAggregatedCounts(
  tree: CategoryNode[],
  leafCounts: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};

  function walk(node: CategoryNode): number {
    let total = leafCounts[node.code] ?? 0;
    for (const child of node.children) {
      total += walk(child);
    }
    result[node.code] = total;
    return total;
  }

  for (const root of tree) {
    walk(root);
  }
  return result;
}

/**
 * Collect all descendant codes of a category node (including itself).
 */
export function getDescendantCodes(node: CategoryNode): string[] {
  const codes = [node.code];
  for (const child of node.children) {
    codes.push(...getDescendantCodes(child));
  }
  return codes;
}
