'use client';

import { useState, useCallback, useRef } from 'react';
import {
  createChangeRequest,
  withdrawChangeRequest,
} from '@/lib/change-request-api';
import type { UsePendingRequestsReturn } from './usePendingRequests';
import type { TabKey } from '@/components/change-request/ChangeRequestModal';

const SESSION_KEY = 'showcase_session';

interface Session {
  token: string;
  expiresAt: number;
}

export type ChangeRequestFlowStatus =
  | 'idle'
  | 'modal_open'
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
  /** The initial tab to open in the change request modal */
  initialTab: TabKey | null;
  /** Open the change request modal for a model, optionally with an initial tab */
  startChangeRequest: (modelId: string, tab?: TabKey) => void;
  /** Submit the change request */
  submitChangeRequest: (data: ChangeRequestData) => void;
  /** Start withdraw flow for a pending request */
  startWithdraw: (modelId: string) => void;
  /** Confirm the withdrawal */
  confirmWithdraw: () => void;
  /** Cancel current flow (close modal / cancel withdraw) */
  cancel: () => void;
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
  const [initialTab, setInitialTab] = useState<TabKey | null>(null);

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
          addToast('error', 'Sessie verlopen, ontgrendel opnieuw via het slot-icoontje');
          setStatus('idle');
          setActiveModelId(null);
          pendingDataRef.current = null;
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
          addToast('error', 'Sessie verlopen, ontgrendel opnieuw via het slot-icoontje');
        } else {
          addToast('error', message);
        }
        setStatus('idle');
        setActiveModelId(null);
      }
    },
    [addToast, pending],
  );

  // -------------------------------------------------------------------------
  // Public interface
  // -------------------------------------------------------------------------

  const startChangeRequest = useCallback((modelId: string, tab?: TabKey) => {
    setActiveModelId(modelId);
    setInitialTab(tab ?? null);
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
        addToast('error', 'Sessie verlopen, ontgrendel opnieuw via het slot-icoontje');
        setStatus('idle');
        setActiveModelId(null);
        pendingDataRef.current = null;
      }
    },
    [activeModelId, addToast, performCreate],
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
      addToast('error', 'Sessie verlopen, ontgrendel opnieuw via het slot-icoontje');
      setStatus('idle');
      setActiveModelId(null);
    }
  }, [activeModelId, addToast, performWithdraw]);

  const cancel = useCallback(() => {
    setStatus('idle');
    setActiveModelId(null);
    setInitialTab(null);
    setErrorMessage(null);
    pendingDataRef.current = null;
  }, []);

  return {
    status,
    activeModelId,
    initialTab,
    startChangeRequest,
    submitChangeRequest,
    startWithdraw,
    confirmWithdraw,
    cancel,
    toasts,
    dismissToast,
    errorMessage,
  };
}
