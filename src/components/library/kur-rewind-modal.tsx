import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHistoryStore } from '../../application/state/history-store';
import { usePlayerStore } from '../../application/state/player-store';
import { playbackService } from '../../application/services/playback-service';
import { getBestArtwork } from '../../domain/value-objects/artwork';
import type { Track } from '../../domain/entities/track';

interface KurRewindModalProps {
	visible: boolean;
	onClose: () => void;
}

export const KurRewindModal: React.FC<KurRewindModalProps> = ({ visible, onClose }) => {
	const historyStore = useHistoryStore();

	const topTracks = historyStore.getTopTracks(10);
	const topArtists = historyStore.getTopArtists(6);
	const totalMinutes = historyStore.getTotalListenedTimeMinutes();

	const handlePlayDailyMix = React.useCallback(async () => {
		if (topTracks.length > 0) {
			usePlayerStore.getState().setQueue(topTracks, 0);
			await playbackService.play(topTracks[0]);
			onClose();
		}
	}, [topTracks, onClose]);

	const handlePlayTrack = React.useCallback(
		async (track: Track) => {
			const index = topTracks.findIndex((t) => t.id.value === track.id.value);
			usePlayerStore.getState().setQueue(topTracks, index >= 0 ? index : 0);
			await playbackService.play(track);
			onClose();
		},
		[topTracks, onClose]
	);

	return (
		<Modal
			visible={visible}
			animationType={'slide'}
			transparent={false}
			onRequestClose={onClose}
		>
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.headerTitleRow}>
						<Ionicons name={'sparkles'} size={24} color={'#8A2BE2'} />
						<Text style={styles.headerTitle}>Kur Rewind</Text>
					</View>
					<TouchableOpacity onPress={onClose} style={styles.closeButton}>
						<Ionicons name={'close'} size={24} color={'#FFFFFF'} />
					</TouchableOpacity>
				</View>

				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					{/* Stat Card 1: Total Minutes */}
					<View style={styles.heroCard}>
						<Ionicons name={'headset-outline'} size={32} color={'#A855F7'} />
						<Text style={styles.heroStatNumber}>{totalMinutes}</Text>
						<Text style={styles.heroStatLabel}>Minutes of Music Listened</Text>
					</View>

					{/* Action: Generate Daily Mix */}
					{topTracks.length > 0 && (
						<TouchableOpacity
							style={styles.dailyMixButton}
							onPress={handlePlayDailyMix}
						>
							<Ionicons name={'play-circle'} size={28} color={'#FFFFFF'} />
							<View style={styles.dailyMixTextCol}>
								<Text style={styles.dailyMixTitle}>Play Your Daily Mix</Text>
								<Text style={styles.dailyMixSubtitle}>
									Queue up your top 10 most played tracks
								</Text>
							</View>
						</TouchableOpacity>
					)}

					{/* Stat Section 2: Top Artists */}
					{topArtists.length > 0 && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Your Top Artists</Text>
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
											<View key={artist.name + idx} style={styles.artistCard}>
												{imgUrl ? (
													<Image
														source={{ uri: imgUrl }}
														style={styles.artistAvatar}
													/>
												) : (
													<View
														style={[
															styles.artistAvatar,
															styles.placeholderAvatar,
														]}
													>
														<Ionicons
															name={'person'}
															size={28}
															color={'#94A3B8'}
														/>
													</View>
												)}
												<Text style={styles.artistName} numberOfLines={1}>
													{artist.name}
												</Text>
												<Text style={styles.artistBadge}>
													{artist.count} plays
												</Text>
											</View>
										);
									}
								)}
							</ScrollView>
						</View>
					)}

					{/* Stat Section 3: Top Played Songs */}
					{topTracks.length > 0 && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Most Played Tracks</Text>
							{topTracks.map((track: Track, index: number) => {
								const imgUrl = getBestArtwork(track.artwork)?.url;
								return (
									<TouchableOpacity
										key={track.id.value + index}
										style={styles.trackRow}
										onPress={() => handlePlayTrack(track)}
									>
										<Text style={styles.trackRank}>#{index + 1}</Text>
										{imgUrl ? (
											<Image
												source={{ uri: imgUrl }}
												style={styles.trackThumb}
											/>
										) : (
											<View
												style={[
													styles.trackThumb,
													styles.placeholderAvatar,
												]}
											>
												<Ionicons
													name={'musical-notes'}
													size={20}
													color={'#94A3B8'}
												/>
											</View>
										)}
										<View style={styles.trackInfo}>
											<Text style={styles.trackTitle} numberOfLines={1}>
												{track.title}
											</Text>
											<Text style={styles.trackArtist} numberOfLines={1}>
												{track.artists?.[0]?.name || 'Unknown Artist'}
											</Text>
										</View>
									</TouchableOpacity>
								);
							})}
						</View>
					)}
				</ScrollView>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#0F172A',
		paddingTop: 48,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(255,255,255,0.08)',
	},
	headerTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	closeButton: {
		padding: 4,
	},
	scrollContent: {
		padding: 20,
		gap: 24,
	},
	heroCard: {
		backgroundColor: 'rgba(138, 43, 226, 0.15)',
		borderRadius: 20,
		padding: 24,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: 'rgba(138, 43, 226, 0.3)',
	},
	heroStatNumber: {
		fontSize: 48,
		fontWeight: '800',
		color: '#FFFFFF',
		marginTop: 8,
	},
	heroStatLabel: {
		fontSize: 14,
		color: '#94A3B8',
		marginTop: 4,
	},
	dailyMixButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#8A2BE2',
		borderRadius: 16,
		padding: 16,
		gap: 14,
	},
	dailyMixTextCol: {
		flex: 1,
	},
	dailyMixTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	dailyMixSubtitle: {
		fontSize: 12,
		color: 'rgba(255,255,255,0.8)',
		marginTop: 2,
	},
	section: {
		gap: 12,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	artistsRow: {
		flexDirection: 'row',
	},
	artistCard: {
		alignItems: 'center',
		marginRight: 16,
		width: 80,
	},
	artistAvatar: {
		width: 70,
		height: 70,
		borderRadius: 35,
	},
	placeholderAvatar: {
		backgroundColor: '#1E293B',
		alignItems: 'center',
		justifyContent: 'center',
	},
	artistName: {
		fontSize: 12,
		fontWeight: '600',
		color: '#FFFFFF',
		marginTop: 6,
		textAlign: 'center',
	},
	artistBadge: {
		fontSize: 10,
		color: '#A855F7',
		marginTop: 2,
	},
	trackRow: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(255,255,255,0.03)',
		borderRadius: 12,
		padding: 12,
		gap: 12,
	},
	trackRank: {
		fontSize: 14,
		fontWeight: '700',
		color: '#8A2BE2',
		width: 24,
	},
	trackThumb: {
		width: 44,
		height: 44,
		borderRadius: 8,
	},
	trackInfo: {
		flex: 1,
	},
	trackTitle: {
		fontSize: 14,
		fontWeight: '600',
		color: '#FFFFFF',
	},
	trackArtist: {
		fontSize: 12,
		color: '#94A3B8',
		marginTop: 2,
	},
});
