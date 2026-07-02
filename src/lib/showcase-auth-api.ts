const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.databiz.app';

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
