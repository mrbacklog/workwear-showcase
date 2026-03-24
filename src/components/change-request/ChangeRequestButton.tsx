'use client';

import type { PendingChangeRequest } from '@/types/product';

// Display labels for change types
const CHANGE_LABELS: Record<string, Record<string, string>> = {
  status_change: {
    core: 'Promoveren naar Kern',
    extended: 'Degraderen naar Rand',
    excluded: 'Markeren als Niet gebruiken',
  },
  category_change: {
    _default: 'Categorie wijzigen',
  },
  name_change: {
    _default: 'Naam wijzigen',
  },
  cover_change: {
    _default: 'Omslagfoto wijzigen',
  },
};

function getChangeLabel(req: PendingChangeRequest): string {
  const typeLabels = CHANGE_LABELS[req.changeType];
  if (!typeLabels) return 'Wijziging';
  return typeLabels[req.requestedValue] ?? typeLabels._default ?? 'Wijziging';
}

interface ChangeRequestButtonProps {
  pendingRequest: PendingChangeRequest | null;
  isLoading: boolean;
  onRequestChange: () => void;
  onWithdraw: () => void;
}

export function ChangeRequestButton({
  pendingRequest,
  isLoading,
  onRequestChange,
  onWithdraw,
}: ChangeRequestButtonProps) {
  // Pending state: amber badge + withdraw
  if (pendingRequest) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800"
          title={`Wijzigingsverzoek: ${getChangeLabel(pendingRequest)}`}
        >
          {/* Edit/pencil icon */}
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Wijziging pending
        </span>
        <button
          type="button"
          onClick={onWithdraw}
          className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors"
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
        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white opacity-75 cursor-wait"
      >
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Bezig...
      </button>
    );
  }

  // Default: "Wijzigen" button
  return (
    <button
      type="button"
      onClick={onRequestChange}
      className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
      Wijzigen
    </button>
  );
}
