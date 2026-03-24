'use client';

import { useState } from 'react';
import type { EnrichmentProposal, FieldProposal, ImageProposal } from '@/types/product';

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

interface EnrichmentPanelProps {
  proposals: EnrichmentProposal[];
  isReviewing: boolean;
  onAcceptField: (proposalId: string, fieldProposalId: string) => void;
  onRejectField: (proposalId: string, fieldProposalId: string) => void;
  onAcceptImage: (proposalId: string, imageProposalId: string) => void;
  onRejectImage: (proposalId: string, imageProposalId: string) => void;
  onBulkAccept: (proposalId: string) => void;
}

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
  const isPending = field.status === 'pending';

  return (
    <tr className={`border-b border-gray-100 ${!isPending ? 'opacity-60' : ''}`}>
      <td className="py-2 pr-3 text-sm font-medium text-gray-700 whitespace-nowrap">
        {FIELD_LABELS[field.fieldName] || field.fieldName}
      </td>
      <td className="py-2 pr-3 text-sm text-gray-400 max-w-[120px] truncate" title={field.currentValue || '-'}>
        {field.currentValue || '-'}
      </td>
      <td className="py-2 pr-3 text-sm text-gray-900 max-w-[200px]">
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

export function EnrichmentPanel({
  proposals,
  isReviewing,
  onAcceptField,
  onRejectField,
  onAcceptImage,
  onRejectImage,
  onBulkAccept,
}: EnrichmentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (proposals.length === 0) return null;

  const latestProposal = proposals[0];
  const fieldProposals = latestProposal.fieldProposals;
  const imageProposals = latestProposal.imageProposals;
  const hasConsensus = fieldProposals.some(
    (fp) => fp.consensusStatus === 'consensus' && fp.status === 'pending',
  );
  const pendingCount = fieldProposals.filter((fp) => fp.status === 'pending').length +
    imageProposals.filter((ip) => ip.status === 'pending').length;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-900">
            Verrijkingsvoorstellen
          </span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              {pendingCount} openstaand
            </span>
          )}
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-blue-200 px-4 py-3 space-y-4">
          {/* Bulk accept button */}
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
        </div>
      )}
    </div>
  );
}
