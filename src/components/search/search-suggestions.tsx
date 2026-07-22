import { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { ClockIcon, SparklesIcon } from 'lucide-react-native';
import { Icon } from '@/src/components/ui/icon';
import { useAppTheme } from '@/lib/theme';
import type { SearchSuggestion } from '@/src/application/state/search-store';

interface SearchSuggestionsProps {
	readonly suggestions: readonly SearchSuggestion[];
	readonly onSelect: (query: string) => void;
}

export const SearchSuggestions = memo(function SearchSuggestions({
	suggestions,
	onSelect,
}: SearchSuggestionsProps) {
	const { colors } = useAppTheme();

	if (suggestions.length === 0) return null;

	return (
		<View style={styles.container}>
			<Text variant={'titleSmall'} style={{ color: colors.onSurface, fontWeight: '600' }}>
				Suggestions
			</Text>
			<View style={styles.list}>
				{suggestions.map((item) => (
					<Chip
						key={`${item.type}:${item.query}`}
						onPress={() => onSelect(item.query)}
						icon={({ size }) => (
							<Icon
								as={item.type === 'recent' ? ClockIcon : SparklesIcon}
								size={size}
								color={colors.onSurfaceVariant}
							/>
						)}
						mode={'flat'}
					>
						{item.query}
					</Chip>
				))}
			</View>
		</View>
	);
});

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 16,
		gap: 8,
	},
	list: {
		gap: 6,
	},
});
