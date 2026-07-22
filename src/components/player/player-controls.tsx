/**
 * PlayerControls Component
 *
 * Main playback controls with play/pause, skip, shuffle, and repeat.
 * Uses M3 theming.
 */

import { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton } from 'react-native-paper';
import { SkipBack, SkipForward, Repeat, Repeat1, Shuffle } from 'lucide-react-native';
import { usePlayer } from '@/src/hooks/use-player';
import { usePlayerTheme } from '@/src/components/player/player-theme-context';
import { WavyPlayButton } from '@/src/components/player/wavy-play-button';

interface PlayerControlsProps {
	readonly size?: 'sm' | 'md' | 'lg';
}

const ICON_SIZES = {
	sm: { secondary: 24 },
	md: { secondary: 28 },
	lg: { secondary: 32 },
} as const;

export function PlayerControls({ size = 'md' }: PlayerControlsProps) {
	const {
		isPlaying,
		isLoading,
		repeatMode,
		isShuffled,
		togglePlayPause,
		skipToPrevious,
		skipToNext,
		cycleRepeatMode,
		toggleShuffle,
	} = usePlayer();
	const { colors } = usePlayerTheme();

	const { secondary: secondaryIconSize } = ICON_SIZES[size];

	const surfaceColor = colors.onSurface;

	const shuffleIcon = useCallback(
		() => (
			<Shuffle size={secondaryIconSize} color={isShuffled ? colors.primary : surfaceColor} />
		),
		[secondaryIconSize, surfaceColor, isShuffled, colors.primary]
	);

	const skipBackIcon = useCallback(
		() => <SkipBack size={secondaryIconSize} color={surfaceColor} fill={surfaceColor} />,
		[secondaryIconSize, surfaceColor]
	);

	const skipForwardIcon = useCallback(
		() => <SkipForward size={secondaryIconSize} color={surfaceColor} fill={surfaceColor} />,
		[secondaryIconSize, surfaceColor]
	);

	const repeatIcon = useCallback(
		() =>
			repeatMode === 'one' ? (
				<Repeat1 size={secondaryIconSize} color={colors.primary} />
			) : (
				<Repeat
					size={secondaryIconSize}
					color={repeatMode !== 'off' ? colors.primary : surfaceColor}
				/>
			),
		[repeatMode, secondaryIconSize, surfaceColor, colors.primary]
	);

	const shuffleButtonStyle = useMemo(
		() => [styles.controlButton, { opacity: isShuffled ? 1 : 0.6 }],
		[isShuffled]
	);

	const repeatButtonStyle = useMemo(
		() => [styles.controlButton, { opacity: repeatMode !== 'off' ? 1 : 0.6 }],
		[repeatMode]
	);

	return (
		<View style={styles.container}>
			{/* Shuffle */}
			<View style={styles.controlSlot}>
				<IconButton
					icon={shuffleIcon}
					size={secondaryIconSize}
					onPress={toggleShuffle}
					style={shuffleButtonStyle}
				/>
			</View>

			{/* Previous */}
			<View style={styles.controlSlot}>
				<IconButton
					icon={skipBackIcon}
					size={secondaryIconSize}
					onPress={skipToPrevious}
					style={styles.controlButton}
				/>
			</View>

			{/* Play/Pause */}
			<View style={styles.centerSlot}>
				<WavyPlayButton
					isLoading={isLoading}
					isPlaying={isPlaying}
					onPress={togglePlayPause}
					color={colors.primary}
					iconColor={colors.onPrimary}
					size={size}
				/>
			</View>

			{/* Next */}
			<View style={styles.controlSlot}>
				<IconButton
					icon={skipForwardIcon}
					size={secondaryIconSize}
					onPress={skipToNext}
					style={styles.controlButton}
				/>
			</View>

			{/* Repeat */}
			<View style={styles.controlSlot}>
				<IconButton
					icon={repeatIcon}
					size={secondaryIconSize}
					onPress={cycleRepeatMode}
					style={repeatButtonStyle}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
	},
	controlSlot: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	centerSlot: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 4,
	},
	controlButton: {
		margin: 0,
	},
});
