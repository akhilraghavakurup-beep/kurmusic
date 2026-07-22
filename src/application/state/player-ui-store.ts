import { create } from 'zustand';

interface PlayerUIState {
	sleepTimerSheetOpen: boolean;
	queueSheetOpen: boolean;

	setSleepTimerSheetOpen: (open: boolean) => void;
	openSleepTimerSheet: () => void;
	closeSleepTimerSheet: () => void;
	openQueueSheet: () => void;
	closeQueueSheet: () => void;
}

export const usePlayerUIStore = create<PlayerUIState>((set) => ({
	sleepTimerSheetOpen: false,
	queueSheetOpen: false,

	setSleepTimerSheetOpen: (open: boolean) => set({ sleepTimerSheetOpen: open }),
	openSleepTimerSheet: () => set({ sleepTimerSheetOpen: true }),
	closeSleepTimerSheet: () => set({ sleepTimerSheetOpen: false }),
	openQueueSheet: () => set({ queueSheetOpen: true }),
	closeQueueSheet: () => set({ queueSheetOpen: false }),
}));

export const useSleepTimerSheetOpen = () => usePlayerUIStore((state) => state.sleepTimerSheetOpen);
export const useQueueSheetOpen = () => usePlayerUIStore((state) => state.queueSheetOpen);
