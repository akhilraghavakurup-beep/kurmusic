import type { Track } from '@domain/entities/track';
import type { HomeFeedData } from '@domain/entities/feed-section';
import type { Result } from '@shared/types/result';

export interface PlaylistTracksPage {
	readonly tracks: Track[];
	readonly hasMore: boolean;
}

export interface HomeFeedOperations {
	getHomeFeed(language?: string): Promise<Result<HomeFeedData, Error>>;
	applyFilter(chipText: string, language?: string): Promise<Result<HomeFeedData, Error>>;
	loadMore(language?: string): Promise<Result<HomeFeedData, Error>>;
	getPlaylistTracks(playlistId: string): Promise<Result<PlaylistTracksPage, Error>>;
	loadMorePlaylistTracks(): Promise<Result<PlaylistTracksPage, Error>>;
}
