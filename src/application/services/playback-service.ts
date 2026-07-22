import type { AudioFormat, AudioStream, Track } from '@/src/domain';
import { createAudioStream, Duration, getPlaybackUri, isLocallyAvailable } from '@/src/domain';
import type { RepeatMode } from '@/src/domain/value-objects/playback-state';
import { getTrackIdString } from '@/src/domain/value-objects/track-id';
import type {
	AudioSourceProvider,
	PlaybackEvent,
	PlaybackEventListener,
	PlaybackProvider,
} from '@plugins/core';
import { usePlayerStore } from '@/src/application';
import { useToastStore } from '@/src/application/state/toast-store';
import { err, ok, type Result } from '@/src/shared';
import { getLogger } from '@shared/services/logger';
import { playbackTimer } from '@shared/services/playback-timer';
import { downloadService } from './download-service';
import { getFileInfo } from '@infrastructure/filesystem';
import { useSettingsStore } from '../state/settings-store';
import { getPluginRegistry } from '../../plugins/core/registry/plugin-registry';
import type { MetadataProvider } from '@plugins/core';

const logger = getLogger('PlaybackService');

const STREAM_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedStream {
	readonly stream: AudioStream;
	readonly cachedAt: number;
}

export class PlaybackService {
	private playbackProviders: PlaybackProvider[] = [];
	private activeProvider: PlaybackProvider | null = null;
	private audioSourceProviders: AudioSourceProvider[] = [];
	private eventListener: PlaybackEventListener | null = null;
	private playLock: Promise<void> = Promise.resolve();
	private _playSessionId = 0;
	private _preCacheTimeoutId: NodeJS.Timeout | null = null;
	private readonly _streamCache = new Map<string, CachedStream>();

	constructor() {
		this.setupEventListener();
	}

	/**
	 * Serialize play operations to prevent race conditions
	 * when rapidly switching tracks.
	 */
	private async withPlayLock<T>(operation: () => Promise<T>): Promise<T> {
		const previousLock = this.playLock;
		let resolve: () => void = () => {};
		this.playLock = new Promise<void>((r) => {
			resolve = r;
		});

		try {
			await previousLock;
			return await operation();
		} finally {
			resolve();
		}
	}

	setPlaybackProviders(providers: PlaybackProvider[]): void {
		for (const provider of this.playbackProviders) {
			if (this.eventListener) {
				provider.removeEventListener(this.eventListener);
			}
		}

		this.playbackProviders = providers;

		if (this.eventListener) {
			for (const provider of this.playbackProviders) {
				provider.addEventListener(this.eventListener);
			}
		}

		logger.debug(`Registered ${providers.length} playback provider(s)`);
	}

	addPlaybackProvider(provider: PlaybackProvider): void {
		if (this.playbackProviders.some((p) => p.manifest.id === provider.manifest.id)) {
			return;
		}
		this.playbackProviders = [...this.playbackProviders, provider];
		if (this.eventListener) {
			provider.addEventListener(this.eventListener);
		}
		logger.debug(`Added playback provider: ${provider.manifest.id}`);
	}

	removePlaybackProvider(providerId: string): void {
		const index = this.playbackProviders.findIndex((p) => p.manifest.id === providerId);
		if (index !== -1) {
			const provider = this.playbackProviders[index];
			if (this.eventListener) {
				provider.removeEventListener(this.eventListener);
			}
			this.playbackProviders = this.playbackProviders.filter((_, i) => i !== index);
			logger.debug(`Removed playback provider: ${providerId}`);
		}
	}

	private getProviderForUrl(url: string): PlaybackProvider | null {
		for (const provider of this.playbackProviders) {
			if (provider.canHandle && provider.canHandle(url)) {
				logger.debug(`Using provider: ${provider.manifest.id}`);
				return provider;
			}
		}

		if (this.playbackProviders.length > 0) {
			const fallback = this.playbackProviders[0];
			logger.debug(`Using fallback provider: ${fallback.manifest.id}`);
			return fallback;
		}

		return null;
	}

	setAudioSourceProviders(providers: AudioSourceProvider[]): void {
		this.audioSourceProviders = providers;
	}

	addAudioSourceProvider(provider: AudioSourceProvider): void {
		if (!this.audioSourceProviders.includes(provider)) {
			this.audioSourceProviders = [...this.audioSourceProviders, provider];
		}
	}

	removeAudioSourceProvider(providerId: string): void {
		this.audioSourceProviders = this.audioSourceProviders.filter(
			(p) => p.manifest.id !== providerId
		);
	}



	async play(track: Track): Promise<Result<void, Error>> {
		return this.withPlayLock(async () => {
			const sessionId = ++this._playSessionId;
			playbackTimer.start(track.title);
			usePlayerStore.getState().play(track);

			// Find and set transitioning = true on the react-native-track-player provider early
			const rntpProvider = this.playbackProviders.find(
				(p) => p.manifest.id === 'react-native-track-player'
			);
			if (rntpProvider && rntpProvider.setTransitioning) {
				rntpProvider.setTransitioning(true);
			}

			const streamResult = await this._resolveStreamForTrack(track, sessionId);
			if (sessionId !== this._playSessionId) {
				logger.debug(`Play session ${sessionId} was superseded by a newer request. Aborting...`);
				return ok(undefined);
			}

			if (!streamResult.success) {
				if (streamResult.error.message === 'superseded') {
					return ok(undefined);
				}
				if (rntpProvider && rntpProvider.setTransitioning) {
					rntpProvider.setTransitioning(false);
				}
				return this._handlePlayError(streamResult.error, track);
			}

			return this._startPlaybackWithProvider(track, streamResult.data);
		});
	}

	/**
	 * Resolves the audio stream first before stopping the active provider
	 * to prevent Android Auto timeouts and gapless/smooth track changes.
	 */
	private async _resolveStreamForTrack(track: Track, sessionId: number): Promise<Result<AudioStream, Error>> {
		playbackTimer.beginPhase('resolve+stop');

		// 1. Resolve stream URL first (takes 1-3 seconds)
		const streamResult = await this._getAudioStream(track);
		if (sessionId !== this._playSessionId) {
			return err(new Error('superseded'));
		}

		// 2. Stop/Reset the active provider only after the stream is ready
		await this._stopActiveProvider();

		playbackTimer.endPhase();
		return streamResult;
	}

	private async _startPlaybackWithProvider(
		track: Track,
		audioStream: AudioStream
	): Promise<Result<void, Error>> {
		const provider = this.getProviderForUrl(audioStream.url);
		if (!provider) {
			return this._handlePlayError(
				new Error('No playback provider available for this stream type'),
				track
			);
		}

		if (this.activeProvider && this.activeProvider !== provider) {
			logger.debug(
				`Provider switch: ${this.activeProvider.manifest.id} → ${provider.manifest.id}`
			);
			await this._stopProvider(this.activeProvider);
		}

		this.activeProvider = provider;

		try {
			return await this._invokeProviderPlay(track, audioStream, provider);
		} catch (error) {
			const wrapped = error instanceof Error ? error : new Error('Unknown error');
			return this._handlePlayError(wrapped, track);
		}
	}

	private async _invokeProviderPlay(
		track: Track,
		audioStream: AudioStream,
		provider: PlaybackProvider
	): Promise<Result<void, Error>> {
		playbackTimer.beginPhase('provider-play');
		const playResult = await provider.play(
			track,
			audioStream.url,
			undefined,
			audioStream.headers
		);
		playbackTimer.endPhase();

		if (!playResult.success) return this._handlePlayError(playResult.error, track);

		playbackTimer.finish();

		// Trigger background pre-caching of the next track
		this._preCacheNextTrackInBackground().catch((err) => {
			logger.warn('Failed to pre-cache next track in background:', err);
		});

		return ok(undefined);
	}

	private async _preCacheNextTrackInBackground(): Promise<void> {
		if (this._preCacheTimeoutId) {
			clearTimeout(this._preCacheTimeoutId);
			this._preCacheTimeoutId = null;
		}

		const state = usePlayerStore.getState();
		if (state.queue.length <= 1) return;

		// Calculate the next index
		let nextIndex = state.queueIndex + 1;
		if (nextIndex >= state.queue.length) {
			if (state.repeatMode === 'all') {
				nextIndex = 0;
			} else {
				return; // No next track to pre-cache
			}
		}

		const nextTrack = state.queue[nextIndex];
		if (!nextTrack) return;

		const nextTrackId = getTrackIdString(nextTrack.id);

		// If already cached, do nothing
		if (this._getCachedStream(nextTrackId)) {
			logger.debug(`[Pre-Cache] Track ${nextTrack.title} is already cached`);
			return;
		}

		logger.debug(`[Pre-Cache] Queuing background resolution for next track: ${nextTrack.title}`);

		this._preCacheTimeoutId = setTimeout(async () => {
			try {
				logger.debug(`[Pre-Cache] Starting background resolution for: ${nextTrack.title}`);
				const streamResult = await this._getAudioStream(nextTrack);
				if (streamResult.success) {
					this._cacheStream(nextTrackId, streamResult.data);
					logger.debug(`[Pre-Cache] Successfully cached stream for: ${nextTrack.title}`);
				} else {
					logger.warn(`[Pre-Cache] Failed to resolve stream for ${nextTrack.title}:`, streamResult.error);
				}
			} catch (e) {
				logger.warn(`[Pre-Cache] Error in background stream resolution for ${nextTrack.title}:`, e);
			}
		}, 1000); // 1s delay to prioritize currently starting playback
	}

	private _handlePlayError(error: Error, track: Track): Result<void, Error> {
		playbackTimer.cancel();

		// Reset transitioning to false on the RNTP provider if needed
		const rntpProvider = this.playbackProviders.find(
			(p) => p.manifest.id === 'react-native-track-player'
		);
		if (rntpProvider && rntpProvider.setTransitioning) {
			rntpProvider.setTransitioning(false);
		}

		usePlayerStore.getState()._setError(error.message);
		this._streamCache.clear();
		logger.warn(`Playback failed for: ${track.title} — ${error.message}`);
		useToastStore.getState().show({
			title: 'Playback failed',
			description: 'Could not play this track.',
			variant: 'error',
			duration: 4000,
		});
		return err(error);
	}

	async pause(): Promise<Result<void, Error>> {
		if (!this.activeProvider) {
			return err(new Error('No playback provider available'));
		}
		usePlayerStore.getState().pause();
		return this.activeProvider.pause();
	}

	async resume(): Promise<Result<void, Error>> {
		if (!this.activeProvider) {
			return err(new Error('No playback provider available'));
		}
		usePlayerStore.getState().resume();
		return this.activeProvider.resume();
	}

	async stop(): Promise<Result<void, Error>> {
		if (!this.activeProvider) {
			return err(new Error('No playback provider available'));
		}
		usePlayerStore.getState().stop();
		return this.activeProvider.stop();
	}

	async seekTo(position: Duration): Promise<Result<void, Error>> {
		if (!this.activeProvider) {
			return err(new Error('No playback provider available'));
		}
		usePlayerStore.getState().seekTo(position);
		return this.activeProvider.seek(position);
	}

	async skipToNext(): Promise<Result<void, Error>> {
		const state = usePlayerStore.getState();
		const endedTrack = state.currentTrack;
		const isLastTrack = state.queueIndex === state.queue.length - 1;

		if (isLastTrack && state.repeatMode === 'off') {
			// Queue ended! Try autoplay recommendations
			if (endedTrack && useSettingsStore.getState().autoplaySimilarOnQueueEnd) {
				const autoAppend = await this.appendRecommendationsFromTrack(endedTrack, 15);
				if (autoAppend.success && autoAppend.data > 0) {
					// We successfully appended recommendations, so we can now skip to the next!
					state.skipToNext();
					const newTrack = usePlayerStore.getState().currentTrack;
					if (newTrack) {
						return this.play(newTrack);
					}
				}
			}
			// If autoplay is off or recommendations failed, gracefully pause and seek to 0,
			// keeping the current track loaded in a paused/idle state.
			await this.pause();
			await this.seekTo(Duration.ZERO);
			return ok(undefined);
		}

		state.skipToNext();

		const currentTrack = usePlayerStore.getState().currentTrack;
		if (currentTrack) {
			return this.play(currentTrack);
		}
		return ok(undefined);
	}

	async skipToPrevious(): Promise<Result<void, Error>> {
		const state = usePlayerStore.getState();

		// If only one track in queue or position > 3s, just seek to start
		if (state.queue.length <= 1 || state.position.totalSeconds > 3) {
			return this.seekTo(Duration.ZERO);
		}

		state.skipToPrevious();
		const currentTrack = usePlayerStore.getState().currentTrack;
		if (currentTrack) {
			return this.play(currentTrack);
		}
		return ok(undefined);
	}

	setQueue(tracks: Track[], startIndex = 0): void {
		usePlayerStore.getState().setQueue(tracks, startIndex);
		const currentTrack = usePlayerStore.getState().currentTrack;
		if (currentTrack) {
			this.play(currentTrack);
		}
	}

	setRepeatMode(mode: RepeatMode): void {
		if (this.activeProvider) {
			this.activeProvider.setRepeatMode(mode);
		}
	}

	async setVolume(volume: number): Promise<Result<void, Error>> {
		if (!this.activeProvider) {
			return err(new Error('No playback provider available'));
		}
		usePlayerStore.getState().setVolume(volume);
		return this.activeProvider.setVolume(volume);
	}

	async appendRecommendationsFromTrack(
		track: Track,
		limit = 5
	): Promise<Result<number, Error>> {
		const provider = this._getRecommendationProvider(track);
		const recommendationsResult = await this._resolveRecommendations(track, provider, limit);
		if (!recommendationsResult.success) {
			return err(recommendationsResult.error);
		}

		const recommendations = recommendationsResult.data.filter((item) => getTrackIdString(item.id) !== getTrackIdString(track.id));
		if (recommendations.length === 0) {
			return ok(0);
		}

		const store = usePlayerStore.getState();
		const insertIndex = Math.max(store.queueIndex + 1, 0);
		recommendations
			.slice()
			.reverse()
			.forEach((item) => store.insertIntoQueue(item, insertIndex));

		return ok(recommendations.length);
	}

	private async _resolveRecommendations(
		track: Track,
		provider: MetadataProvider | undefined,
		limit: number
	): Promise<Result<Track[], Error>> {
		let recommendationError: Error | null = null;

		if (provider?.getRecommendations) {
			const result = await provider.getRecommendations({ tracks: [track.id] }, undefined, limit);
			if (result.success && result.data.length > 0) {
				return ok(result.data);
			}
			if (!result.success) {
				recommendationError = result.error;
			}
		}

		if (provider?.hasCapability('search-tracks')) {
			const fallbackQuery = track.artists[0]?.name?.trim() || track.title;
			const fallbackSearch = await provider.searchTracks(fallbackQuery, { limit: limit + 5 });
			if (fallbackSearch.success) {
				const items = fallbackSearch.data.items.filter(
					(item) => getTrackIdString(item.id) !== getTrackIdString(track.id)
				);
				if (items.length > 0) {
					return ok(items.slice(0, limit));
				}
			}
		}

		// Fallback to Library/Favorites matching the artist or general favorites
		try {
			const { useLibraryStore } = require('../state/library-store');
			const libraryStore = useLibraryStore.getState();
			const libraryTracks = libraryStore.tracks || [];

			if (libraryTracks.length > 0) {
				let candidates = libraryTracks.filter(
					(t: Track) => getTrackIdString(t.id) !== getTrackIdString(track.id)
				);

				if (track.artists.length > 0) {
					const primaryArtist = track.artists[0].name.toLowerCase();
					const matchingArtistTracks = candidates.filter((t: Track) =>
						t.artists.some((a) => a.name.toLowerCase().includes(primaryArtist))
					);
					if (matchingArtistTracks.length > 0) {
						logger.debug(`Library recommendation fallback: found ${matchingArtistTracks.length} tracks matching artist "${primaryArtist}"`);
						candidates = matchingArtistTracks;
					}
				}

				// If no artist match, try favorites
				if (candidates === libraryTracks && libraryStore.favorites) {
					const favIds = Array.from(libraryStore.favorites);
					const matchingFavTracks = libraryTracks.filter(
						(t: Track) => getTrackIdString(t.id) !== getTrackIdString(track.id) && favIds.includes(getTrackIdString(t.id))
					);
					if (matchingFavTracks.length > 0) {
						logger.debug(`Library recommendation fallback: found ${matchingFavTracks.length} favorites`);
						candidates = matchingFavTracks;
					}
				}

				if (candidates.length > 0) {
					// Shuffle and slice
					const shuffled = [...candidates].sort(() => Math.random() - 0.5);
					return ok(shuffled.slice(0, limit));
				}
			}
		} catch (fallbackError) {
			logger.warn('Failed to resolve library recommendation fallback', fallbackError);
		}

		return err(recommendationError ?? new Error('No recommendation provider available for this track'));
	}

	private _getCachedStream(trackId: string): AudioStream | null {
		const cached = this._streamCache.get(trackId);
		if (!cached) return null;

		const age = Date.now() - cached.cachedAt;
		if (age > STREAM_CACHE_TTL_MS) {
			this._streamCache.delete(trackId);
			return null;
		}

		logger.debug(`Stream cache hit for track: ${trackId}`);
		return cached.stream;
	}

	private _cacheStream(trackId: string, stream: AudioStream): void {
		this._streamCache.set(trackId, {
			stream,
			cachedAt: Date.now(),
		});

		// Evict stale entries when cache grows beyond reasonable size
		if (this._streamCache.size > 50) {
			this._evictStaleEntries();
		}
	}

	private _evictStaleEntries(): void {
		const now = Date.now();
		for (const [key, value] of this._streamCache) {
			if (now - value.cachedAt > STREAM_CACHE_TTL_MS) {
				this._streamCache.delete(key);
			}
		}
	}

	private async _getAudioStream(track: Track): Promise<Result<AudioStream, Error>> {
		logger.debug('getAudioStream called for track:', track.title);

		const cachedStream = this._getCachedStream(getTrackIdString(track.id));
		if (cachedStream) return ok(cachedStream);

		const localResult = await this._tryLocalSource(track);
		if (localResult) return localResult;

		const providerResult = await this._tryAudioSourceProviders(track);
		if (providerResult) return providerResult;

		return err(new Error(`No audio source available for track: ${track.title}`));
	}

	private async _tryLocalSource(track: Track): Promise<Result<AudioStream, Error> | null> {
		const resolvedSource = downloadService.resolveTrackSource(track);
		logger.debug('Resolved source type:', resolvedSource.type);
		if (!isLocallyAvailable(resolvedSource)) return null;

		const filePath = getPlaybackUri(resolvedSource);
		if (!filePath) return null;

		// content:// paths are resolved via local-library provider into cache files.
		if (filePath.startsWith('content://')) return null;

		const fileInfo = await getFileInfo(filePath);
		if (fileInfo.exists) return ok(this._createLocalStream(resolvedSource, filePath));

		if (resolvedSource.type === 'downloaded') {
			logger.warn(`Downloaded file missing, removing: ${filePath}`);
			await downloadService.removeDownload(getTrackIdString(track.id));
		}
		return null;
	}

	private _createLocalStream(
		resolvedSource: ReturnType<typeof downloadService.resolveTrackSource>,
		filePath: string
	): AudioStream {
		logger.debug(`Using local file: ${filePath}`);
		let format: AudioFormat = 'm4a';
		if (resolvedSource.type === 'downloaded') {
			format = resolvedSource.fileType as AudioFormat;
		} else if (resolvedSource.type === 'local' && resolvedSource.fileType) {
			format = resolvedSource.fileType as AudioFormat;
		}
		return createAudioStream({ url: filePath, format, quality: 'high' });
	}

	private async _tryAudioSourceProviders(
		track: Track
	): Promise<Result<AudioStream, Error> | null> {
		const preferred = this._findPreferredProvider(track);

		if (preferred) {
			const result = await this._tryProvider(preferred, track);
			if (result) return result;
		}

		return this._tryFallbackProviders(track, preferred);
	}

	private _findPreferredProvider(track: Track): AudioSourceProvider | undefined {
		return this.audioSourceProviders.find((p) => {
			const supports = p.supportsTrack(track);
			logger.debug(`Provider ${p.manifest.id} supportsTrack: ${supports}`);
			return supports;
		});
	}

	private _getRecommendationProvider(track: Track): MetadataProvider | undefined {
		return getPluginRegistry()
			.getActiveMetadataProviders()
			.find((provider) => provider.manifest.id === track.id.sourceType);
	}

	private async _tryProvider(
		provider: AudioSourceProvider,
		track: Track
	): Promise<Result<AudioStream, Error> | null> {
		logger.debug('Found supporting provider:', provider.manifest.id);
		const result = await provider.getStreamUrl(track, {
			quality: useSettingsStore.getState().preferredStreamQuality,
		});
		if (result.success) {
			logger.debug('Got audio stream successfully');
			this._cacheStream(getTrackIdString(track.id), result.data);
			return ok(result.data);
		}
		logger.debug('getStreamUrl failed:', result.error);
		return null;
	}

	private async _tryFallbackProviders(
		track: Track,
		exclude?: AudioSourceProvider
	): Promise<Result<AudioStream, Error> | null> {
		for (const provider of this.audioSourceProviders) {
			if (provider === exclude) continue;
			try {
				if (!provider.supportsTrack(track)) continue;
				const result = await provider.getStreamUrl(track, {
					quality: useSettingsStore.getState().preferredStreamQuality,
				});
				if (result.success) {
					this._cacheStream(getTrackIdString(track.id), result.data);
					return ok(result.data);
				}
			} catch {}
		}
		return null;
	}

	private async _stopActiveProvider(): Promise<void> {
		if (!this.activeProvider) return;
		await this._stopProvider(this.activeProvider);
	}

	private async _stopProvider(provider: PlaybackProvider): Promise<void> {
		logger.debug(`Stopping provider: ${provider.manifest.id}`);
		try {
			await provider.stop();
		} catch (e) {
			logger.warn(
				`Error stopping provider ${provider.manifest.id}:`,
				e instanceof Error ? e : undefined
			);
		}
	}

	private setupEventListener(): void {
		this.eventListener = (event: PlaybackEvent) => {
			this._handlePlaybackEvent(event);
		};
	}

	private _handlePlaybackEvent(event: PlaybackEvent): void {
		const store = usePlayerStore.getState();
		switch (event.type) {
			case 'status-change':
				logger.debug(`Status change: ${event.status}`);
				store._setStatus(event.status);
				break;
			case 'position-change':
				store._setPosition(event.position);
				break;
			case 'duration-change':
				store._setDuration(event.duration);
				break;
			case 'ended':
				logger.debug(`${event.type} received - calling skipToNext`);
				setTimeout(() => this.skipToNext(), 0);
				break;
			case 'error':
				this._handlePlaybackErrorEvent(event, store);
				break;
		}
	}

	private _handlePlaybackErrorEvent(
		event: PlaybackEvent & { readonly type: 'error' },
		store: ReturnType<typeof usePlayerStore.getState>
	): void {
		logger.debug(`Error event: ${event.error.message}`);
		store._setError(event.error.message);
		this._streamCache.clear();
		useToastStore.getState().show({
			title: 'Playback failed',
			description: 'Could not play this track.',
			variant: 'error',
			duration: 4000,
		});
	}

	async dispose(): Promise<void> {
		this._streamCache.clear();
		if (this.activeProvider) {
			if (this.eventListener) {
				this.activeProvider.removeEventListener(this.eventListener);
			}
			await this.activeProvider.onDestroy();
		}
	}
}

export const playbackService = new PlaybackService();
