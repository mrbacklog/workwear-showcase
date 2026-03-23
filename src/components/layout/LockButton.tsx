'use client';

import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';

export function LockButton() {
  const { isUnlocked, lock, openPinModal } = useShowcaseAuth();

  if (isUnlocked) {
    return (
      <button
        type="button"
        onClick={lock}
        title="Vergrendelen"
        className="rounded-lg p-2 text-green-400 hover:bg-white/10 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openPinModal}
      title="Ontgrendelen"
      className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    </button>
  );
}
