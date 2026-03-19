'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CategoryNode } from '@/types/product';

interface CategoryTreeNodeProps {
  node: CategoryNode;
  depth: number;
  currentCode?: string;
  /** Article counts per category code (aggregated including descendants) */
  counts?: Record<string, number>;
  /** Callback for filter mode — if provided, clicking selects instead of navigating */
  onSelect?: (code: string) => void;
}

export function CategoryTreeNode({ node, depth, currentCode, counts, onSelect }: CategoryTreeNodeProps) {
  const isActive = node.code === currentCode;
  const hasChildren = node.children.length > 0;

  // Auto-expand if current category is within this subtree
  const containsActive = currentCode
    ? isActive || hasDescendant(node, currentCode)
    : false;

  const [expanded, setExpanded] = useState(containsActive);

  const count = counts?.[node.code];

  // Build the category URL path from the code
  const categoryPath = `/category/${node.code}`;

  const labelContent = (
    <>
      {node.nameNl}
      {count != null && count > 0 && (
        <span className="ml-1 text-gray-400 font-normal">({count})</span>
      )}
    </>
  );

  const labelClasses = `block flex-1 rounded px-2 py-1.5 text-sm transition-colors ${
    isActive
      ? 'bg-gray-100 font-semibold text-gray-900'
      : count === 0
        ? 'text-gray-300'
        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
  } ${depth === 0 ? 'font-bold' : depth === 1 ? 'font-normal' : 'text-xs'}`;

  return (
    <li>
      <div
        className="flex items-center"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-600"
            aria-label={expanded ? 'Inklappen' : 'Uitklappen'}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="mr-1 inline-block h-5 w-5 shrink-0" />
        )}

        {/* Category label: filter mode (button) or navigation mode (link) */}
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(node.code)}
            className={labelClasses}
          >
            {labelContent}
          </button>
        ) : (
          <Link href={categoryPath} className={labelClasses}>
            {labelContent}
          </Link>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul className="mt-0.5">
          {node.children
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((child) => (
              <CategoryTreeNode
                key={child.code}
                node={child}
                depth={depth + 1}
                currentCode={currentCode}
                counts={counts}
                onSelect={onSelect}
              />
            ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Recursively check if a node or any of its descendants has the given code.
 */
function hasDescendant(node: CategoryNode, code: string): boolean {
  for (const child of node.children) {
    if (child.code === code) return true;
    if (hasDescendant(child, code)) return true;
  }
  return false;
}
