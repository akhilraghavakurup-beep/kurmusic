import type { Track, Album, Artist } from '@/src/domain';
import type { MetadataProvider, SearchOptions } from '@plugins/core';
import {
	useSearchStore,
	type SearchSuggestion,
	type SearchResults as AppSearchResults,
} from '../state/search-store';
import { ok, err, type Result } from '@/src/shared';
import { getLogger } from '@shared/services/logger';
import { useSettingsStore } from '../state/settings-store';

const logger = getLogger('SearchService');

interface CacheEntry {
	results: AppSearchResults;
	timestamp: number;
}

interface SuggestionCacheEntry {
	suggestions: SearchSuggestion[];
	timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const SUGGESTION_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_SUGGESTIONS = 40;
const MAX_API_SEARCH_LIMIT = 60;

interface ProviderSearchResult {
	readonly tracks: Track[];
	readonly albums: Album[];
	readonly artists: Artist[];
}

const LANGUAGE_HINTS: Record<string, string[]> = {
	english: ['english'],
	malayalam: ['malayalam'],
	tamil: ['tamil'],
	telugu: ['telugu'],
	kannada: ['kannada'],
	punjabi: ['punjabi'],
	marathi: ['marathi'],
	bengali: ['bengali', 'bangla'],
	gujarati: ['gujarati'],
	bhojpuri: ['bhojpuri'],
	urdu: ['urdu'],
	haryanvi: ['haryanvi'],
	rajasthani: ['rajasthani'],
	odia: ['odia'],
	assamese: ['assamese'],
};

interface SuggestionCandidate {
	readonly query: string;
	readonly source: 'track' | 'album' | 'artist' | 'recent';
}

const EMPTY_PROVIDER_RESULT: ProviderSearchResult = { tracks: [], albums: [], artists: [] };

export class SearchService {
	private metadataProviders: MetadataProvider[] = [];

	private pendingSearches = new Map<string, Promise<Result<AppSearchResults, Error>>>();
	private pendingSuggestions = new Map<string, Promise<Result<SearchSuggestion[], Error>>>();

	private searchCache = new Map<string, CacheEntry>();
	private suggestionCache = new Map<string, SuggestionCacheEntry>();

	private _currentAbortController: AbortController | null = null;
	private _currentSuggestionAbortController: AbortController | null = null;

	private _searchVersion = 0;
	private _suggestionVersion = 0;

	setMetadataProviders(providers: MetadataProvider[]): void {
		this.metadataProviders = providers;
		this.clearCache();
	}

	addMetadataProvider(provider: MetadataProvider): void {
		if (!this.metadataProviders.includes(provider)) {
			this.metadataProviders = [...this.metadataProviders, provider];
			this.clearCache();
		}
	}

	removeMetadataProvider(providerId: string): void {
		this.metadataProviders = this.metadataProviders.filter((p) => p.manifest.id !== providerId);
		this.clearCache();
	}

	clearCache(): void {
		this.searchCache.clear();
		this.suggestionCache.clear();
		logger.debug('Search caches cleared');
	}

	async search(query: string, options?: SearchOptions): Promise<Result<AppSearchResults, Error>> {
		this._cancelCurrentSearch();
		this._searchVersion++;

		const cacheKey = this._getCacheKey(query, options);
		const cachedResult = this._tryReturnCached(query, cacheKey);
		if (cachedResult) return cachedResult;

		const pendingSearch = this.pendingSearches.get(cacheKey);
		if (pendingSearch) {
			logger.debug(`Deduplicating search request for query: ${query}`);
			return pendingSearch;
		}

		return this._startNewSearch(query, options, cacheKey);
	}

	private _tryReturnCached(
		query: string,
		cacheKey: string
	): Result<AppSearchResults, Error> | null {
		const cachedEntry = this.searchCache.get(cacheKey);
		if (!cachedEntry || Date.now() - cachedEntry.timestamp >= CACHE_TTL_MS) return null;

		logger.debug(`Returning cached results for query: ${query}`);
		const store = useSearchStore.getState();
		store.setQuery(query);
		store.setResults(cachedEntry.results);
		return ok(cachedEntry.results);
	}

	private async _startNewSearch(
		query: string,
		options: SearchOptions | undefined,
		cacheKey: string
	): Promise<Result<AppSearchResults, Error>> {
		const abortController = new AbortController();
		this._currentAbortController = abortController;
		const searchVersion = this._searchVersion;

		const optionsWithSignal: SearchOptions = { ...options, signal: abortController.signal };
		const searchPromise = this._executeSearch(
			query,
			optionsWithSignal,
			cacheKey,
			searchVersion
		);
		this.pendingSearches.set(cacheKey, searchPromise);

		try {
			return await searchPromise;
		} finally {
			this.pendingSearches.delete(cacheKey);
		}
	}

	cancelSearch(): void {
		this._cancelCurrentSearch();
	}

	private _cancelCurrentSearch(): void {
		if (this._currentAbortController) {
			this._currentAbortController.abort();
			this._currentAbortController = null;
			logger.debug('Cancelled previous search');
		}
	}

	private _cancelCurrentSuggestionFetch(): void {
		if (this._currentSuggestionAbortController) {
			this._currentSuggestionAbortController.abort();
			this._currentSuggestionAbortController = null;
		}
	}

	private _getCacheKey(query: string, options?: SearchOptions): string {
		const normalizedQuery = query.trim().toLowerCase();
		if (!options) {
			return normalizedQuery;
		}
		const { signal: _signal, ...cacheableOptions } = options;
		const optionsKey =
			Object.keys(cacheableOptions).length > 0 ? JSON.stringify(cacheableOptions) : '';
		return `${normalizedQuery}:${optionsKey}`;
	}

	private async _executeSearch(
		query: string,
		options: SearchOptions | undefined,
		cacheKey: string,
		searchVersion: number
	): Promise<Result<AppSearchResults, Error>> {
		const store = useSearchStore.getState();
		store.setSearching(true);
		store.setQuery(query);
		if (this.metadataProviders.length === 0) {
			store.setError('No metadata providers available');
			return err(new Error('No metadata providers available'));
		}
		try {
			return await this._searchAndAggregate(query, options, cacheKey, searchVersion, store);
		} catch (error) {
			return this._handleSearchError(error, options?.signal, searchVersion, store);
		}
	}

	private async _searchAndAggregate(
		query: string,
		options: SearchOptions | undefined,
		cacheKey: string,
		searchVersion: number,
		store: ReturnType<typeof useSearchStore.getState>
	): Promise<Result<AppSearchResults, Error>> {
		const signal = options?.signal;
		const results = await this._searchAllProviders(query, options, signal);

		if (signal?.aborted || searchVersion !== this._searchVersion) {
			logger.debug(`Search for "${query}" was cancelled or superseded`);
			return err(new Error('Search cancelled'));
		}

		const aggregated = this._aggregateResults(results);
		this._cacheResults(cacheKey, aggregated);

		return this._publishResults(query, aggregated, searchVersion, store);
	}

	private async _searchAllProviders(
		query: string,
		options: SearchOptions | undefined,
		signal: AbortSignal | undefined
	): Promise<ProviderSearchResult[]> {
		const promises = this.metadataProviders.map((provider) =>
			this._searchProvider(provider, query, options, signal)
		);
		return Promise.all(promises);
	}

	private async _searchProvider(
		provider: MetadataProvider,
		query: string,
		options: SearchOptions | undefined,
		signal: AbortSignal | undefined
	): Promise<ProviderSearchResult> {
		if (signal?.aborted) return EMPTY_PROVIDER_RESULT;
		try {
			return await this._fetchProviderResults(provider, query, options, signal);
		} catch (error) {
			if (signal?.aborted) return EMPTY_PROVIDER_RESULT;
			logger.warn(
				`Search failed for provider ${provider.manifest.id}`,
				error instanceof Error ? error : undefined
			);
			return EMPTY_PROVIDER_RESULT;
		}
	}

	private async _fetchProviderResults(
		provider: MetadataProvider,
		query: string,
		options: SearchOptions | undefined,
		signal: AbortSignal | undefined
	): Promise<ProviderSearchResult> {
		const effectiveOptions: SearchOptions = {
			sortBy: 'relevance',
			limit: MAX_API_SEARCH_LIMIT,
			...options,
		};

		const [tracksResult, albumsResult, artistsResult] = await Promise.all([
			provider.searchTracks(query, effectiveOptions),
			provider.searchAlbums(query, effectiveOptions),
			provider.searchArtists(query, effectiveOptions),
		]);
		if (signal?.aborted) return EMPTY_PROVIDER_RESULT;
		return {
			tracks: tracksResult.success ? tracksResult.data.items : [],
			albums: albumsResult.success ? albumsResult.data.items : [],
			artists: artistsResult.success ? artistsResult.data.items : [],
		};
	}

	private _aggregateResults(results: ProviderSearchResult[]): AppSearchResults {
		const aggregated: AppSearchResults = { tracks: [], albums: [], artists: [] };
		for (const result of results) {
			aggregated.tracks.push(...result.tracks);
			aggregated.albums.push(...result.albums);
			aggregated.artists.push(...result.artists);
		}
		aggregated.tracks = this._rankTracksByPreferredLanguage(
			this.deduplicateTracks(aggregated.tracks)
		);
		aggregated.albums = this.deduplicateAlbums(aggregated.albums);
		aggregated.artists = this.deduplicateById(aggregated.artists);
		return aggregated;
	}

	private _cacheResults(cacheKey: string, results: AppSearchResults): void {
		this.searchCache.set(cacheKey, { results, timestamp: Date.now() });
	}

	private _publishResults(
		query: string,
		aggregated: AppSearchResults,
		searchVersion: number,
		store: ReturnType<typeof useSearchStore.getState>
	): Result<AppSearchResults, Error> {
		if (searchVersion !== this._searchVersion) {
			logger.debug(`Search for "${query}" superseded, not updating store`);
			return ok(aggregated);
		}
		store.setResults(aggregated);
		store.addRecentSearch(query);
		return ok(aggregated);
	}

	private _handleSearchError(
		error: unknown,
		signal: AbortSignal | undefined,
		searchVersion: number,
		store: ReturnType<typeof useSearchStore.getState>
	): Result<AppSearchResults, Error> {
		if (signal?.aborted || searchVersion !== this._searchVersion) {
			return err(new Error('Search cancelled'));
		}
		const errorMessage = error instanceof Error ? error.message : 'Search failed';
		store.setError(errorMessage);
		return err(error instanceof Error ? error : new Error(errorMessage));
	}

	async getSuggestions(query: string): Promise<Result<SearchSuggestion[], Error>> {
		const store = useSearchStore.getState();
		const trimmedQuery = query.trim();

		if (!trimmedQuery) {
			const recentSuggestions = this._buildRecentSuggestions('', store.recentSearches);
			store.setSuggestions(recentSuggestions);
			return ok(recentSuggestions);
		}

		const normalized = trimmedQuery.toLowerCase();
		const cached = this._getCachedSuggestions(normalized);
		if (cached) {
			store.setSuggestions(cached);
			return ok(cached);
		}

		const warmed = this._getWarmSuggestionsFromPrefixCache(normalized);
		if (warmed.length > 0) {
			store.setSuggestions(warmed);
		}

		const pending = this.pendingSuggestions.get(normalized);
		if (pending) return pending;

		this._cancelCurrentSuggestionFetch();
		this._suggestionVersion += 1;
		const suggestionVersion = this._suggestionVersion;
		const abortController = new AbortController();
		this._currentSuggestionAbortController = abortController;

		const promise = this._fetchAndStoreSuggestions(
			trimmedQuery,
			normalized,
			suggestionVersion,
			abortController.signal
		);
		this.pendingSuggestions.set(normalized, promise);

		try {
			return await promise;
		} finally {
			this.pendingSuggestions.delete(normalized);
		}
	}

	private _getCachedSuggestions(cacheKey: string): SearchSuggestion[] | null {
		const cached = this.suggestionCache.get(cacheKey);
		if (!cached) return null;
		if (Date.now() - cached.timestamp >= SUGGESTION_CACHE_TTL_MS) {
			this.suggestionCache.delete(cacheKey);
			return null;
		}
		return cached.suggestions;
	}

	private _getWarmSuggestionsFromPrefixCache(queryLower: string): SearchSuggestion[] {
		let bestKey = '';
		for (const key of this.suggestionCache.keys()) {
			if (queryLower.startsWith(key) && key.length > bestKey.length) {
				bestKey = key;
			}
		}
		if (!bestKey) return [];

		const cached = this._getCachedSuggestions(bestKey);
		if (!cached) return [];

		return cached
			.filter((item) => item.query.toLowerCase().includes(queryLower))
			.slice(0, MAX_SUGGESTIONS);
	}

	private async _fetchAndStoreSuggestions(
		query: string,
		cacheKey: string,
		suggestionVersion: number,
		signal: AbortSignal
	): Promise<Result<SearchSuggestion[], Error>> {
		const store = useSearchStore.getState();
		const recent = this._buildRecentSuggestions(query, store.recentSearches);

		if (this.metadataProviders.length === 0) {
			store.setSuggestions(recent);
			this.suggestionCache.set(cacheKey, { suggestions: recent, timestamp: Date.now() });
			return ok(recent);
		}

		try {
			const providerCandidates = await Promise.all(
				this.metadataProviders.map((provider) =>
					this._fetchProviderSuggestionCandidates(provider, query, signal)
				)
			);

			if (signal.aborted || suggestionVersion !== this._suggestionVersion) {
				return err(new Error('Suggestions cancelled'));
			}

			const merged = this._rankAndMergeSuggestions(query, recent, providerCandidates.flat());
			this.suggestionCache.set(cacheKey, { suggestions: merged, timestamp: Date.now() });
			store.setSuggestions(merged);
			return ok(merged);
		} catch (error) {
			if (!signal.aborted && suggestionVersion === this._suggestionVersion) {
				store.setSuggestions(recent);
			}
			return ok(recent);
		}
	}

	private _buildRecentSuggestions(query: string, recentSearches: string[]): SearchSuggestion[] {
		const queryLower = query.trim().toLowerCase();
		const items = recentSearches
			.filter((item) => (!queryLower ? true : item.toLowerCase().includes(queryLower)))
			.slice(0, MAX_SUGGESTIONS)
			.map((item) => ({ query: item, type: 'recent' as const }));
		return items;
	}

	private async _fetchProviderSuggestionCandidates(
		provider: MetadataProvider,
		query: string,
		signal: AbortSignal
	): Promise<SuggestionCandidate[]> {
		if (signal.aborted) return [];

		const options: SearchOptions = { limit: 10, sortBy: 'relevance', signal };
		const [tracksRes, albumsRes, artistsRes] = await Promise.all([
			provider.searchTracks(query, options),
			provider.searchAlbums(query, { ...options, limit: 8 }),
			provider.searchArtists(query, { ...options, limit: 8 }),
		]);

		if (signal.aborted) return [];

		const candidates: SuggestionCandidate[] = [];
		if (tracksRes.success) {
			for (const track of tracksRes.data.items.slice(0, 10)) {
				candidates.push({ query: track.title, source: 'track' });
				for (const artist of track.artists.slice(0, 2)) {
					if (artist?.name) {
						candidates.push({ query: artist.name, source: 'artist' });
					}
				}
			}
		}
		if (albumsRes.success) {
			for (const album of albumsRes.data.items.slice(0, 8)) {
				candidates.push({ query: album.name, source: 'album' });
			}
		}
		if (artistsRes.success) {
			for (const artist of artistsRes.data.items.slice(0, 8)) {
				candidates.push({ query: artist.name, source: 'artist' });
			}
		}
		return candidates;
	}

	private _rankAndMergeSuggestions(
		query: string,
		recent: SearchSuggestion[],
		apiCandidates: SuggestionCandidate[]
	): SearchSuggestion[] {
		const queryLower = query.toLowerCase();
		const scoreMap = new Map<string, number>();
		const displayMap = new Map<string, string>();
		const recentSet = new Set(recent.map((item) => item.query.toLowerCase()));

		const pushCandidate = (candidate: SuggestionCandidate) => {
			const cleaned = candidate.query.trim();
			if (!cleaned) return;
			const lower = cleaned.toLowerCase();
			const sourceWeight =
				candidate.source === 'recent'
					? 55
					: candidate.source === 'track'
						? 40
						: candidate.source === 'artist'
							? 36
							: 32;
			const score =
					sourceWeight +
					this._scoreSuggestionMatch(queryLower, lower) +
					this._preferredLanguageBonus(lower);
			if (score <= 0) return;
			const previous = scoreMap.get(lower) ?? -1;
			if (score > previous) {
				scoreMap.set(lower, score);
				displayMap.set(lower, cleaned);
			}
		};

		for (const item of recent) {
			pushCandidate({ query: item.query, source: 'recent' });
		}
		for (const item of apiCandidates) {
			pushCandidate(item);
		}

		const sorted = [...scoreMap.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, MAX_SUGGESTIONS)
			.map(([lower]) => {
				const text = displayMap.get(lower) ?? lower;
				return {
					query: text,
					type: recentSet.has(lower) ? ('recent' as const) : ('suggested' as const),
				};
			});

		return sorted;
	}

	private _scoreSuggestionMatch(queryLower: string, candidateLower: string): number {
		if (!queryLower) return 1;
		if (candidateLower === queryLower) return 60;
		if (candidateLower.startsWith(queryLower)) return 40;
		if (candidateLower.includes(` ${queryLower}`)) return 28;
		if (candidateLower.includes(queryLower)) return 20;
		return -100;
	}


	private _getPreferredLanguageTerms(): string[] {
		const preferences = useSettingsStore.getState().homeContentPreferences;
		const terms = new Set<string>();
		for (const pref of preferences) {
			const key = pref.toLowerCase();
			const hints = LANGUAGE_HINTS[key] ?? [key];
			for (const hint of hints) {
				terms.add(hint.toLowerCase());
			}
		}
		return [...terms];
	}

	private _preferredLanguageBonus(candidateLower: string): number {
		const terms = this._getPreferredLanguageTerms();
		if (terms.length === 0) return 0;
		for (const term of terms) {
			if (candidateLower.includes(term)) return 12;
		}
		return 0;
	}

	private _rankTracksByPreferredLanguage(tracks: Track[]): Track[] {
		const terms = this._getPreferredLanguageTerms();
		if (terms.length === 0) return tracks;

		return tracks
			.map((track, index) => ({
				track,
				index,
				score: this._trackLanguageScore(track, terms),
			}))
			.sort((a, b) => b.score - a.score || a.index - b.index)
			.map((item) => item.track);
	}

	private _trackLanguageScore(track: Track, terms: string[]): number {
		const haystack = [
			track.title,
			track.album?.name ?? '',
			...track.artists.map((artist) => artist.name),
			track.id.sourceType,
		]
			.join(' ')
			.toLowerCase();

		let score = 0;
		for (const term of terms) {
			if (haystack.includes(term)) {
				score += 10;
			}
		}
		return score;
	}
	private deduplicateTracks(tracks: Track[]): Track[] {
		const seen = new Set<string>();
		const result: Track[] = [];

		for (const track of tracks) {
			const id = track.id.value;
			if (!seen.has(id)) {
				seen.add(id);
				result.push(track);
			}
		}

		return result;
	}

	private deduplicateAlbums(albums: Album[]): Album[] {
		const seen = new Set<string>();
		const result: Album[] = [];

		for (const album of albums) {
			const idValue = album.id.value;
			if (!seen.has(idValue)) {
				seen.add(idValue);
				result.push(album);
			}
		}

		return result;
	}

	private deduplicateById<T extends { id: string }>(items: T[]): T[] {
		const seen = new Set<string>();
		const result: T[] = [];

		for (const item of items) {
			if (!seen.has(item.id)) {
				seen.add(item.id);
				result.push(item);
			}
		}

		return result;
	}
}

export const searchService = new SearchService();
