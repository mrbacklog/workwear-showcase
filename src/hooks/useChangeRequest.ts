'use client';

import { useState, useCallback, useRef } from 'react';
import {
  authenticateWithPin,
  createChangeRequest,
  withdrawChangeRequest,
} from '@/lib/change-request-api';
import type { UsePendingRequestsReturn } from './usePendingRequests';

const SESSION_KEY = 'showcase_session';

interface Session {
  token: string;
  expiresAt: number;
}

export type ChangeRequestFlowStatus =
  | 'idle'
  | 'modal_open'
  | 'needs_pin'
  | 'authenticating'
  | 'submitting'
  | 'withdrawing'
  | 'confirm_withdraw'
  | 'success'
  | 'error';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export interface ChangeRequestData {
  changeType: 'status_change' | 'category_change' | 'name_change' | 'cover_change';
  requestedValue: string;
  note?: string;
}

export interface UseChangeRequestReturn {
  status: ChangeRequestFlowStatus;
  /** The model ID currently being acted on */
  activeModelId: string | null;
  /** Open the change request modal for a model */
  startChangeRequest: (modelId: string) => void;
  /** Submit the change request (may trigger PIN first) */
  submitChangeRequest: (data: ChangeRequestData) => void;
  /** Start withdraw flow for a pending request */
  startWithdraw: (modelId: string) => void;
  /** Confirm the withdrawal */
  confirmWithdraw: () => void;
  /** Cancel current flow (close modal / cancel PIN / cancel withdraw) */
  cancel: () => void;
  /** Submit PIN code */
  submitPin: (pin: string) => void;
  /** Toast messages */
  toasts: ToastMessage[];
  dismissToast: (id: number) => void;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function getValidSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(token: string, expiresInSeconds: number): void {
  const session: Session = {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage unavailable
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChangeRequest(
  pending: UsePendingRequestsReturn,
): UseChangeRequestReturn {
  const [status, setStatus] = useState<ChangeRequestFlowStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const pendingDataRef = useRef<ChangeRequestData | null>(null);
  const toastIdCounter = useRef(0);
  const busyRef = useRef(false);

  // -------------------------------------------------------------------------
  // Toast helpers
  // -------------------------------------------------------------------------

  const addToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      const id = ++toastIdCounter.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // -------------------------------------------------------------------------
  // Perform API calls
  // -------------------------------------------------------------------------

  const performCreate = useCallback(
    async (modelId: string, data: ChangeRequestData, token: string) => {
      setStatus('submitting');
      try {
        const result = await createChangeRequest(
          {
            modelId,
            changeType: data.changeType,
            requestedValue: data.requestedValue,
            note: data.note,
          },
          token,
        );
        pending.addLocal({
          id: result.id,
          modelId: result.modelId,
          changeType: data.changeType,
          requestedValue: data.requestedValue,
          status: 'pending',
        });
        addToast('success', 'Wijzigingsverzoek ingediend!');
        setStatus('idle');
        setActiveModelId(null);
        pendingDataRef.current = null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Wijzigingsverzoek mislukt';
        if (message.includes('Ongeldig of verlopen token')) {
          try {
            localStorage.removeItem(SESSION_KEY);
          } catch {
            /* noop */
          }
          setStatus('needs_pin');
          setErrorMessage(null);
        } else {
          addToast('error', message);
          setStatus('idle');
          setActiveModelId(null);
          pendingDataRef.current = null;
        }
      }
    },
    [addToast, pending],
  );

  const performWithdraw = useCallback(
    async (modelId: string, token: string) => {
      setStatus('withdrawing');
      const req = pending.getPending(modelId);
      if (!req) {
        addToast('error', 'Geen pending verzoek gevonden');
        setStatus('idle');
        setActiveModelId(null);
        return;
      }
      try {
        await withdrawChangeRequest(req.id, token);
        pending.removeLocal(modelId);
        addToast('success', 'Wijzigingsverzoek ingetrokken');
        setStatus('idle');
        setActiveModelId(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Intrekken mislukt';
        if (message.includes('Ongeldig of verlopen token')) {
          try {
            localStorage.removeItem(SESSION_KEY);
          } catch {
            /* noop */
          }
          setStatus('needs_pin');
          setErrorMessage(null);
        } else {
          addToast('error', message);
          setStatus('idle');
          setActiveModelId(null);
        }
      }
    },
    [addToast, pending],
  );

  // -------------------------------------------------------------------------
  // Public interface
  // -------------------------------------------------------------------------

  const startChangeRequest = useCallback((modelId: string) => {
    setActiveModelId(modelId);
    setErrorMessage(null);
    setStatus('modal_open');
  }, []);

  const submitChangeRequest = useCallback(
    (data: ChangeRequestData) => {
      if (busyRef.current || !activeModelId) return;
      pendingDataRef.current = data;

      const session = getValidSession();
      if (session) {
        busyRef.current = true;
        performCreate(activeModelId, data, session.token).finally(() => {
          busyRef.current = false;
        });
      } else {
        setStatus('needs_pin');
        setErrorMessage(null);
      }
    },
    [activeModelId, performCreate],
  );

  const startWithdraw = useCallback((modelId: string) => {
    setActiveModelId(modelId);
    setErrorMessage(null);
    setStatus('confirm_withdraw');
  }, []);

  const confirmWithdraw = useCallback(() => {
    if (busyRef.current || !activeModelId) return;

    const session = getValidSession();
    if (session) {
      busyRef.current = true;
      performWithdraw(activeModelId, session.token).finally(() => {
        busyRef.current = false;
      });
    } else {
      setStatus('needs_pin');
      setErrorMessage(null);
    }
  }, [activeModelId, performWithdraw]);

  const cancel = useCallback(() => {
    setStatus('idle');
    setActiveModelId(null);
    setErrorMessage(null);
    pendingDataRef.current = null;
  }, []);

  const submitPin = useCallback(
    async (pin: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setStatus('authenticating');
      setErrorMessage(null);

      try {
        const authResult = await authenticateWithPin(pin);
        saveSession(authResult.token, authResult.expires_in);

        if (!activeModelId) {
          setStatus('idle');
          busyRef.current = false;
          return;
        }

        // Check if we're in a withdraw or create flow
        const pendingReq = pending.getPending(activeModelId);
        if (pendingReq && !pendingDataRef.current) {
          // Withdraw flow
          await performWithdraw(activeModelId, authResult.token);
        } else if (pendingDataRef.current) {
          // Create flow
          await performCreate(
            activeModelId,
            pendingDataRef.current,
            authResult.token,
          );
        } else {
          setStatus('idle');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Authenticatie mislukt';
        setErrorMessage(message);
        setStatus('needs_pin');
      } finally {
        busyRef.current = false;
      }
    },
    [activeModelId, pending, performCreate, performWithdraw],
  );

  return {
    status,
    activeModelId,
    startChangeRequest,
    submitChangeRequest,
    startWithdraw,
    confirmWithdraw,
    cancel,
    submitPin,
    toasts,
    dismissToast,
    errorMessage,
  };
}
