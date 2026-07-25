import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Freeze } from 'react-freeze';
import { TabsProvider, Tabs, TabScreen } from 'react-native-paper-tabs';
import { PageLayout } from '@/src/components/ui/page-layout';
import { useState, useEffect, useRef } from 'react';
import { usePlaylists, useIsLibraryLoading } from '@/src/application/state/library-store';
import { useDefaultLibraryTab, useSettingsStore } from '@/src/application/state/settings-store';
import { useAggregatedArtists, useAggregatedAlbums } from '@/src/hooks/use-aggregated-library';
import {
	SongsTab,
	PlaylistList,
	ArtistList,
	AlbumList,
	LibrarySortFilterSheet,
} from '@/src/components/library';
import { KurRewindModal } from '@/src/components/library/kur-rewind-modal';
import { SortFilterFAB } from '@/src/components/sort-filter';
import { useLibraryFilter } from '@/src/hooks/use-library-filter';
import { useTabShadow } from '@/src/hooks/use-tab-shadow';
import { useAppTheme } from '@/lib/theme';
import { TAB_INDEX_MAP } from '@/lib/settings-config';

export default function HomeScreen() {
	const { colors } = useAppTheme();
	const defaultLibraryTab = useDefaultLibraryTab();
	const [tabIndex, setTabIndex] = useState(TAB_INDEX_MAP[defaultLibraryTab]);
	const [isRewindOpen, setIsRewindOpen] = useState(false);
	const hasAppliedDefaultRef = useRef(false);

	useEffect(() => {
		if (hasAppliedDefaultRef.current) return;

		if (useSettingsStore.persist.hasHydrated()) {
			hasAppliedDefaultRef.current = true;
			setTabIndex(TAB_INDEX_MAP[useSettingsStore.getState().defaultLibraryTab]);
			return;
		}

		const unsubscribe = useSettingsStore.persist.onFinishHydration(() => {
			hasAppliedDefaultRef.current = true;
			const storedTab = useSettingsStore.getState().defaultLibraryTab;
			setTabIndex(TAB_INDEX_MAP[storedTab]);
		});

		return unsubscribe;
	}, []);

	const playlists = usePlaylists();
	const artists = useAggregatedArtists();
	const albums = useAggregatedAlbums();
	const isLoading = useIsLibraryLoading();

	const {
		tracks: filteredTracks,
		hasFilters,
		filterCount,
		isFilterSheetOpen,
		openFilterSheet,
		closeFilterSheet,
	} = useLibraryFilter();

	const { handleScroll, shadowStyle } = useTabShadow({ tabIndex });

	return (
		<PageLayout edges={[]}>
			<View style={styles.content}>
				<TabsProvider defaultIndex={tabIndex} onChangeIndex={setTabIndex}>
					<Tabs
						uppercase={false}
						mode={'scrollable'}
						showLeadingSpace={false}
						style={{ backgroundColor: colors.surface, ...shadowStyle }}
					>
						<TabScreen label={'Songs'} icon={'music-note'}>
							<Freeze freeze={tabIndex !== 0}>
								<View style={styles.tabContent}>
									<SongsTab
										tracks={filteredTracks}
										isLoading={isLoading}
										hasFilters={hasFilters}
										onScroll={handleScroll}
									/>
								</View>
							</Freeze>
						</TabScreen>
						<TabScreen label={'Playlists'} icon={'playlist-music'}>
							<Freeze freeze={tabIndex !== 1}>
								<View style={styles.tabContent}>
									<PlaylistList
										playlists={playlists}
										isLoading={isLoading}
										onScroll={handleScroll}
									/>
								</View>
							</Freeze>
						</TabScreen>
						<TabScreen label={'Artists'} icon={'account-music'}>
							<Freeze freeze={tabIndex !== 2}>
								<View style={styles.tabContent}>
									<ArtistList
										artists={artists}
										isLoading={isLoading}
										onScroll={handleScroll}
									/>
								</View>
							</Freeze>
						</TabScreen>
						<TabScreen label={'Albums'} icon={'album'}>
							<Freeze freeze={tabIndex !== 3}>
								<View style={styles.tabContent}>
									<AlbumList
										albums={albums}
										isLoading={isLoading}
										onScroll={handleScroll}
									/>
								</View>
							</Freeze>
						</TabScreen>
					</Tabs>
				</TabsProvider>
			</View>

			{tabIndex === 0 && (
				<View style={styles.fabRow}>
					<TouchableOpacity style={styles.rewindFab} onPress={() => setIsRewindOpen(true)}>
						<Ionicons name={'sparkles'} size={20} color={'#FFFFFF'} />
						<Text style={styles.rewindFabText}>Rewind</Text>
					</TouchableOpacity>
					<SortFilterFAB filterCount={filterCount} onPress={openFilterSheet} />
				</View>
			)}

			<KurRewindModal visible={isRewindOpen} onClose={() => setIsRewindOpen(false)} />
			<LibrarySortFilterSheet isOpen={isFilterSheetOpen} onClose={closeFilterSheet} />
		</PageLayout>
	);
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
	},
	tabContent: {
		flex: 1,
		paddingHorizontal: 16,
	},
	fabRow: {
		position: 'absolute',
		bottom: 16,
		right: 16,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	rewindFab: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#8A2BE2',
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 24,
		gap: 6,
		elevation: 4,
		shadowColor: '#8A2BE2',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
	},
	rewindFabText: {
		fontSize: 14,
		fontWeight: '700',
		color: '#FFFFFF',
	},
});
