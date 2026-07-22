/**
 * AutoUpdateDialog Component
 *
 * Automatic startup update popup displaying release changelog notes,
 * download progress bar, and options for Update Now, Later, and Skip Version.
 */

import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Dialog, Portal, Text, Button, Divider, ProgressBar } from 'react-native-paper';
import { useState, useEffect, useCallback } from 'react';
import Constants from 'expo-constants';
import { useAppTheme, M3Shapes } from '@/lib/theme';
import { Icon } from '@/src/components/ui/icon';
import {
	PackageIcon,
	DownloadIcon,
	CheckCircle2Icon,
	AlertCircleIcon,
	SparklesIcon,
} from 'lucide-react-native';
import {
	checkForUpdates,
	downloadUpdateApk,
	triggerUpdateInstall,
	type UpdateInfo,
} from '@/src/application/services/update-service';
import { useSettingsStore } from '@/src/application/state/settings-store';

export function AutoUpdateDialog() {
	const { colors } = useAppTheme();
	const currentVersion = Constants.expoConfig?.version ?? '1.1.0';

	const [visible, setVisible] = useState(false);
	const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
	const [updateState, setUpdateState] = useState<
		'idle' | 'downloading' | 'ready' | 'error'
	>('idle');
	const [downloadProgress, setDownloadProgress] = useState(0);
	const [localApkUri, setLocalApkUri] = useState('');

	useEffect(() => {
		let isMounted = true;

		// Perform background update check 1.5 seconds after app startup
		const timer = setTimeout(async () => {
			try {
				const info = await checkForUpdates();
				if (!isMounted) return;

				if (info.hasUpdate) {
					setUpdateInfo(info);
					setVisible(true);
				}
			} catch (_err) {
				// Silent failure on startup update check
			}
		}, 1500);

		return () => {
			isMounted = false;
			clearTimeout(timer);
		};
	}, []);

	const handleUpdateNow = useCallback(async () => {
		if (!updateInfo?.downloadUrl) return;
		setUpdateState('downloading');
		setDownloadProgress(0);

		try {
			const localUri = await downloadUpdateApk(updateInfo.downloadUrl, (progress) => {
				setDownloadProgress(progress);
			});
			setLocalApkUri(localUri);
			setUpdateState('ready');
			await triggerUpdateInstall(localUri);
		} catch (_err) {
			setUpdateState('error');
		}
	}, [updateInfo]);

	const handleInstallAgain = useCallback(async () => {
		if (!localApkUri) return;
		try {
			await triggerUpdateInstall(localApkUri);
		} catch (_err) {
			setUpdateState('error');
		}
	}, [localApkUri]);

	const handleDismiss = useCallback(() => {
		setVisible(false);
	}, []);

	if (!visible || !updateInfo) {
		return null;
	}

	return (
		<Portal>
			<Dialog
				visible={visible}
				onDismiss={updateState === 'downloading' ? undefined : handleDismiss}
				style={[styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}
			>
				<Dialog.Title style={{ color: colors.onSurface, paddingBottom: 0 }}>
					<View style={styles.titleRow}>
						<Icon as={SparklesIcon} size={22} color={colors.primary} />
						<Text variant={'titleLarge'} style={{ color: colors.onSurface, fontWeight: '700' }}>
							Update Available
						</Text>
					</View>
				</Dialog.Title>

				<Dialog.Content style={styles.dialogContent}>
					{/* Brand & Version Header */}
					<View style={styles.headerSection}>
						<View style={styles.logoContainer}>
							<Image
								source={require('@/assets/images/kur-logo.png')}
								style={styles.logo}
								contentFit={'contain'}
							/>
						</View>
						<View style={styles.headerText}>
							<Text variant={'titleMedium'} style={{ color: colors.onSurface, fontWeight: '700' }}>
								Kur Music v{updateInfo.latestVersion}
							</Text>
							<Text variant={'bodyMedium'} style={{ color: colors.onSurfaceVariant }}>
								Current Version: v{currentVersion}
							</Text>
						</View>
					</View>

					<Divider style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

					{/* Release Notes / Changelog */}
					<Text variant={'labelLarge'} style={[styles.changelogTitle, { color: colors.primary }]}>
						What's New in v{updateInfo.latestVersion}:
					</Text>

					<View
						style={[
							styles.changelogBox,
							{
								backgroundColor: colors.surfaceContainer,
								borderColor: colors.outlineVariant,
							},
						]}
					>
						<ScrollView style={styles.changelogScroll} showsVerticalScrollIndicator={true}>
							<Text
								variant={'bodyMedium'}
								style={[styles.changelogText, { color: colors.onSurface }]}
							>
								{updateInfo.changelog || 'Performance improvements and bug fixes.'}
							</Text>
						</ScrollView>
					</View>

					{/* Download Progress Status */}
					{updateState === 'downloading' && (
						<View style={styles.progressContainer}>
							<Text variant={'bodyMedium'} style={{ color: colors.onSurface, marginBottom: 6 }}>
								Downloading update: {Math.round(downloadProgress * 100)}%
							</Text>
							<ProgressBar
								progress={downloadProgress}
								color={colors.primary}
								style={styles.progressBar}
							/>
						</View>
					)}

					{updateState === 'ready' && (
						<View style={styles.statusBox}>
							<Icon as={CheckCircle2Icon} size={20} color={colors.primary} />
							<Text variant={'bodyMedium'} style={{ color: colors.onSurface, fontWeight: '600' }}>
								Update Downloaded! Launching Installer...
							</Text>
						</View>
					)}

					{updateState === 'error' && (
						<View style={styles.errorBox}>
							<Icon as={AlertCircleIcon} size={20} color={colors.error} />
							<Text variant={'bodySmall'} style={{ color: colors.error, flex: 1 }}>
								Download failed. Please check internet connection and try again.
							</Text>
						</View>
					)}
				</Dialog.Content>

				<Dialog.Actions style={styles.actions}>
					{updateState === 'downloading' ? (
						<View style={styles.downloadingRow}>
							<ActivityIndicator size={'small'} color={colors.primary} />
							<Text variant={'bodyMedium'} style={{ color: colors.onSurfaceVariant }}>
								Installing update...
							</Text>
						</View>
					) : updateState === 'ready' ? (
						<Button mode={'contained'} onPress={handleInstallAgain} textColor={colors.onPrimary}>
							Install Update
						</Button>
					) : (
						<View style={styles.rightButtons}>
							<Button mode={'text'} onPress={handleDismiss} textColor={colors.onSurfaceVariant}>
								Dismiss
							</Button>

							<Button
								mode={'contained'}
								icon={() => <Icon as={DownloadIcon} size={16} color={colors.onPrimary} />}
								onPress={handleUpdateNow}
								textColor={colors.onPrimary}
							>
								Update Now
							</Button>
						</View>
					)}
				</Dialog.Actions>
			</Dialog>
		</Portal>
	);
}

const styles = StyleSheet.create({
	dialog: {
		borderRadius: M3Shapes.extraLarge,
		maxHeight: '85%',
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	dialogContent: {
		paddingTop: 12,
	},
	headerSection: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		marginBottom: 12,
	},
	logoContainer: {
		width: 48,
		height: 48,
		borderRadius: 14,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	logo: {
		width: 48,
		height: 48,
	},
	headerText: {
		flex: 1,
	},
	divider: {
		marginBottom: 12,
	},
	changelogTitle: {
		fontWeight: '700',
		marginBottom: 6,
	},
	changelogBox: {
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		maxHeight: 140,
		padding: 12,
	},
	changelogScroll: {
		maxHeight: 116,
	},
	changelogText: {
		lineHeight: 20,
	},
	progressContainer: {
		marginTop: 14,
	},
	progressBar: {
		height: 6,
		borderRadius: 3,
	},
	statusBox: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginTop: 14,
		padding: 10,
		borderRadius: 10,
		backgroundColor: 'rgba(124, 58, 237, 0.1)',
	},
	errorBox: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginTop: 14,
		padding: 10,
		borderRadius: 10,
		backgroundColor: 'rgba(239, 68, 68, 0.1)',
	},
	actions: {
		paddingHorizontal: 16,
		paddingBottom: 16,
		paddingTop: 8,
	},
	actionButtonsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
	},
	rightButtons: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	downloadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 4,
	},
});
