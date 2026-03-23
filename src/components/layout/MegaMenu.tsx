'use client';

import { useEffect } from 'react';
import type { CategoryNode } from '@/types/product';
import { MegaMenuColumn } from './MegaMenuColumn';

interface MegaMenuProps {
  category: CategoryNode;
  counts?: Record<string, number>;
  onSelect: (code: string) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function MegaMenu({ category, counts, onSelect, onClose, onMouseEnter, onMouseLeave }: MegaMenuProps) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 top-[128px] z-[60] bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed left-0 right-0 top-[128px] z-[70] bg-white shadow-lg border-t border-gray-100"
        role="menu"
        aria-label={`Subcategorieën van ${category.nameNl}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
            {category.children.map((child) => (
              <MegaMenuColumn
                key={child.code}
                category={child}
                counts={counts}
                onSelect={(code) => {
                  onSelect(code);
                  onClose();
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
