import React from 'react';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Image,
	NativeSyntheticEvent,
	NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHistoryStore } from '../../application/state/history-store';
import { usePlayerStore } from '../../application/state/player-store';
import { playbackService } from '../../application/services/playback-service';
import { getBestArtwork } from '../../domain/value-objects/artwork';
import type { Track } from '../../domain/entities/track';
import { useAppTheme } from '@/lib/theme';

interface KurRewindTabProps {
	onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const KurRewindTab: React.FC<KurRewindTabProps> = ({ onScroll }) => {
	const { colors } = useAppTheme();
	const historyStore = useHistoryStore();

	const topTracks = historyStore.getTopTracks(10);
	const topArtists = historyStore.getTopArtists(6);
	const totalMinutes = historyStore.getTotalListenedTimeMinutes();

	const handlePlayDailyMix = React.useCallback(async () => {
		if (topTracks.length > 0) {
			usePlayerStore.getState().setQueue(topTracks, 0);
			await playbackService.play(topTracks[0]);
		}
	}, [topTracks]);

	const handlePlayTrack = React.useCallback(
		async (track: Track) => {
			const index = topTracks.findIndex((t) => t.id.value === track.id.value);
			usePlayerStore.getState().setQueue(topTracks, index >= 0 ? index : 0);
			await playbackService.play(track);
		},
		[topTracks]
	);

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: colors.background }]}
			contentContainerStyle={styles.scrollContent}
			showsVerticalScrollIndicator={false}
			onScroll={onScroll}
			scrollEventThrottle={16}
		>
			{/* Header Banner */}
			<View style={styles.headerBanner}>
				<Ionicons name={'sparkles'} size={28} color={colors.primary} />
				<View>
					<Text style={[styles.headerBannerTitle, { color: colors.onSurface }]}>
						Kur Rewind
					</Text>
					<Text style={[styles.headerBannerSubtitle, { color: colors.onSurfaceVariant }]}>
						Your personalized listening insights & statistics
					</Text>
				</View>
			</View>

			{/* Stat Card 1: Total Minutes */}
			<View style={[styles.heroCard, { backgroundColor: colors.surfaceContainerHigh }]}>
				<Ionicons name={'headset-outline'} size={36} color={colors.primary} />
				<Text style={[styles.heroStatNumber, { color: colors.onSurface }]}>
					{totalMinutes}
				</Text>
				<Text style={[styles.heroStatLabel, { color: colors.onSurfaceVariant }]}>
					Total Minutes of Music Listened
				</Text>
			</View>

			{/* Action: Generate Daily Mix */}
			{topTracks.length > 0 && (
				<TouchableOpacity
					style={[styles.dailyMixButton, { backgroundColor: colors.primaryContainer }]}
					onPress={handlePlayDailyMix}
				>
					<Ionicons name={'play-circle'} size={32} color={colors.onPrimaryContainer} />
					<View style={styles.dailyMixTextCol}>
						<Text style={[styles.dailyMixTitle, { color: colors.onPrimaryContainer }]}>
							Play Your Daily Mix
						</Text>
						<Text
							style={[styles.dailyMixSubtitle, { color: colors.onPrimaryContainer }]}
						>
							Queue up your top 10 most played tracks
						</Text>
					</View>
				</TouchableOpacity>
			)}

			{/* Stat Section 2: Top Artists */}
			{topArtists.length > 0 && (
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
						Your Top Artists
					</Text>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						style={styles.artistsRow}
					>
						{topArtists.map(
							(
								artist: { name: string; count: number; artwork?: any },
								idx: number
							) => {
								const imgUrl = getBestArtwork(artist.artwork)?.url;
								return (
									<View
										key={artist.name + idx}
										style={[
											styles.artistCard,
											{ backgroundColor: colors.surfaceContainer },
										]}
									>
										{imgUrl ? (
											<Image
												source={{ uri: imgUrl }}
												style={styles.artistAvatar}
											/>
										) : (
											<View
												style={[
													styles.artistAvatar,
													{
														backgroundColor:
															colors.surfaceContainerHigh,
													},
												]}
											>
												<Ionicons
													name={'person'}
													size={28}
													color={colors.onSurfaceVariant}
												/>
											</View>
										)}
										<Text
											style={[styles.artistName, { color: colors.onSurface }]}
											numberOfLines={1}
										>
											{artist.name}
										</Text>
										<Text
											style={[styles.artistBadge, { color: colors.primary }]}
										>
											{artist.count} {artist.count === 1 ? 'play' : 'plays'}
										</Text>
									</View>
								);
							}
						)}
					</ScrollView>
				</View>
			)}

			{/* Stat Section 3: Top Played Songs */}
			{topTracks.length > 0 ? (
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
						Most Played Tracks
					</Text>
					{topTracks.map((track: Track, index: number) => {
						const imgUrl = getBestArtwork(track.artwork)?.url;
						return (
							<TouchableOpacity
								key={track.id.value + index}
								style={[
									styles.trackRow,
									{ backgroundColor: colors.surfaceContainerLow },
								]}
								onPress={() => handlePlayTrack(track)}
							>
								<Text style={[styles.trackRank, { color: colors.primary }]}>
									#{index + 1}
								</Text>
								{imgUrl ? (
									<Image source={{ uri: imgUrl }} style={styles.trackThumb} />
								) : (
									<View
										style={[
											styles.trackThumb,
											{ backgroundColor: colors.surfaceContainerHigh },
										]}
									>
										<Ionicons
											name={'musical-notes'}
											size={20}
											color={colors.onSurfaceVariant}
										/>
									</View>
								)}
								<View style={styles.trackInfo}>
									<Text
										style={[styles.trackTitle, { color: colors.onSurface }]}
										numberOfLines={1}
									>
										{track.title}
									</Text>
									<Text
										style={[
											styles.trackArtist,
											{ color: colors.onSurfaceVariant },
										]}
										numberOfLines={1}
									>
										{track.artists?.[0]?.name || 'Unknown Artist'}
									</Text>
								</View>
							</TouchableOpacity>
						);
					})}
				</View>
			) : (
				<View style={[styles.emptyBox, { backgroundColor: colors.surfaceContainerLow }]}>
					<Ionicons
						name={'stats-chart-outline'}
						size={40}
						color={colors.onSurfaceVariant}
					/>
					<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
						No Listening Data Yet
					</Text>
					<Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
						Play your favorite tracks to generate your custom listening insights!
					</Text>
				</View>
			)}
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 100,
	},
	headerBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginBottom: 20,
	},
	headerBannerTitle: {
		fontSize: 22,
		fontWeight: '800',
	},
	headerBannerSubtitle: {
		fontSize: 13,
		marginTop: 2,
	},
	heroCard: {
		borderRadius: 20,
		padding: 24,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 20,
	},
	heroStatNumber: {
		fontSize: 48,
		fontWeight: '900',
		marginVertical: 4,
	},
	heroStatLabel: {
		fontSize: 14,
		fontWeight: '600',
	},
	dailyMixButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 16,
		padding: 16,
		gap: 14,
		marginBottom: 24,
	},
	dailyMixTextCol: {
		flex: 1,
	},
	dailyMixTitle: {
		fontSize: 16,
		fontWeight: '700',
	},
	dailyMixSubtitle: {
		fontSize: 13,
		opacity: 0.85,
		marginTop: 2,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 12,
	},
	artistsRow: {
		flexDirection: 'row',
	},
	artistCard: {
		width: 110,
		borderRadius: 16,
		padding: 12,
		alignItems: 'center',
		marginRight: 12,
	},
	artistAvatar: {
		width: 64,
		height: 64,
		borderRadius: 32,
		marginBottom: 8,
		justifyContent: 'center',
		alignItems: 'center',
	},
	artistName: {
		fontSize: 13,
		fontWeight: '600',
		textAlign: 'center',
		marginBottom: 2,
	},
	artistBadge: {
		fontSize: 11,
		fontWeight: '700',
	},
	trackRow: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderRadius: 14,
		marginBottom: 8,
	},
	trackRank: {
		fontSize: 15,
		fontWeight: '800',
		width: 32,
	},
	trackThumb: {
		width: 44,
		height: 44,
		borderRadius: 8,
		marginRight: 12,
		justifyContent: 'center',
		alignItems: 'center',
	},
	trackInfo: {
		flex: 1,
	},
	trackTitle: {
		fontSize: 15,
		fontWeight: '600',
	},
	trackArtist: {
		fontSize: 13,
		marginTop: 2,
	},
	emptyBox: {
		borderRadius: 20,
		padding: 32,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 20,
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: '700',
		marginTop: 12,
	},
	emptySubtitle: {
		fontSize: 13,
		textAlign: 'center',
		marginTop: 6,
	},
});
