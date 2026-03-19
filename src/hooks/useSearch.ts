'use client';

/**
 * React hook wrapping SearchManager for full-text product search.
 *
 * Provides debounced search (150ms) and auto-suggest (100ms) with
 * lazy index loading on first mount.
 *
 * @example
 * ```tsx
 * const { query, setQuery, results, suggestions, isReady, isLoading } = useSearch();
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchManager } from '@/lib/search/search-manager';
import type { SearchResult } from '@/lib/search/types';

const SEARCH_DEBOUNCE_MS = 150;
const SUGGEST_DEBOUNCE_MS = 100;

export interface UseSearchReturn {
  /** Current search query */
  query: string;
  /** Update the search query (triggers debounced search + suggest) */
  setQuery: (query: string) => void;
  /** Search results ranked by relevance */
  results: SearchResult[];
  /** Auto-suggest completions for the current query */
  suggestions: string[];
  /** Whether the search index has been loaded */
  isReady: boolean;
  /** Whether a search or index load is in progress */
  isLoading: boolean;
}

export function useSearch(): UseSearchReturn {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const managerRef = useRef<SearchManager | null>(null);

  // ---------------------------------------------------------------------------
  // Initialize search manager on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
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
      })
      .finally(() => {
        setIsLoading(false);
      });
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
  // Query setter with debounced triggers
  // ---------------------------------------------------------------------------

  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

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
    [executeSearch, executeSuggest]
  );

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
    results,
    suggestions,
    isReady,
    isLoading,
  };
}
