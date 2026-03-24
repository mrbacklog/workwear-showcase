'use client';

interface SpecialColorFilterProps {
  hiVisCount: number;
  fluorescentCount: number;
  hiVisActive: boolean;
  fluorescentActive: boolean;
  onToggleHiVis: () => void;
  onToggleFluorescent: () => void;
}

export function SpecialColorFilter({
  hiVisCount,
  fluorescentCount,
  hiVisActive,
  fluorescentActive,
  onToggleHiVis,
  onToggleFluorescent,
}: SpecialColorFilterProps) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Speciale kleuren
      </h2>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onToggleHiVis}
          disabled={hiVisCount === 0 && !hiVisActive}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
            hiVisActive
              ? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-400'
              : hiVisCount === 0
                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Hi-Vis
          <span className={hiVisActive ? 'text-yellow-600' : 'text-gray-400'}>
            {hiVisCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleFluorescent}
          disabled={fluorescentCount === 0 && !fluorescentActive}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
            fluorescentActive
              ? 'bg-lime-100 text-lime-800 ring-1 ring-lime-400'
              : fluorescentCount === 0
                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Fluorescerend
          <span className={fluorescentActive ? 'text-lime-600' : 'text-gray-400'}>
            {fluorescentCount}
          </span>
        </button>
      </div>
    </div>
  );
}
