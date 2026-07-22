import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { ok, err, type AsyncResult } from '@shared/types/result';
import type { ParsedMetadata, EmbeddedArtwork } from '../types';
import { getLogger } from '@shared/services/logger';
import {
	extractMetadata as nativeExtractMetadata,
	extractArtwork as nativeExtractArtwork,
	isNativeModuleAvailable,
} from 'audio-metadata';

const logger = getLogger('ID3Parser');

// Make Buffer available globally for music-metadata (web fallback)
if (typeof global !== 'undefined') {
	(global as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

let musicMetadata: typeof import('music-metadata') | null = null;

interface DownloadSidecarMetadata {
	readonly title?: string;
	readonly artist?: string;
	readonly album?: string;
	readonly albumArtist?: string;
	readonly year?: number;
	readonly genre?: string;
	readonly trackNumber?: number;
	readonly discNumber?: number;
	readonly artworkFilePath?: string;
}

async function _getMusicMetadata(): Promise<typeof import('music-metadata')> {
	if (!musicMetadata) {
		logger.debug('Loading music-metadata library...');
		musicMetadata = await import('music-metadata');
		logger.debug('music-metadata library loaded');
	}
	return musicMetadata;
}

/**
 * Parse audio metadata using native APIs (iOS/Android) or JS fallback (web).
 * Native parsing runs on a background thread and does not block the UI.
 */
export async function parseAudioMetadata(fileUri: string): AsyncResult<ParsedMetadata, Error> {
	const fileName = fileUri.split('/').pop() || fileUri;

	// Use native module on iOS/Android for non-blocking parsing
	if (isNativeModuleAvailable() && Platform.OS !== 'web') {
		return _parseWithNativeModule(fileUri, fileName);
	}

	// Fall back to JS parser on web
	return _parseWithJsModule(fileUri, fileName);
}

async function _parseWithNativeModule(
	fileUri: string,
	fileName: string
): AsyncResult<ParsedMetadata, Error> {
	try {
		logger.debug(`Parsing metadata natively for: ${fileName}`);

		const metadata = await nativeExtractMetadata(fileUri);

		let artwork: EmbeddedArtwork | undefined;
		if (metadata.hasArtwork) {
			try {
				const artworkResult = await nativeExtractArtwork(fileUri);
				if (artworkResult) {
					artwork = {
						data: Buffer.from(artworkResult.base64, 'base64'),
						mimeType: artworkResult.mimeType,
					};
				}
			} catch (artworkError) {
				logger.debug(`Failed to extract artwork for ${fileName}: ${artworkError}`);
			}
		}

		const sidecar = await _readDownloadSidecar(fileUri);
		if (!artwork && sidecar.artwork) {
			artwork = sidecar.artwork;
		}

		logger.debug(`Native parse complete: ${fileName}`);

		return ok({
			title: metadata.title ?? sidecar.metadata.title,
			artist: metadata.artist ?? sidecar.metadata.artist,
			album: metadata.album ?? sidecar.metadata.album,
			albumArtist: metadata.albumArtist ?? sidecar.metadata.albumArtist,
			year: metadata.year ?? sidecar.metadata.year,
			genre: metadata.genre ?? sidecar.metadata.genre,
			trackNumber: metadata.trackNumber ?? sidecar.metadata.trackNumber,
			discNumber: metadata.discNumber ?? sidecar.metadata.discNumber,
			duration: metadata.duration,
			bitrate: metadata.bitrate,
			sampleRate: metadata.sampleRate,
			codec: undefined,
			artwork,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`Native parsing failed for ${fileName}, falling back to JS: ${message}`);

		// Fall back to JS parser if native fails
		return _parseWithJsModule(fileUri, fileName);
	}
}

async function _parseWithJsModule(
	fileUri: string,
	fileName: string
): AsyncResult<ParsedMetadata, Error> {
	try {
		const fileInfo = await FileSystem.getInfoAsync(fileUri);
		if (!fileInfo.exists) {
			return err(new Error('File does not exist'));
		}

		const fileSize = 'size' in fileInfo ? (fileInfo.size as number) : 0;
		logger.debug(
			`Parsing metadata with JS for: ${fileName} (${Math.round(fileSize / 1024)}KB)`
		);

		const mm = await _getMusicMetadata();

		logger.debug(`Reading file: ${fileName}`);
		const base64Content = await FileSystem.readAsStringAsync(fileUri, {
			encoding: FileSystem.EncodingType.Base64,
		});
		logger.debug(`File read complete: ${fileName}`);

		const buffer = Buffer.from(base64Content, 'base64');
		const uint8Array = new Uint8Array(buffer);

		logger.debug(`Parsing buffer: ${fileName}`);
		const metadata = await mm.parseBuffer(uint8Array, {
			mimeType: _getMimeTypeFromUri(fileUri),
		});
		logger.debug(`Parse complete: ${fileName}`);

		const common = metadata.common;
		const format = metadata.format;

		let artwork: EmbeddedArtwork | undefined;
		if (common.picture && common.picture.length > 0) {
			const pic = common.picture[0];
			artwork = {
				data: pic.data,
				mimeType: pic.format || 'image/jpeg',
			};
		}

		const sidecar = await _readDownloadSidecar(fileUri);
		if (!artwork && sidecar.artwork) {
			artwork = sidecar.artwork;
		}

		return ok({
			title: common.title ?? sidecar.metadata.title,
			artist: common.artist || common.artists?.join(', ') || sidecar.metadata.artist,
			album: common.album ?? sidecar.metadata.album,
			albumArtist: common.albumartist ?? sidecar.metadata.albumArtist,
			year: common.year ?? sidecar.metadata.year,
			genre: common.genre?.join(', ') ?? sidecar.metadata.genre,
			trackNumber: common.track?.no ?? sidecar.metadata.trackNumber,
			discNumber: common.disk?.no ?? sidecar.metadata.discNumber,
			duration: format.duration ?? 0,
			bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
			sampleRate: format.sampleRate,
			codec: format.codec,
			artwork,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`Failed to parse metadata for ${fileName}: ${message}`);
		return err(
			error instanceof Error ? error : new Error(`Failed to parse metadata: ${String(error)}`)
		);
	}
}

async function _readDownloadSidecar(
	fileUri: string
): Promise<{ metadata: Partial<ParsedMetadata>; artwork?: EmbeddedArtwork }> {
	try {
		const normalized = fileUri.startsWith('file://') ? fileUri.replace('file://', '') : fileUri;
		const slashIndex = normalized.lastIndexOf('/');
		if (slashIndex === -1) {
			return { metadata: {} };
		}

		const directory = normalized.slice(0, slashIndex + 1);
		const metadataPath = `${directory}metadata.json`;
		const info = await FileSystem.getInfoAsync(metadataPath);
		if (!info.exists) {
			return { metadata: {} };
		}

		const raw = await FileSystem.readAsStringAsync(metadataPath, {
			encoding: FileSystem.EncodingType.UTF8,
		});
		const parsed = JSON.parse(raw) as DownloadSidecarMetadata;

		let artwork: EmbeddedArtwork | undefined;
		if (parsed.artworkFilePath) {
			const artworkInfo = await FileSystem.getInfoAsync(parsed.artworkFilePath);
			if (artworkInfo.exists) {
				const artworkBase64 = await FileSystem.readAsStringAsync(parsed.artworkFilePath, {
					encoding: FileSystem.EncodingType.Base64,
				});
				artwork = {
					data: Buffer.from(artworkBase64, 'base64'),
					mimeType: _getArtworkMimeType(parsed.artworkFilePath),
				};
			}
		}

		return {
			metadata: {
				title: parsed.title,
				artist: parsed.artist,
				album: parsed.album,
				albumArtist: parsed.albumArtist,
				year: parsed.year,
				genre: parsed.genre,
				trackNumber: parsed.trackNumber,
				discNumber: parsed.discNumber,
			},
			artwork,
		};
	} catch {
		return { metadata: {} };
	}
}

export async function parseAudioMetadataPartial(
	fileUri: string,
	_readDuration: boolean = true
): AsyncResult<Partial<ParsedMetadata>, Error> {
	// Native module handles this efficiently - just use full parse
	if (isNativeModuleAvailable() && Platform.OS !== 'web') {
		const result = await parseAudioMetadata(fileUri);
		if (result.success) {
			return ok({
				title: result.data.title,
				artist: result.data.artist,
				album: result.data.album,
				year: result.data.year,
				duration: result.data.duration,
			});
		}
		return ok({});
	}

	// JS fallback for web
	try {
		const mm = await _getMusicMetadata();

		const base64Content = await FileSystem.readAsStringAsync(fileUri, {
			encoding: FileSystem.EncodingType.Base64,
		});

		const buffer = Buffer.from(base64Content, 'base64');
		const uint8Array = new Uint8Array(buffer.slice(0, 1024 * 256));

		const metadata = await mm.parseBuffer(uint8Array, {
			mimeType: _getMimeTypeFromUri(fileUri),
		});

		const common = metadata.common;
		const format = metadata.format;

		return ok({
			title: common.title,
			artist: common.artist || common.artists?.join(', '),
			album: common.album,
			year: common.year,
			duration: format.duration ?? 0,
		});
	} catch {
		return ok({});
	}
}

function _getMimeTypeFromUri(uri: string): string {
	const ext = uri.split('.').pop()?.toLowerCase();

	const mimeMap: Record<string, string> = {
		mp3: 'audio/mpeg',
		m4a: 'audio/mp4',
		aac: 'audio/aac',
		flac: 'audio/flac',
		ogg: 'audio/ogg',
		opus: 'audio/opus',
		wav: 'audio/wav',
		webm: 'audio/webm',
	};

	return mimeMap[ext || ''] || 'audio/mpeg';
}

function _getArtworkMimeType(uri: string): string {
	const lower = uri.toLowerCase();
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.webp')) return 'image/webp';
	if (lower.endsWith('.gif')) return 'image/gif';
	return 'image/jpeg';
}

export async function extractDuration(fileUri: string): AsyncResult<number, Error> {
	// Native module is efficient for just duration
	if (isNativeModuleAvailable() && Platform.OS !== 'web') {
		try {
			const metadata = await nativeExtractMetadata(fileUri);
			return ok(metadata.duration);
		} catch (error) {
			return err(
				error instanceof Error
					? error
					: new Error(`Failed to extract duration: ${String(error)}`)
			);
		}
	}

	// JS fallback
	try {
		const mm = await _getMusicMetadata();

		const base64Content = await FileSystem.readAsStringAsync(fileUri, {
			encoding: FileSystem.EncodingType.Base64,
		});

		const buffer = Buffer.from(base64Content, 'base64');
		const uint8Array = new Uint8Array(buffer);

		const metadata = await mm.parseBuffer(uint8Array, {
			mimeType: _getMimeTypeFromUri(fileUri),
		});

		return ok(metadata.format.duration ?? 0);
	} catch (error) {
		return err(
			error instanceof Error
				? error
				: new Error(`Failed to extract duration: ${String(error)}`)
		);
	}
}
