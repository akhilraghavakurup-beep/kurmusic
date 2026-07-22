/**
 * SplashNative
 *
 * Native-specific rendering of the animated splash screen.
 * Uses Reanimated for smooth animations on the native UI thread.
 */

import { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { AnimatedPolygonView } from '../animated-polygon';
import { POLYGON_SIZE, ICON_SIZE } from './types';
import { styles } from './styles';

interface SplashNativeProps {
	readonly progressMessage: string;
	readonly segments: number;
	readonly colors: {
		readonly background: string;
		readonly onSurface: string;
		readonly surfaceVariant: string;
		readonly onSurfaceVariant: string;
	};
	readonly containerStyle: AnimatedStyle<ViewStyle>;
	readonly backgroundStyle: AnimatedStyle<ViewStyle>;
	readonly polygonContainerStyle: AnimatedStyle<ViewStyle>;
	readonly progressFillStyle: AnimatedStyle<ViewStyle>;
	readonly progressSectionStyle: AnimatedStyle<ViewStyle>;
}

export function SplashNative({
	progressMessage,
	segments,
	colors,
	containerStyle,
	backgroundStyle,
	polygonContainerStyle,
	progressFillStyle,
	progressSectionStyle,
}: SplashNativeProps) {
	const logoScale = useSharedValue(1);
	const logoGlow = useSharedValue(0.75);

	useEffect(() => {
		logoScale.value = withRepeat(
			withSequence(
				withTiming(1.06, { duration: 1200 }),
				withTiming(1, { duration: 1200 })
			),
			-1,
			true
		);
		logoGlow.value = withRepeat(
			withSequence(
				withTiming(1, { duration: 1200 }),
				withTiming(0.75, { duration: 1200 })
			),
			-1,
			true
		);
	}, [logoGlow, logoScale]);

	const logoStyle = useAnimatedStyle(() => ({
		transform: [{ scale: logoScale.value }],
		opacity: logoGlow.value,
	}));

	return (
		<Animated.View style={[styles.container, containerStyle]}>
			<Animated.View
				style={[styles.background, { backgroundColor: colors.background }, backgroundStyle]}
			/>
			<View style={styles.content}>
				<Animated.View style={[styles.iconWrapper, logoStyle]}>
					<Image
						source={require('@/assets/images/splash-icon.png')}
						style={{ width: ICON_SIZE, height: ICON_SIZE }}
						resizeMode={'contain'}
					/>
				</Animated.View>
				<Animated.View style={[styles.polygonWrapper, polygonContainerStyle]}>
					<AnimatedPolygonView
						segments={segments}
						size={POLYGON_SIZE}
						fill={colors.onSurface}
						stroke={colors.onSurface}
						strokeWidth={40}
						springConfig={{ damping: 20, stiffness: 100, mass: 0.5 }}
					/>
				</Animated.View>
			</View>
			<Animated.View style={[styles.progressSection, progressSectionStyle]}>
				<View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
					<Animated.View
						style={[
							styles.progressFill,
							{ backgroundColor: colors.onSurface },
							progressFillStyle,
						]}
					/>
				</View>
				<Text
					style={[styles.progressLabel, { color: colors.onSurfaceVariant }]}
					numberOfLines={1}
				>
					{progressMessage}
				</Text>
			</Animated.View>
		</Animated.View>
	);
}
