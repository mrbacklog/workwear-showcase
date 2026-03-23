'use client';

import { useState, useEffect } from 'react';
import type { CategoryNode } from '@/types/product';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  tree: CategoryNode[];
  counts?: Record<string, number>;
  onCategorySelect: (code: string) => void;
}

export function MobileNav({ isOpen, onClose, tree, counts, onCategorySelect }: MobileNavProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function toggleExpand(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleSelect(code: string) {
    onCategorySelect(code);
    onClose();
  }

  const roots = tree.filter((node) => node.level === 1 && node.code !== 'TEST_JACKETS');

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigatie"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Categorieën</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Sluiten"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {roots.map((root) => (
            <div key={root.code} className="mb-4">
              {/* Level 1 */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleSelect(root.code)}
                  className="text-sm font-bold text-gray-900 hover:text-black"
                >
                  {root.nameNl}
                  {counts?.[root.code] != null && (
                    <span className="ml-1 font-normal text-gray-400">
                      ({counts[root.code]})
                    </span>
                  )}
                </button>
                {root.children.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(root.code)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                    aria-label={expanded.has(root.code) ? 'Inklappen' : 'Uitklappen'}
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${expanded.has(root.code) ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Level 2 (accordion) */}
              {expanded.has(root.code) && (
                <div className="mt-2 ml-3 space-y-3">
                  {root.children.map((l2) => (
                    <div key={l2.code}>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleSelect(l2.code)}
                          className="text-sm font-semibold text-gray-700 hover:text-black"
                        >
                          {l2.nameNl}
                          {counts?.[l2.code] != null && (
                            <span className="ml-1 font-normal text-gray-400">
                              ({counts[l2.code]})
                            </span>
                          )}
                        </button>
                        {l2.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(l2.code)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100"
                            aria-label={expanded.has(l2.code) ? 'Inklappen' : 'Uitklappen'}
                          >
                            <svg
                              className={`h-3.5 w-3.5 transition-transform ${expanded.has(l2.code) ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Level 3 */}
                      {expanded.has(l2.code) && l2.children.length > 0 && (
                        <ul className="mt-1 ml-3 space-y-0.5">
                          {l2.children.map((l3) => (
                            <li key={l3.code}>
                              <button
                                type="button"
                                onClick={() => handleSelect(l3.code)}
                                className="text-sm text-gray-600 hover:text-black hover:underline"
                              >
                                {l3.nameNl}
                                {counts?.[l3.code] != null && counts[l3.code] > 0 && (
                                  <span className="ml-1 text-gray-400">({counts[l3.code]})</span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
