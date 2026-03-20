'use client';

/**
 * React hook wrapping SearchManager for full-text product search.
 *
 * Provides debounced search (150ms) and auto-suggest (100ms) with
 * lazy index loading — only triggered on first user interaction (focus
 * or when setQuery is called with a non-empty value).
 *
 * Pass `initialQuery` to trigger loading immediately (e.g. when URL has ?q=).
 *
 * @example
 * ```tsx
 * const { query, setQuery, activate, results, suggestions, isReady, isLoading } = useSearch({ initialQuery: 'polo' });
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchManager } from '@/lib/search/search-manager';
import type { SearchResult } from '@/lib/search/types';

const SEARCH_DEBOUNCE_MS = 150;
const SUGGEST_DEBOUNCE_MS = 100;

export interface UseSearchOptions {
  /** When provided the index is loaded immediately (e.g. URL has ?q=) */
  initialQuery?: string;
}

export interface UseSearchReturn {
  /** Current search query */
  query: string;
  /** Update the search query (triggers debounced search + suggest, and lazy-loads index on first call) */
  setQuery: (query: string) => void;
  /** Call this when the search field receives focus to trigger lazy index loading */
  activate: () => void;
  /** Search results ranked by relevance */
  results: SearchResult[];
  /** Auto-suggest completions for the current query */
  suggestions: string[];
  /** Whether the search index has been loaded */
  isReady: boolean;
  /** Whether a search or index load is in progress */
  isLoading: boolean;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { initialQuery } = options;

  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const managerRef = useRef<SearchManager | null>(null);
  const loadTriggeredRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Index loader — safe to call multiple times
  // ---------------------------------------------------------------------------

  const triggerLoad = useCallback(() => {
    if (loadTriggeredRef.current) return;
    loadTriggeredRef.current = true;

    const manager = SearchManager.getInstance();
    managerRef.current = manager;

    if (manager.isReady) {
      setIsReady(true);
      return;
    }

    setIsLoading(true);
    const start = performance.now();

    manager
      .loadIndex()
      .then(() => {
        setIsReady(true);
        const elapsed = (performance.now() - start).toFixed(1);
        console.debug(`[useSearch] Index ready in ${elapsed}ms`);
      })
      .catch((error) => {
        console.error('[useSearch] Failed to load search index:', error);
        // Reset so a retry is possible on next interaction
        loadTriggeredRef.current = false;
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // ---------------------------------------------------------------------------
  // If an initialQuery is provided (e.g. ?q= in URL), load index immediately
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      triggerLoad();
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Debounced search execution
  // ---------------------------------------------------------------------------

  const executeSearch = useCallback(
    async (q: string) => {
      const manager = managerRef.current;
      if (!manager) return;

      if (!q.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      const start = performance.now();

      try {
        const searchResults = await manager.search(q);
        setResults(searchResults);

        const elapsed = (performance.now() - start).toFixed(1);
        console.debug(
          `[useSearch] search("${q}") -> ${searchResults.length} results in ${elapsed}ms`
        );
      } catch (error) {
        console.error('[useSearch] Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Debounced auto-suggest
  // ---------------------------------------------------------------------------

  const executeSuggest = useCallback(
    async (q: string) => {
      const manager = managerRef.current;
      if (!manager) return;

      if (!q.trim()) {
        setSuggestions([]);
        return;
      }

      try {
        const result = await manager.autoSuggest(q);
        setSuggestions(result);
      } catch (error) {
        console.error('[useSearch] Suggest error:', error);
        setSuggestions([]);
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Query setter with debounced triggers — also activates lazy load
  // ---------------------------------------------------------------------------

  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      // Lazy-load index on first interaction
      if (newQuery.trim()) {
        triggerLoad();
      }

      // Clear pending timers
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      if (suggestTimerRef.current) {
        clearTimeout(suggestTimerRef.current);
      }

      if (!newQuery.trim()) {
        setResults([]);
        setSuggestions([]);
        return;
      }

      // Schedule debounced calls
      suggestTimerRef.current = setTimeout(() => {
        executeSuggest(newQuery);
      }, SUGGEST_DEBOUNCE_MS);

      searchTimerRef.current = setTimeout(() => {
        executeSearch(newQuery);
      }, SEARCH_DEBOUNCE_MS);
    },
    [triggerLoad, executeSearch, executeSuggest]
  );

  // ---------------------------------------------------------------------------
  // activate — call when search field receives focus
  // ---------------------------------------------------------------------------

  const activate = useCallback(() => {
    triggerLoad();
  }, [triggerLoad]);

  // ---------------------------------------------------------------------------
  // Cleanup timers on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };
  }, []);

  return {
    query,
    setQuery,
    activate,
    results,
    suggestions,
    isReady,
    isLoading,
  };
}
