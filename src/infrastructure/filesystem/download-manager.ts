import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { Result } from '../../shared/types/result';
import { ok, err } from '../../shared/types/result';
import { getLogger } from '../../shared/services/logger';
import { permissionService } from '../../application/services/permission-service';
import { useSettingsStore } from '../../application/state/settings-store';
import type { DownloadLocationMode } from '../../application/state/settings-store';

const logger = getLogger('DownloadManager');

const DOWNLOADS_DIR = 'downloads/audio/';
const MIME_TYPES: Record<string, string> = {
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
	flac: 'audio/flac',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	opus: 'audio/ogg',
	m3u8: 'application/vnd.apple.mpegurl',
};

function getSafeTrackId(trackId: string): string {
	return trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSafeFileName(name: string): string {
	const trimmed = name.trim();
	const sanitized = trimmed
		.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/\.+$/g, '');

	return sanitized || 'Audio';
}

function getDownloadTrackDirectory(trackId: string): string {
	return FileSystem.documentDirectory + DOWNLOADS_DIR + `${getSafeTrackId(trackId)}/`;
}

export async function getDownloadsDirectory(): Promise<string> {
	const dir = FileSystem.documentDirectory + DOWNLOADS_DIR;
	await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
	return dir;
}

export function getDownloadFilePath(
	trackId: string,
	displayName: string,
	format: string = 'm4a'
): string {
	const trackDir = getDownloadTrackDirectory(trackId);
	return trackDir + `${getSafeFileName(displayName)}.${format}`;
}

export type DownloadProgressCallback = (progress: number) => void;

export interface DownloadResult {
	filePath: string;
	fileSize: number;
}

export interface InternalDownloadMetadataPayload {
	readonly trackId: string;
	readonly fileName: string;
	readonly title: string;
	readonly artistName: string;
	readonly albumName?: string;
	readonly albumId?: string;
	readonly sourcePlugin: string;
	readonly format: string;
	readonly artworkUrl?: string;
}

export interface InternalDownloadMetadataResult {
	readonly metadataFilePath: string;
	readonly artworkFilePath?: string;
}

export interface ExternalDownloadConfig {
	readonly mode: DownloadLocationMode;
	readonly customDirectoryUri?: string | null;
	readonly customDirectoryName?: string | null;
}

export interface ExternalDownloadResult {
	readonly filePath: string;
	readonly directoryName: string;
}

function getParentDirectory(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	const slashIndex = normalized.lastIndexOf('/');
	return slashIndex === -1 ? normalized : normalized.slice(0, slashIndex + 1);
}

function getArtworkExtension(artworkUrl: string): string {
	const lower = artworkUrl.toLowerCase();
	if (lower.includes('.png')) return 'png';
	if (lower.includes('.webp')) return 'webp';
	return 'jpg';
}

async function resolveExternalDirectory(
	config: ExternalDownloadConfig
): Promise<Result<{ uri: string; name: string }, Error>> {
	if (Platform.OS !== 'android') {
		return err(new Error('External download location is only supported on Android'));
	}

	if (config.mode === 'music') {
		const savedMusicDirectoryUri = useSettingsStore.getState().musicDownloadDirectoryUri;
		const savedMusicDirectoryName = useSettingsStore.getState().musicDownloadDirectoryName;

		if (savedMusicDirectoryUri) {
			return ok({
				uri: savedMusicDirectoryUri,
				name: savedMusicDirectoryName ?? 'Music',
			});
		}

		const result = await permissionService.requestMusicDirectoryPermission();
		if (result.success) {
			useSettingsStore
				.getState()
				.setMusicDownloadDirectory(result.data.uri, result.data.name);
		}
		return result;
	}

	if (config.customDirectoryUri) {
		return ok({
			uri: config.customDirectoryUri,
			name: config.customDirectoryName ?? 'Selected folder',
		});
	}

	const result = await permissionService.requestDirectoryPermission();
	if (result.success) {
		useSettingsStore.getState().setCustomDownloadDirectory(result.data.uri, result.data.name);
	}
	return result;
}

async function deleteExistingExternalFile(directoryUri: string, fileName: string): Promise<void> {
	const entries = await StorageAccessFramework.readDirectoryAsync(directoryUri);

	for (const entryUri of entries) {
		const decoded = decodeURIComponent(entryUri);
		if (decoded.endsWith(`/${fileName}`)) {
			await FileSystem.deleteAsync(entryUri, { idempotent: true }).catch(() => {});
		}
	}
}

export async function downloadAudioFile(
	url: string,
	trackId: string,
	displayName: string,
	onProgress?: DownloadProgressCallback,
	headers?: Record<string, string>,
	format: string = 'm4a'
): Promise<Result<DownloadResult, Error>> {
	try {
		await getDownloadsDirectory();
		const trackDir = getDownloadTrackDirectory(trackId);
		await FileSystem.makeDirectoryAsync(trackDir, { intermediates: true }).catch(() => {});

		const filePath = getDownloadFilePath(trackId, displayName, format);
		logger.debug(`Downloading to: ${filePath}`);
		logger.debug(`Using headers:`, JSON.stringify(headers ?? 'none'));

		const defaultHeaders: Record<string, string> = {
			Accept: '*/*',
			'User-Agent': 'Kur Music/0.0.1',
		};

		const finalHeaders = { ...defaultHeaders, ...headers };
		logger.debug('Final headers:', Object.keys(finalHeaders).join(', '));

		// First try with progress tracking using createDownloadResumable
		const downloadResumable = FileSystem.createDownloadResumable(
			url,
			filePath,
			{ headers: finalHeaders },
			(downloadProgress) => {
				const progress =
					downloadProgress.totalBytesExpectedToWrite > 0
						? Math.round(
								(downloadProgress.totalBytesWritten /
									downloadProgress.totalBytesExpectedToWrite) *
									100
							)
						: 0;
				onProgress?.(progress);
			}
		);

		let result = await downloadResumable.downloadAsync();

		// If resumable download fails, try simple downloadAsync as fallback
		if (!result || (result.status !== 200 && result.status !== 206)) {
			logger.debug('Resumable download failed, trying simple download...');
			await deleteAudioFile(filePath).catch(() => {});
			result = await FileSystem.downloadAsync(url, filePath, {
				headers: finalHeaders,
			});
		}

		if (!result) {
			return err(new Error('Download failed: no result returned'));
		}

		// Accept 200 (OK) and 206 (Partial Content for Range requests)
		if (result.status !== 200 && result.status !== 206) {
			logger.debug(`Download failed with HTTP status: ${result.status}`);
			await deleteAudioFile(filePath);
			return err(new Error(`Download failed with status: ${result.status}`));
		}

		const fileInfo = await FileSystem.getInfoAsync(filePath);
		if (!fileInfo.exists) {
			return err(new Error('Download failed: file not found after download'));
		}

		const fileSize = 'size' in fileInfo ? (fileInfo.size as number) : 0;

		if (fileSize < 10000) {
			await deleteAudioFile(filePath);
			return err(new Error('Download failed: file too small, likely corrupted'));
		}

		logger.debug(`Download complete: ${filePath} (${fileSize} bytes)`);

		return ok({
			filePath,
			fileSize,
		});
	} catch (error) {
		logger.error('Download error', error instanceof Error ? error : undefined);
		return err(error instanceof Error ? error : new Error(`Download failed: ${String(error)}`));
	}
}

export async function copyToDownloads(
	sourcePath: string,
	trackId: string,
	displayName: string,
	format: string = 'm4a'
): Promise<Result<DownloadResult, Error>> {
	try {
		await getDownloadsDirectory();
		const trackDir = getDownloadTrackDirectory(trackId);
		await FileSystem.makeDirectoryAsync(trackDir, { intermediates: true }).catch(() => {});
		const destPath = getDownloadFilePath(trackId, displayName, format);

		const normalizedSource = sourcePath.startsWith('file://')
			? sourcePath
			: `file://${sourcePath}`;

		const sourceInfo = await FileSystem.getInfoAsync(normalizedSource);
		if (!sourceInfo.exists) {
			return err(new Error('Source file not found'));
		}

		await FileSystem.copyAsync({ from: normalizedSource, to: destPath });

		const destInfo = await FileSystem.getInfoAsync(destPath);
		if (!destInfo.exists || !('size' in destInfo)) {
			return err(new Error('Failed to copy file to downloads'));
		}

		const fileSize = destInfo.size as number;
		logger.debug(`Copied to downloads: ${destPath} (${fileSize} bytes)`);

		return ok({ filePath: destPath, fileSize });
	} catch (error) {
		logger.error('Copy to downloads error', error instanceof Error ? error : undefined);
		return err(error instanceof Error ? error : new Error(`Copy failed: ${String(error)}`));
	}
}

export async function copyDirectoryToDownloads(
	sourceDir: string,
	trackId: string,
	displayName: string
): Promise<Result<DownloadResult, Error>> {
	try {
		await getDownloadsDirectory();
		const trackDir = getDownloadTrackDirectory(trackId);
		const destDir = trackDir + `${getSafeFileName(displayName)}_hls/`;

		await FileSystem.makeDirectoryAsync(destDir, { intermediates: true }).catch(() => {});
		await FileSystem.copyAsync({ from: sourceDir, to: destDir });

		const manifestPath = destDir + 'playlist.m3u8';
		const manifestInfo = await FileSystem.getInfoAsync(manifestPath);
		if (!manifestInfo.exists) {
			return err(new Error('Failed to copy HLS directory: manifest not found'));
		}

		const files = await FileSystem.readDirectoryAsync(destDir);
		let totalSize = 0;
		for (const file of files) {
			const info = await FileSystem.getInfoAsync(destDir + file);
			if (info.exists && 'size' in info) {
				totalSize += info.size as number;
			}
		}

		logger.debug(`Copied HLS directory to downloads: ${destDir} (${totalSize} bytes)`);
		return ok({ filePath: manifestPath, fileSize: totalSize });
	} catch (error) {
		logger.error(
			'Copy directory to downloads error',
			error instanceof Error ? error : undefined
		);
		return err(
			error instanceof Error ? error : new Error(`Directory copy failed: ${String(error)}`)
		);
	}
}

export async function exportAudioToExternalDirectory(
	sourcePath: string,
	trackId: string,
	displayName: string,
	format: string,
	config: ExternalDownloadConfig
): Promise<Result<ExternalDownloadResult, Error>> {
	try {
		const resolvedDirectory = await resolveExternalDirectory(config);
		if (!resolvedDirectory.success) {
			return resolvedDirectory;
		}

		const baseFileName = getSafeFileName(displayName || getSafeTrackId(trackId));
		const fileName = `${baseFileName}.${format}`;
		await deleteExistingExternalFile(resolvedDirectory.data.uri, fileName);

		const sourceUri = sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}`;
		const targetUri = await StorageAccessFramework.createFileAsync(
			resolvedDirectory.data.uri,
			baseFileName,
			MIME_TYPES[format] ?? 'audio/*'
		);
		const base64 = await FileSystem.readAsStringAsync(sourceUri, {
			encoding: FileSystem.EncodingType.Base64,
		});

		await FileSystem.writeAsStringAsync(targetUri, base64, {
			encoding: FileSystem.EncodingType.Base64,
		});

		logger.debug(`Exported download to external storage: ${targetUri}`);
		return ok({
			filePath: targetUri,
			directoryName: resolvedDirectory.data.name,
		});
	} catch (error) {
		logger.error(
			'Export to external directory error',
			error instanceof Error ? error : undefined
		);
		return err(
			error instanceof Error
				? error
				: new Error(`Failed to export download: ${String(error)}`)
		);
	}
}

export async function writeInternalDownloadMetadata(
	filePath: string,
	metadata: InternalDownloadMetadataPayload
): Promise<Result<InternalDownloadMetadataResult, Error>> {
	try {
		const directory = getParentDirectory(filePath);
		const metadataFilePath = `${directory}metadata.json`;

		let artworkFilePath: string | undefined;
		if (metadata.artworkUrl) {
			const extension = getArtworkExtension(metadata.artworkUrl);
			const targetArtworkPath = `${directory}cover.${extension}`;
			const artworkDownload = await FileSystem.downloadAsync(
				metadata.artworkUrl,
				targetArtworkPath,
				{
					headers: {
						Accept: 'image/*',
						'User-Agent': 'Kur Music/0.0.1',
					},
				}
			).catch(() => null);

			if (artworkDownload?.status === 200) {
				artworkFilePath = targetArtworkPath;
			}
		}

		await FileSystem.writeAsStringAsync(
			metadataFilePath,
			JSON.stringify(
				{
					trackId: metadata.trackId,
					fileName: metadata.fileName,
					title: metadata.title,
					artist: metadata.artistName,
					album: metadata.albumName,
					albumId: metadata.albumId,
					sourcePlugin: metadata.sourcePlugin,
					format: metadata.format,
					artworkUrl: metadata.artworkUrl,
					artworkFilePath,
					writtenAt: Date.now(),
				},
				null,
				2
			),
			{
				encoding: FileSystem.EncodingType.UTF8,
			}
		);

		return ok({
			metadataFilePath,
			artworkFilePath,
		});
	} catch (error) {
		logger.error(
			'Write internal download metadata error',
			error instanceof Error ? error : undefined
		);
		return err(
			error instanceof Error
				? error
				: new Error(`Failed to write internal metadata: ${String(error)}`)
		);
	}
}

export async function deleteDownloadDirectory(manifestPath: string): Promise<Result<void, Error>> {
	try {
		const dir = manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1);
		await FileSystem.deleteAsync(dir, { idempotent: true });
		logger.debug(`Deleted download directory: ${dir}`);
		return ok(undefined);
	} catch (error) {
		logger.error('Delete directory error', error instanceof Error ? error : undefined);
		return err(
			error instanceof Error ? error : new Error(`Delete directory failed: ${String(error)}`)
		);
	}
}

export async function deleteAudioFile(filePath: string): Promise<Result<void, Error>> {
	try {
		await FileSystem.deleteAsync(filePath, { idempotent: true });
		logger.debug(`Deleted file: ${filePath}`);
		return ok(undefined);
	} catch (error) {
		logger.error('Delete error', error instanceof Error ? error : undefined);
		return err(error instanceof Error ? error : new Error(`Delete failed: ${String(error)}`));
	}
}

export async function deleteInternalDownloadBundle(filePath: string): Promise<Result<void, Error>> {
	try {
		const directory = getParentDirectory(filePath);
		await FileSystem.deleteAsync(directory, { idempotent: true });
		logger.debug(`Deleted internal download bundle: ${directory}`);
		return ok(undefined);
	} catch (error) {
		logger.error(
			'Delete internal bundle error',
			error instanceof Error ? error : undefined
		);
		return err(
			error instanceof Error
				? error
				: new Error(`Delete internal bundle failed: ${String(error)}`)
		);
	}
}

export async function getFileInfo(filePath: string): Promise<{ exists: boolean; size?: number }> {
	try {
		const info = await FileSystem.getInfoAsync(filePath);
		return {
			exists: info.exists,
			size: info.exists && 'size' in info ? (info.size as number) : undefined,
		};
	} catch {
		return { exists: false };
	}
}

async function getDirectorySize(dirPath: string): Promise<number> {
	const entries = await FileSystem.readDirectoryAsync(dirPath);
	let totalSize = 0;

	for (const entry of entries) {
		const entryPath = dirPath + entry;
		const info = await FileSystem.getInfoAsync(entryPath);
		if (!info.exists) continue;

		if (info.isDirectory) {
			totalSize += await getDirectorySize(entryPath + '/');
		} else if ('size' in info) {
			totalSize += info.size as number;
		}
	}

	return totalSize;
}

export async function getDownloadedFilesSize(): Promise<number> {
	try {
		const dir = await getDownloadsDirectory();
		return await getDirectorySize(dir);
	} catch {
		return 0;
	}
}

export async function clearAllDownloads(): Promise<Result<void, Error>> {
	try {
		const dir = FileSystem.documentDirectory + DOWNLOADS_DIR;
		await FileSystem.deleteAsync(dir, { idempotent: true });
		await getDownloadsDirectory();
		logger.debug('Cleared all downloads');
		return ok(undefined);
	} catch (error) {
		logger.error('Clear downloads error', error instanceof Error ? error : undefined);
		return err(
			error instanceof Error ? error : new Error(`Clear downloads failed: ${String(error)}`)
		);
	}
}
