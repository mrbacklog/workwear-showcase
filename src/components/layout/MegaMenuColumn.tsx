'use client';

import type { CategoryNode } from '@/types/product';

interface MegaMenuColumnProps {
  category: CategoryNode;
  counts?: Record<string, number>;
  onSelect: (code: string) => void;
}

export function MegaMenuColumn({ category, counts, onSelect }: MegaMenuColumnProps) {
  const count = counts?.[category.code];

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onSelect(category.code)}
        className="mb-1.5 text-sm font-bold text-gray-900 hover:text-black hover:underline text-left"
      >
        {category.nameNl}
        {count != null && count > 0 && (
          <span className="ml-1 font-normal text-gray-400">({count})</span>
        )}
      </button>

      {category.children.length > 0 && (
        <ul className="space-y-0.5">
          {category.children.map((child) => {
            const childCount = counts?.[child.code];
            return (
              <li key={child.code}>
                <button
                  type="button"
                  onClick={() => onSelect(child.code)}
                  className="text-sm text-gray-600 hover:text-black hover:underline text-left"
                >
                  {child.nameNl}
                  {childCount != null && childCount > 0 && (
                    <span className="ml-1 text-gray-400">({childCount})</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
