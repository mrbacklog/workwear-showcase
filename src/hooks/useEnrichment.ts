'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentStatusResponse, EnrichmentProposal } from '@/types/product';
import {
  triggerEnrichment,
  getEnrichmentStatus,
  reviewProposal,
  bulkAcceptConsensus,
} from '@/lib/enrichment-api';

const SESSION_KEY = 'showcase_session';

interface Session {
  token: string;
  expiresAt: number;
}

export type EnrichmentFlowStatus =
  | 'idle'
  | 'needs_pin'
  | 'triggering'
  | 'processing'
  | 'completed'
  | 'reviewing'
  | 'error';

export interface UseEnrichmentReturn {
  status: EnrichmentFlowStatus;
  enrichmentData: EnrichmentStatusResponse | null;
  proposals: EnrichmentProposal[];
  errorMessage: string | null;
  trigger: (modelId: string) => void;
  checkStatus: (modelId: string) => void;
  acceptField: (proposalId: string, fieldProposalId: string) => Promise<void>;
  rejectField: (proposalId: string, fieldProposalId: string) => Promise<void>;
  acceptImage: (proposalId: string, imageProposalId: string) => Promise<void>;
  rejectImage: (proposalId: string, imageProposalId: string) => Promise<void>;
  bulkAccept: (proposalId: string) => Promise<void>;
  submitPin: (pin: string) => void;
  cancel: () => void;
}

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

export function useEnrichment(): UseEnrichmentReturn {
  const [status, setStatus] = useState<EnrichmentFlowStatus>('idle');
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeModelIdRef = useRef<string | null>(null);
  const pendingActionRef = useRef<'trigger' | 'check' | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((modelId: string, token: string) => {
    stopPolling();
    setStatus('processing');

    const poll = async () => {
      try {
        const result = await getEnrichmentStatus(modelId, token);
        setEnrichmentData(result);

        if (result.status === 'completed' || result.status === 'failed') {
          stopPolling();
          setStatus(result.status === 'completed' ? 'completed' : 'error');
          if (result.status === 'failed') {
            setErrorMessage('Verrijking mislukt');
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Polling mislukt';
        if (msg.includes('Ongeldig of verlopen token')) {
          stopPolling();
          setStatus('needs_pin');
          pendingActionRef.current = 'check';
        }
      }
    };

    // Poll immediately, then every 3s
    poll();
    pollingRef.current = setInterval(poll, 3000);
  }, [stopPolling]);

  const trigger = useCallback((modelId: string) => {
    activeModelIdRef.current = modelId;
    const session = getValidSession();

    if (!session) {
      pendingActionRef.current = 'trigger';
      setStatus('needs_pin');
      return;
    }

    setStatus('triggering');
    setErrorMessage(null);

    triggerEnrichment(modelId, session.token)
      .then(() => {
        startPolling(modelId, session.token);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Verrijking mislukt';
        if (msg.includes('Ongeldig of verlopen token')) {
          pendingActionRef.current = 'trigger';
          setStatus('needs_pin');
        } else {
          setErrorMessage(msg);
          setStatus('error');
        }
      });
  }, [startPolling]);

  const checkStatus = useCallback((modelId: string) => {
    activeModelIdRef.current = modelId;
    const session = getValidSession();

    if (!session) {
      pendingActionRef.current = 'check';
      setStatus('needs_pin');
      return;
    }

    getEnrichmentStatus(modelId, session.token)
      .then((result) => {
        setEnrichmentData(result);
        if (result.status === 'pending' || result.status === 'processing') {
          startPolling(modelId, session.token);
        } else if (result.status === 'completed') {
          setStatus('completed');
        } else if (result.status === 'none') {
          setStatus('idle');
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        // Silently fail on initial check
        setStatus('idle');
      });
  }, [startPolling]);

  const submitPin = useCallback(async (pin: string) => {
    const { authenticateWithPin } = await import('@/lib/change-request-api');
    setErrorMessage(null);

    try {
      const authResult = await authenticateWithPin(pin);
      const session: Session = {
        token: authResult.token,
        expiresAt: Date.now() + authResult.expires_in * 1000,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));

      const modelId = activeModelIdRef.current;
      if (!modelId) {
        setStatus('idle');
        return;
      }

      if (pendingActionRef.current === 'trigger') {
        pendingActionRef.current = null;
        setStatus('triggering');
        try {
          await triggerEnrichment(modelId, session.token);
          startPolling(modelId, session.token);
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Verrijking mislukt');
          setStatus('error');
        }
      } else {
        pendingActionRef.current = null;
        startPolling(modelId, session.token);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authenticatie mislukt');
      setStatus('needs_pin');
    }
  }, [startPolling]);

  const performReview = useCallback(async (
    proposalId: string,
    fieldActions: Array<{ fieldProposalId: string; action: 'accept' | 'reject' }>,
    imageActions: Array<{ imageProposalId: string; action: 'accept' | 'reject' }>,
  ) => {
    const session = getValidSession();
    if (!session) {
      setStatus('needs_pin');
      return;
    }

    setStatus('reviewing');
    try {
      await reviewProposal(proposalId, { fieldActions, imageActions }, session.token);
      // Refresh data
      if (activeModelIdRef.current) {
        const result = await getEnrichmentStatus(activeModelIdRef.current, session.token);
        setEnrichmentData(result);
      }
      setStatus('completed');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Review mislukt');
      setStatus('error');
    }
  }, []);

  const acceptField = useCallback(async (proposalId: string, fieldProposalId: string) => {
    await performReview(proposalId, [{ fieldProposalId, action: 'accept' }], []);
  }, [performReview]);

  const rejectField = useCallback(async (proposalId: string, fieldProposalId: string) => {
    await performReview(proposalId, [{ fieldProposalId, action: 'reject' }], []);
  }, [performReview]);

  const acceptImage = useCallback(async (proposalId: string, imageProposalId: string) => {
    await performReview(proposalId, [], [{ imageProposalId, action: 'accept' }]);
  }, [performReview]);

  const rejectImage = useCallback(async (proposalId: string, imageProposalId: string) => {
    await performReview(proposalId, [], [{ imageProposalId, action: 'reject' }]);
  }, [performReview]);

  const bulkAccept = useCallback(async (proposalId: string) => {
    const session = getValidSession();
    if (!session) {
      setStatus('needs_pin');
      return;
    }

    setStatus('reviewing');
    try {
      await bulkAcceptConsensus(proposalId, session.token);
      if (activeModelIdRef.current) {
        const result = await getEnrichmentStatus(activeModelIdRef.current, session.token);
        setEnrichmentData(result);
      }
      setStatus('completed');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Bulk accept mislukt');
      setStatus('error');
    }
  }, []);

  const cancel = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setErrorMessage(null);
    pendingActionRef.current = null;
  }, [stopPolling]);

  return {
    status,
    enrichmentData,
    proposals: enrichmentData?.proposals ?? [],
    errorMessage,
    trigger,
    checkStatus,
    acceptField,
    rejectField,
    acceptImage,
    rejectImage,
    bulkAccept,
    submitPin,
    cancel,
  };
}
