'use client';

import { useState, useRef, useEffect } from 'react';
import type { PendingChangeRequest } from '@/types/product';

type TabKey = 'status' | 'category' | 'name' | 'cover' | 'enrichment';

interface MenuOption {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  separator?: boolean;
}

const MENU_OPTIONS: MenuOption[] = [
  {
    key: 'status',
    label: 'Status wijzigen',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    key: 'category',
    label: 'Categorie wijzigen',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    key: 'name',
    label: 'Naam wijzigen',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    key: 'cover',
    label: 'Omslagfoto wijzigen',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'enrichment',
    label: 'Verrijk productdata',
    separator: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
];

const CHANGE_LABELS: Record<string, Record<string, string>> = {
  status_change: {
    core: 'Promoveren naar Kern',
    extended: 'Degraderen naar Rand',
    excluded: 'Niet gebruiken',
  },
  category_change: { _default: 'Categorie wijzigen' },
  name_change: { _default: 'Naam wijzigen' },
  cover_change: { _default: 'Omslagfoto wijzigen' },
};

function getChangeLabel(req: PendingChangeRequest): string {
  const typeLabels = CHANGE_LABELS[req.changeType];
  if (!typeLabels) return 'Wijziging';
  return typeLabels[req.requestedValue] ?? typeLabels._default ?? 'Wijziging';
}

interface ActionMenuProps {
  pendingRequest: PendingChangeRequest | null;
  isLoading: boolean;
  enrichmentProposalCount: number;
  onSelectAction: (tab: TabKey) => void;
  onWithdraw: () => void;
}

export function ActionMenu({
  pendingRequest,
  isLoading,
  enrichmentProposalCount,
  onSelectAction,
  onWithdraw,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Pending state: show inline badge with withdraw option
  if (pendingRequest) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800"
          aria-label={`Wijzigingsverzoek: ${getChangeLabel(pendingRequest)}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {getChangeLabel(pendingRequest)}
        </span>
        <button
          type="button"
          onClick={onWithdraw}
          className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors"
          aria-label="Wijzigingsverzoek intrekken"
        >
          Intrekken
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white opacity-75 cursor-wait"
      >
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Bezig...
      </button>
    );
  }

  // Default: dropdown menu
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Beheer opties openen"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Beheer
        <svg className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-gray-200 py-1 z-50"
          role="menu"
          aria-orientation="vertical"
        >
          {MENU_OPTIONS.map((option) => (
            <div key={option.key}>
              {option.separator && (
                <div className="my-1 border-t border-gray-100" />
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onSelectAction(option.key);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-400">{option.icon}</span>
                <span>{option.label}</span>
                {option.key === 'enrichment' && enrichmentProposalCount > 0 && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    {enrichmentProposalCount}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
