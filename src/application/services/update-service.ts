import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { installApk } from 'apk-installer';
import { getLogger } from '@/src/shared/services/logger';

const logger = getLogger('UpdateService');

// The raw package.json URL on your GitHub repository (CDN cached, no rate limits)
const REMOTE_PACKAGE_JSON_URL =
	'https://raw.githubusercontent.com/akhilraghavakurup-beep/kurmusic/main/package.json';

const GITHUB_RELEASES_API_URL =
	'https://api.github.com/repos/akhilraghavakurup-beep/kurmusic/releases/latest';

// Local version of the app from package.json
const LOCAL_VERSION = require('../../../package.json').version;

export interface UpdateInfo {
	readonly hasUpdate: boolean;
	readonly latestVersion: string;
	readonly downloadUrl: string;
	readonly changelog: string;
}

/**
 * Checks if a newer version is available in the GitHub repository.
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
	try {
		logger.debug(`Checking for updates... Local: ${LOCAL_VERSION}`);

		// Attempt to fetch GitHub Release API for latest release metadata & release notes
		const releaseResponse = await fetch(GITHUB_RELEASES_API_URL, {
			headers: { 'User-Agent': 'KurMusic-App', Accept: 'application/vnd.github.v3+json' },
		});

		if (releaseResponse.ok) {
			const releaseData = (await releaseResponse.json()) as {
				tag_name: string;
				body?: string;
				assets?: { name: string; browser_download_url: string }[];
			};

			const rawVersion = releaseData.tag_name ? releaseData.tag_name.replace(/^v/, '') : '';
			const latestVersion = rawVersion || LOCAL_VERSION;
			const changelog = releaseData.body
				? releaseData.body.trim()
				: 'Bug fixes and performance improvements.';

			const releaseAsset = releaseData.assets?.find((a) => a.name.includes('-release.apk'));
			const downloadUrl =
				releaseAsset?.browser_download_url ??
				`https://github.com/akhilraghavakurup-beep/kurmusic/releases/download/v${latestVersion}/kurmusic-${latestVersion}-release.apk`;

			const hasUpdate = isNewerVersion(latestVersion, LOCAL_VERSION);

			return {
				hasUpdate,
				latestVersion,
				downloadUrl,
				changelog,
			};
		}

		// Fallback to CDN-cached package.json if API is rate limited
		const packageResponse = await fetch(REMOTE_PACKAGE_JSON_URL, {
			headers: { 'Cache-Control': 'no-cache' },
		});
		if (!packageResponse.ok) {
			throw new Error(`Failed to fetch update metadata: ${packageResponse.status}`);
		}

		const data = (await packageResponse.json()) as { version: string };
		const latestVersion = data.version;
		const hasUpdate = isNewerVersion(latestVersion, LOCAL_VERSION);
		const downloadUrl = `https://github.com/akhilraghavakurup-beep/kurmusic/releases/download/v${latestVersion}/kurmusic-${latestVersion}-release.apk`;

		return {
			hasUpdate,
			latestVersion,
			downloadUrl,
			changelog: 'Bug fixes and performance improvements.',
		};
	} catch (error) {
		logger.warn('Failed to check for app updates', error instanceof Error ? error : undefined);
		return {
			hasUpdate: false,
			latestVersion: LOCAL_VERSION,
			downloadUrl: '',
			changelog: '',
		};
	}
}

/**
 * Helper to download the update APK with progress tracking.
 */
export async function downloadUpdateApk(
	downloadUrl: string,
	onProgress: (progress: number) => void
): Promise<string> {
	try {
		const targetPath = `${FileSystem.cacheDirectory}kurmusic-update.apk`;
		logger.debug(`Downloading update from: ${downloadUrl} to ${targetPath}`);

		// Clean up any stale/incomplete APK download file first
		const fileInfo = await FileSystem.getInfoAsync(targetPath);
		if (fileInfo.exists) {
			await FileSystem.deleteAsync(targetPath, { idempotent: true });
		}

		const downloadResumable = FileSystem.createDownloadResumable(
			downloadUrl,
			targetPath,
			{
				headers: {
					'User-Agent': 'KurMusic-App',
					Accept: 'application/vnd.android.package-archive, */*',
				},
			},
			(progressData) => {
				const progress =
					progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
				onProgress(
					isNaN(progress) || !isFinite(progress) ? 0 : Math.max(0, Math.min(1, progress))
				);
			}
		);

		const result = await downloadResumable.downloadAsync();
		if (!result || !result.uri) {
			throw new Error('Download completed but URI is missing');
		}

		logger.debug(`Download complete: ${result.uri}`);
		return result.uri;
	} catch (error) {
		logger.error('Failed to download update APK', error instanceof Error ? error : undefined);
		throw error;
	}
}

/**
 * Triggers Android's package installer to install the downloaded APK.
 * If native module installation fails (e.g. on legacy app builds without FileProvider),
 * falls back to browser download via Linking.openURL.
 */
export async function triggerUpdateInstall(
	localFileUri: string,
	fallbackDownloadUrl?: string
): Promise<boolean> {
	try {
		logger.debug(`Triggering install for: ${localFileUri}`);
		return await installApk(localFileUri);
	} catch (error) {
		logger.warn(
			'Native APK installation failed, attempting browser fallback',
			error instanceof Error ? error : undefined
		);
		if (fallbackDownloadUrl) {
			try {
				await Linking.openURL(fallbackDownloadUrl);
				return true;
			} catch (fallbackErr) {
				logger.error(
					'Browser fallback failed',
					fallbackErr instanceof Error ? fallbackErr : undefined
				);
			}
		}
		throw error;
	}
}

/**
 * Returns true if remote version string is higher than local version string.
 */
function isNewerVersion(remote: string, local: string): boolean {
	const rParts = remote.split('.').map((p) => parseInt(p, 10) || 0);
	const lParts = local.split('.').map((p) => parseInt(p, 10) || 0);

	const maxLen = Math.max(rParts.length, lParts.length);
	for (let i = 0; i < maxLen; i++) {
		const r = rParts[i] ?? 0;
		const l = lParts[i] ?? 0;
		if (r > l) return true;
		if (r < l) return false;
	}

	return false;
}
