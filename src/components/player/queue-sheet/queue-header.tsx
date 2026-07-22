/**
 * QueueHeader Component
 *
 * Header row for the queue sheet with title and clear action.
 */

import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '@/lib/theme';
import type { QueueHeaderProps } from './types';

export function QueueHeader({ trackCount, totalDurationFormatted, onClear }: QueueHeaderProps) {
	const { colors } = useAppTheme();

	return (
		<View style={styles.container}>
			<View style={styles.titleRow}>
				<Text
					variant={'titleMedium'}
					style={{ color: colors.onSurface, fontWeight: '700' }}
				>
					Queue
				</Text>
				{trackCount > 0 && (
					<Text variant={'labelMedium'} style={{ color: colors.onSurfaceVariant }}>
						{trackCount} {trackCount === 1 ? 'song' : 'songs'}{' '}
						{totalDurationFormatted ? `• ${totalDurationFormatted}` : ''}
					</Text>
				)}
			</View>
			{trackCount > 0 && (
				<TouchableOpacity onPress={onClear} hitSlop={8}>
					<Text variant={'labelLarge'} style={{ color: colors.error, fontWeight: '600' }}>
						Clear Queue
					</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 16,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: 10,
	},
});
