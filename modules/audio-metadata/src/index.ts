import { requireNativeModule, Platform } from 'expo-modules-core';
import type { NativeAudioMetadata, ExtractedArtwork } from './AudioMetadata.types';

export type { NativeAudioMetadata, ExtractedArtwork };

interface AudioMetadataModule {
	extractMetadata(fileUri: string): Promise<NativeAudioMetadata>;
	extractArtwork(fileUri: string): Promise<ExtractedArtwork | null>;
	writeMetadata(
		fileUri: string,
		metadata: { title?: string; artist?: string; album?: string; artworkBase64?: string }
	): Promise<void>;
}

const NativeModule: AudioMetadataModule | null =
	Platform.OS === 'web' ? null : requireNativeModule('AudioMetadata');

/**
 * Extracts audio metadata using native APIs.
 * Runs on a background thread, not blocking the JS thread.
 */
export async function extractMetadata(fileUri: string): Promise<NativeAudioMetadata> {
	if (!NativeModule) {
		throw new Error('AudioMetadata module is not available on web');
	}
	return NativeModule.extractMetadata(fileUri);
}

/**
 * Extracts embedded artwork from an audio file.
 * Returns null if no artwork is embedded.
 */
export async function extractArtwork(fileUri: string): Promise<ExtractedArtwork | null> {
	if (!NativeModule) {
		throw new Error('AudioMetadata module is not available on web');
	}
	return NativeModule.extractArtwork(fileUri);
}

/**
 * Writes audio metadata tags (Title, Artist, Album, Artwork) to the audio file natively.
 */
export async function writeMetadata(
	fileUri: string,
	metadata: { title?: string; artist?: string; album?: string; artworkBase64?: string }
): Promise<void> {
	if (!NativeModule) {
		throw new Error('AudioMetadata module is not available on web');
	}
	return NativeModule.writeMetadata(fileUri, metadata);
}

/**
 * Check if native module is available (false on web)
 */
export function isNativeModuleAvailable(): boolean {
	return NativeModule !== null;
}
