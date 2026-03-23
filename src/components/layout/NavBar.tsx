'use client';

import { useState, useRef, useCallback } from 'react';
import type { CategoryNode } from '@/types/product';
import { MegaMenu } from './MegaMenu';

interface NavBarProps {
  tree: CategoryNode[];
  counts?: Record<string, number>;
  activeCategory?: string | null;
  onCategorySelect: (code: string) => void;
}

export function NavBar({ tree, counts, activeCategory, onCategorySelect }: NavBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((code: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenMenu(code);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setOpenMenu(null);
      closeTimerRef.current = null;
    }, 200);
  }, []);

  const handleSelect = useCallback(
    (code: string) => {
      setOpenMenu(null);
      onCategorySelect(code);
    },
    [onCategorySelect],
  );

  // Determine if activeCategory falls under a root node
  function isActive(root: CategoryNode): boolean {
    if (!activeCategory) return false;
    if (root.code === activeCategory) return true;
    return hasDescendant(root, activeCategory);
  }

  return (
    <nav
      aria-label="Productcategorieën"
      className="hidden lg:block bg-white border-b border-gray-200 relative"
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center gap-8">
          {tree
            .filter((node) => node.level === 1 && node.code !== 'TEST_JACKETS')
            .map((root) => (
              <div
                key={root.code}
                className="relative h-full flex items-center"
                onMouseEnter={() => handleMouseEnter(root.code)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(root.code)}
                  className={`text-sm font-semibold transition-colors ${
                    isActive(root)
                      ? 'text-black'
                      : 'text-gray-700 hover:text-black'
                  }`}
                  aria-haspopup="true"
                  aria-expanded={openMenu === root.code}
                >
                  {root.nameNl}
                </button>

                {/* Active indicator */}
                {isActive(root) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                )}

                {/* Mega menu dropdown */}
                {openMenu === root.code && (
                  <MegaMenu
                    category={root}
                    counts={counts}
                    onSelect={handleSelect}
                    onClose={() => setOpenMenu(null)}
                    onMouseEnter={() => handleMouseEnter(root.code)}
                    onMouseLeave={handleMouseLeave}
                  />
                )}
              </div>
            ))}
        </div>
      </div>
    </nav>
  );
}

function hasDescendant(node: CategoryNode, code: string): boolean {
  for (const child of node.children) {
    if (child.code === code) return true;
    if (hasDescendant(child, code)) return true;
  }
  return false;
}
