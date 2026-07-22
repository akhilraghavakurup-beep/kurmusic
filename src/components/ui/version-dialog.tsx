/**
 * VersionDialog Component
 *
 * Material 3 styled dialog displaying app version information and in-app update checker.
 */

import { StyleSheet, View, Platform, Image, ActivityIndicator } from 'react-native';
import { Dialog, Portal, Text, Button, Divider, ProgressBar } from 'react-native-paper';
import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { useAppTheme, M3Shapes } from '@/lib/theme';
import { Icon } from '@/src/components/ui/icon';
import {
	SmartphoneIcon,
	CpuIcon,
	PackageIcon,
	CodeIcon,
	DownloadIcon,
	CheckCircle2Icon,
	AlertCircleIcon,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
	checkForUpdates,
	downloadUpdateApk,
	triggerUpdateInstall,
} from '@/src/application/services/update-service';

interface VersionDialogProps {
	readonly visible: boolean;
	readonly onDismiss: () => void;
}

interface InfoRowProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly value: string;
}

function InfoRow({ icon: IconComponent, label, value }: InfoRowProps) {
	const { colors } = useAppTheme();

	return (
		<View style={styles.infoRow}>
			<Icon as={IconComponent} size={18} color={colors.onSurfaceVariant} />
			<Text variant={'bodyMedium'} style={[styles.label, { color: colors.onSurfaceVariant }]}>
				{label}
			</Text>
			<Text variant={'bodyMedium'} style={[styles.value, { color: colors.onSurface }]}>
				{value}
			</Text>
		</View>
	);
}

export function VersionDialog({ visible, onDismiss }: VersionDialogProps) {
	const { colors } = useAppTheme();

	const appVersion = Constants.expoConfig?.version ?? '1.0.0';
	const expoSdkVersion = Constants.expoConfig?.sdkVersion ?? 'Unknown';
	const platformVersion = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`;

	// Update Checking State
	const [updateState, setUpdateState] = useState<
		'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'
	>('idle');
	const [latestVersion, setLatestVersion] = useState<string>('');
	const [downloadUrl, setDownloadUrl] = useState<string>('');
	const [downloadProgress, setDownloadProgress] = useState<number>(0);
	const [localApkUri, setLocalApkUri] = useState<string>('');

	// Reset state when dialog is closed/opened
	useEffect(() => {
		if (visible) {
			setUpdateState('idle');
			setLatestVersion('');
			setDownloadUrl('');
			setDownloadProgress(0);
			setLocalApkUri('');
		}
	}, [visible]);

	const handleCheckForUpdates = async () => {
		setUpdateState('checking');
		try {
			const info = await checkForUpdates();
			if (info.hasUpdate) {
				setLatestVersion(info.latestVersion);
				setDownloadUrl(info.downloadUrl);
				setUpdateState('available');
			} else {
				setUpdateState('up-to-date');
			}
		} catch (error) {
			setUpdateState('error');
		}
	};

	const handleDownloadUpdate = async () => {
		if (!downloadUrl) return;
		setUpdateState('downloading');
		setDownloadProgress(0);
		try {
			const localUri = await downloadUpdateApk(downloadUrl, (progress) => {
				setDownloadProgress(progress);
			});
			setLocalApkUri(localUri);
			setUpdateState('ready');
			// Automatically trigger installation once downloaded
			await triggerUpdateInstall(localUri);
		} catch (error) {
			setUpdateState('error');
		}
	};

	const handleInstallUpdate = async () => {
		if (!localApkUri) return;
		try {
			await triggerUpdateInstall(localApkUri);
		} catch (error) {
			setUpdateState('error');
		}
	};

	if (!visible) {
		return null;
	}

	return (
		<Portal>
			<Dialog
				visible={visible}
				onDismiss={updateState === 'downloading' ? undefined : onDismiss} // Prevent closing dialog during critical download
				style={[styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}
			>
				<Dialog.Title style={{ color: colors.onSurface }}>About Kur Music</Dialog.Title>
				<Dialog.Content>
					<View style={styles.headerSection}>
						<View
							style={[
								styles.iconContainer,
								{ backgroundColor: colors.primaryContainer },
							]}
						>
							<Image
								source={require('../../../assets/images/icon.png')}
								style={styles.logo}
								resizeMode={'contain'}
							/>
						</View>
						<View style={styles.headerText}>
							<Text variant={'headlineSmall'} style={{ color: colors.onSurface }}>
								Kur Music
							</Text>
							<Text variant={'bodyMedium'} style={{ color: colors.onSurfaceVariant }}>
								Music Player
							</Text>
						</View>
					</View>

					<Divider style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

					<View style={styles.infoSection}>
						<InfoRow icon={PackageIcon} label={'Version'} value={appVersion} />
						<InfoRow icon={CodeIcon} label={'Developed by'} value={'Kurup'} />
						<InfoRow icon={CodeIcon} label={'Tested by'} value={'Nemo'} />
						<InfoRow icon={CodeIcon} label={'Build'} value={'New Road to Dreams'} />
						<InfoRow icon={CodeIcon} label={'Expo SDK'} value={expoSdkVersion} />
						<InfoRow icon={SmartphoneIcon} label={'Platform'} value={platformVersion} />
						<InfoRow
							icon={CpuIcon}
							label={'Architecture'}
							value={Platform.OS === 'ios' ? 'arm64' : 'arm64-v8a'}
						/>
					</View>

					<Divider style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

					{/* Update Actions Display Section */}
					<View style={styles.updateContainer}>
						{updateState === 'idle' && (
							<Button
								mode={'outlined'}
								icon={() => (
									<Icon as={PackageIcon} size={16} color={colors.primary} />
								)}
								onPress={handleCheckForUpdates}
								textColor={colors.primary}
								style={{ borderColor: colors.outline }}
							>
								Check for Updates
							</Button>
						)}

						{updateState === 'checking' && (
							<View style={styles.rowCenter}>
								<ActivityIndicator size={'small'} color={colors.primary} />
								<Text
									variant={'bodyMedium'}
									style={{ color: colors.onSurfaceVariant }}
								>
									Checking repository for updates...
								</Text>
							</View>
						)}

						{updateState === 'up-to-date' && (
							<View style={styles.rowCenter}>
								<Icon as={CheckCircle2Icon} size={20} color={colors.primary} />
								<Text variant={'bodyMedium'} style={{ color: colors.onSurface }}>
									App is up to date!
								</Text>
							</View>
						)}

						{updateState === 'available' && (
							<View style={styles.updateAvailableBox}>
								<Text
									variant={'bodyMedium'}
									style={{ color: colors.onSurface, fontWeight: '600' }}
								>
									Update Available: v{latestVersion}
								</Text>
								<Text
									variant={'bodySmall'}
									style={{ color: colors.onSurfaceVariant, marginBottom: 8 }}
								>
									A newer version is ready in the cloud.
								</Text>
								<Button
									mode={'contained'}
									icon={() => (
										<Icon
											as={DownloadIcon}
											size={16}
											color={colors.onPrimary}
										/>
									)}
									onPress={handleDownloadUpdate}
									textColor={colors.onPrimary}
								>
									Download & Install
								</Button>
							</View>
						)}

						{updateState === 'downloading' && (
							<View style={styles.progressBox}>
								<Text
									variant={'bodyMedium'}
									style={{ color: colors.onSurface, marginBottom: 4 }}
								>
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
							<View style={styles.updateAvailableBox}>
								<View style={styles.rowCenter}>
									<Icon as={CheckCircle2Icon} size={20} color={colors.primary} />
									<Text
										variant={'bodyMedium'}
										style={{ color: colors.onSurface, fontWeight: '600' }}
									>
										Download Completed!
									</Text>
								</View>
								<Button
									mode={'contained'}
									onPress={handleInstallUpdate}
									textColor={colors.onPrimary}
									style={{ marginTop: 8 }}
								>
									Launch Installer
								</Button>
							</View>
						)}

						{updateState === 'error' && (
							<View style={styles.errorBox}>
								<Icon as={AlertCircleIcon} size={20} color={colors.error} />
								<View style={{ flex: 1 }}>
									<Text
										variant={'bodyMedium'}
										style={{ color: colors.error, fontWeight: '600' }}
									>
										Update failed
									</Text>
									<Text
										variant={'bodySmall'}
										style={{ color: colors.onErrorContainer }}
									>
										Could not fetch or install release APK.
									</Text>
								</View>
								<Button
									mode={'text'}
									onPress={handleCheckForUpdates}
									textColor={colors.primary}
								>
									Retry
								</Button>
							</View>
						)}
					</View>
				</Dialog.Content>
				<Dialog.Actions style={styles.actions}>
					<Button
						mode={'text'}
						onPress={onDismiss}
						textColor={colors.primary}
						disabled={updateState === 'downloading'}
					>
						Close
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	);
}

const styles = StyleSheet.create({
	dialog: {
		borderRadius: M3Shapes.extraLarge,
	},
	headerSection: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		marginBottom: 16,
	},
	iconContainer: {
		width: 64,
		height: 64,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	logo: {
		width: 56,
		height: 56,
	},
	headerText: {
		flex: 1,
	},
	divider: {
		marginVertical: 16,
	},
	infoSection: {
		gap: 12,
	},
	infoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	label: {
		flex: 1,
	},
	value: {
		fontWeight: '500',
	},
	actions: {
		paddingHorizontal: 16,
		paddingBottom: 16,
	},
	updateContainer: {
		marginTop: 8,
		alignItems: 'stretch',
		justifyContent: 'center',
	},
	rowCenter: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	updateAvailableBox: {
		padding: 12,
		borderRadius: 12,
		backgroundColor: 'rgba(255, 255, 255, 0.04)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.08)',
		alignItems: 'center',
	},
	progressBox: {
		paddingVertical: 8,
	},
	progressBar: {
		height: 6,
		borderRadius: 3,
	},
	errorBox: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		padding: 12,
		borderRadius: 12,
		backgroundColor: 'rgba(255, 82, 82, 0.08)',
		borderWidth: 1,
		borderColor: 'rgba(255, 82, 82, 0.2)',
	},
});
