import { StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { ActionSheet } from '@/src/components/ui/action-sheet';
import { ConfirmationDialog } from '@/src/components/ui/confirmation-dialog';
import { VersionDialog } from '@/src/components/ui/version-dialog';
import { PlayerAwareScrollView } from '@/src/components/ui/player-aware-scroll-view';
import { PageLayout } from '@/src/components/ui/page-layout';
import { Icon } from '@/src/components/ui/icon';
import { SettingsItem } from '@/src/components/settings/settings-item';
import { SettingsSection } from '@/src/components/settings/settings-section';
import { SettingsSelect } from '@/src/components/settings/settings-select';
import { AccentColorPicker } from '@/src/components/settings/accent-color-picker';
import { ProgressStylePicker } from '@/src/components/settings/progress-style-picker';
import { TabOrderSetting } from '@/src/components/settings/tab-order-setting';
import { SettingsBottomSheet } from '@/src/components/settings/settings-bottom-sheet';
import { EqualizerSheet } from '@/src/components/settings/equalizer-sheet';
import { Button, Surface, Switch, Text, TouchableRipple } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
	TrashIcon,
	InfoIcon,
	PlugIcon,
	HardDriveIcon,
	SunMoonIcon,
	LayoutGridIcon,
	SlidersHorizontalIcon,
	MusicIcon,
	WifiOffIcon,
	RotateCcwIcon,
	MonitorPlayIcon,
	PaintbrushIcon,
	TagIcon,
	FolderOpenIcon,
	LanguagesIcon,
	SparklesIcon,
	UserIcon,
	ShieldCheckIcon,
	CpuIcon,
	type LucideIcon,
} from 'lucide-react-native';
import {
	THEME_OPTIONS,
	DEFAULT_TAB_OPTIONS,
	PLAYER_BACKGROUND_OPTIONS,
	UI_STYLE_OPTIONS,
	STREAM_QUALITY_OPTIONS,
	HOME_CONTENT_PREFERENCE_OPTIONS,
} from '@/lib/settings-config';
import { useLibraryStore } from '@application/state/library-store';
import { useLibraryFilterStore } from '@application/state/library-filter-store';
import { useEqualizerStore } from '@application/state/equalizer-store';
import {
	useSettingsStore,
	DEFAULT_HOME_CONTENT_PREFERENCES,
	type HomeContentPreference,
	useHomeContentPreferences,
	useSetHomeContentPreferences,
} from '@application/state/settings-store';
import { useDownloadQueue, formatFileSize } from '@/src/hooks/use-download-queue';
import { useEqualizer } from '@/src/hooks/use-equalizer';
import { useClearDownloads } from '@/src/hooks/use-clear-downloads';
import { useFactoryReset } from '@/src/hooks/use-factory-reset';
import { useToast } from '@/src/hooks/use-toast';
import Constants from 'expo-constants';
import { permissionService } from '@/src/application/services/permission-service';
import { homeFeedService } from '@/src/application/services/home-feed-service';
import { resolveDisplayFont, useAppTheme } from '@/lib/theme';

export default function SettingsScreen() {
	const { homeLanguages } = useLocalSearchParams<{ homeLanguages?: string }>();
	const { colors } = useAppTheme();
	const homeContentPreferences = useHomeContentPreferences();
	const setHomeContentPreferences = useSetHomeContentPreferences();
	const { tracks, playlists, favorites } = useLibraryStore(
		useShallow((state) => ({
			tracks: state.tracks,
			playlists: state.playlists,
			favorites: state.favorites,
		}))
	);
	const {
		themePreference,
		setThemePreference,
		defaultTab,
		setDefaultTab,
		accentColor,
		setAccentColor,
		openPlayerOnTrackClick,
		setOpenPlayerOnTrackClick,
		showProviderLabel,
		setShowProviderLabel,
		progressBarStyle,
		setProgressBarStyle,
		playerBackground,
		setPlayerBackground,
		uiStyle,
		setUIStyle,
		preferredStreamQuality,
		setPreferredStreamQuality,
		autoplaySimilarOnQueueEnd,
		setAutoplaySimilarOnQueueEnd,
		downloadLocationMode,
		musicDownloadDirectoryName,
		customDownloadDirectoryName,
		setMusicDownloadDirectory,
		setCustomDownloadDirectory,
		resetDownloadLocation,
	} = useSettingsStore(
		useShallow((state) => ({
			themePreference: state.themePreference,
			setThemePreference: state.setThemePreference,
			defaultTab: state.defaultTab,
			setDefaultTab: state.setDefaultTab,
			accentColor: state.accentColor,
			setAccentColor: state.setAccentColor,
			openPlayerOnTrackClick: state.openPlayerOnTrackClick,
			setOpenPlayerOnTrackClick: state.setOpenPlayerOnTrackClick,
			showProviderLabel: state.showProviderLabel,
			setShowProviderLabel: state.setShowProviderLabel,
			progressBarStyle: state.progressBarStyle,
			setProgressBarStyle: state.setProgressBarStyle,
			playerBackground: state.playerBackground,
			setPlayerBackground: state.setPlayerBackground,
			uiStyle: state.uiStyle,
			setUIStyle: state.setUIStyle,
			preferredStreamQuality: state.preferredStreamQuality,
			setPreferredStreamQuality: state.setPreferredStreamQuality,
			autoplaySimilarOnQueueEnd: state.autoplaySimilarOnQueueEnd,
			setAutoplaySimilarOnQueueEnd: state.setAutoplaySimilarOnQueueEnd,
			downloadLocationMode: state.downloadLocationMode,
			musicDownloadDirectoryName: state.musicDownloadDirectoryName,
			customDownloadDirectoryName: state.customDownloadDirectoryName,
			setMusicDownloadDirectory: state.setMusicDownloadDirectory,
			setCustomDownloadDirectory: state.setCustomDownloadDirectory,
			resetDownloadLocation: state.resetDownloadLocation,
		}))
	);
	const { stats } = useDownloadQueue();
	const { isEnabled: eqEnabled, currentPreset } = useEqualizer();
	const { clearDownloads } = useClearDownloads();
	const { factoryReset } = useFactoryReset();
	const offlineMode = useLibraryFilterStore((s) => s.activeFilters.downloadedOnly);
	const toggleOfflineMode = useLibraryFilterStore((s) => s.toggleDownloadedOnly);

	const offlineModeSwitch = useMemo(
		() => <Switch value={offlineMode} onValueChange={toggleOfflineMode} />,
		[offlineMode, toggleOfflineMode]
	);
	const openPlayerSwitch = useMemo(
		() => <Switch value={openPlayerOnTrackClick} onValueChange={setOpenPlayerOnTrackClick} />,
		[openPlayerOnTrackClick, setOpenPlayerOnTrackClick]
	);
	const providerLabelSwitch = useMemo(
		() => <Switch value={showProviderLabel} onValueChange={setShowProviderLabel} />,
		[showProviderLabel, setShowProviderLabel]
	);

	const autoplaySimilarSwitch = useMemo(
		() => (
			<Switch
				value={autoplaySimilarOnQueueEnd}
				onValueChange={setAutoplaySimilarOnQueueEnd}
			/>
		),
		[autoplaySimilarOnQueueEnd, setAutoplaySimilarOnQueueEnd]
	);
	const { success } = useToast();
	const [equalizerSheetOpen, setEqualizerSheetOpen] = useState(false);
	const [clearLibraryDialogVisible, setClearLibraryDialogVisible] = useState(false);
	const [clearDownloadsDialogVisible, setClearDownloadsDialogVisible] = useState(false);
	const [versionDialogVisible, setVersionDialogVisible] = useState(false);
	const [resetSettingsDialogVisible, setResetSettingsDialogVisible] = useState(false);
	const [resetEqualizerDialogVisible, setResetEqualizerDialogVisible] = useState(false);
	const [factoryResetDialogVisible, setFactoryResetDialogVisible] = useState(false);
	const [downloadLocationSheetVisible, setDownloadLocationSheetVisible] = useState(false);
	const [homeLanguagesSheetVisible, setHomeLanguagesSheetVisible] = useState(false);
	const [draftHomeLanguages, setDraftHomeLanguages] =
		useState<HomeContentPreference[]>(homeContentPreferences);

	const homeLanguageLabel =
		homeContentPreferences.length > 0 ? homeContentPreferences.join(', ') : 'Malayalam, Tamil';

	const openEqualizerSheet = useCallback(() => {
		setEqualizerSheetOpen(true);
	}, []);

	const closeEqualizerSheet = useCallback(() => {
		setEqualizerSheetOpen(false);
	}, []);

	const handleClearLibrary = () => {
		setClearLibraryDialogVisible(true);
	};

	const confirmClearLibrary = () => {
		useLibraryStore.getState().clearLibrary();
		setClearLibraryDialogVisible(false);
		success('Library cleared', 'All tracks, playlists, and favorites have been removed');
	};

	const handleClearCache = useCallback(async () => {
		try {
			await Image.clearMemoryCache();
			await Image.clearDiskCache();
			success('Cache cleared', 'Freed up memory and disk image cache');
		} catch (_e) {
			success('Cache cleared', 'Temporary image cache cleared');
		}
	}, [success]);

	const handleClearDownloads = () => {
		setClearDownloadsDialogVisible(true);
	};

	const confirmClearDownloads = async () => {
		await clearDownloads();
		setClearDownloadsDialogVisible(false);
	};

	const handleResetSettings = () => {
		setResetSettingsDialogVisible(true);
	};

	const confirmResetSettings = async () => {
		await useSettingsStore.getState().resetAllSettings();
		setResetSettingsDialogVisible(false);
		void homeFeedService.handleLanguagePreferencesChanged(DEFAULT_HOME_CONTENT_PREFERENCES);
		success('Settings reset', 'All settings have been restored to defaults');
	};

	const handleResetEqualizer = () => {
		setResetEqualizerDialogVisible(true);
	};

	const confirmResetEqualizer = () => {
		useEqualizerStore.getState().resetEqualizer();
		setResetEqualizerDialogVisible(false);
		success('Equalizer reset', 'Equalizer has been disabled and reset to flat');
	};

	const handleFactoryReset = () => {
		setFactoryResetDialogVisible(true);
	};

	const confirmFactoryReset = async () => {
		await factoryReset();
		setFactoryResetDialogVisible(false);
	};

	const downloadLocationLabel =
		downloadLocationMode === 'music'
			? (musicDownloadDirectoryName ?? 'Music folder')
			: (customDownloadDirectoryName ?? 'Selected folder');

	const handleSelectDownloadLocation = useCallback(
		async (selection: string) => {
			setDownloadLocationSheetVisible(false);

			if (selection === 'music') {
				const result = await permissionService.requestMusicDirectoryPermission();
				if (!result.success) {
					return;
				}

				setMusicDownloadDirectory(result.data.uri, result.data.name);
				success(
					'Download location saved',
					`${result.data.name} will be used as the default download directory`
				);
				return;
			}

			if (selection === 'folder') {
				const result = await permissionService.requestDirectoryPermission();
				if (!result.success) {
					return;
				}

				setCustomDownloadDirectory(result.data.uri, result.data.name);
				success(
					'Download location saved',
					`${result.data.name} will be used as the default download directory`
				);
				return;
			}

			if (selection === 'reset') {
				resetDownloadLocation();
				success('Download location reset', 'Downloads will use the Music folder again');
			}
		},
		[resetDownloadLocation, setCustomDownloadDirectory, setMusicDownloadDirectory, success]
	);

	const downloadLocationGroups = useMemo(
		() => [
			{
				items: [
					{
						id: 'music',
						label: 'Music folder',
						icon: MusicIcon,
						checked: downloadLocationLabel.toLowerCase() === 'music folder',
					},
					{
						id: 'folder',
						label: 'Choose folder',
						icon: FolderOpenIcon,
						checked: downloadLocationLabel.toLowerCase() !== 'music folder',
					},
					{
						id: 'reset',
						label: 'Reset to Music',
						icon: RotateCcwIcon,
					},
				],
			},
		],
		[downloadLocationLabel]
	);

	const homeLanguageOptions = useMemo(() => HOME_CONTENT_PREFERENCE_OPTIONS, []);

	useEffect(() => {
		if (homeLanguagesSheetVisible) {
			setDraftHomeLanguages(homeContentPreferences);
		}
	}, [homeContentPreferences, homeLanguagesSheetVisible]);

	useEffect(() => {
		if (homeLanguages === '1') {
			setHomeLanguagesSheetVisible(true);
		}
	}, [homeLanguages]);

	const handleDraftHomeLanguageToggle = useCallback(
		(language: (typeof homeLanguageOptions)[number]['value'], enabled: boolean) => {
			setDraftHomeLanguages((current) =>
				enabled
					? Array.from(new Set([...current, language]))
					: current.filter((value) => value !== language)
			);
		},
		[]
	);

	const handleApplyHomeLanguages = useCallback(async () => {
		const normalized = await setHomeContentPreferences(draftHomeLanguages);
		setHomeLanguagesSheetVisible(false);
		void homeFeedService.handleLanguagePreferencesChanged(normalized);
		if (draftHomeLanguages.length === 0) {
			success(
				'Using default languages',
				'Malayalam and Tamil will be used for home suggestions'
			);
		} else {
			success('Home languages updated', normalized.join(', '));
		}
	}, [draftHomeLanguages, setHomeContentPreferences, success]);

	const handleResetDraftHomeLanguages = useCallback(() => {
		setDraftHomeLanguages([...DEFAULT_HOME_CONTENT_PREFERENCES]);
	}, []);

	const handleCancelHomeLanguages = useCallback(() => {
		setDraftHomeLanguages(homeContentPreferences);
		setHomeLanguagesSheetVisible(false);
	}, [homeContentPreferences]);

	const appVersion = Constants.expoConfig?.version ?? '1.0.0';

	return (
		<PageLayout
			header={{
				title: 'Settings',
				showBack: true,
			}}
		>
			<PlayerAwareScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
			>
				<Surface
					elevation={0}
					style={[
						styles.hero,
						{
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						},
					]}
				>
					<LinearGradient
						pointerEvents={'none'}
						colors={[`${colors.primary}24`, `${colors.secondary}10`, 'transparent']}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.heroGradient}
					/>
					<View style={styles.heroTop}>
						<View style={styles.heroLogoWrapper}>
							<Image
								source={require('@/assets/images/kur-logo.png')}
								style={styles.heroLogoImage}
								contentFit={'contain'}
							/>
						</View>
						<View style={styles.heroCopy}>
							<Text
								variant={'headlineSmall'}
								style={[
									styles.heroTitle,
									{
										color: colors.onSurface,
										fontFamily: resolveDisplayFont('800'),
									},
								]}
							>
								Kur Music
							</Text>
							<Text
								variant={'bodyMedium'}
								numberOfLines={2}
								style={[styles.heroSubtitle, { color: colors.onSurfaceVariant }]}
							>
								Version {appVersion} • New Road to Dreams
							</Text>
						</View>
					</View>
					<View style={styles.heroMetrics}>
						<SettingsHeroMetric label={'Tracks'} value={tracks.length.toString()} />
						<SettingsHeroMetric
							label={'Downloads'}
							value={stats.completedCount.toString()}
						/>
						<SettingsHeroMetric label={'Favorites'} value={favorites.size.toString()} />
					</View>
					<View style={styles.quickActions}>
						<SettingsQuickAction
							icon={LanguagesIcon}
							label={'Languages'}
							value={homeLanguageLabel}
							onPress={() => setHomeLanguagesSheetVisible(true)}
						/>
						<SettingsQuickAction
							icon={WifiOffIcon}
							label={'Offline'}
							value={offlineMode ? 'On' : 'Off'}
							onPress={toggleOfflineMode}
						/>
						<SettingsQuickAction
							icon={SlidersHorizontalIcon}
							label={'Equalizer'}
							value={eqEnabled ? currentPreset.name : 'Off'}
							onPress={openEqualizerSheet}
						/>
						<SettingsQuickAction
							icon={SparklesIcon}
							label={'Clear Cache'}
							value={'Clean'}
							onPress={handleClearCache}
						/>
					</View>
				</Surface>

				<SettingsSection title={'Plugins'}>
					<SettingsItem
						icon={PlugIcon}
						title={'Manage plugins'}
						subtitle={'Music sources, playback, and more'}
						onPress={() => router.push('/plugins')}
						showChevron
					/>
				</SettingsSection>

				<SettingsSection title={'Appearance'}>
					<SettingsSelect
						icon={SunMoonIcon}
						title={'Theme'}
						options={THEME_OPTIONS}
						value={themePreference}
						onValueChange={setThemePreference}
						portalName={'theme-select'}
					/>
					<AccentColorPicker value={accentColor} onValueChange={setAccentColor} />
					<SettingsSelect
						icon={LayoutGridIcon}
						title={'Default home screen'}
						options={DEFAULT_TAB_OPTIONS}
						value={defaultTab}
						onValueChange={setDefaultTab}
						portalName={'default-tab-select'}
					/>
					<SettingsSelect
						icon={PaintbrushIcon}
						title={'UI style'}
						options={UI_STYLE_OPTIONS}
						value={uiStyle}
						onValueChange={setUIStyle}
						portalName={'ui-style-select'}
					/>
					<TabOrderSetting />
					<SettingsItem
						icon={TagIcon}
						title={'Show provider label'}
						subtitle={'Display the source plugin on tracks'}
						rightElement={providerLabelSwitch}
						onPress={() => setShowProviderLabel(!showProviderLabel)}
					/>
				</SettingsSection>

				<SettingsSection title={'Player'}>
					<SettingsItem
						icon={MonitorPlayIcon}
						title={'Open player on tap'}
						subtitle={'Automatically open the player when a track is tapped'}
						rightElement={openPlayerSwitch}
						onPress={() => setOpenPlayerOnTrackClick(!openPlayerOnTrackClick)}
					/>
					<ProgressStylePicker
						value={progressBarStyle}
						onValueChange={setProgressBarStyle}
					/>
					<SettingsSelect
						icon={PaintbrushIcon}
						title={'Background'}
						options={PLAYER_BACKGROUND_OPTIONS}
						value={playerBackground}
						onValueChange={setPlayerBackground}
						portalName={'player-background-select'}
					/>
				</SettingsSection>

				<SettingsSection title={'Playback'}>
					<SettingsItem
						icon={WifiOffIcon}
						title={'Offline mode'}
						subtitle={'Show only downloaded songs'}
						rightElement={offlineModeSwitch}
						onPress={toggleOfflineMode}
					/>
					<SettingsItem
						icon={MusicIcon}
						title={'Autoplay similar songs'}
						subtitle={'When queue ends, continue with recommended tracks'}
						rightElement={autoplaySimilarSwitch}
						onPress={() => setAutoplaySimilarOnQueueEnd(!autoplaySimilarOnQueueEnd)}
					/>
					<SettingsSelect
						icon={MusicIcon}
						title={'Stream quality'}
						options={STREAM_QUALITY_OPTIONS}
						value={preferredStreamQuality}
						onValueChange={setPreferredStreamQuality}
						portalName={'stream-quality-select'}
					/>
					<SettingsItem
						icon={SlidersHorizontalIcon}
						title={'Equalizer'}
						subtitle={eqEnabled ? `${currentPreset.name} (On)` : 'Off'}
						onPress={openEqualizerSheet}
						showChevron
					/>
				</SettingsSection>

				<SettingsSection title={'Home feed'}>
					<SettingsItem
						icon={LanguagesIcon}
						title={'Home languages'}
						subtitle={`${homeLanguageLabel} - Updates home suggestions`}
						onPress={() => setHomeLanguagesSheetVisible(true)}
						showChevron
					/>
				</SettingsSection>

				<SettingsSection title={'Storage & Maintenance'}>
					<SettingsItem
						icon={HardDriveIcon}
						title={'Default download directory'}
						subtitle={downloadLocationLabel}
						onPress={() => setDownloadLocationSheetVisible(true)}
						showChevron
					/>
					<SettingsItem
						icon={HardDriveIcon}
						title={'Storage used'}
						subtitle={`${formatFileSize(stats.totalSize)} - ${stats.completedCount} downloaded files`}
					/>
					<SettingsItem
						icon={SparklesIcon}
						title={'Clear temporary cache'}
						subtitle={'Free up image and temporary data memory'}
						onPress={handleClearCache}
						showChevron
					/>
					{stats.completedCount > 0 && (
						<SettingsItem
							icon={TrashIcon}
							title={'Clear all downloads'}
							subtitle={'Remove all downloaded audio files'}
							onPress={handleClearDownloads}
							destructive
						/>
					)}
				</SettingsSection>

				<SettingsSection title={'Library'}>
					<SettingsItem
						icon={MusicIcon}
						title={'Library settings'}
						subtitle={'Default tab and display options'}
						onPress={() => router.push('/library/settings')}
						showChevron
					/>
					<SettingsItem
						icon={InfoIcon}
						title={'Library stats'}
						subtitle={`${tracks.length} tracks - ${playlists.length} playlists - ${favorites.size} favorites`}
					/>
					<SettingsItem
						icon={TrashIcon}
						title={'Clear library'}
						subtitle={'Remove all tracks and playlists'}
						onPress={handleClearLibrary}
						destructive
					/>
				</SettingsSection>

				<SettingsSection title={'Reset'}>
					<SettingsItem
						icon={RotateCcwIcon}
						title={'Reset settings'}
						subtitle={'Reset appearance and navigation preferences'}
						onPress={handleResetSettings}
						destructive
					/>
					<SettingsItem
						icon={RotateCcwIcon}
						title={'Reset equalizer'}
						subtitle={'Reset equalizer to default'}
						onPress={handleResetEqualizer}
						destructive
					/>
					<SettingsItem
						icon={RotateCcwIcon}
						title={'Factory reset'}
						subtitle={'Clear all data and reset to defaults'}
						onPress={handleFactoryReset}
						destructive
					/>
				</SettingsSection>

				<SettingsSection title={'About Kur Music'}>
					<SettingsItem
						icon={SparklesIcon}
						title={'Kur Music'}
						subtitle={'Next-generation music experience'}
						showChevron
						onPress={() => setVersionDialogVisible(true)}
					/>
					<SettingsItem
						icon={UserIcon}
						title={'Developer'}
						subtitle={'Kurup (Lead Developer & Creator)'}
					/>
					<SettingsItem
						icon={ShieldCheckIcon}
						title={'Quality Assurance'}
						subtitle={'Nemo (Testing & QA Lead)'}
					/>
					<SettingsItem
						icon={CpuIcon}
						title={'Audio Engine'}
						subtitle={'New Road to Dreams (Engine)'}
					/>
					<SettingsItem
						icon={InfoIcon}
						title={'Version & Build Info'}
						subtitle={`v${appVersion} • Tap for details and updates`}
						onPress={() => setVersionDialogVisible(true)}
						showChevron
					/>
				</SettingsSection>
			</PlayerAwareScrollView>

			<EqualizerSheet isOpen={equalizerSheetOpen} onClose={closeEqualizerSheet} />

			<ActionSheet
				isOpen={downloadLocationSheetVisible}
				portalName={'download-location'}
				onClose={() => setDownloadLocationSheetVisible(false)}
				onSelect={handleSelectDownloadLocation}
				groups={downloadLocationGroups}
			/>

			<ConfirmationDialog
				visible={clearLibraryDialogVisible}
				title={'Clear library'}
				message={
					'This will remove all tracks, playlists, and favorites. This action cannot be undone.'
				}
				confirmLabel={'Clear'}
				cancelLabel={'Cancel'}
				destructive
				onConfirm={confirmClearLibrary}
				onCancel={() => setClearLibraryDialogVisible(false)}
			/>

			<ConfirmationDialog
				visible={clearDownloadsDialogVisible}
				title={'Clear all downloads'}
				message={'This will remove all downloaded files. This action cannot be undone.'}
				confirmLabel={'Clear All'}
				cancelLabel={'Cancel'}
				destructive
				onConfirm={confirmClearDownloads}
				onCancel={() => setClearDownloadsDialogVisible(false)}
			/>

			<ConfirmationDialog
				visible={resetSettingsDialogVisible}
				title={'Reset settings'}
				message={
					'This will reset all appearance and navigation preferences to their defaults.'
				}
				confirmLabel={'Reset'}
				cancelLabel={'Cancel'}
				destructive
				onConfirm={confirmResetSettings}
				onCancel={() => setResetSettingsDialogVisible(false)}
			/>

			<ConfirmationDialog
				visible={resetEqualizerDialogVisible}
				title={'Reset equalizer'}
				message={'This will disable the equalizer and reset all bands to flat.'}
				confirmLabel={'Reset'}
				cancelLabel={'Cancel'}
				destructive
				onConfirm={confirmResetEqualizer}
				onCancel={() => setResetEqualizerDialogVisible(false)}
			/>

			<ConfirmationDialog
				visible={factoryResetDialogVisible}
				title={'Factory reset'}
				message={
					'This will clear all your data including library, downloads, settings, and equalizer. This action cannot be undone.'
				}
				confirmLabel={'Reset Everything'}
				cancelLabel={'Cancel'}
				destructive
				onConfirm={confirmFactoryReset}
				onCancel={() => setFactoryResetDialogVisible(false)}
			/>

			<VersionDialog
				visible={versionDialogVisible}
				onDismiss={() => setVersionDialogVisible(false)}
			/>

			<SettingsBottomSheet
				isOpen={homeLanguagesSheetVisible}
				onClose={handleCancelHomeLanguages}
				portalName={'home-languages'}
				title={'Home languages'}
				showReset
				onReset={handleResetDraftHomeLanguages}
			>
				{homeLanguageOptions.map((option) => {
					const isEnabled = draftHomeLanguages.includes(option.value);

					return (
						<SettingsItem
							key={option.value}
							icon={option.icon}
							title={option.label}
							subtitle={'Used for home suggestions'}
							rightElement={
								<Switch
									value={isEnabled}
									onValueChange={(enabled) =>
										handleDraftHomeLanguageToggle(option.value, enabled)
									}
								/>
							}
							onPress={() => handleDraftHomeLanguageToggle(option.value, !isEnabled)}
						/>
					);
				})}
				<View style={styles.homeLanguageActions}>
					<Button mode={'text'} onPress={handleCancelHomeLanguages}>
						Cancel
					</Button>
					<Button mode={'contained'} onPress={handleApplyHomeLanguages}>
						Apply
					</Button>
				</View>
			</SettingsBottomSheet>
		</PageLayout>
	);
}

function SettingsHeroMetric({ label, value }: { readonly label: string; readonly value: string }) {
	const { colors } = useAppTheme();

	return (
		<View style={styles.heroMetric}>
			<Text
				variant={'titleMedium'}
				numberOfLines={1}
				style={[
					styles.heroMetricValue,
					{ color: colors.onSurface, fontFamily: resolveDisplayFont('700') },
				]}
			>
				{value}
			</Text>
			<Text
				variant={'labelSmall'}
				numberOfLines={1}
				style={[styles.heroMetricLabel, { color: colors.onSurfaceVariant }]}
			>
				{label}
			</Text>
		</View>
	);
}

function SettingsQuickAction({
	icon,
	label,
	value,
	onPress,
}: {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly value: string;
	readonly onPress: () => void;
}) {
	const { colors } = useAppTheme();

	return (
		<TouchableRipple
			onPress={onPress}
			borderless
			style={[
				styles.quickAction,
				{
					backgroundColor: colors.surfaceContainerHighest,
					borderColor: colors.outlineVariant,
				},
			]}
		>
			<View style={styles.quickActionInner}>
				<View style={[styles.quickActionIcon, { backgroundColor: `${colors.primary}18` }]}>
					<Icon as={icon} size={18} color={colors.primary} />
				</View>
				<View style={styles.quickActionCopy}>
					<Text
						variant={'labelMedium'}
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.8}
						style={[styles.quickActionLabel, { color: colors.onSurface }]}
					>
						{label}
					</Text>
					<Text
						variant={'labelSmall'}
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.75}
						style={{ color: colors.onSurfaceVariant }}
					>
						{value}
					</Text>
				</View>
			</View>
		</TouchableRipple>
	);
}

const styles = StyleSheet.create({
	scrollView: {
		flex: 1,
		paddingHorizontal: 8,
	},
	scrollContent: {
		paddingTop: 4,
		paddingBottom: 32,
	},
	hero: {
		borderRadius: 22,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
		padding: 18,
		gap: 16,
	},
	heroGradient: {
		position: 'absolute',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
	},
	heroTop: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
	},
	heroLogoWrapper: {
		width: 58,
		height: 58,
		borderRadius: 18,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	heroLogoImage: {
		width: 58,
		height: 58,
		borderRadius: 18,
	},
	heroCopy: {
		flex: 1,
		minWidth: 0,
	},
	heroTitle: {
		letterSpacing: 0,
	},
	heroSubtitle: {
		marginTop: 2,
	},
	heroMetrics: {
		flexDirection: 'row',
		gap: 10,
	},
	heroMetric: {
		flex: 1,
		minWidth: 0,
	},
	heroMetricValue: {
		letterSpacing: 0,
	},
	heroMetricLabel: {
		marginTop: 2,
		letterSpacing: 0,
	},
	quickActions: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	quickAction: {
		width: '48%',
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
	},
	quickActionInner: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 10,
		gap: 10,
	},
	quickActionIcon: {
		width: 34,
		height: 34,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	quickActionCopy: {
		flex: 1,
		minWidth: 0,
	},
	quickActionLabel: {
		fontWeight: '700',
		letterSpacing: 0,
	},
	homeLanguageActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		gap: 8,
		marginTop: 16,
	},
});
