import type { EnrichmentStatusResponse } from '@/types/product';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.databiz.app';

export interface EnrichResponse {
  requestId: string;
  status: string;
}

export interface ReviewAction {
  fieldActions?: Array<{
    fieldProposalId: string;
    action: 'accept' | 'reject';
    editedValue?: string;
  }>;
  imageActions?: Array<{
    imageProposalId: string;
    action: 'accept' | 'reject';
  }>;
}

export async function triggerEnrichment(
  modelId: string,
  token: string,
  requestType: string = 'both',
): Promise<EnrichResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/distribution/showcase/enrich`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ modelId, requestType }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Verrijking starten mislukt' }));
    throw new Error(err.detail || 'Verrijking starten mislukt');
  }

  return res.json();
}

export async function getEnrichmentStatus(
  modelId: string,
  token: string,
): Promise<EnrichmentStatusResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/distribution/showcase/enrichment-status/${modelId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Status ophalen mislukt' }));
    throw new Error(err.detail || 'Status ophalen mislukt');
  }

  return res.json();
}

export async function reviewProposal(
  proposalId: string,
  actions: ReviewAction,
  token: string,
): Promise<{ success: boolean; status: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/distribution/showcase/enrichment-proposal/${proposalId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(actions),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Review mislukt' }));
    throw new Error(err.detail || 'Review mislukt');
  }

  return res.json();
}

export async function bulkAcceptConsensus(
  proposalId: string,
  token: string,
): Promise<{ success: boolean; status: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/distribution/showcase/enrichment-proposal/${proposalId}/bulk-accept`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Bulk accept mislukt' }));
    throw new Error(err.detail || 'Bulk accept mislukt');
  }

  return res.json();
}
