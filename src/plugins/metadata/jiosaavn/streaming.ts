import type { Track } from '@domain/entities/track';
import type { AudioFormat, AudioStream } from '@domain/value-objects/audio-stream';
import { createAudioStream } from '@domain/value-objects/audio-stream';
import type { StreamQuality } from '@domain/value-objects/audio-source';
import type { TrackId } from '@domain/value-objects/track-id';
import type { AvailableFormat, StreamOptions } from '@plugins/core/interfaces/audio-source-provider';
import type { AsyncResult } from '@shared/types/result';
import { err, ok } from '@shared/types/result';
import { sortDownloadUrls } from './mappers';
import type { JioSaavnClient } from './client';
import type { JioSaavnDownloadUrl, JioSaavnSong } from './types';

const STREAM_URL_TTL_MS = 30 * 60 * 1000;
const JIOSAAVN_STREAM_HEADERS: Record<string, string> = {
	Accept: '*/*',
	Origin: 'https://www.jiosaavn.com',
	Referer: 'https://www.jiosaavn.com/',
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

const labelFor = (quality: StreamQuality) =>
	quality === 'low' ? '48kbps' : quality === 'medium' ? '96kbps' : '320kbps';
const bitrateFor = (download: JioSaavnDownloadUrl) => parseInt(download.quality, 10) || 0;
const qualityFor = (bitrate: number): StreamQuality =>
	bitrate >= 320 ? 'high' : bitrate >= 96 ? 'medium' : 'low';
const formatFor = (url: string): AudioFormat =>
	url.toLowerCase().includes('.m3u8')
		? 'hls'
		: url.toLowerCase().includes('.mp3')
			? 'mp3'
			: url.toLowerCase().includes('.aac')
				? 'aac'
				: url.toLowerCase().includes('.wav')
					? 'wav'
					: url.toLowerCase().includes('.ogg')
						? 'ogg'
						: url.toLowerCase().includes('.flac')
							? 'flac'
							: 'm4a';
const targetBitrateFor = (quality: StreamQuality) => (quality === 'low' ? 48 : quality === 'medium' ? 96 : 320);

function normalizeUrl(url: string): string {
	return url.trim().replace(/^http:\/\//i, 'https://');
}

function createStream(url: string, bitrate: number | undefined): AudioStream {
	return createAudioStream({
		url: normalizeUrl(url),
		format: formatFor(url),
		quality: qualityFor(bitrate ?? 0),
		bitrate: bitrate || undefined,
		expiresAt: Date.now() + STREAM_URL_TTL_MS,
		headers: JIOSAAVN_STREAM_HEADERS,
	});
}

function selectDownloadUrl(
	downloads: JioSaavnDownloadUrl[],
	quality: StreamQuality
): JioSaavnDownloadUrl | undefined {
	const exact = downloads.find((download) => download.quality === labelFor(quality));
	if (exact) {
		return exact;
	}

	const targetBitrate = targetBitrateFor(quality);
	const ranked = [...downloads].sort(
		(left, right) =>
			Math.abs(bitrateFor(left) - targetBitrate) - Math.abs(bitrateFor(right) - targetBitrate)
	);
	return ranked[0];
}

async function tryAuthTokenUrl(
	client: JioSaavnClient,
	song: JioSaavnSong,
	quality: StreamQuality
): Promise<string | null> {
	const encryptedMediaUrl = song.more_info?.encrypted_media_url?.trim();
	if (!encryptedMediaUrl) {
		return null;
	}

	try {
		const token = await client.generateAuthToken(encryptedMediaUrl, labelFor(quality));
		if (token.status === 'success' && token.auth_url) {
			return token.auth_url;
		}
	} catch {
		// ignore and continue to other fallback paths
	}

	return null;
}

function tryPreviewUrl(song: JioSaavnSong): string | null {
	const rawVlink = (song.more_info as { vlink?: string | null } | null | undefined)?.vlink;
	const vlink = rawVlink?.trim();
	return vlink ? normalizeUrl(vlink) : null;
}

export interface StreamingOperations {
	supportsTrack(track: Track): boolean;
	getStreamUrl(track: Track, options?: StreamOptions): AsyncResult<AudioStream, Error>;
	getAvailableFormats(trackId: TrackId): AsyncResult<AvailableFormat[], Error>;
}

export function createStreamingOperations(client: JioSaavnClient): StreamingOperations {
	return {
		supportsTrack(track) {
			return track.id.sourceType === 'jiosaavn';
		},
		async getStreamUrl(track, options) {
			if (track.id.sourceType !== 'jiosaavn') {
				return err(new Error(`Unsupported source type: ${track.id.sourceType}`));
			}

			try {
				const song = await client.getSong(track.id.sourceId);
				const requestedQuality = options?.quality ?? 'high';
				const downloads = sortDownloadUrls(song.downloadUrl);
				const selected = selectDownloadUrl(downloads, requestedQuality);

				if (selected?.url) {
					const bitrate = bitrateFor(selected);
					return ok(createStream(selected.url, bitrate || undefined));
				}

				const authTokenUrl = await tryAuthTokenUrl(client, song, requestedQuality);
				if (authTokenUrl) {
					return ok(createStream(authTokenUrl, targetBitrateFor(requestedQuality)));
				}

				const previewUrl = tryPreviewUrl(song);
				if (previewUrl) {
					return ok(createStream(previewUrl, 96));
				}

				return err(new Error('No playable stream URL was returned by JioSaavn API'));
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
		async getAvailableFormats(trackId) {
			if (trackId.sourceType !== 'jiosaavn') {
				return err(new Error(`Unsupported source type: ${trackId.sourceType}`));
			}
			try {
				const song = await client.getSong(trackId.sourceId);
				return ok(
					sortDownloadUrls(song.downloadUrl).map((download, index) => {
						const bitrate = bitrateFor(download);
						return {
							format: formatFor(download.url),
							quality: qualityFor(bitrate),
							bitrate: bitrate || undefined,
							label: download.quality,
							isDefault: index === 0,
						} satisfies AvailableFormat;
					})
				);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		},
	};
}