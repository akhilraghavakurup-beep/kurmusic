import { useCallback } from 'react';
import { useDownloadStore } from '@/src/application/state/download-store';
import { downloadService } from '@/src/application/services/download-service';
import { useToast } from '@/src/hooks/use-toast';

export function useClearDownloads() {
	const { success, error } = useToast();

	const clearDownloads = useCallback(async () => {
		const downloadedTracks = useDownloadStore.getState().getAllDownloadedTracks();

		for (const track of downloadedTracks) {
			const result = await downloadService.removeDownload(track.trackId);
			if (!result.success) {
				error('Failed to clear downloads', result.error.message);
				return false;
			}
		}

		success('Downloads cleared', 'All downloaded files have been removed');
		return true;
	}, [success, error]);

	return { clearDownloads };
}
