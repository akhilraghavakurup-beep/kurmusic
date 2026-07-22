/**
 * SettingsSection Component
 *
 * A container for grouping related settings items.
 * Uses M3 theming with Surface background.
 */

import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { resolveDisplayFont, useAppTheme } from '@/lib/theme';

interface SettingsSectionProps {
	readonly title: string;
	readonly children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
	const { colors } = useAppTheme();

	return (
		<View style={styles.container}>
			<Text variant={'titleSmall'} style={[styles.title, { color: colors.onSurfaceVariant }]}>
				{title}
			</Text>
			<Surface
				elevation={0}
				style={[
					styles.content,
					{
						backgroundColor: colors.surfaceContainerLow,
						borderColor: colors.outlineVariant,
					},
				]}
			>
				{children}
			</Surface>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginTop: 22,
	},
	title: {
		paddingHorizontal: 16,
		marginBottom: 10,
		letterSpacing: 0,
		fontFamily: resolveDisplayFont('700'),
	},
	content: {
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
	},
});
