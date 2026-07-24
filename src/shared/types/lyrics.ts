export interface LyricsLine {
	readonly timestamp?: number;
	readonly text: string;
}

export interface Lyrics {
	readonly isSynced: boolean;
	readonly lines: LyricsLine[];
	readonly raw?: string;
	readonly provider?: string;
	readonly copyright?: string;
}
