import type { TrackId } from '@domain/value-objects/track-id';
import { createAudioStream, type AudioStream } from '@domain/value-objects/audio-stream';
import type { StreamOptions } from '@plugins/core/interfaces/audio-source-provider';
import { err, type AsyncResult, ok } from '@shared/types/result';
import { useLocalLibraryStore } from '../storage/local-library-store';
import { getFormatFromPath } from '../utils/audio-utils';
import * as FileSystem from 'expo-file-system/legacy';

const CONTENT_URI_PREFIX = 'content://';
const FILE_URI_PREFIX = 'file://';
const PLAYBACK_CACHE_DIR = `${FileSystem.cacheDirectory ?? ''}local-playback/`;
const cachedPlayableUris = new Map<string, string>();

/**
 * Resolve local/content URIs into a URI RNTP can always play.
 */
async function resolvePlayableUri(
	trackId: TrackId,
	originalPath: string,
	format: string
): Promise<AsyncResult<string, Error>> {
	if (originalPath.startsWith(FILE_URI_PREFIX)) {
		return ok(originalPath);
	}

	if (!originalPath.startsWith(CONTENT_URI_PREFIX)) {
		return ok(originalPath.startsWith('/') ? `${FILE_URI_PREFIX}${originalPath}` : originalPath);
	}

	const cachedPath = cachedPlayableUris.get(originalPath);
	if (cachedPath) {
		const info = await FileSystem.getInfoAsync(cachedPath);
		if (info.exists) {
			return ok(cachedPath);
		}
		cachedPlayableUris.delete(originalPath);
	}

	if (!PLAYBACK_CACHE_DIR) {
		return err(new Error('Playback cache directory unavailable'));
	}

	await FileSystem.makeDirectoryAsync(PLAYBACK_CACHE_DIR, { intermediates: true }).catch(() => {});

	const safeId = trackId.value.replace(/[^a-zA-Z0-9_-]/g, '_');
	const extension = format || 'm4a';
	const destination = `${PLAYBACK_CACHE_DIR}${safeId}.${extension}`;

	await FileSystem.copyAsync({ from: originalPath, to: destination });
	cachedPlayableUris.set(originalPath, destination);
	return ok(destination);
}

/**
 * Get audio stream URL for a track.
 */
export async function getStreamUrl(
	trackId: TrackId,
	_options?: StreamOptions
): AsyncResult<AudioStream, Error> {
	const state = useLocalLibraryStore.getState();
	const localTrack = state.tracks[trackId.sourceId];

	if (!localTrack) {
		return err(new Error(`Track not found: ${trackId.value}`));
	}

	const format = getFormatFromPath(localTrack.filePath);
	const playableUriResult = await resolvePlayableUri(trackId, localTrack.filePath, format);
	if (!playableUriResult.success) {
		return err(playableUriResult.error);
	}

	return ok(
		createAudioStream({
			url: playableUriResult.data,
			format,
			quality: 'high',
			contentLength: localTrack.fileSize,
		})
	);
}
