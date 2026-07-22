export interface NativeAudioMetadata {
	title?: string;
	artist?: string;
	album?: string;
	albumArtist?: string;
	year?: number;
	genre?: string;
	trackNumber?: number;
	discNumber?: number;
	duration: number;
	bitrate?: number;
	sampleRate?: number;
	hasArtwork: boolean;
}

export interface ExtractedArtwork {
	base64: string;
	mimeType: string;
}

export interface WritableAudioMetadata {
	title?: string;
	artist?: string;
	album?: string;
	albumArtist?: string;
	year?: number;
	genre?: string;
	trackNumber?: number;
	discNumber?: number;
	artworkFileUri?: string;
}
