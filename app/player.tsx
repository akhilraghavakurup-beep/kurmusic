import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { router, usePathname } from 'expo-router';
import { Text, IconButton } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import type { AnimationObject } from 'lottie-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	FadeInDown,
	FadeInUp,
	FadeOut,
	LinearTransition,
	ZoomIn,
	runOnJS,
} from 'react-native-reanimated';
import { Icon } from '@/src/components/ui/icon';
import {
	ChevronLeftIcon,
	DownloadIcon,
	CheckIcon,
	LoaderCircleIcon,
	ListMusic,
} from 'lucide-react-native';
import { PlayerControls } from '@/src/components/player/player-controls';
import { ProgressBar } from '@/src/components/player/progress-bar';
import { SoundwaveVisualizer } from '@/src/components/player/soundwave-visualizer';
import { TrackOptionsMenu } from '@/src/components/track-options-menu';
import { PlayerThemeProvider, usePlayerTheme } from '@/src/components/player/player-theme-context';
import { getLargestArtwork } from '@/src/domain/value-objects/artwork';
import { getArtistNames } from '@/src/domain/entities/track';
import { getQualityLabel } from '@/src/domain/value-objects/audio-source';
import { useAppTheme } from '@/lib/theme';
import { usePlayerUIStore } from '@/src/application/state/player-ui-store';
import { useLibraryStore, useIsFavorite } from '@/src/application/state/library-store';
import { useCurrentTrack, usePlayerError } from '@/src/application/state/player-store';
import { useIsDownloaded, useIsDownloading } from '@/src/application/state/download-store';
import { useDownloadActions } from '@/src/hooks/use-download-actions';
import { usePlayer, usePlayerActions } from '@/src/hooks/use-player';
import { usePreferredStreamQuality } from '@/src/application/state/settings-store';
import { LinearGradient } from 'expo-linear-gradient';

const thumbUpRegular =
	require('@/assets/animation/system-regular-124-thumb-up-hover-thumb-up.json') as AnimationObject;
const thumbUpSolid =
	require('@/assets/animation/system-solid-124-thumb-up-hover-thumb-up.json') as AnimationObject;

const DARK_SCRIM_OPACITY = 0.6;
function hexToRgbArray(hex: string): [number, number, number, number] {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return [0, 0, 0, 1];
	return [
		parseInt(result[1], 16) / 255,
		parseInt(result[2], 16) / 255,
		parseInt(result[3], 16) / 255,
		1,
	];
}

function replaceColorsInSource(source: AnimationObject, color: string): AnimationObject {
	const rgbArray = hexToRgbArray(color);
	const json = JSON.stringify(source);
	const replaced = json.replace(
		/"c"\s*:\s*\{\s*"a"\s*:\s*0\s*,\s*"k"\s*:\s*\[\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\]/g,
		`"c":{"a":0,"k":[${rgbArray.join(',')}]`
	);
	return JSON.parse(replaced) as AnimationObject;
}

export default function PlayerScreen() {
	const currentTrack = useCurrentTrack();
	const artwork = currentTrack ? getLargestArtwork(currentTrack.artwork) : undefined;
	const artworkUrl = artwork?.url;

	return (
		<PlayerThemeProvider artworkUrl={artworkUrl}>
			<PlayerScreenContent />
		</PlayerThemeProvider>
	);
}

function PlayerScreenContent() {
	const pathname = usePathname();
	const currentTrack = useCurrentTrack();
	const error = usePlayerError();
	const { colors: appColors, isDark } = useAppTheme();
	const { colors, backgroundStyle, dominantColor } = usePlayerTheme();
	const openQueueSheet = usePlayerUIStore((s) => s.openQueueSheet);
	const [artworkLoaded, setArtworkLoaded] = useState(false);
	const { isPlaying } = usePlayer();
	const { skipToNext, skipToPrevious } = usePlayerActions();

	const trackId = currentTrack?.id.value ?? '';
	const isFavorite = useIsFavorite(trackId);
	const isDownloaded = useIsDownloaded(trackId);
	const isDownloading = useIsDownloading(trackId);
	const lottieRef = useRef<LottieView>(null);
	const { startDownload } = useDownloadActions();
	const preferredStreamQuality = usePreferredStreamQuality();

	const coloredSource = useMemo(
		() =>
			replaceColorsInSource(
				isFavorite ? thumbUpSolid : thumbUpRegular,
				isFavorite ? colors.primary : colors.onSurfaceVariant
			),
		[isFavorite, colors.primary, colors.onSurfaceVariant]
	);

	const artworkShadowStyle = useMemo(() => {
		const shadowColor = dominantColor ?? '#000';
		return {
			shadowColor,
			shadowOffset: { width: 0, height: 20 },
			shadowOpacity: 0.45,
			shadowRadius: 36,
			elevation: 28,
		};
	}, [dominantColor]);

	const handleToggleFavorite = useCallback(() => {
		const store = useLibraryStore.getState();
		if (currentTrack && !isFavorite) {
			store.addTrack(currentTrack);
		}
		store.toggleFavorite(trackId);
		requestAnimationFrame(() => {
			lottieRef.current?.reset();
			lottieRef.current?.play();
		});
	}, [currentTrack, trackId, isFavorite]);

	const handleDownload = useCallback(() => {
		if (!currentTrack || isDownloaded || isDownloading) {
			return;
		}
		void startDownload(currentTrack);
	}, [currentTrack, isDownloaded, isDownloading, startDownload]);

	const artwork = currentTrack ? getLargestArtwork(currentTrack.artwork) : undefined;
	const artworkUrl = artwork?.url;

	useEffect(() => {
		if (!currentTrack && pathname === '/player') {
			router.back();
		}
	}, [currentTrack, pathname]);

	useEffect(() => {
		setArtworkLoaded(false);
	}, [artworkUrl]);

	const handleArtworkLoad = useCallback(() => {
		setArtworkLoaded(true);
	}, []);

	const swipeGesture = useMemo(
		() =>
			Gesture.Pan()
				.activeOffsetX([-20, 20])
				.failOffsetY([-15, 15])
				.onEnd((event) => {
					const shouldSkipNext = event.translationX <= -80 || event.velocityX <= -900;
					const shouldSkipPrevious = event.translationX >= 80 || event.velocityX >= 900;

					if (shouldSkipNext) {
						runOnJS(skipToNext)();
					} else if (shouldSkipPrevious) {
						runOnJS(skipToPrevious)();
					}
				}),
		[skipToNext, skipToPrevious]
	);

	if (!currentTrack) {
		return null;
	}

	const artistNames = getArtistNames(currentTrack);
	const albumName = currentTrack.album?.name;

	// Artwork-blur and artwork-solid always have dark backgrounds → light status bar
	// Theme-color follows the app theme
	const statusBarStyle =
		backgroundStyle === 'theme-color' ? (isDark ? 'light' : 'dark') : 'light';

	return (
		<GestureDetector gesture={swipeGesture}>
			<View style={[styles.container, { backgroundColor: appColors.background }]}>
				<StatusBar style={statusBarStyle} />
				{renderBackground(backgroundStyle, artworkUrl, appColors.background, dominantColor)}

				<SafeAreaView style={styles.safeArea}>
					<View style={styles.content}>
						<Animated.View entering={FadeInDown.duration(320)} style={styles.header}>
							<IconButton
								icon={() => (
									<Icon as={ChevronLeftIcon} size={24} color={colors.onSurface} />
								)}
								onPress={() => router.back()}
							/>
							<Text variant={'labelLarge'} style={{ color: colors.onSurfaceVariant }}>
								Now Playing
							</Text>
							<View style={styles.headerActions}>
								<IconButton
									icon={() => (
										<Icon
											as={ListMusic}
											size={20}
											color={colors.onSurfaceVariant}
										/>
									)}
									onPress={openQueueSheet}
									size={20}
									accessibilityLabel={'Open queue'}
								/>
								<TrackOptionsMenu
									track={currentTrack}
									source={'player'}
									orientation={'horizontal'}
									iconColor={colors.onSurfaceVariant}
								/>
							</View>
						</Animated.View>

						<Animated.View
							entering={ZoomIn.springify().damping(16).delay(60)}
							style={styles.artworkContainer}
						>
							<View
								style={[styles.artworkWrapper, artworkLoaded && artworkShadowStyle]}
							>
								{artworkUrl ? (
									<Image
										source={{ uri: artworkUrl }}
										style={styles.artwork}
										contentFit={'contain'}
										transition={300}
										cachePolicy={'memory-disk'}
										recyclingKey={currentTrack.id.value}
										onLoad={handleArtworkLoad}
									/>
								) : (
									<View
										style={[
											styles.artwork,
											styles.artworkPlaceholder,
											{ backgroundColor: appColors.surfaceContainerHighest },
										]}
									/>
								)}
							</View>
						</Animated.View>

						{/* Audio Soundwave Spectrum Visualizer */}
						<View style={{ marginVertical: 8 }}>
							<SoundwaveVisualizer isPlaying={isPlaying} color={colors.primary} />
						</View>

						<Animated.View
							entering={FadeInUp.duration(320).delay(120)}
							layout={LinearTransition.springify().damping(18)}
							style={styles.trackInfo}
						>
							<View style={styles.trackInfoText}>
								<Animated.View
									key={`track-meta-${currentTrack.id.value}`}
									entering={FadeInUp.duration(260)}
									exiting={FadeOut.duration(160)}
								>
									<Text
										numberOfLines={2}
										adjustsFontSizeToFit={true}
										minimumFontScale={0.75}
										style={{
											color: colors.onSurface,
											fontSize: 22,
											fontWeight: '800',
											letterSpacing: -0.3,
											lineHeight: 28,
											marginBottom: 4,
										}}
									>
										{currentTrack.title}
									</Text>
									<Text
										numberOfLines={1}
										style={{
											color: colors.onSurfaceVariant,
											fontSize: 16,
											fontWeight: '600',
											opacity: 0.8,
										}}
									>
										{albumName
											? `${artistNames} \u2022 ${albumName}`
											: artistNames}
									</Text>
									<View style={styles.badgeRow}>
										<View
											style={[
												styles.qualityBadge,
												{ borderColor: `${colors.onSurfaceVariant}4D` },
											]}
										>
											<Text
												variant={'labelSmall'}
												numberOfLines={1}
												style={[
													styles.qualityBadgeText,
													{ color: colors.onSurfaceVariant },
												]}
											>
												{getQualityLabel(
													preferredStreamQuality
												).toUpperCase()}
											</Text>
										</View>
									</View>
								</Animated.View>
							</View>
							<Animated.View
								entering={FadeInUp.duration(240).delay(160)}
								style={styles.trackActions}
							>
								<IconButton
									icon={() => (
										<LottieView
											ref={lottieRef}
											source={coloredSource}
											style={styles.favoriteIcon}
											autoPlay={false}
											loop={false}
										/>
									)}
									onPress={handleToggleFavorite}
									accessibilityLabel={
										isFavorite ? 'Remove from favorites' : 'Add to favorites'
									}
								/>
								<IconButton
									icon={() => (
										<Icon
											as={
												isDownloaded
													? CheckIcon
													: isDownloading
														? LoaderCircleIcon
														: DownloadIcon
											}
											size={20}
											color={
												isDownloaded
													? colors.primary
													: isDownloading
														? colors.primary
														: colors.onSurfaceVariant
											}
										/>
									)}
									onPress={handleDownload}
									disabled={isDownloaded || isDownloading}
									accessibilityLabel={
										isDownloaded
											? 'Downloaded'
											: isDownloading
												? 'Downloading'
												: 'Download track'
									}
								/>
							</Animated.View>
						</Animated.View>

						{error && (
							<View
								style={[
									styles.errorContainer,
									{ backgroundColor: `${colors.error}1A` },
								]}
							>
								<Text variant={'bodySmall'} style={{ color: colors.error }}>
									{error}
								</Text>
							</View>
						)}

						<Animated.View
							entering={FadeInUp.duration(320).delay(220)}
							style={styles.controlsCard}
						>
							<ProgressBar seekable={true} />
							<View style={{ height: 16 }} />
							<PlayerControls size={'lg'} />
						</Animated.View>
					</View>
				</SafeAreaView>
			</View>
		</GestureDetector>
	);
}

function renderBackground(
	style: string,
	artworkUrl: string | undefined,
	backgroundColor: string,
	dominantColor: string | null
) {
	if (style === 'theme-color') {
		return null;
	}

	if (style === 'artwork-solid') {
		const solidColor = dominantColor ?? backgroundColor;
		return (
			<View style={StyleSheet.absoluteFill}>
				<View style={[StyleSheet.absoluteFill, { backgroundColor: solidColor }]} />
				<View
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: `rgba(0,0,0,${DARK_SCRIM_OPACITY})` },
					]}
				/>
			</View>
		);
	}

	// Dynamic Spotify-style Gradient Background (Default & Premium)
	const topColor = dominantColor ?? '#1c1f26';
	const bottomColor = '#0b0c0f';

	return (
		<View style={StyleSheet.absoluteFill}>
			{artworkUrl ? (
				<Image
					source={{ uri: artworkUrl }}
					style={[StyleSheet.absoluteFill, { opacity: 0.12 }]}
					contentFit={'cover'}
				/>
			) : null}
			<LinearGradient
				colors={[topColor, bottomColor]}
				locations={[0, 0.75]}
				style={StyleSheet.absoluteFill}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingTop: 8,
		paddingHorizontal: 24,
		paddingBottom: 24,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	artworkContainer: {
		flex: 1,
		width: '100%',
		maxHeight: '44%',
		justifyContent: 'center',
		alignItems: 'center',
		marginVertical: 8,
	},
	artworkWrapper: {
		width: '88%',
		maxWidth: 320,
		aspectRatio: 1,
		borderRadius: 24,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.08)',
	},
	artworkShadow: {
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 16 },
		shadowOpacity: 0.35,
		shadowRadius: 32,
		elevation: 24,
	},
	artwork: {
		width: '100%',
		height: '100%',
		aspectRatio: 1,
		borderRadius: 24,
	},
	artworkPlaceholder: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	trackInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 16,
		marginBottom: 12,
	},
	trackInfoText: {
		flex: 1,
		gap: 4,
	},
	trackActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	errorContainer: {
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 12,
		marginBottom: 16,
	},
	progressContainer: {
		marginBottom: 24,
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	favoriteIcon: {
		width: 32,
		height: 32,
	},
	qualityBadge: {
		borderWidth: 1,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	qualityBadgeText: {
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 1.2,
	},
	badgeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 8,
	},
	sourceBadge: {
		borderWidth: 1,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	sourceBadgeText: {
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 1.2,
	},
	controlsCard: {
		backgroundColor: 'rgba(255, 255, 255, 0.03)',
		borderColor: 'rgba(255, 255, 255, 0.06)',
		borderWidth: 1,
		borderRadius: 28,
		padding: 24,
		marginTop: 16,
	},
});
