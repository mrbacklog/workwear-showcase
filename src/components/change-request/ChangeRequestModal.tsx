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
  selectedColorGroupIndex: number;
  onSubmit: (data: ChangeRequestData) => void;
  onClose: () => void;
}

type Tab = 'status' | 'category' | 'name' | 'cover';

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
  selectedColorGroupIndex,
  onSubmit,
  onClose,
}: ChangeRequestModalProps) {
  const [tab, setTab] = useState<Tab>('status');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedImageId, setSelectedImageId] = useState('');
  const [note, setNote] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab('status');
      setSelectedStatus('');
      setSelectedCategory('');
      setNewName('');
      setSelectedImageId('');
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
  const currentColorGroup = model.colorGroups[selectedColorGroupIndex];
  const images = currentColorGroup?.images ?? [];
  const hasImageIds = images.some((img) => img.id && img.id !== '');

  const canSubmit =
    !isLoading &&
    ((tab === 'status' && selectedStatus !== '') ||
      (tab === 'category' && selectedCategory !== '') ||
      (tab === 'name' && newName.trim() !== '' && newName.trim() !== model.modelName) ||
      (tab === 'cover' && selectedImageId !== ''));

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (tab === 'status') {
      onSubmit({
        changeType: 'status_change',
        requestedValue: selectedStatus,
        note: note.trim() || undefined,
      });
    } else if (tab === 'category') {
      onSubmit({
        changeType: 'category_change',
        requestedValue: selectedCategory,
        note: note.trim() || undefined,
      });
    } else if (tab === 'name') {
      onSubmit({
        changeType: 'name_change',
        requestedValue: newName.trim(),
        note: note.trim() || undefined,
      });
    } else if (tab === 'cover') {
      onSubmit({
        changeType: 'cover_change',
        requestedValue: selectedImageId,
        note: note.trim() || undefined,
      });
    }
  };

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'status', label: 'Status' },
    { key: 'category', label: 'Categorie' },
    { key: 'name', label: 'Naam' },
    { key: 'cover', label: 'Foto' },
  ];

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
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Status tab */}
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

          {/* Category tab */}
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

          {/* Name tab */}
          {tab === 'name' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Huidige naam:{' '}
                <span className="font-medium text-gray-700">
                  {model.modelName}
                </span>
              </p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={500}
                placeholder="Nieuwe productnaam..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500/20"
              />
              <div className="flex justify-between">
                <p className="text-xs text-gray-400">
                  {newName.trim() === model.modelName
                    ? 'Naam moet anders zijn dan de huidige naam'
                    : '\u00A0'}
                </p>
                <p className="text-xs text-gray-400">
                  {newName.length}/500
                </p>
              </div>
            </div>
          )}

          {/* Cover image tab */}
          {tab === 'cover' && (
            <div className="space-y-2">
              {!hasImageIds ? (
                <p className="text-sm text-gray-400">
                  Omslagfoto wijzigen is pas beschikbaar na de volgende sync.
                </p>
              ) : images.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Geen afbeeldingen beschikbaar voor deze kleurgroep.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-500">
                    Selecteer een afbeelding als omslagfoto voor{' '}
                    <span className="font-medium text-gray-700">
                      {currentColorGroup?.colorName || currentColorGroup?.colorRaw || 'deze kleur'}
                    </span>
                  </p>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {images.map((img) => {
                      const isCurrentCover = img.isCover;
                      const isSelected = selectedImageId === img.id;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => {
                            if (!isCurrentCover) setSelectedImageId(img.id);
                          }}
                          disabled={isCurrentCover}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? 'border-gray-900 ring-2 ring-gray-900/20'
                              : isCurrentCover
                                ? 'border-green-500 opacity-75 cursor-default'
                                : 'border-gray-200 hover:border-gray-400 cursor-pointer'
                          }`}
                        >
                          <img
                            src={img.thumb400Webp}
                            alt={`${img.imageType || 'product'}`}
                            className="h-full w-full object-cover"
                          />
                          {isCurrentCover && (
                            <span className="absolute bottom-0 left-0 right-0 bg-green-600 px-1 py-0.5 text-[10px] font-medium text-white text-center">
                              Huidig
                            </span>
                          )}
                          {isSelected && (
                            <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
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
