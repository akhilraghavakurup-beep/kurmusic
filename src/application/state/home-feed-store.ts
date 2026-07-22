import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedSection, FeedFilterChip } from '@domain/entities/feed-section';
import type { Album } from '@domain/entities/album';
import type { Track } from '@domain/entities/track';
import { AlbumId } from '@domain/value-objects/album-id';
import { Duration } from '@domain/value-objects/duration';
import { TrackId } from '@domain/value-objects/track-id';

interface HomeFeedState {
	sections: FeedSection[];
	filterChips: FeedFilterChip[];
	activeFilterIndex: number | null;
	isLoading: boolean;
	isRefreshing: boolean;
	isLoadingMore: boolean;
	hasContinuation: boolean;
	error: string | null;
	lastFetchedAt: number | null;
	languageKey: string | null;

	setSections: (sections: FeedSection[]) => void;
	appendSections: (sections: FeedSection[]) => void;
	setFilterChips: (chips: FeedFilterChip[]) => void;
	setActiveFilterIndex: (index: number | null) => void;
	setLoading: (isLoading: boolean) => void;
	setRefreshing: (isRefreshing: boolean) => void;
	setLoadingMore: (isLoadingMore: boolean) => void;
	setHasContinuation: (hasContinuation: boolean) => void;
	setError: (error: string | null) => void;
	setLastFetchedAt: (timestamp: number) => void;
	setLanguageKey: (languageKey: string | null) => void;
	reset: () => void;
}

const INITIAL_STATE = {
	sections: [] as FeedSection[],
	filterChips: [] as FeedFilterChip[],
	activeFilterIndex: null as number | null,
	isLoading: false,
	isRefreshing: false,
	isLoadingMore: false,
	hasContinuation: false,
	error: null as string | null,
	lastFetchedAt: null as number | null,
	languageKey: null as string | null,
};

const customStorage = {
	getItem: async (name: string): Promise<string | null> => {
		return AsyncStorage.getItem(name);
	},
	setItem: async (name: string, value: string): Promise<void> => {
		await AsyncStorage.setItem(name, value);
	},
	removeItem: async (name: string): Promise<void> => {
		await AsyncStorage.removeItem(name);
	},
};

let resolveHydration: (() => void) | null = null;
const hydrationPromise = new Promise<void>((resolve) => {
	resolveHydration = resolve;
});

function normalizeTrack(track: Track): Track | null {
	const rawId = track.id as unknown;
	const rawDuration = track.duration as unknown;

	const id =
		typeof rawId === 'string'
			? TrackId.tryFromString(rawId)
			: rawId &&
				  typeof rawId === 'object' &&
				  'value' in rawId &&
				  typeof (rawId as { value?: unknown }).value === 'string'
				? TrackId.tryFromString((rawId as { value: string }).value)
				: rawId instanceof TrackId
					? rawId
					: null;

	if (!id) {
		return null;
	}

	const duration =
		typeof rawDuration === 'number'
			? Duration.fromMilliseconds(rawDuration)
			: rawDuration &&
				  typeof rawDuration === 'object' &&
				  'totalMilliseconds' in rawDuration &&
				  typeof (rawDuration as { totalMilliseconds?: unknown }).totalMilliseconds ===
						'number'
				? Duration.fromMilliseconds(
						(rawDuration as { totalMilliseconds: number }).totalMilliseconds
					)
				: rawDuration instanceof Duration
					? rawDuration
					: Duration.ZERO;

	return {
		...track,
		id,
		duration,
	};
}

function normalizeAlbum(album: Album): Album | null {
	const rawId = album.id as unknown;
	const id =
		typeof rawId === 'string'
			? AlbumId.tryFromString(rawId)
			: rawId &&
				  typeof rawId === 'object' &&
				  'value' in rawId &&
				  typeof (rawId as { value?: unknown }).value === 'string'
				? AlbumId.tryFromString((rawId as { value: string }).value)
				: rawId instanceof AlbumId
					? rawId
					: null;

	if (!id) {
		return null;
	}

	return {
		...album,
		id,
	};
}

function normalizeFeedSection(section: FeedSection): FeedSection | null {
	if (!section || typeof section !== 'object' || !Array.isArray(section.items)) {
		return null;
	}

	const items = section.items
		.map((item) => {
			if (item.type === 'track') {
				const track = normalizeTrack(item.data);
				return track ? { ...item, data: track } : null;
			}
			if (item.type === 'album') {
				const album = normalizeAlbum(item.data);
				return album ? { ...item, data: album } : null;
			}
			return item;
		})
		.filter((item): item is FeedSection['items'][number] => item !== null);

	return {
		...section,
		items,
	};
}

export const useHomeFeedStore = create<HomeFeedState>()(
	persist(
		(set) => ({
			...INITIAL_STATE,

			setSections: (sections: FeedSection[]) => {
				set({ sections, error: null });
			},

			appendSections: (sections: FeedSection[]) => {
				set((state) => ({ sections: [...state.sections, ...sections] }));
			},

			setFilterChips: (filterChips: FeedFilterChip[]) => {
				set({ filterChips });
			},

			setActiveFilterIndex: (activeFilterIndex: number | null) => {
				set({ activeFilterIndex });
			},

			setLoading: (isLoading: boolean) => {
				set({ isLoading });
			},

			setRefreshing: (isRefreshing: boolean) => {
				set({ isRefreshing });
			},

			setLoadingMore: (isLoadingMore: boolean) => {
				set({ isLoadingMore });
			},

			setHasContinuation: (hasContinuation: boolean) => {
				set({ hasContinuation });
			},

			setError: (error: string | null) => {
				set({ error, isLoading: false, isRefreshing: false, isLoadingMore: false });
			},

			setLastFetchedAt: (lastFetchedAt: number) => {
				set({ lastFetchedAt });
			},

			setLanguageKey: (languageKey: string | null) => {
				set({ languageKey });
			},

			reset: () => {
				set(INITIAL_STATE);
			},
		}),
		{
			name: 'aria-home-feed-storage',
			version: 2,
			storage: createJSONStorage(() => customStorage),
			partialize: (state) => ({
				sections: state.sections,
				filterChips: state.filterChips,
				hasContinuation: state.hasContinuation,
				lastFetchedAt: state.lastFetchedAt,
				languageKey: state.languageKey,
			}),
			migrate: () => ({ ...INITIAL_STATE }),
			onRehydrateStorage: () => {
				return (state) => {
					if (state) {
						state.sections = state.sections
							.map(normalizeFeedSection)
							.filter((section): section is FeedSection => section !== null);
						state.activeFilterIndex = null;
						state.isLoading = false;
						state.isRefreshing = false;
						state.isLoadingMore = false;
						state.error = null;
					}
					resolveHydration?.();
				};
			},
		}
	)
);

export const useHomeFeedSections = () => useHomeFeedStore((state) => state.sections);
export const useHomeFeedFilterChips = () => useHomeFeedStore((state) => state.filterChips);
export const useHomeFeedLoading = () => useHomeFeedStore((state) => state.isLoading);
export const useHomeFeedRefreshing = () => useHomeFeedStore((state) => state.isRefreshing);
export const useHomeFeedLoadingMore = () => useHomeFeedStore((state) => state.isLoadingMore);
export const useHomeFeedError = () => useHomeFeedStore((state) => state.error);
export const useHomeFeedHasContinuation = () => useHomeFeedStore((state) => state.hasContinuation);

export function waitForHomeFeedHydration(): Promise<void> {
	if (useHomeFeedStore.persist.hasHydrated()) {
		return Promise.resolve();
	}
	return hydrationPromise;
}
