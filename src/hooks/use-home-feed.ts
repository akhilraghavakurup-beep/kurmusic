import { useEffect, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import {
	useHomeFeedSections,
	useHomeFeedFilterChips,
	useHomeFeedLoading,
	useHomeFeedError,
	useHomeFeedHasContinuation,
	useHomeFeedStore,
} from '@/src/application/state/home-feed-store';
import { homeFeedService } from '@/src/application/services/home-feed-service';
import {
	getHomeContentPreferenceCacheKey,
	useHomeContentPreferences,
} from '@/src/application/state/settings-store';
import { useCuratedContent } from './use-curated-content';
import { useAppState } from './use-app-state';
import type { FeedSection, FeedFilterChip } from '@/src/domain/entities/feed-section';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface HomeFeedResult {
	readonly localSections: FeedSection[];
	readonly remoteSections: FeedSection[];
	readonly filterChips: FeedFilterChip[];
	readonly isLoading: boolean;
	readonly isRefreshing: boolean;
	readonly error: string | null;
	readonly hasContinuation: boolean;
	readonly handleApplyFilter: (chipText: string, index: number) => void;
	readonly handleClearFilter: () => void;
	readonly handleLoadMore: () => void;
	readonly handleRefresh: () => Promise<void>;
}

function isRecentlyPlayedSection(section: FeedSection): boolean {
	const title = section.title.trim().toLowerCase();
	const id = section.id.trim().toLowerCase();
	return (
		title.includes('recently played') ||
		id.includes('recently-played') ||
		id.includes('recently_played')
	);
}

function buildLocalSections(curated: ReturnType<typeof useCuratedContent>): FeedSection[] {
	const sections: FeedSection[] = [];

	if (curated.recentlyPlayed.length > 0) {
		sections.push({
			id: 'local-recently-played',
			title: 'Recently Played',
			compact: true,
			items: curated.recentlyPlayed.map((track) => ({ type: 'track', data: track })),
			source: 'local',
		});
	}

	if (curated.favoriteTracks.length > 0) {
		sections.push({
			id: 'local-favorites',
			title: 'Favorites',
			items: curated.favoriteTracks.map((track) => ({ type: 'track', data: track })),
			source: 'local',
		});
	}

	return sections;
}

export function useHomeFeed(): HomeFeedResult {
	const remoteSectionsRaw = useHomeFeedSections();
	const filterChips = useHomeFeedFilterChips();
	const isLoading = useHomeFeedLoading();
	const isRefreshing = useHomeFeedStore((state) => state.isRefreshing);
	const error = useHomeFeedError();
	const hasContinuation = useHomeFeedHasContinuation();
	const curated = useCuratedContent(10);
	const homeContentPreferences = useHomeContentPreferences();
	const languageKey = useMemo(
		() => getHomeContentPreferenceCacheKey(homeContentPreferences),
		[homeContentPreferences]
	);

	useAppState({
		onForeground: () => {
			homeFeedService.fetchHomeFeed();
		},
	});

	useEffect(() => {
		// Defer the network fetch until after mount animations/interactions
		// complete so the feed screen paints without blocking on async I/O.
		const task = InteractionManager.runAfterInteractions(() => {
			useHomeFeedStore.setState({ activeFilterIndex: null });
			homeFeedService.fetchHomeFeed();
		});

		// Periodic auto-refresh interval provision to update suggestions periodically
		const intervalId = setInterval(() => {
			homeFeedService.fetchHomeFeed({ force: true });
		}, REFRESH_INTERVAL_MS);

		return () => {
			task.cancel();
			clearInterval(intervalId);
		};
	}, [languageKey]);

	const localSections = useMemo(() => buildLocalSections(curated), [curated]);

	const remoteSections = useMemo(() => {
		const hasLocalRecentlyPlayed = localSections.some(isRecentlyPlayedSection);
		if (!hasLocalRecentlyPlayed) {
			return remoteSectionsRaw;
		}
		return remoteSectionsRaw.filter((section) => !isRecentlyPlayedSection(section));
	}, [localSections, remoteSectionsRaw]);

	const handleApplyFilter = useCallback((chipText: string, index: number) => {
		homeFeedService.applyFilter(chipText, index);
	}, []);

	const handleClearFilter = useCallback(() => {
		useHomeFeedStore.setState({ activeFilterIndex: null });
		homeFeedService.fetchHomeFeed({ force: true });
	}, []);

	const handleLoadMore = useCallback(() => {
		homeFeedService.loadMore();
	}, []);

	const handleRefresh = useCallback(async () => {
		await homeFeedService.refresh();
	}, []);

	return {
		localSections,
		remoteSections,
		filterChips,
		isLoading,
		isRefreshing,
		error,
		hasContinuation,
		handleApplyFilter,
		handleClearFilter,
		handleLoadMore,
		handleRefresh,
	};
}
