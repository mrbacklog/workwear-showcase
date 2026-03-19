'use client';

interface AutoSuggestProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  visible: boolean;
}

export function AutoSuggest({ suggestions, onSelect, visible }: AutoSuggestProps) {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  const displaySuggestions = suggestions.slice(0, 5);

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      <ul role="listbox">
        {displaySuggestions.map((suggestion, index) => (
          <li key={index}>
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(suggestion);
              }}
            >
              <svg
                className="h-4 w-4 shrink-0 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
