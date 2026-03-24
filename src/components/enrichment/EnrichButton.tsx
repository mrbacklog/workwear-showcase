'use client';

import type { EnrichmentFlowStatus } from '@/hooks/useEnrichment';

interface EnrichButtonProps {
  status: EnrichmentFlowStatus;
  hasProposals: boolean;
  onTrigger: () => void;
  onViewProposals: () => void;
}

export function EnrichButton({
  status,
  hasProposals,
  onTrigger,
  onViewProposals,
}: EnrichButtonProps) {
  // Processing state
  if (status === 'triggering' || status === 'processing') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 cursor-wait"
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
        Verrijking bezig...
      </button>
    );
  }

  // Completed with proposals
  if ((status === 'completed' || status === 'idle') && hasProposals) {
    return (
      <button
        type="button"
        onClick={onViewProposals}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Voorstellen bekijken
      </button>
    );
  }

  // Error state with retry
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onTrigger}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Opnieuw verrijken
      </button>
    );
  }

  // Default: trigger button
  return (
    <button
      type="button"
      onClick={onTrigger}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      Verrijk
    </button>
  );
}
