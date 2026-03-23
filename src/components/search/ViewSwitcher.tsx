'use client';

export type ViewMode = 'grid' | 'gallery' | 'hover';

interface ViewSwitcherProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const buttons: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: 'grid',
    label: 'Rasterweergave',
    icon: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    mode: 'gallery',
    label: 'Galerieweergave',
    icon: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden="true">
        <rect x="1" y="1" width="4" height="14" rx="1" />
        <rect x="7" y="1" width="8" height="14" rx="1" />
      </svg>
    ),
  },
  {
    mode: 'hover',
    label: 'Focusweergave',
    icon: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden="true">
        <rect x="1" y="1" width="14" height="14" rx="2" />
      </svg>
    ),
  },
];

export function ViewSwitcher({ mode, onChange }: ViewSwitcherProps) {
  return (
    <div className="bg-gray-100 rounded-lg p-0.5 flex gap-0.5">
      {buttons.map(({ mode: buttonMode, label, icon }) => (
        <button
          key={buttonMode}
          type="button"
          aria-label={label}
          aria-pressed={mode === buttonMode}
          onClick={() => onChange(buttonMode)}
          className={[
            'flex items-center justify-center rounded-md transition-colors',
            'w-7 h-7',
            mode === buttonMode
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-400 hover:text-gray-600',
          ].join(' ')}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
