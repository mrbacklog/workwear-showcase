'use client';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = 'Zoek producten...',
}: SearchInputProps) {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <svg
          className="h-4 w-4 text-gray-400"
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
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full rounded-full border border-gray-700 bg-white/10 py-2.5 pl-11 pr-5 text-sm text-white placeholder-gray-500 transition-colors focus:border-amber-500 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
      />
    </div>
  );
}
