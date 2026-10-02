import { useCallback, useRef, useState } from 'react';
import { createJioSaavnClient } from '@/src/plugins/metadata/jiosaavn/client';
import { DEFAULT_CONFIG } from '@/src/plugins/metadata/jiosaavn/config';
import { mapSong } from '@/src/plugins/metadata/jiosaavn/mappers';
import { useHomeFeedStore } from '@/src/application/state/home-feed-store';
import type { FeedSection, FeedItem } from '@/src/domain/entities/feed-section';
import type { Track } from '@/src/domain/entities/track';

// Shared client instance — created once per app session
const sharedClient = createJioSaavnClient({ baseUrl: DEFAULT_CONFIG.baseUrl ?? '' });

const LOAD_MORE_THRESHOLD_PX = 300;
// Cooldown between fetches per carousel — prevents hammering on fast scroll
const FETCH_COOLDOWN_MS = 3000;

/**
 * Hook that adds horizontal load-more behaviour to a track carousel.
 * When the user scrolls within LOAD_MORE_THRESHOLD_PX of the right edge,
 * it fetches song suggestions based on the last track and appends them.
 *
 * Returns { isLoadingMore, handleHorizontalScroll } to wire into the ScrollView.
 */
export function useCarouselLoadMore(section: FeedSection, trackItems: Track[]) {
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const lockRef = useRef(false);
	const appendItemsToSection = useHomeFeedStore((s) => s.appendItemsToSection);

	const isTrackSection = section.source === 'remote' && trackItems.length > 0;

	const handleHorizontalScroll = useCallback(
		({
			nativeEvent,
		}: {
			nativeEvent: {
				contentOffset: { x: number };
				contentSize: { width: number };
				layoutMeasurement: { width: number };
			};
		}) => {
			if (!isTrackSection || lockRef.current) return;

			const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
			const distanceFromEnd = contentSize.width - layoutMeasurement.width - contentOffset.x;
			if (distanceFromEnd > LOAD_MORE_THRESHOLD_PX) return;

			const lastTrack = trackItems[trackItems.length - 1];
			if (!lastTrack) return;

			// Strip "jiosaavn:" source prefix to get the raw JioSaavn song ID
			const rawSongId = lastTrack.id.value.replace(/^[^:]+:/, '');
			if (!rawSongId) return;

			lockRef.current = true;
			setIsLoadingMore(true);

			sharedClient
				.getSongSuggestions(rawSongId)
				.then((songs) => {
					const raw = Array.isArray(songs) ? songs : [];
					const newItems: FeedItem[] = raw
						.map((song) => {
							const track = mapSong(song);
							return track
								? ({ type: 'track' as const, data: track } as FeedItem)
								: null;
						})
						.filter((item): item is FeedItem => item !== null);

					if (newItems.length > 0) {
						appendItemsToSection(section.id, newItems);
					}
				})
				.catch(() => {
					// Swallow silently — load-more failure should never surface to the user
				})
				.finally(() => {
					setIsLoadingMore(false);
					setTimeout(() => {
						lockRef.current = false;
					}, FETCH_COOLDOWN_MS);
				});
		},
		[isTrackSection, trackItems, section.id, appendItemsToSection]
	);

	return {
		isLoadingMore,
		handleHorizontalScroll: isTrackSection ? handleHorizontalScroll : undefined,
	};
}
