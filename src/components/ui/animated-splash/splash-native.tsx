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
import { POLYGON_SIZE } from './types';
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
	const logoGlow = useSharedValue(0.85);

	const ringScale = useSharedValue(0.9);
	const ringOpacity = useSharedValue(0.5);

	// Equalizer bar shared values for 5 pulsing soundwave bars
	const bar1 = useSharedValue(12);
	const bar2 = useSharedValue(24);
	const bar3 = useSharedValue(36);
	const bar4 = useSharedValue(20);
	const bar5 = useSharedValue(14);

	useEffect(() => {
		logoScale.value = withRepeat(
			withSequence(withTiming(1.05, { duration: 1000 }), withTiming(1, { duration: 1000 })),
			-1,
			true
		);
		logoGlow.value = withRepeat(
			withSequence(withTiming(1, { duration: 1000 }), withTiming(0.85, { duration: 1000 })),
			-1,
			true
		);

		ringScale.value = withRepeat(
			withSequence(withTiming(1.35, { duration: 1400 }), withTiming(0.9, { duration: 1400 })),
			-1,
			true
		);
		ringOpacity.value = withRepeat(
			withSequence(withTiming(0.15, { duration: 1400 }), withTiming(0.5, { duration: 1400 })),
			-1,
			true
		);

		bar1.value = withRepeat(withSequence(withTiming(32, { duration: 400 }), withTiming(8, { duration: 400 })), -1, true);
		bar2.value = withRepeat(withSequence(withTiming(14, { duration: 550 }), withTiming(38, { duration: 550 })), -1, true);
		bar3.value = withRepeat(withSequence(withTiming(42, { duration: 350 }), withTiming(12, { duration: 350 })), -1, true);
		bar4.value = withRepeat(withSequence(withTiming(10, { duration: 480 }), withTiming(34, { duration: 480 })), -1, true);
		bar5.value = withRepeat(withSequence(withTiming(28, { duration: 380 }), withTiming(6, { duration: 380 })), -1, true);
	}, [bar1, bar2, bar3, bar4, bar5, logoGlow, logoScale, ringOpacity, ringScale]);

	const logoStyle = useAnimatedStyle(() => ({
		transform: [{ scale: logoScale.value }],
		opacity: logoGlow.value,
	}));

	const ringStyle = useAnimatedStyle(() => ({
		transform: [{ scale: ringScale.value }],
		opacity: ringOpacity.value,
	}));

	const bar1Style = useAnimatedStyle(() => ({ height: bar1.value }));
	const bar2Style = useAnimatedStyle(() => ({ height: bar2.value }));
	const bar3Style = useAnimatedStyle(() => ({ height: bar3.value }));
	const bar4Style = useAnimatedStyle(() => ({ height: bar4.value }));
	const bar5Style = useAnimatedStyle(() => ({ height: bar5.value }));

	return (
		<Animated.View style={[styles.container, containerStyle]}>
			<Animated.View
				style={[styles.background, { backgroundColor: colors.background }, backgroundStyle]}
			/>
			<View style={styles.content}>
				{/* Expanding Glowing Neon Aura Ring */}
				<Animated.View
					style={[
						{
							position: 'absolute',
							width: 170,
							height: 170,
							borderRadius: 85,
							backgroundColor: '#7C3AED',
							filter: 'blur(30px)',
						},
						ringStyle,
					]}
				/>

				<Animated.View style={[styles.iconWrapper, logoStyle]}>
					<Image
						source={require('@/assets/images/kur-logo.png')}
						style={{ width: 140, height: 140 }}
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
				{/* Pulsing Soundwave Equalizer Bars */}
				<View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginBottom: 14, height: 44 }}>
					<Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: '#7C3AED' }, bar1Style]} />
					<Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: '#A855F7' }, bar2Style]} />
					<Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: '#06B6D4' }, bar3Style]} />
					<Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: '#10B981' }, bar4Style]} />
					<Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: '#7C3AED' }, bar5Style]} />
				</View>

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
