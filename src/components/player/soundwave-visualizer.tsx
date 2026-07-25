import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withRepeat,
	withSequence,
	withTiming,
	Easing,
} from 'react-native-reanimated';

interface SoundwaveVisualizerProps {
	isPlaying: boolean;
	barCount?: number;
	color?: string;
}

const VisualizerBar: React.FC<{ isPlaying: boolean; delay: number; color: string }> = ({
	isPlaying,
	delay,
	color,
}) => {
	const height = useSharedValue(6);

	useEffect(() => {
		if (isPlaying) {
			height.value = withRepeat(
				withSequence(
					withTiming(24, { duration: 300 + delay, easing: Easing.inOut(Easing.ease) }),
					withTiming(6, { duration: 300 + delay, easing: Easing.inOut(Easing.ease) })
				),
				-1,
				true
			);
		} else {
			height.value = withTiming(6, { duration: 200 });
		}
	}, [isPlaying, delay, height]);

	const animatedStyle = useAnimatedStyle(() => ({
		height: height.value,
	}));

	return <Animated.View style={[styles.bar, { backgroundColor: color }, animatedStyle]} />;
};

export const SoundwaveVisualizer: React.FC<SoundwaveVisualizerProps> = ({
	isPlaying,
	barCount = 9,
	color = '#A855F7',
}) => {
	const delays = [50, 150, 100, 200, 80, 120, 180, 90, 140];

	return (
		<View style={styles.container}>
			{Array.from({ length: barCount }).map((_, index) => (
				<VisualizerBar
					key={index}
					isPlaying={isPlaying}
					delay={delays[index % delays.length]}
					color={color}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'center',
		height: 28,
		gap: 4,
	},
	bar: {
		width: 3.5,
		borderRadius: 2,
	},
});
