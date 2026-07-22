import TrackPlayer, { Event } from 'react-native-track-player';
import { getLogger } from '@shared/services/logger';
import { useHomeFeedStore } from '@/src/application/state/home-feed-store';
import { getArtistNames } from '@/src/domain/entities/track';
import { usePlayerStore } from '@/src/application/state/player-store';
import { useLibraryStore } from '@/src/application/state/library-store';
import { useHistoryStore } from '@/src/application/state/history-store';
import { useDownloadStore } from '@/src/application/state/download-store';
import { createTrackFromDownloadInfo } from '@/src/domain/utils/create-track-from-download';
import { playbackService } from '@/src/application/services/playback-service';
import type { Track } from '@/src/domain/entities/track';
import { getTrackIdString } from '@/src/domain/value-objects/track-id';
import { getAlbumIdString } from '@/src/domain/value-objects/album-id';

const logger = getLogger('RNTPPlaybackService');
const MIN_SEEK_POSITION = 0;
const ANDROID_AUTO_TRACK_ID_PREFIX = 'android_auto_track:';
const ANDROID_AUTO_BROWSE_TRACK_ID_PREFIX = 'android_auto_browse_track:';
const ANDROID_AUTO_NATIVE_TRACK_ID_PREFIX = 'android_auto_native_track:';
const ANDROID_AUTO_REMOTE_SKIP_SETTLE_MS = 120;

interface AndroidAutoBrowseItem {
	readonly id: string;
	readonly title: string;
	readonly subtitle: string;
	readonly playable: boolean;
	readonly browsable: boolean;
	readonly iconUri?: string;
	readonly gridBrowsable?: boolean;
	readonly gridPlayable?: boolean;
}

async function ensureStoresHydrated(): Promise<void> {
	const stores = [useLibraryStore, useHistoryStore, useDownloadStore, useHomeFeedStore];
	await Promise.all(
		stores.map((store) => {
			if (store.persist?.hasHydrated && !store.persist.hasHydrated()) {
				return new Promise<void>((resolve) => {
					const check = () => {
						if (store.persist.hasHydrated()) {
							resolve();
						} else {
							setTimeout(check, 50);
						}
					};
					check();
				});
			}
			return Promise.resolve();
		})
	);
}

const browseTrackCache = new Map<string, Track>();

interface AndroidAutoPlayContext {
	readonly tracks: Track[];
	readonly index: number;
}

const browsePlayContextCache = new Map<string, AndroidAutoPlayContext>();

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTrackArtwork(track: Track): string {
	return track.artwork?.[0]?.url || '';
}

function cacheAndroidAutoTrackContext(
	contextId: string,
	tracks: Track[],
	index: number,
	prefix = ANDROID_AUTO_BROWSE_TRACK_ID_PREFIX
): string {
	const track = tracks[index];
	const trackId = getTrackIdString(track.id);
	const mediaId = `${prefix}${encodeURIComponent(contextId)}:${index}:${encodeURIComponent(trackId)}`;
	browseTrackCache.set(trackId, track);
	browsePlayContextCache.set(mediaId, { tracks, index });
	return mediaId;
}

function createTrackBrowseItems(
	contextId: string,
	tracks: Track[],
	idPrefix = ANDROID_AUTO_BROWSE_TRACK_ID_PREFIX
): AndroidAutoBrowseItem[] {
	return tracks.map((track, index) => ({
		id: cacheAndroidAutoTrackContext(contextId, tracks, index, idPrefix),
		title: track.title,
		subtitle: getArtistNames(track),
		playable: true,
		browsable: false,
		iconUri: getTrackArtwork(track),
	}));
}

function getTrackIdFromAndroidAutoMediaId(mediaId: string): string {
	if (!mediaId.startsWith(ANDROID_AUTO_BROWSE_TRACK_ID_PREFIX)) {
		return mediaId;
	}

	const payload = mediaId.slice(ANDROID_AUTO_BROWSE_TRACK_ID_PREFIX.length);
	const [, , encodedTrackId] = payload.split(':');
	if (!encodedTrackId) {
		return mediaId;
	}

	try {
		return decodeURIComponent(encodedTrackId);
	} catch {
		return mediaId;
	}
}

async function getNativeActiveQueueIndex(): Promise<number | null> {
	try {
		const nativeTrack = await TrackPlayer.getActiveTrack();
		const nativeTrackId = typeof nativeTrack?.id === 'string' ? nativeTrack.id : undefined;
		if (!nativeTrackId) return null;

		const queue = usePlayerStore.getState().queue;
		const index = queue.findIndex((track) => getTrackIdString(track.id) === nativeTrackId);
		return index >= 0 ? index : null;
	} catch (error) {
		logger.debug(
			'Unable to read native active track for Android Auto skip alignment',
			error instanceof Error ? error : undefined
		);
		return null;
	}
}

async function handleAndroidAutoRemoteSkip(direction: 'next' | 'previous'): Promise<void> {
	const beforeIndex = usePlayerStore.getState().queueIndex;

	await delay(ANDROID_AUTO_REMOTE_SKIP_SETTLE_MS);

	const latestState = usePlayerStore.getState();
	const nativeQueueIndex = await getNativeActiveQueueIndex();

	if (nativeQueueIndex !== null && nativeQueueIndex !== beforeIndex) {
		logger.debug(
			`Android Auto ${direction} already moved native session to queue index ${nativeQueueIndex}; aligning app queue`
		);
		if (latestState.queueIndex !== nativeQueueIndex) {
			playbackService.setQueue(latestState.queue, nativeQueueIndex);
		}
		return;
	}

	if (latestState.queueIndex !== beforeIndex) {
		logger.debug(`Android Auto ${direction} already handled by app queue alignment`);
		return;
	}

	if (direction === 'next') {
		await playbackService.skipToNext();
	} else {
		await playbackService.skipToPrevious();
	}
}

export async function PlaybackService(): Promise<void> {
	logger.debug('PlaybackService initializing - registering remote control handlers');

	TrackPlayer.addEventListener(Event.RemotePlay, () => {
		logger.debug('RemotePlay received (service)');
		TrackPlayer.play();
	});

	TrackPlayer.addEventListener(Event.RemotePause, () => {
		logger.debug('RemotePause received (service)');
		TrackPlayer.pause();
	});

	TrackPlayer.addEventListener(Event.RemoteStop, () => {
		logger.debug('RemoteStop received (service)');
		TrackPlayer.stop();
	});

	TrackPlayer.addEventListener(Event.RemoteNext, () => {
		logger.debug('RemoteNext received (service) - aligning Android Auto skip next');
		void handleAndroidAutoRemoteSkip('next');
	});

	TrackPlayer.addEventListener(Event.RemotePrevious, () => {
		logger.debug('RemotePrevious received (service) - aligning Android Auto skip previous');
		void handleAndroidAutoRemoteSkip('previous');
	});

	TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
		logger.debug(`RemoteSeek received (service): position=${event.position}`);
		TrackPlayer.seekTo(event.position);
	});

	TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
		logger.debug(`RemoteJumpForward received (service): interval=${event.interval}`);
		const position = await TrackPlayer.getPosition();
		await TrackPlayer.seekTo(position + event.interval);
	});

	TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
		logger.debug(`RemoteJumpBackward received (service): interval=${event.interval}`);
		const position = await TrackPlayer.getPosition();
		await TrackPlayer.seekTo(Math.max(MIN_SEEK_POSITION, position - event.interval));
	});

	// @ts-ignore - Custom event for Android Auto browsing
	TrackPlayer.addEventListener('remote-browse', async (event: { parentId: string }) => {
		logger.debug(`RemoteBrowse received: parentId=${event.parentId}`);

		try {
			const { ensureBootstrapped } = await import('@/src/application/bootstrap');
			await ensureBootstrapped();
			await ensureStoresHydrated();

			let items: AndroidAutoBrowseItem[] = [];
			if (event.parentId === 'root') {
				items = [
					{
						id: 'feed',
						title: 'Home Suggestions',
						subtitle: 'Personalized for you',
						playable: false,
						browsable: true,
						gridBrowsable: true,
						gridPlayable: true,
					},
					{
						id: 'library',
						title: 'Your Library',
						subtitle: 'Playlists and Favorites',
						playable: false,
						browsable: true,
					},
					{
						id: 'queue',
						title: 'Playing Next',
						subtitle: 'View current queue',
						playable: false,
						browsable: true,
					},
				];
			} else if (event.parentId === 'feed') {
				const { sections } = useHomeFeedStore.getState();
				const feedTracks: Track[] = [];
				items = sections
					.flatMap((section) =>
						section.items.flatMap((item): AndroidAutoBrowseItem[] => {
							if (item.type === 'track') {
								feedTracks.push(item.data);
								const trackIndex = feedTracks.length - 1;
								return [
									{
										id: cacheAndroidAutoTrackContext(
											'feed',
											feedTracks,
											trackIndex
										),
										title: item.data.title,
										subtitle: getArtistNames(item.data),
										playable: true,
										browsable: false,
										iconUri: getTrackArtwork(item.data),
									},
								];
							}
							if (item.type === 'album') {
								return [
									{
										id: `album_tracks:${getAlbumIdString(item.data.id)}`,
										title: item.data.name,
										subtitle:
											item.data.artists
												.map((artist) => artist.name)
												.join(', ') || 'Album',
										playable: false,
										browsable: true,
										iconUri: item.data.artwork?.[0]?.url || '',
									},
								];
							}
							return [];
						})
					)
					.slice(0, 30);

				if (items.length === 0) {
					items.push({
						id: 'empty_feed',
						title: 'No suggestions found',
						subtitle: 'Open app to refresh',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId === 'library') {
				items = [
					{
						id: 'library_tracks',
						title: 'Favorite Songs',
						subtitle: 'Your liked music',
						playable: false,
						browsable: true,
						gridPlayable: true,
					},
					{
						id: 'library_playlists',
						title: 'Playlists',
						subtitle: 'Your custom playlists',
						playable: false,
						browsable: true,
					},
					{
						id: 'library_recent',
						title: 'Recently Played',
						subtitle: 'Recently played tracks',
						playable: false,
						browsable: true,
						gridPlayable: true,
					},
					{
						id: 'library_downloads',
						title: 'Downloads',
						subtitle: 'Offline tracks on this device',
						playable: false,
						browsable: true,
						gridPlayable: true,
					},
				];
			} else if (event.parentId === 'library_recent') {
				const recentTracks = useHistoryStore.getState().getRecentTracks(30);
				items = createTrackBrowseItems('library_recent', recentTracks);

				if (items.length === 0) {
					items.push({
						id: 'empty_recent',
						title: 'No recently played songs',
						subtitle: 'Play songs in the app to show them here',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId === 'library_downloads') {
				const completedDownloads = Array.from(
					useDownloadStore.getState().downloads.values()
				).filter((info) => info.status === 'completed');
				const downloadedTracks = completedDownloads.map((downloadInfo) =>
					createTrackFromDownloadInfo(downloadInfo)
				);
				items = createTrackBrowseItems('library_downloads', downloadedTracks);

				if (items.length === 0) {
					items.push({
						id: 'empty_downloads',
						title: 'No downloaded songs',
						subtitle: 'Download songs in the app to play offline',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId === 'library_tracks') {
				const favorites = useLibraryStore.getState().getFavoriteTracks();
				items = createTrackBrowseItems('library_tracks', favorites);

				if (items.length === 0) {
					items.push({
						id: 'empty_favorites',
						title: 'No favorite songs',
						subtitle: 'Like songs in the app to show them here',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId === 'library_playlists') {
				const playlists = useLibraryStore.getState().playlists;
				items = playlists.map((playlist) => {
					const firstTrackArtwork = playlist.tracks[0]?.track?.artwork?.[0]?.url;
					return {
						id: `playlist_tracks:${playlist.id}`,
						title: playlist.name,
						subtitle: `${playlist.tracks.length} song(s)`,
						playable: false,
						browsable: true,
						iconUri: firstTrackArtwork || '',
					};
				});

				if (items.length === 0) {
					items.push({
						id: 'empty_playlists',
						title: 'No playlists found',
						subtitle: 'Create playlists in the app',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId.startsWith('playlist_tracks:')) {
				const playlistId = event.parentId.slice('playlist_tracks:'.length);
				const playlist = useLibraryStore
					.getState()
					.playlists.find((p) => p.id === playlistId);
				if (playlist) {
					items = createTrackBrowseItems(
						`playlist_tracks:${playlistId}`,
						playlist.tracks.map((pt) => pt.track)
					);
				}

				if (items.length === 0) {
					items.push({
						id: 'empty_playlist_tracks',
						title: 'Playlist is empty',
						subtitle: 'Add songs to this playlist',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId.startsWith('album_tracks:')) {
				const albumId = event.parentId.slice('album_tracks:'.length);
				const { albumService } = await import('@/src/application/services/album-service');
				const albumResult = await albumService.getAlbumDetail(albumId);
				if (albumResult.success && albumResult.data) {
					items = createTrackBrowseItems(
						`album_tracks:${albumId}`,
						albumResult.data.tracks
					);
				}

				if (items.length === 0) {
					items.push({
						id: 'empty_album_tracks',
						title: 'Album is empty',
						subtitle: 'No tracks found',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId === 'queue') {
				const appQueue = usePlayerStore.getState().queue;
				const currentIndex = usePlayerStore.getState().queueIndex;
				items = appQueue.map((track, i) => {
					browseTrackCache.set(getTrackIdString(track.id), track);
					browsePlayContextCache.set(`${ANDROID_AUTO_TRACK_ID_PREFIX}${i}`, {
						tracks: appQueue,
						index: i,
					});
					const isCurrent = i === currentIndex;
					return {
						id: `${ANDROID_AUTO_TRACK_ID_PREFIX}${i}`,
						title: track.title,
						subtitle: `${isCurrent ? 'Now playing - ' : ''}${getArtistNames(track)}`,
						playable: true,
						browsable: false,
						iconUri: getTrackArtwork(track),
					};
				});

				if (items.length === 0) {
					items.push({
						id: 'empty_queue',
						title: 'Queue is empty',
						subtitle: 'Add songs to your queue',
						playable: false,
						browsable: false,
					});
				}
			}

			// Prepend Android Auto Mini Player if a song is active
			const currentTrack = usePlayerStore.getState().currentTrack;
			if (currentTrack && event.parentId !== 'queue') {
				const isPlaying = usePlayerStore.getState().status === 'playing';
				// Remove empty messages if we are adding a real item
				if (items.length === 1 && items[0].id.startsWith('empty_')) {
					items = [];
				}
				items.unshift({
					id: 'android_auto_mini_player',
					title: `${isPlaying ? 'Now Playing: ' : 'Paused: '}${currentTrack.title}`,
					subtitle: getArtistNames(currentTrack),
					playable: true,
					browsable: false,
					iconUri: getTrackArtwork(currentTrack),
				});
			}

			// Send results back to native side
			const { NativeModules } = require('react-native');
			if (
				NativeModules.TrackPlayerModule &&
				NativeModules.TrackPlayerModule.setBrowseResults
			) {
				NativeModules.TrackPlayerModule.setBrowseResults(event.parentId, items);
			}
		} catch (error) {
			logger.error('RemoteBrowse error', error instanceof Error ? error : undefined);
			const { NativeModules } = require('react-native');
			if (
				NativeModules.TrackPlayerModule &&
				NativeModules.TrackPlayerModule.setBrowseResults
			) {
				NativeModules.TrackPlayerModule.setBrowseResults(event.parentId, []);
			}
		}
	});

	// @ts-ignore - Custom event for Android Auto playback
	TrackPlayer.addEventListener('remote-play-id', async (event: { mediaId: string }) => {
		logger.debug(`RemotePlayId received: mediaId=${event.mediaId}`);
		try {
			const { ensureBootstrapped } = await import('@/src/application/bootstrap');
			await ensureBootstrapped();
			await ensureStoresHydrated();

			if (event.mediaId === 'android_auto_mini_player') {
				logger.debug('Mini player action received - toggling play/pause');
				const state = usePlayerStore.getState();
				if (state.status === 'playing') {
					await playbackService.pause();
				} else {
					await playbackService.resume();
				}
				return;
			}

			const store = usePlayerStore.getState();
			const appQueue = store.queue;
			const playContext = browsePlayContextCache.get(event.mediaId);

			if (playContext) {
				logger.debug(
					`Playing Android Auto browse context at index ${playContext.index} (${playContext.tracks.length} tracks)`
				);
				playbackService.setQueue(playContext.tracks, playContext.index);
				return;
			}

			let index = -1;
			if (event.mediaId.startsWith(ANDROID_AUTO_TRACK_ID_PREFIX)) {
				index = Number.parseInt(
					event.mediaId.slice(ANDROID_AUTO_TRACK_ID_PREFIX.length),
					10
				);
			} else if (event.mediaId.startsWith(ANDROID_AUTO_NATIVE_TRACK_ID_PREFIX)) {
				logger.debug(
					'Native Android Auto track id received after native fallback; waiting for native session alignment'
				);
				return;
			} else {
				const trackId = getTrackIdFromAndroidAutoMediaId(event.mediaId);
				index = appQueue.findIndex((t) => getTrackIdString(t.id) === trackId);
			}

			if (index >= 0 && index < appQueue.length) {
				logger.debug(`Playing from queue at index ${index}`);
				playbackService.setQueue(appQueue, index);
			} else {
				// Not in active queue, check cache
				const track = browseTrackCache.get(getTrackIdFromAndroidAutoMediaId(event.mediaId));
				if (track) {
					logger.debug(`Playing cached track: ${track.title}`);
					playbackService.setQueue([track], 0);
				} else {
					logger.warn(`Track not found in queue or cache: ${event.mediaId}`);
				}
			}
		} catch (err) {
			logger.error(
				'Error playing track in remote-play-id',
				err instanceof Error ? err : undefined
			);
		}
	});

	// @ts-ignore - Custom event for Bluetooth/Headset connection
	TrackPlayer.addEventListener('remote-active', async (event: { device: string }) => {
		logger.debug(`RemoteActive received: device=${event.device}`);
	});

	logger.debug('PlaybackService initialized - all remote control handlers registered');
}
