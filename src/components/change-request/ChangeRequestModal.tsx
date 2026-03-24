'use client';

import { useState, useEffect } from 'react';
import type { ShowcaseModel, CategoryNode, EnrichmentProposal, FieldProposal, ImageProposal } from '@/types/product';
import type { ChangeRequestData } from '@/hooks/useChangeRequest';
import { CategoryPicker } from './CategoryPicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TabKey = 'status' | 'category' | 'name' | 'cover' | 'enrichment';

interface EnrichmentActions {
  status: string;
  proposals: EnrichmentProposal[];
  notFoundFields: string[];
  onTrigger: () => void;
  onAcceptField: (proposalId: string, fieldProposalId: string) => void;
  onRejectField: (proposalId: string, fieldProposalId: string) => void;
  onAcceptImage: (proposalId: string, imageProposalId: string) => void;
  onRejectImage: (proposalId: string, imageProposalId: string) => void;
  onBulkAccept: (proposalId: string) => void;
}

interface ChangeRequestModalProps {
  isOpen: boolean;
  isLoading: boolean;
  model: ShowcaseModel;
  categoryTree: CategoryNode[];
  selectedColorGroupIndex: number;
  initialTab?: TabKey;
  enrichment: EnrichmentActions;
  onSubmit: (data: ChangeRequestData) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const FIELD_LABELS: Record<string, string> = {
  short_description_nl: 'Korte beschrijving',
  short_description_en: 'Short description',
  description_nl: 'Beschrijving',
  description_en: 'Description',
  long_description_nl: 'Beschrijving',
  long_description_en: 'Description',
  material: 'Materiaal',
  safety_norms: 'Veiligheidsnormen',
  gender: 'Geslacht',
  care_instructions: 'Wasinstructies',
  country_of_origin: 'Land van herkomst',
  fabric_type_weight: 'Stoftype/gewicht',
  category_code: 'Categorie',
};

// ---------------------------------------------------------------------------
// Enrichment sub-components
// ---------------------------------------------------------------------------

function ConsensusBadge({ status }: { status: string }) {
  if (status === 'consensus') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
        Consensus
      </span>
    );
  }
  if (status === 'conflict') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
        Conflict
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
      1 bron
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700';
  return <span className={`text-[10px] font-medium ${color}`}>{pct}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'accepted') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
        Geaccepteerd
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
        Afgewezen
      </span>
    );
  }
  return null;
}

function FieldRow({
  proposal,
  field,
  isReviewing,
  onAccept,
  onReject,
}: {
  proposal: EnrichmentProposal;
  field: FieldProposal;
  isReviewing: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  void proposal;
  const isPending = field.status === 'pending';
  return (
    <tr className={`border-b border-gray-100 ${!isPending ? 'opacity-60' : ''}`}>
      <td className="py-2 pr-3 text-sm font-medium text-gray-700 whitespace-nowrap">
        {FIELD_LABELS[field.fieldName] || field.fieldName}
      </td>
      <td className="py-2 pr-3 text-sm text-gray-400 max-w-[140px] truncate" title={field.currentValue || '-'}>
        {field.currentValue || '-'}
      </td>
      <td className="py-2 pr-3 text-sm text-gray-900 max-w-[280px]">
        <span className="line-clamp-2" title={field.proposedValue}>
          {field.proposedValue}
        </span>
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1">
          <ConsensusBadge status={field.consensusStatus} />
          <ConfidenceBadge confidence={field.confidence} />
        </div>
      </td>
      <td className="py-2 text-right">
        {isPending ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={onAccept}
              disabled={isReviewing}
              className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
              title="Accepteren"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isReviewing}
              className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
              title="Afwijzen"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <StatusBadge status={field.status} />
        )}
      </td>
    </tr>
  );
}

function ImageCard({
  proposal,
  image,
  isReviewing,
  onAccept,
  onReject,
}: {
  proposal: EnrichmentProposal;
  image: ImageProposal;
  isReviewing: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  void proposal;
  const isPending = image.status === 'pending';
  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden ${!isPending ? 'opacity-60' : ''}`}>
      <div className="aspect-square bg-gray-100">
        <img
          src={image.imageUrl}
          alt={image.shotType || 'product'}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-gray-500 uppercase">
            {image.shotType || 'onbekend'}
          </span>
          {image.coverScore !== null && (
            <span className="text-[10px] text-gray-400">
              Score: {image.coverScore}
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 truncate">{image.source}</p>
        {isPending ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onAccept}
              disabled={isReviewing}
              className="flex-1 rounded bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              Accepteer
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isReviewing}
              className="flex-1 rounded bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Afwijs
            </button>
          </div>
        ) : (
          <StatusBadge status={image.status} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enrichment tab content
// ---------------------------------------------------------------------------

function EnrichmentTabContent({ enrichment }: { enrichment: EnrichmentActions }) {
  const { status, proposals, notFoundFields, onTrigger, onAcceptField, onRejectField, onAcceptImage, onRejectImage, onBulkAccept } = enrichment;

  const isTriggering = status === 'triggering';
  const isProcessing = status === 'processing';
  const isBusy = isTriggering || isProcessing;
  const hasProposals = proposals.length > 0;

  if (!hasProposals) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        {isBusy ? (
          <>
            <svg className="h-8 w-8 animate-spin text-blue-500 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Verrijking bezig...</p>
            <p className="mt-1 text-xs text-gray-400">Dit kan een moment duren</p>
          </>
        ) : (
          <>
            <svg className="h-10 w-10 text-gray-300 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Nog geen verrijkingsvoorstellen</p>
            <p className="mt-1 text-xs text-gray-400 max-w-xs">
              Start de verrijking om automatisch veld- en afbeeldingsvoorstellen te genereren via meerdere databronnen.
            </p>
            <button
              type="button"
              onClick={onTrigger}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
              Start verrijking
            </button>
          </>
        )}
      </div>
    );
  }

  const latestProposal = proposals[0];
  const fieldProposals = latestProposal.fieldProposals;
  const imageProposals = latestProposal.imageProposals;
  const hasConsensus = fieldProposals.some(
    (fp) => fp.consensusStatus === 'consensus' && fp.status === 'pending',
  );
  const isReviewing = false;

  return (
    <div className="space-y-4">
      {/* Status header */}
      {isBusy && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <svg className="h-4 w-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Verrijking bezig...
        </div>
      )}

      {/* Bulk accept */}
      {hasConsensus && (
        <button
          type="button"
          onClick={() => onBulkAccept(latestProposal.id)}
          disabled={isReviewing}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
          Alles met consensus accepteren
        </button>
      )}

      {/* Field proposals */}
      {fieldProposals.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Veldvoorstellen
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-1 pr-3 text-[10px] font-medium text-gray-400 uppercase">Veld</th>
                  <th className="pb-1 pr-3 text-[10px] font-medium text-gray-400 uppercase">Huidig</th>
                  <th className="pb-1 pr-3 text-[10px] font-medium text-gray-400 uppercase">Voorstel</th>
                  <th className="pb-1 pr-3 text-[10px] font-medium text-gray-400 uppercase">Bron</th>
                  <th className="pb-1 text-[10px] font-medium text-gray-400 uppercase text-right">Actie</th>
                </tr>
              </thead>
              <tbody>
                {fieldProposals.map((fp) => (
                  <FieldRow
                    key={fp.id}
                    proposal={latestProposal}
                    field={fp}
                    isReviewing={isReviewing}
                    onAccept={() => onAcceptField(latestProposal.id, fp.id)}
                    onReject={() => onRejectField(latestProposal.id, fp.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image proposals */}
      {imageProposals.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Afbeeldingsvoorstellen
          </h4>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {imageProposals.map((ip) => (
              <ImageCard
                key={ip.id}
                proposal={latestProposal}
                image={ip}
                isReviewing={isReviewing}
                onAccept={() => onAcceptImage(latestProposal.id, ip.id)}
                onReject={() => onRejectImage(latestProposal.id, ip.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Not-found fields */}
      {notFoundFields.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Niet gevonden bij externe bronnen
          </h4>
          <div className="space-y-1">
            {notFoundFields.map((field) => (
              <div key={field} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <span className="text-sm text-gray-400">
                  {FIELD_LABELS[field] || field}
                </span>
                <span className="ml-auto text-xs text-gray-300">&mdash;</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  {
    key: 'status',
    label: 'Status',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'category',
    label: 'Categorie',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    key: 'name',
    label: 'Naam',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
      </svg>
    ),
  },
  {
    key: 'cover',
    label: 'Foto',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    key: 'enrichment',
    label: 'Verrijking',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function ChangeRequestModal({
  isOpen,
  isLoading,
  model,
  categoryTree,
  selectedColorGroupIndex,
  initialTab,
  enrichment,
  onSubmit,
  onClose,
}: ChangeRequestModalProps) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'status');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedImageId, setSelectedImageId] = useState('');
  const [note, setNote] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab ?? 'status');
      setSelectedStatus('');
      setSelectedCategory('');
      setNewName('');
      setSelectedImageId('');
      setNote('');
    }
  }, [isOpen, initialTab]);

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

  const isEnrichmentTab = tab === 'enrichment';

  const canSubmit =
    !isLoading &&
    !isEnrichmentTab &&
    ((tab === 'status' && selectedStatus !== '') ||
      (tab === 'category' && selectedCategory !== '') ||
      (tab === 'name' && newName.trim() !== '' && newName.trim() !== model.modelName) ||
      (tab === 'cover' && selectedImageId !== ''));

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (tab === 'status') {
      onSubmit({ changeType: 'status_change', requestedValue: selectedStatus, note: note.trim() || undefined });
    } else if (tab === 'category') {
      onSubmit({ changeType: 'category_change', requestedValue: selectedCategory, note: note.trim() || undefined });
    } else if (tab === 'name') {
      onSubmit({ changeType: 'name_change', requestedValue: newName.trim(), note: note.trim() || undefined });
    } else if (tab === 'cover') {
      onSubmit({ changeType: 'cover_change', requestedValue: selectedImageId, note: note.trim() || undefined });
    }
  };

  // Pending enrichment proposals count for badge
  const pendingEnrichmentCount = enrichment.proposals.length > 0
    ? (enrichment.proposals[0].fieldProposals.filter((fp) => fp.status === 'pending').length +
       enrichment.proposals[0].imageProposals.filter((ip) => ip.status === 'pending').length)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Wijzigingsverzoek</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {model.brandName} {model.modelName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="ml-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 transition-colors"
            aria-label="Sluiten"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile: horizontal pill tabs */}
        <div className="md:hidden flex-shrink-0 border-b border-gray-200 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
                {t.key === 'enrichment' && pendingEnrichmentCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                    {pendingEnrichmentCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Desktop: vertical sidebar */}
          <nav className="hidden md:flex flex-col w-40 flex-shrink-0 border-r border-gray-200 py-3 gap-0.5 px-2 overflow-y-auto">
            {TABS.map((t, index) => (
              <>
                {/* Divider before Verrijking tab */}
                {index === 4 && (
                  <div key="divider" className="my-1 border-t border-gray-200 mx-1" />
                )}
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left ${
                    tab === t.key
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.key === 'enrichment' && pendingEnrichmentCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      {pendingEnrichmentCount}
                    </span>
                  )}
                </button>
              </>
            ))}
          </nav>

          {/* Content area */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
                            <span className="text-sm font-medium text-gray-900">{option.label}</span>
                            <p className="text-xs text-gray-500">{option.description}</p>
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
                    <p className="text-xs text-green-700">Geselecteerd: {selectedCategory}</p>
                  )}
                </div>
              )}

              {/* Name tab */}
              {tab === 'name' && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    Huidige naam:{' '}
                    <span className="font-medium text-gray-700">{model.modelName}</span>
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
                    <p className="text-xs text-gray-400">{newName.length}/500</p>
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
                              onClick={() => { if (!isCurrentCover) setSelectedImageId(img.id); }}
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

              {/* Enrichment tab */}
              {tab === 'enrichment' && (
                <EnrichmentTabContent enrichment={enrichment} />
              )}

              {/* Note field — hidden on enrichment tab */}
              {!isEnrichmentTab && (
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
              )}
            </div>

            {/* Sticky footer — hidden on enrichment tab */}
            {!isEnrichmentTab && (
              <div className="flex gap-3 border-t border-gray-200 px-6 py-4 flex-shrink-0">
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
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Verzoek indienen
                </button>
              </div>
            )}
          </div>
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
        <h2 className="text-lg font-semibold text-gray-900">Verzoek intrekken?</h2>
        <p className="mt-2 text-sm text-gray-500">
          Weet je zeker dat je dit wijzigingsverzoek wilt intrekken? Je kunt daarna een nieuw verzoek indienen.
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
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Intrekken
          </button>
        </div>
      </div>
    </div>
  );
}
