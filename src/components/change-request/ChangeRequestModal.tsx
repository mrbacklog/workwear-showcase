'use client';

import { useState, useEffect } from 'react';
import type { ShowcaseModel, CategoryNode } from '@/types/product';
import type { ChangeRequestData } from '@/hooks/useChangeRequest';
import { CategoryPicker } from './CategoryPicker';

interface ChangeRequestModalProps {
  isOpen: boolean;
  isLoading: boolean;
  model: ShowcaseModel;
  categoryTree: CategoryNode[];
  onSubmit: (data: ChangeRequestData) => void;
  onClose: () => void;
}

// Status change options based on current publication status
const STATUS_OPTIONS: Record<
  string,
  Array<{ value: string; label: string; description: string }>
> = {
  extended: [
    {
      value: 'core',
      label: 'Promoveren naar Kern',
      description: 'Product wordt onderdeel van het kernassortiment',
    },
    {
      value: 'excluded',
      label: 'Niet gebruiken',
      description: 'Product wordt uitgesloten van het assortiment',
    },
  ],
  core: [
    {
      value: 'extended',
      label: 'Degraderen naar Rand',
      description: 'Product wordt verplaatst naar het randassortiment',
    },
    {
      value: 'excluded',
      label: 'Niet gebruiken',
      description: 'Product wordt uitgesloten van het assortiment',
    },
  ],
};

export function ChangeRequestModal({
  isOpen,
  isLoading,
  model,
  categoryTree,
  onSubmit,
  onClose,
}: ChangeRequestModalProps) {
  const [tab, setTab] = useState<'status' | 'category'>('status');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [note, setNote] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab('status');
      setSelectedStatus('');
      setSelectedCategory('');
      setNote('');
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const statusOptions = STATUS_OPTIONS[model.publicationStatus] ?? [];
  const canSubmit =
    !isLoading &&
    ((tab === 'status' && selectedStatus !== '') ||
      (tab === 'category' && selectedCategory !== ''));

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (tab === 'status') {
      onSubmit({
        changeType: 'status_change',
        requestedValue: selectedStatus,
        note: note.trim() || undefined,
      });
    } else {
      onSubmit({
        changeType: 'category_change',
        requestedValue: selectedCategory,
        note: note.trim() || undefined,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Wijzigingsverzoek
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {model.brandName} {model.modelName}
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab('status')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'status'
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Status wijzigen
          </button>
          <button
            type="button"
            onClick={() => setTab('category')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'category'
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Categorie wijzigen
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {tab === 'status' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Huidige status:{' '}
                <span className="font-medium text-gray-700">
                  {model.publicationStatus === 'core' ? 'Kern' : 'Rand'}
                </span>
              </p>
              {statusOptions.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Geen statuswijzigingen beschikbaar voor dit product.
                </p>
              ) : (
                <div className="space-y-2">
                  {statusOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedStatus === option.value
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={option.value}
                        checked={selectedStatus === option.value}
                        onChange={() => setSelectedStatus(option.value)}
                        className="mt-0.5 h-4 w-4 text-gray-900 focus:ring-gray-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {option.label}
                        </span>
                        <p className="text-xs text-gray-500">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'category' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Huidige categorie:{' '}
                <span className="font-medium text-gray-700">
                  {model.categoryPath || model.categoryCode}
                </span>
              </p>
              <CategoryPicker
                tree={categoryTree}
                currentCategoryCode={model.categoryCode}
                onSelect={setSelectedCategory}
              />
              {selectedCategory && (
                <p className="text-xs text-green-700">
                  Geselecteerd: {selectedCategory}
                </p>
              )}
            </div>
          )}

          {/* Note field */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Toelichting{' '}
              <span className="font-normal text-gray-400">(optioneel)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Reden voor de wijziging..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500/20 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && (
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
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
            )}
            Verzoek indienen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdraw confirmation dialog
// ---------------------------------------------------------------------------

interface WithdrawDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function WithdrawDialog({
  isOpen,
  isLoading,
  onConfirm,
  onClose,
}: WithdrawDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          Verzoek intrekken?
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Weet je zeker dat je dit wijzigingsverzoek wilt intrekken? Je kunt
          daarna een nieuw verzoek indienen.
        </p>

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
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading && (
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
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
            )}
            Intrekken
          </button>
        </div>
      </div>
    </div>
  );
}
