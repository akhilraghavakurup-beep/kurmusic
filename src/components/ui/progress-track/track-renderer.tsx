/**
 * Track Renderer
 *
 * Renders the SVG track visuals for each ProgressTrack variant style.
 */

import Svg, { Path, Line, Circle } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { ProgressBarStyle } from '@/src/application/state/settings-store';
import type { TrackRenderParams } from './types';
import {
	ACTIVE_THICKNESS,
	TRACK_THICKNESS,
	TRACK_HEIGHT,
	STOP_RADIUS,
	BASIC_TRACK_HEIGHT,
	BASIC_TRACK_THICKNESS,
	VARIANT_TRACK_HEIGHT,
	VARIANT_TRACK_RADIUS,
	VARIANT_THUMB_GAP,
	VARIANT_INSIDE_CORNER,
} from './types';
import { buildVariantActiveTrackPath, buildVariantInactiveTrackPath } from './utils';
import { styles } from './styles';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function renderTrack(style: ProgressBarStyle, params: TrackRenderParams) {
	if (style === 'basic') {
		return renderBasicTrack(params);
	}

	if (style === 'waveform') {
		return renderWaveformTrack(params);
	}

	if (style === 'beats') {
		return renderBeatsTrack(params);
	}

	if (style === 'glow-line') {
		return renderGlowLineTrack(params);
	}

	if (style === 'pulse-dots') {
		return renderPulseDotsTrack(params);
	}

	if (style === 'expressive-variant') {
		return renderVariantTrack(params);
	}

	return renderExpressiveTrack(params);
}

function renderBasicTrack(params: TrackRenderParams) {
	const { trackWidth, activeEnd, colors } = params;
	const basicCy = BASIC_TRACK_HEIGHT / 2;

	return (
		<Svg width={trackWidth} height={BASIC_TRACK_HEIGHT} style={styles.basicTrackSvg}>
			<Line
				x1={0}
				y1={basicCy}
				x2={trackWidth}
				y2={basicCy}
				stroke={colors.primaryContainer}
				strokeWidth={BASIC_TRACK_THICKNESS}
				strokeLinecap={'round'}
			/>
			{activeEnd > 0 && (
				<Line
					x1={0}
					y1={basicCy}
					x2={activeEnd}
					y2={basicCy}
					stroke={colors.primary}
					strokeWidth={BASIC_TRACK_THICKNESS}
					strokeLinecap={'round'}
				/>
			)}
		</Svg>
	);
}

function renderVariantTrack(params: TrackRenderParams) {
	const { trackWidth, activeEnd, stopCx, colors } = params;
	const vcy = VARIANT_TRACK_HEIGHT / 2;
	const inactiveColor = colors.surfaceContainerHighest ?? colors.primaryContainer;
	const inactivePath = buildVariantInactiveTrackPath(
		activeEnd,
		trackWidth,
		VARIANT_TRACK_HEIGHT,
		VARIANT_TRACK_RADIUS,
		VARIANT_THUMB_GAP,
		VARIANT_INSIDE_CORNER
	);

	return (
		<Svg width={trackWidth} height={VARIANT_TRACK_HEIGHT} style={styles.variantTrackSvg}>
			{inactivePath.length > 0 && <Path d={inactivePath} fill={inactiveColor} />}
			{activeEnd > 0 && (
				<Path
					d={buildVariantActiveTrackPath(
						activeEnd,
						VARIANT_TRACK_HEIGHT,
						VARIANT_TRACK_RADIUS,
						VARIANT_THUMB_GAP,
						VARIANT_INSIDE_CORNER
					)}
					fill={colors.primary}
				/>
			)}
			<Circle cx={stopCx} cy={vcy} r={STOP_RADIUS} fill={colors.primary} />
		</Svg>
	);
}

function renderExpressiveTrack(params: TrackRenderParams) {
	const {
		trackWidth,
		activeWidth,
		cy,
		inactiveStart,
		inactiveEnd,
		stopCx,
		colors,
		waveAnimatedProps,
	} = params;

	return (
		<Svg width={trackWidth} height={TRACK_HEIGHT} style={styles.trackSvg}>
			{inactiveStart < inactiveEnd && (
				<Line
					x1={inactiveStart}
					y1={cy}
					x2={inactiveEnd}
					y2={cy}
					stroke={colors.primaryContainer}
					strokeWidth={TRACK_THICKNESS}
					strokeLinecap={'round'}
				/>
			)}
			<Circle cx={stopCx} cy={cy} r={STOP_RADIUS} fill={colors.primary} />
			{activeWidth > ACTIVE_THICKNESS && (
				<AnimatedPath
					animatedProps={waveAnimatedProps}
					stroke={colors.primary}
					strokeWidth={ACTIVE_THICKNESS}
					strokeLinecap={'round'}
					fill={'none'}
				/>
			)}
		</Svg>
	);
}

function renderWaveformTrack(params: TrackRenderParams) {
	const { trackWidth, activeEnd, colors, seedString } = params;
	const barWidth = 3;
	const gap = 2;
	const count = Math.max(1, Math.floor(trackWidth / (barWidth + gap)));
	const maxBarHeight = 28;
	const minBarHeight = 4;
	const centerY = 16;

	// Helper to generate a consistent, unique bar height seeded by track information
	const getBarHeight = (idx: number) => {
		if (!seedString) {
			const staticHeights = [8, 14, 10, 18, 12, 16, 9, 15, 11, 17, 8, 13];
			return staticHeights[idx % staticHeights.length];
		}

		let hash = 0;
		const str = seedString + String(idx);
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash |= 0;
		}
		const absHash = Math.abs(hash);
		return minBarHeight + (absHash % (maxBarHeight - minBarHeight + 1));
	};

	return (
		<Svg
			width={trackWidth}
			height={32}
			style={{
				position: 'absolute',
				top: 12, // perfectly centered in the 56px container
				left: 0,
			}}
		>
			{Array.from({ length: count }, (_, index) => {
				const x = index * (barWidth + gap);
				const height = getBarHeight(index);
				const y1 = centerY - height / 2;
				const y2 = centerY + height / 2;
				const isActive = x + barWidth <= activeEnd;

				return (
					<Line
						key={`waveform-${index}`}
						x1={x + barWidth / 2}
						y1={y1}
						x2={x + barWidth / 2}
						y2={y2}
						stroke={isActive ? colors.primary : `${colors.onSurfaceVariant}26`}
						strokeWidth={barWidth}
						strokeLinecap={'round'}
					/>
				);
			})}
		</Svg>
	);
}

function renderBeatsTrack(params: TrackRenderParams) {
	const { trackWidth, activeEnd, colors } = params;
	const beatWidth = 6;
	const gap = 6;
	const count = Math.max(1, Math.floor(trackWidth / (beatWidth + gap)));
	const y = 4;
	const height = 8;

	return (
		<Svg width={trackWidth} height={16} style={styles.basicTrackSvg}>
			{Array.from({ length: count }, (_, index) => {
				const x = index * (beatWidth + gap);
				const isActive = x + beatWidth <= activeEnd;
				return (
					<Line
						key={`beat-${index}`}
						x1={x + beatWidth / 2}
						y1={y}
						x2={x + beatWidth / 2}
						y2={y + height}
						stroke={isActive ? colors.primary : colors.primaryContainer}
						strokeWidth={beatWidth}
						strokeLinecap={'round'}
					/>
				);
			})}
		</Svg>
	);
}

function renderGlowLineTrack(params: TrackRenderParams) {
	const { trackWidth, activeEnd, colors } = params;
	const cy = BASIC_TRACK_HEIGHT / 2;

	return (
		<Svg width={trackWidth} height={BASIC_TRACK_HEIGHT} style={styles.basicTrackSvg}>
			<Line
				x1={0}
				y1={cy}
				x2={trackWidth}
				y2={cy}
				stroke={colors.primaryContainer}
				strokeWidth={BASIC_TRACK_THICKNESS}
				strokeLinecap={'round'}
			/>
			{activeEnd > 0 && (
				<>
					<Line
						x1={0}
						y1={cy}
						x2={activeEnd}
						y2={cy}
						stroke={colors.primary}
						strokeOpacity={0.28}
						strokeWidth={BASIC_TRACK_THICKNESS + 6}
						strokeLinecap={'round'}
					/>
					<Line
						x1={0}
						y1={cy}
						x2={activeEnd}
						y2={cy}
						stroke={colors.primary}
						strokeWidth={BASIC_TRACK_THICKNESS}
						strokeLinecap={'round'}
					/>
					<Circle cx={activeEnd} cy={cy} r={5} fill={colors.primary} />
				</>
			)}
		</Svg>
	);
}

function renderPulseDotsTrack(params: TrackRenderParams) {
	const { trackWidth, activeEnd, colors } = params;
	const dotRadius = 2.4;
	const gap = 7;
	const diameter = dotRadius * 2;
	const count = Math.max(1, Math.floor((trackWidth + gap) / (diameter + gap)));
	const cy = BASIC_TRACK_HEIGHT / 2;

	return (
		<Svg width={trackWidth} height={BASIC_TRACK_HEIGHT} style={styles.basicTrackSvg}>
			{Array.from({ length: count }, (_, index) => {
				const x = index * (diameter + gap) + dotRadius;
				const isActive = x <= activeEnd;

				return (
					<Circle
						key={`pulse-dot-${index}`}
						cx={x}
						cy={cy}
						r={dotRadius}
						fill={isActive ? colors.primary : colors.primaryContainer}
					/>
				);
			})}
			{activeEnd > 0 && (
				<>
					<Circle cx={activeEnd} cy={cy} r={6} fill={colors.primary} fillOpacity={0.24} />
					<Circle cx={activeEnd} cy={cy} r={3.5} fill={colors.primary} />
				</>
			)}
		</Svg>
	);
}