const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.databiz.app';

// Auth types and functions (previously in nomination-api.ts)
export interface AuthResponse {
  token: string;
  expires_in: number;
}

export async function authenticateWithPin(pin: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/distribution/showcase/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Authenticatie mislukt' }));
    throw new Error(err.detail || 'Authenticatie mislukt');
  }

  return res.json();
}

export interface ChangeRequestResponse {
  id: number;
  modelId: string;
  changeType: string;
  currentValue: string;
  requestedValue: string;
  status: string;
  requestedAt: string;
}

export interface PendingChangeRequestsResponse {
  modelIds: string[];
  requests: Array<{
    id: number;
    modelId: string;
    changeType: string;
    requestedValue: string;
    status: string;
  }>;
}

export async function createChangeRequest(
  data: {
    modelId: string;
    changeType: string;
    requestedValue: string;
    note?: string;
  },
  token: string,
): Promise<ChangeRequestResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/distribution/showcase/change-request`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: 'Wijzigingsverzoek mislukt' }));
    throw new Error(err.detail || 'Wijzigingsverzoek mislukt');
  }

  return res.json();
}

export async function withdrawChangeRequest(
  requestId: number,
  token: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/distribution/showcase/change-request/${requestId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: 'Intrekken mislukt' }));
    throw new Error(err.detail || 'Intrekken mislukt');
  }
}

export async function getPendingChangeRequests(): Promise<PendingChangeRequestsResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/distribution/showcase/change-requests/pending`,
  );

  if (!res.ok) {
    throw new Error('Kon wijzigingsverzoeken niet ophalen');
  }

  return res.json();
}
