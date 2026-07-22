import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/src/components/ui/skeleton';

export function FeedSectionSkeleton() {
	return (
		<View style={styles.sectionCard}>
			<View style={styles.header}>
				<View style={styles.headerRow}>
					<Skeleton width={'45%'} height={18} rounded={'sm'} />
					<Skeleton width={56} height={22} rounded={'full'} />
				</View>
				<Skeleton width={'55%'} height={12} rounded={'sm'} />
			</View>
			<View style={styles.cards}>
				{Array.from({ length: 4 }).map((_, index) => (
					<View key={index} style={styles.card}>
						<Skeleton width={128} height={128} rounded={'lg'} />
						<Skeleton width={100} height={14} rounded={'sm'} />
						<Skeleton width={72} height={14} rounded={'sm'} />
					</View>
				))}
			</View>
		</View>
	);
}

export function HomeFeedSkeleton() {
	return (
		<View style={styles.container}>
			<View style={styles.heroCard}>
				<View style={styles.heroTopRow}>
					<Skeleton width={72} height={72} rounded={'2xl'} />
					<View style={styles.heroCopy}>
						<Skeleton width={'68%'} height={22} rounded={'sm'} />
						<Skeleton width={'88%'} height={14} rounded={'sm'} />
						<Skeleton width={'78%'} height={14} rounded={'sm'} />
					</View>
				</View>
				<View style={styles.badgeRow}>
					<Skeleton width={86} height={30} rounded={'full'} />
					<Skeleton width={80} height={30} rounded={'full'} />
					<Skeleton width={96} height={30} rounded={'full'} />
				</View>
			</View>
			<View style={styles.chipRow}>
				{Array.from({ length: 4 }).map((_, index) => (
					<Skeleton key={index} width={80} height={32} rounded={'md'} />
				))}
			</View>
			{Array.from({ length: 4 }).map((_, index) => (
				<FeedSectionSkeleton key={index} />
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		gap: 18,
		paddingTop: 10,
		paddingBottom: 12,
	},
	heroCard: {
		marginHorizontal: 12,
		gap: 16,
		padding: 16,
		borderRadius: 28,
	},
	heroTopRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
	},
	heroCopy: {
		flex: 1,
		gap: 8,
	},
	badgeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	chipRow: {
		flexDirection: 'row',
		paddingHorizontal: 16,
		gap: 8,
	},
	sectionCard: {
		gap: 12,
		marginHorizontal: 12,
		paddingVertical: 14,
		borderRadius: 28,
	},
	header: {
		paddingHorizontal: 16,
		gap: 8,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	cards: {
		flexDirection: 'row',
		paddingHorizontal: 16,
		gap: 12,
	},
	card: {
		gap: 8,
	},
});
