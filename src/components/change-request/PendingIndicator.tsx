'use client';

import type { PendingChangeRequest } from '@/types/product';

const CHANGE_LABELS: Record<string, Record<string, string>> = {
  status_change: {
    core: 'Promoveren naar Kern',
    extended: 'Degraderen naar Rand',
    excluded: 'Markeren als Niet gebruiken',
  },
  category_change: {
    _default: 'Categorie wijzigen',
  },
};

function getChangeLabel(req: PendingChangeRequest): string {
  const typeLabels = CHANGE_LABELS[req.changeType];
  if (!typeLabels) return 'Wijziging aangevraagd';
  return (
    typeLabels[req.requestedValue] ?? typeLabels._default ?? 'Wijziging aangevraagd'
  );
}

interface PendingIndicatorProps {
  request: PendingChangeRequest;
  /** Show compact version (icon only) for search results */
  compact?: boolean;
}

export function PendingIndicator({
  request,
  compact = false,
}: PendingIndicatorProps) {
  const label = `Wijzigingsverzoek: ${getChangeLabel(request)}`;

  if (compact) {
    return (
      <span
        className="inline-flex items-center text-amber-600"
        title={label}
      >
        <svg
          className="h-3.5 w-3.5"
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
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-amber-600"
      title={label}
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
    </span>
  );
}
