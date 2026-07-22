/**
 * TagEditorStore
 *
 * Controls the visibility and target track of the Tag Editor bottom sheet.
 */

import { create } from 'zustand';
import type { Track } from '@/src/domain/entities/track';

interface TagEditorState {
	isOpen: boolean;
	track: Track | null;
	openTagEditor: (track: Track) => void;
	closeTagEditor: () => void;
}

export const useTagEditorStore = create<TagEditorState>((set) => ({
	isOpen: false,
	track: null,

	openTagEditor: (track: Track) => set({ isOpen: true, track }),
	closeTagEditor: () => set({ isOpen: false, track: null }),
}));

export const useIsTagEditorOpen = () => useTagEditorStore((state) => state.isOpen);
export const useTagEditorTrack = () => useTagEditorStore((state) => state.track);
