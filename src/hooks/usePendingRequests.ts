'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPendingChangeRequests } from '@/lib/change-request-api';
import type { PendingChangeRequest } from '@/types/product';

export interface UsePendingRequestsReturn {
  /** Whether the pending data has been loaded at least once */
  isLoaded: boolean;
  /** Check if a model has a pending change request */
  hasPending: (modelId: string) => boolean;
  /** Get the pending request for a model (if any) */
  getPending: (modelId: string) => PendingChangeRequest | null;
  /** Force refetch of pending data */
  refresh: () => void;
  /** Locally add a pending request (after creation) */
  addLocal: (request: PendingChangeRequest) => void;
  /** Locally remove a pending request (after withdrawal) */
  removeLocal: (modelId: string) => void;
}

export function usePendingRequests(): UsePendingRequestsReturn {
  const [requests, setRequests] = useState<Map<string, PendingChangeRequest>>(
    new Map(),
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await getPendingChangeRequests();
      const map = new Map<string, PendingChangeRequest>();
      for (const req of data.requests) {
        map.set(req.modelId, {
          id: req.id,
          modelId: req.modelId,
          changeType: req.changeType as PendingChangeRequest['changeType'],
          requestedValue: req.requestedValue,
          status: req.status as PendingChangeRequest['status'],
        });
      }
      setRequests(map);
    } catch (err) {
      console.error('[usePendingRequests] Failed to load:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Lazy-load after mount (non-blocking)
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    // Delay slightly so it doesn't block initial render
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const hasPending = useCallback(
    (modelId: string) => requests.has(modelId),
    [requests],
  );

  const getPending = useCallback(
    (modelId: string) => requests.get(modelId) ?? null,
    [requests],
  );

  const refresh = useCallback(() => {
    load();
  }, [load]);

  const addLocal = useCallback((request: PendingChangeRequest) => {
    setRequests((prev) => {
      const next = new Map(prev);
      next.set(request.modelId, request);
      return next;
    });
  }, []);

  const removeLocal = useCallback((modelId: string) => {
    setRequests((prev) => {
      const next = new Map(prev);
      next.delete(modelId);
      return next;
    });
  }, []);

  return { isLoaded, hasPending, getPending, refresh, addLocal, removeLocal };
}
