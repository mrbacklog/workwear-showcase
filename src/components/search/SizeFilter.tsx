'use client';

import { useCallback } from 'react';
import { GROUP_ORDER, GROUP_LABELS, type SizeGroupMap, type SizeGroup } from '@/lib/size-filter-utils';

interface SizeFilterProps {
  available: SizeGroupMap;
  selected: Set<string>;
  onChange: (sizes: Set<string>) => void;
}

export function SizeFilter({ available, selected, onChange }: SizeFilterProps) {
  const toggle = useCallback((size: string) => {
    const next = new Set(selected);
    if (next.has(size)) next.delete(size);
    else next.add(size);
    onChange(next);
  }, [selected, onChange]);

  const visibleGroups = GROUP_ORDER.filter((g) => available[g].length > 0);

  if (visibleGroups.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Maat
      </h2>

      <div className="flex flex-col gap-2">
        {visibleGroups.map((group) => {
          const sizes = available[group];
          const activeInGroup = sizes.filter((s) => selected.has(s)).length;

          return (
            <div key={group} className="rounded border border-gray-200 overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between bg-gray-50 px-2 py-1.5 border-b border-gray-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {GROUP_LABELS[group]}
                </span>
                {activeInGroup > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white">
                    {activeInGroup}
                  </span>
                )}
              </div>

              {/* Scrollable size list */}
              <div className="max-h-28 overflow-y-auto">
                {sizes.map((size) => {
                  const isSelected = selected.has(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggle(size)}
                      aria-pressed={isSelected}
                      className={`flex min-h-8 w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                        isSelected ? 'bg-gray-50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-gray-900 bg-gray-900'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="h-2.5 w-2.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}>
                        {size}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
