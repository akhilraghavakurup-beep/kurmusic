import { memo, useCallback, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from 'react-native-reanimated';
import { TrackCard } from '@/src/components/media-list/track-card';
import { AlbumCard } from '@/src/components/media-list/album-card';
import { ArtistCard } from './artist-card';
import { PlaylistCard } from './playlist-card';
import { useAppTheme } from '@/lib/theme';
import { useUIStyle } from '@/src/application/state/settings-store';
import { usePlayerStore } from '@/src/application/state/player-store';
import { useCarouselLoadMore } from '@/src/hooks/use-carousel-load-more';
import type { FeedSection } from '@/src/domain/entities/feed-section';
import type { Track } from '@/src/domain/entities/track';

interface FeedCarouselProps {
	readonly section: FeedSection;
}

export const FeedCarousel = memo(function FeedCarousel({ section }: FeedCarouselProps) {
	const { colors } = useAppTheme();
	const uiStyle = useUIStyle();
	const glowPulse = useSharedValue(0.55);
	const glowSweep = useSharedValue(0);

	useEffect(() => {
		glowPulse.value = withRepeat(
			withSequence(withTiming(1, { duration: 1200 }), withTiming(0.72, { duration: 1200 })),
			-1,
			true
		);
		glowSweep.value = withRepeat(withTiming(1, { duration: 2200 }), -1, true);
	}, [glowPulse, glowSweep]);

	const glowStyle = useAnimatedStyle(() => ({
		opacity: 0.22 + glowPulse.value * 0.18,
		transform: [{ scale: 1 + (glowPulse.value - 0.72) * 0.045 }],
	}));

	const sweepStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: (glowSweep.value * 2 - 1) * 180 }],
		opacity: 0.22 + (glowPulse.value - 0.72) * 0.18,
	}));

	const trackItems = useMemo(
		() =>
			section.items.filter((item) => item.type === 'track').map((item) => item.data as Track),
		[section.items]
	);

	const isTrackSection = trackItems.length > 0 && section.source === 'remote';

	// ── Horizontal load-more (track sections only) ───────────────────────────
	const { isLoadingMore, handleHorizontalScroll } = useCarouselLoadMore(section, trackItems);

	// ── Play All ─────────────────────────────────────────────────────────────
	const setQueue = usePlayerStore((s) => s.setQueue);
	const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
	const isShuffled = usePlayerStore((s) => s.isShuffled);

	const handlePlayAll = useCallback(() => {
		if (trackItems.length === 0) return;
		// If currently shuffled, un-shuffle first so Play All plays in order
		if (isShuffled) toggleShuffle();
		setQueue(trackItems, 0);
	}, [trackItems, setQueue, isShuffled, toggleShuffle]);

	// ── Shuffle Play ─────────────────────────────────────────────────────────
	const handleShuffle = useCallback(() => {
		if (trackItems.length === 0) return;
		setQueue(trackItems, 0);
		// Enable shuffle after queuing so the store shuffles from position 0
		if (!isShuffled) toggleShuffle();
	}, [trackItems, setQueue, isShuffled, toggleShuffle]);

	const isGlowFlow = uiStyle === 'glow-flow';
	const isGlass = uiStyle === 'glass';
	const isBold = uiStyle === 'bold';
	const isNeo = uiStyle === 'neo';
	const containerStyle = useMemo(() => {
		switch (uiStyle) {
			case 'clean':
				return {
					backgroundColor: colors.surfaceContainerLow,
					borderColor: colors.outlineVariant,
					borderWidth: StyleSheet.hairlineWidth,
				};
			case 'glass':
				return {
					backgroundColor: `${colors.surfaceContainerLow}CC`,
					borderColor: `${colors.primary}40`,
					borderWidth: 1,
				};
			case 'bold':
				return {
					backgroundColor: colors.surfaceContainerHigh,
					borderColor: colors.primary,
					borderWidth: 1.4,
				};
			case 'neo':
				return {
					backgroundColor: colors.surfaceContainerLowest ?? colors.surfaceContainerLow,
					borderColor: `${colors.primary}80`,
					borderWidth: 1.1,
				};
			case 'glow-flow':
			default:
				return {
					backgroundColor: colors.surfaceContainerLow,
					borderColor: colors.outlineVariant,
					borderWidth: StyleSheet.hairlineWidth,
				};
		}
	}, [uiStyle, colors]);

	return (
		<View style={styles.shell}>
			{(isGlowFlow || isNeo) && (
				<Animated.View
					pointerEvents={'none'}
					style={[
						styles.glow,
						{
							borderColor: colors.primary,
							backgroundColor: colors.primary,
							shadowColor: colors.primary,
						},
						glowStyle,
					]}
				/>
			)}
			{(isGlowFlow || isNeo) && (
				<Animated.View pointerEvents={'none'} style={[styles.sweepMask, sweepStyle]}>
					<LinearGradient
						colors={[
							'transparent',
							`${colors.primary}00`,
							`${colors.primary}66`,
							`${colors.primary}00`,
							'transparent',
						]}
						start={{ x: 0, y: 0.5 }}
						end={{ x: 1, y: 0.5 }}
						style={styles.sweepGradient}
					/>
				</Animated.View>
			)}
			<View
				style={[
					styles.container,
					containerStyle,
					isGlass && styles.glassContainer,
					isBold && styles.boldContainer,
					isNeo && styles.neoContainer,
				]}
			>
				<View style={styles.header}>
					<View style={styles.headerTitleRow}>
						<Text
							variant={'titleMedium'}
							style={[styles.title, { color: colors.onSurface }]}
						>
							{section.title}
						</Text>

						{/* ▶ Play All + Shuffle — only shown for remote track sections */}
						{isTrackSection && (
							<View style={styles.headerActions}>
								<IconButton
									icon={'shuffle'}
									size={18}
									iconColor={colors.onSurfaceVariant}
									onPress={handleShuffle}
									style={styles.headerIconButton}
								/>
								<IconButton
									icon={'play-circle-outline'}
									size={20}
									iconColor={colors.primary}
									onPress={handlePlayAll}
									style={styles.headerIconButton}
								/>
							</View>
						)}
					</View>
					{section.subtitle && (
						<Text variant={'bodySmall'} style={{ color: colors.onSurfaceVariant }}>
							{section.subtitle}
						</Text>
					)}
				</View>

				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.scrollContent}
					onScroll={handleHorizontalScroll}
					scrollEventThrottle={handleHorizontalScroll ? 200 : undefined}
				>
					{section.items.map((item, index) => (
						<FeedCarouselItem
							key={`${section.id}-${index}`}
							item={item}
							compact={section.compact}
							trackQueue={trackItems}
							trackQueueIndex={
								item.type === 'track'
									? trackItems.indexOf(item.data as Track)
									: undefined
							}
						/>
					))}

					{/* Subtle spinner that appears at the right edge while fetching more */}
					{isLoadingMore && (
						<View style={styles.loadMoreSpinner}>
							<ActivityIndicator size={'small'} color={colors.primary} />
						</View>
					)}
				</ScrollView>
			</View>
		</View>
	);
});

interface FeedCarouselItemProps {
	readonly item: FeedSection['items'][number];
	readonly compact?: boolean;
	readonly trackQueue: Track[];
	readonly trackQueueIndex?: number;
}

const FeedCarouselItem = memo(function FeedCarouselItem({
	item,
	compact = false,
	trackQueue,
	trackQueueIndex,
}: FeedCarouselItemProps) {
	const handleAlbumPress = useCallback(() => {
		if (item.type === 'album') {
			router.push(`/album/${item.data.id.value}`);
		}
	}, [item]);

	const handlePlaylistPress = useCallback(() => {
		if (item.type === 'playlist') {
			router.push({
				pathname: '/remote-playlist/[id]',
				params: {
					id: item.data.id,
					name: item.data.name,
					artwork: item.data.artwork?.[0]?.url,
				},
			});
		}
	}, [item]);

	switch (item.type) {
		case 'track':
			return (
				<TrackCard
					track={item.data}
					queue={trackQueue}
					queueIndex={trackQueueIndex}
					compact={compact}
				/>
			);
		case 'album':
			return <AlbumCard album={item.data} onPress={handleAlbumPress} />;
		case 'artist':
			return <ArtistCard artist={item.data} />;
		case 'playlist':
			return <PlaylistCard playlist={item.data} onPress={handlePlaylistPress} />;
	}
});

const styles = StyleSheet.create({
	shell: {
		marginHorizontal: 12,
	},
	glow: {
		position: 'absolute',
		top: 1,
		right: 1,
		bottom: 1,
		left: 1,
		borderRadius: 32,
		borderWidth: 2,
		opacity: 0.48,
		elevation: 12,
		shadowOpacity: 0.3,
		shadowRadius: 22,
		shadowOffset: {
			width: 0,
			height: 0,
		},
	},
	sweepMask: {
		position: 'absolute',
		top: '44%',
		right: -56,
		left: -56,
		height: 18,
		borderRadius: 999,
		overflow: 'hidden',
	},
	sweepGradient: {
		width: '220%',
		height: 18,
	},
	container: {
		gap: 12,
		paddingVertical: 14,
		paddingTop: 16,
		borderRadius: 28,
		overflow: 'hidden',
	},
	glassContainer: {
		shadowOpacity: 0.08,
	},
	boldContainer: {
		borderRadius: 24,
		paddingTop: 18,
	},
	neoContainer: {
		borderRadius: 30,
		shadowOpacity: 0.22,
		shadowRadius: 24,
	},
	header: {
		paddingHorizontal: 16,
		gap: 2,
	},
	headerTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	title: {
		fontWeight: '700',
		flex: 1,
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 0,
	},
	headerIconButton: {
		margin: 0,
	},
	scrollContent: {
		paddingHorizontal: 16,
		gap: 12,
	},
	loadMoreSpinner: {
		width: 60,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
