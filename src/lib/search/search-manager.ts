/**
 * SearchManager - Singleton that owns the MiniSearch index.
 *
 * The index is lazily loaded on first search from /data/search-index.json.
 * All public methods are safe to call before the index is ready; they will
 * trigger loading and return empty results while loading is in progress.
 */

import MiniSearch from 'minisearch';
import type { SearchDocument, SearchResult, SuggestResult } from './types';
import { MINISEARCH_OPTIONS, AUTOSUGGEST_OPTIONS, STORE_FIELDS, SEARCH_FIELDS } from './search-config';

const SEARCH_INDEX_PATH = '/data/search-index.json';

export class SearchManager {
  private static instance: SearchManager | null = null;

  private index: MiniSearch<SearchDocument> | null = null;
  private loadPromise: Promise<void> | null = null;
  private ready = false;

  /** Use getInstance() instead. */
  private constructor() {}

  // -------------------------------------------------------------------------
  // Singleton access
  // -------------------------------------------------------------------------

  static getInstance(): SearchManager {
    if (!SearchManager.instance) {
      SearchManager.instance = new SearchManager();
    }
    return SearchManager.instance;
  }

  /**
   * Reset the singleton (useful for testing or hot-reload scenarios).
   */
  static resetInstance(): void {
    if (SearchManager.instance) {
      SearchManager.instance.index = null;
      SearchManager.instance.loadPromise = null;
      SearchManager.instance.ready = false;
    }
    SearchManager.instance = null;
  }

  // -------------------------------------------------------------------------
  // Index loading
  // -------------------------------------------------------------------------

  /** Whether the index has been loaded and is ready for queries. */
  get isReady(): boolean {
    return this.ready;
  }

  /**
   * Load the search index from the static JSON file.
   * Safe to call multiple times -- subsequent calls return the same promise.
   */
  async loadIndex(): Promise<void> {
    if (this.ready) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._doLoad();
    return this.loadPromise;
  }

  private async _doLoad(): Promise<void> {
    const start = performance.now();

    try {
      const response = await fetch(SEARCH_INDEX_PATH);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch search index: ${response.status} ${response.statusText}`
        );
      }

      const json = await response.text();

      this.index = MiniSearch.loadJSON<SearchDocument>(json, {
        fields: SEARCH_FIELDS as string[],
        storeFields: STORE_FIELDS as string[],
      });

      this.ready = true;

      const elapsed = (performance.now() - start).toFixed(1);
      console.debug(`[SearchManager] Index loaded in ${elapsed}ms (${this.index.documentCount} documents)`);
    } catch (error) {
      // Reset so a retry is possible
      this.loadPromise = null;
      console.error('[SearchManager] Failed to load search index:', error);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /**
   * Full-text search with boosting, prefix matching, and fuzzy matching.
   *
   * @param query - User search query string
   * @returns Ranked array of search results
   */
  async search(query: string): Promise<SearchResult[]> {
    await this.ensureLoaded();

    if (!this.index || !query.trim()) {
      return [];
    }

    const start = performance.now();

    const rawResults = this.index.search(query, MINISEARCH_OPTIONS.searchOptions);

    const results: SearchResult[] = rawResults.map((hit) => ({
      id: hit.id as string,
      slug: (hit as unknown as SearchDocument).slug,
      name: (hit as unknown as SearchDocument).name,
      brand: (hit as unknown as SearchDocument).brand,
      brandSlug: (hit as unknown as SearchDocument).brandSlug,
      articleNumber: (hit as unknown as SearchDocument).articleNumber,
      keywords: (hit as unknown as SearchDocument).keywords,
      description: (hit as unknown as SearchDocument).description,
      categoryPath: (hit as unknown as SearchDocument).categoryPath,
      thumbPath: (hit as unknown as SearchDocument).thumbPath,
      imagePath: (hit as unknown as SearchDocument).imagePath,
      minPrice: (hit as unknown as SearchDocument).minPrice,
      publicationStatus: (hit as unknown as SearchDocument).publicationStatus,
      score: hit.score,
      match: hit.match,
      terms: hit.terms,
    }));

    const elapsed = (performance.now() - start).toFixed(1);
    console.debug(
      `[SearchManager] search("${query}") -> ${results.length} results in ${elapsed}ms`
    );

    return results;
  }

  // -------------------------------------------------------------------------
  // Auto-suggest
  // -------------------------------------------------------------------------

  /**
   * Generate search suggestions for typeahead / autocomplete.
   *
   * @param query - Partial user input
   * @returns Array of suggestion strings sorted by relevance
   */
  async autoSuggest(query: string): Promise<string[]> {
    await this.ensureLoaded();

    if (!this.index || !query.trim()) {
      return [];
    }

    const start = performance.now();

    const suggestions: SuggestResult[] = this.index
      .autoSuggest(query, AUTOSUGGEST_OPTIONS)
      .map((s) => ({
        suggestion: s.suggestion,
        score: s.score,
        terms: s.terms,
      }));

    const result = suggestions.map((s) => s.suggestion);

    const elapsed = (performance.now() - start).toFixed(1);
    console.debug(
      `[SearchManager] autoSuggest("${query}") -> ${result.length} suggestions in ${elapsed}ms`
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async ensureLoaded(): Promise<void> {
    if (!this.ready) {
      await this.loadIndex();
    }
  }
}
