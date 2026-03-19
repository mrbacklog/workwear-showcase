'use client';

import { useState, useEffect, useRef } from 'react';

interface PinModalProps {
  isOpen: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onSubmit: (pin: string) => void;
  onClose: () => void;
}

export function PinModal({ isOpen, isLoading, errorMessage, onSubmit, onClose }: PinModalProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const isValidPin = pin.length >= 4;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidPin && !isLoading) {
      onSubmit(pin);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-900">PIN invoeren</h2>
        <p className="mt-1 text-sm text-gray-500">
          Voer uw toegangscode in.
        </p>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setPin(val);
          }}
          disabled={isLoading}
          placeholder="Toegangscode"
          className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.3em] placeholder:text-base placeholder:tracking-normal focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:bg-gray-50 disabled:text-gray-400"
        />

        {errorMessage && (
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={!isValidPin || isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Bevestigen
          </button>
        </div>
      </form>
    </div>
  );
}
