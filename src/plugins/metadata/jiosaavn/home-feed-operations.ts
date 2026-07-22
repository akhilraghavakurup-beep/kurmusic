import type { FeedItem, FeedSection, HomeFeedData } from '@domain/entities/feed-section';
import type { Track } from '@domain/entities/track';
import type {
	HomeFeedOperations,
	PlaylistTracksPage,
} from '@plugins/core/interfaces/home-feed-provider';
import { err, ok, type Result } from '@shared/types/result';
import {
	getHomeContentLanguageHeader,
	useSettingsStore,
	type HomeFeedPrioritySection,
} from '@/src/application/state/settings-store';
import type {
	JioSaavnLaunchData,
	JioSaavnLaunchModule,
	JioSaavnAlbum,
	JioSaavnPlaylist,
	JioSaavnRadioStation,
	JioSaavnSong,
} from './types';
import type { JioSaavnClient } from './client';
import { mapAlbum, mapArtistStation, mapPlaylistFeed, mapSong, stripSourcePrefix } from './mappers';

export type {
	HomeFeedOperations,
	PlaylistTracksPage,
} from '@plugins/core/interfaces/home-feed-provider';

interface SectionDefinition {
	key: string;
	titleMatcher: (title: string) => boolean;
	mapItems: (items: unknown[]) => FeedItem[];
	subtitle?: string;
}

const PLAYLIST_FETCH_LIMIT = 200;
const BLACKHOLE_COLLECTION_ORDER = [
	'new_trending',
	'charts',
	'new_albums',
	'tag_mixes',
	'top_playlists',
	'radio',
	'city_mod',
	'artist_recos',
] as const;

const BLACKHOLE_SECTION_PRIORITY = [
	'jiosaavn-new-trending',
	'jiosaavn-charts',
	'jiosaavn-new-albums',
	'jiosaavn-tag-mixes',
	'jiosaavn-top-playlists',
	'jiosaavn-radio',
	'jiosaavn-city-mod',
	'jiosaavn-artist-recos',
] as const;

const matchesTitle =
	(...patterns: string[]) =>
	(title: string) =>
		patterns.some((pattern) => title.toLowerCase().includes(pattern));

function mapMixedFeedItems(items: unknown[]): FeedItem[] {
	const mapped: FeedItem[] = [];

	for (const item of items) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const candidate = item as JioSaavnSong | JioSaavnPlaylist;
		switch (candidate.type) {
			case 'song':
				{
					const track = mapSong(candidate as JioSaavnSong);
					if (track) {
						mapped.push({ type: 'track', data: track });
					}
				}
				break;
			case 'album':
				{
					const album = mapAlbum(candidate as JioSaavnAlbum);
					if (album) {
						mapped.push({ type: 'album', data: album });
					}
				}
				break;
			case 'playlist':
				{
					const playlist = mapPlaylistFeed(candidate as JioSaavnPlaylist);
					if (playlist) {
						mapped.push({ type: 'playlist', data: playlist });
					}
				}
				break;
			default:
				break;
		}
	}

	return mapped;
}

function mapAnyFeedItems(items: unknown[]): FeedItem[] {
	const mapped: FeedItem[] = [];

	for (const item of items) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const candidate = item as
			| JioSaavnSong
			| JioSaavnAlbum
			| JioSaavnPlaylist
			| JioSaavnRadioStation;

		if (candidate.type === 'radio_station') {
			const artist = mapArtistStation(candidate as JioSaavnRadioStation);
			if (artist) {
				mapped.push({ type: 'artist', data: artist });
			}
			continue;
		}

		const mixed = mapMixedFeedItems([candidate]);
		if (mixed.length > 0) {
			mapped.push(...mixed);
			continue;
		}

		const playlist = mapPlaylistFeed(candidate as JioSaavnPlaylist);
		if (playlist) {
			mapped.push({ type: 'playlist', data: playlist });
		}
	}

	return mapped;
}

function mapPlaylistItems(items: unknown[]): FeedItem[] {
	return items
		.map((item) => mapPlaylistFeed(item as JioSaavnPlaylist))
		.filter(
			(playlist): playlist is NonNullable<ReturnType<typeof mapPlaylistFeed>> => !!playlist
		)
		.map((playlist) => ({ type: 'playlist' as const, data: playlist }));
}

function mapArtistStationItems(items: unknown[]): FeedItem[] {
	return items
		.map((item) => mapArtistStation(item as JioSaavnRadioStation))
		.filter((artist): artist is NonNullable<ReturnType<typeof mapArtistStation>> => !!artist)
		.map((artist) => ({ type: 'artist' as const, data: artist }));
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
	{
		key: 'new_trending',
		titleMatcher: matchesTitle('trending now', 'trending'),
		mapItems: mapMixedFeedItems,
		subtitle: 'What is moving fastest right now',
	},
	{
		key: 'charts',
		titleMatcher: matchesTitle('top charts', 'superhits', 'chartbusters'),
		mapItems: mapPlaylistItems,
		subtitle: 'The biggest chart playlists on JioSaavn',
	},
	{
		key: 'new_albums',
		titleMatcher: matchesTitle('new releases', 'new release'),
		mapItems: mapMixedFeedItems,
		subtitle: 'Fresh songs and albums just added',
	},
	{
		key: 'tag_mixes',
		titleMatcher: matchesTitle('mixes', 'tag mixes', 'mix'),
		mapItems: mapAnyFeedItems,
		subtitle: 'Auto-curated mixes from JioSaavn',
	},
	{
		key: 'top_playlists',
		titleMatcher: matchesTitle('editorial picks', 'editor picks'),
		mapItems: mapPlaylistItems,
		subtitle: 'Curated playlists from JioSaavn editors',
	},
	{
		key: 'artist_recos',
		titleMatcher: matchesTitle('recommended artist stations', 'artist stations'),
		mapItems: mapArtistStationItems,
		subtitle: 'Open an artist to start their station',
	},
	{
		key: 'promo:fresh-hits',
		titleMatcher: matchesTitle('fresh hits'),
		mapItems: mapMixedFeedItems,
		subtitle: 'More new favorites to explore',
	},
	{
		key: 'promo:genres',
		titleMatcher: matchesTitle('top genres', 'genres & moods'),
		mapItems: mapPlaylistItems,
		subtitle: 'Jump into genres, moods, and starter collections',
	},
	{
		key: 'radio',
		titleMatcher: matchesTitle('radio stations', 'radio'),
		mapItems: mapArtistStationItems,
		subtitle: 'Lean back with artist and station-based recommendations',
	},
	{
		key: 'promo:podcasts',
		titleMatcher: matchesTitle('trending podcasts', 'podcasts'),
		mapItems: mapAnyFeedItems,
		subtitle: 'Popular spoken-audio recommendations from JioSaavn',
	},
	{
		key: 'city_mod',
		titleMatcher: matchesTitle(`what's hot`, 'trending this week', 'hot in'),
		mapItems: mapAnyFeedItems,
		subtitle: 'Regional momentum and what is trending around you',
	},
	{
		key: 'promo:classics',
		titleMatcher: matchesTitle('best of 90s', '90s', 'retro'),
		mapItems: mapAnyFeedItems,
		subtitle: 'Throwback recommendations and catalog favorites',
	},
	{
		key: 'promo:new-release-focus',
		titleMatcher: matchesTitle('new releases pop', 'new releases', 'pop -'),
		mapItems: mapAnyFeedItems,
		subtitle: 'More focused release shelves directly from JioSaavn promos',
	},
];

function createSection(
	key: string,
	title: string,
	items: FeedItem[],
	subtitle?: string
): FeedSection | null {
	if (items.length === 0) {
		return null;
	}

	return {
		id: `jiosaavn-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		title,
		subtitle,
		items,
		source: 'remote',
	};
}

function getModuleOrder(modules?: Record<string, JioSaavnLaunchModule>): string[] {
	if (!modules) {
		return [];
	}

	const preferredOrder = new Map<string, number>(
		BLACKHOLE_COLLECTION_ORDER.map((key, index) => [key, index] as const)
	);

	return Object.entries(modules)
		.sort(([leftKey, left], [rightKey, right]) => {
			const leftPreferred = preferredOrder.get(leftKey);
			const rightPreferred = preferredOrder.get(rightKey);

			if (leftPreferred !== undefined && rightPreferred !== undefined) {
				return (
					leftPreferred - rightPreferred ||
					(left.position ?? 999) - (right.position ?? 999)
				);
			}

			if (leftPreferred !== undefined) {
				return -1;
			}

			if (rightPreferred !== undefined) {
				return 1;
			}

			const leftPromo = leftKey.startsWith('promo');
			const rightPromo = rightKey.startsWith('promo');
			if (leftPromo !== rightPromo) {
				return leftPromo ? 1 : -1;
			}

			return (
				(left.position ?? 999) - (right.position ?? 999) || leftKey.localeCompare(rightKey)
			);
		})
		.map(([key]) => key);
}

function itemDedupKey(item: FeedItem): string {
	switch (item.type) {
		case 'track':
			return `track:${item.data.id.value}`;
		case 'album':
			return `album:${item.data.id.value}`;
		case 'artist':
			return `artist:${item.data.id}`;
		case 'playlist':
			return `playlist:${item.data.id}`;
	}
}

function dedupeSections(sections: FeedSection[]): FeedSection[] {
	const seenItems = new Set<string>();
	const seenSectionTitles = new Set<string>();
	const deduped: FeedSection[] = [];

	for (const section of sections) {
		const titleKey = section.title.trim().toLowerCase();
		if (seenSectionTitles.has(titleKey)) {
			continue;
		}

		const items = section.items.filter((item) => {
			const key = itemDedupKey(item);
			if (seenItems.has(key)) {
				return false;
			}
			seenItems.add(key);
			return true;
		});

		if (items.length === 0) {
			continue;
		}

		seenSectionTitles.add(titleKey);
		deduped.push({
			...section,
			items,
		});
	}

	return deduped;
}

function prioritizeSections(sections: FeedSection[]): FeedSection[] {
	const configuredPriority = useSettingsStore.getState().homeFeedPriority;
	const blackholePriority = new Map<string, number>(
		BLACKHOLE_SECTION_PRIORITY.map((key, index) => [key, index] as const)
	);
	const sectionToPriorityKey = (section: FeedSection): HomeFeedPrioritySection | null => {
		switch (section.id) {
			case 'jiosaavn-new-trending':
				return 'trending-now';
			case 'jiosaavn-localized-charts':
			case 'jiosaavn-charts':
				return 'top-charts';
			case 'jiosaavn-localized-new-releases':
			case 'jiosaavn-new-albums':
				return 'new-releases';
			case 'jiosaavn-city-mod':
				return 'hot-in-thiruvananthapuram';
			case 'jiosaavn-localized-editorial-picks':
			case 'jiosaavn-top-playlists':
				return 'editorial-picks';
			case 'jiosaavn-radio':
				return 'radio-stations';
			case 'jiosaavn-artist-recos':
				return 'recommended-artist-stations';
			default:
				return section.title.trim().toLowerCase() === 'fresh hits' ? 'fresh-hits' : null;
		}
	};

	const priorityMap = new Map<string, number>(
		configuredPriority.map((key, index) => [key, index])
	);

	return [...sections].sort((left, right) => {
		const leftBlackhole = blackholePriority.get(left.id);
		const rightBlackhole = blackholePriority.get(right.id);

		if (leftBlackhole !== undefined && rightBlackhole !== undefined) {
			return leftBlackhole - rightBlackhole;
		}

		if (leftBlackhole !== undefined) {
			return -1;
		}

		if (rightBlackhole !== undefined) {
			return 1;
		}

		const leftPriority = priorityMap.get(sectionToPriorityKey(left) ?? '');
		const rightPriority = priorityMap.get(sectionToPriorityKey(right) ?? '');

		if (leftPriority !== undefined && rightPriority !== undefined) {
			return leftPriority - rightPriority;
		}

		if (leftPriority !== undefined) {
			return -1;
		}

		if (rightPriority !== undefined) {
			return 1;
		}

		return 0;
	});
}

async function buildHomeFeed(client: JioSaavnClient, language?: string): Promise<HomeFeedData> {
	const launchData = (await client.getLaunchData(
		language ?? getHomeContentLanguageHeader()
	)) as JioSaavnLaunchData & {
		collections?: string[];
		collections_temp?: string[];
	};
	const sections: FeedSection[] = [];

	const collectionOrder =
		Array.isArray(launchData.collections) && launchData.collections.length > 0
			? launchData.collections
			: getModuleOrder(launchData.modules);
	const promoCollectionOrder = Array.isArray(launchData.collections_temp)
		? launchData.collections_temp.filter(
				(collection, index, array) =>
					typeof collection === 'string' &&
					array.indexOf(collection) === index &&
					!collectionOrder.includes(collection)
			)
		: [];

	for (const moduleKey of [...collectionOrder, ...promoCollectionOrder]) {
		const module = launchData.modules?.[moduleKey];
		const title = module?.title?.trim();
		const items = launchData[moduleKey];

		if (!title || !Array.isArray(items) || items.length === 0) {
			continue;
		}

		const definition = SECTION_DEFINITIONS.find(
			(candidate) =>
				(candidate.key === moduleKey || candidate.key.startsWith('promo:')) &&
				candidate.titleMatcher(title)
		);

		const mappedItems = definition ? definition.mapItems(items) : mapAnyFeedItems(items);
		const section = createSection(
			moduleKey,
			title,
			mappedItems,
			definition?.subtitle ?? module?.subtitle
		);
		if (section) {
			sections.push(section);
		}
	}

	return {
		sections: prioritizeSections(dedupeSections(sections)),
		filterChips: [],
		hasContinuation: false,
	};
}

export function createHomeFeedOperations(client: JioSaavnClient): HomeFeedOperations {
	return {
		async getHomeFeed(language?: string): Promise<Result<HomeFeedData, Error>> {
			try {
				const data = await buildHomeFeed(client, language);
				return ok(data);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async applyFilter(_chipText: string, language?: string): Promise<Result<HomeFeedData, Error>> {
			try {
				const data = await buildHomeFeed(client, language);
				return ok(data);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},

		async loadMore(_language?: string): Promise<Result<HomeFeedData, Error>> {
			return ok({
				sections: [],
				filterChips: [],
				hasContinuation: false,
			});
		},

		async getPlaylistTracks(playlistId: string): Promise<Result<PlaylistTracksPage, Error>> {
			try {
				const playlist = await client.getPlaylist(
					stripSourcePrefix(playlistId),
					PLAYLIST_FETCH_LIMIT
				);
				const tracks = (playlist.songs ?? [])
					.map(mapSong)
					.filter((track): track is Track => !!track);
				return ok({
					tracks,
					hasMore: false,
				});
			} catch (error) {
				return err(
					error instanceof Error
						? error
						: new Error(`Failed to fetch playlist tracks: ${String(error)}`)
				);
			}
		},

		async loadMorePlaylistTracks(): Promise<Result<PlaylistTracksPage, Error>> {
			return ok({ tracks: [], hasMore: false });
		},
	};
}
