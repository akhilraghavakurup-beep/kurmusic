import type { TrackAction, TrackActionContext } from '../../../../domain/actions/track-action';
import type { TrackActionResult } from '../../../../application/events/track-action-events';
import { CORE_ACTION_IDS } from '../../../../domain/actions/track-action';
import { sleepTimerService } from '../../../../application/services/sleep-timer-service';
import { usePlayerUIStore } from '../../../../application/state/player-ui-store';

export function getPlayerActions(context: TrackActionContext): TrackAction[] {
	const { source } = context;

	if (source !== 'player') {
		return [];
	}

	const actions: TrackAction[] = [];
	const sleepTimerActive = sleepTimerService.getState().isActive;

	actions.push({
		id: CORE_ACTION_IDS.VIEW_QUEUE,
		label: 'Queue',
		icon: 'ListMusic',
		group: 'secondary',
		priority: 30,
		enabled: true,
	});

	actions.push({
		id: CORE_ACTION_IDS.SLEEP_TIMER,
		label: sleepTimerActive ? 'Sleep Timer (On)' : 'Sleep Timer',
		icon: 'Timer',
		group: 'secondary',
		priority: 20,
		enabled: true,
		checked: sleepTimerActive,
	});

	return actions;
}

export async function executePlayerAction(
	actionId: string,
	_context: TrackActionContext
): Promise<TrackActionResult> {
	switch (actionId) {
		case CORE_ACTION_IDS.VIEW_QUEUE:
			usePlayerUIStore.getState().openQueueSheet();
			return { handled: true };

		case CORE_ACTION_IDS.SLEEP_TIMER:
			usePlayerUIStore.getState().openSleepTimerSheet();
			return { handled: true };

		default:
			return { handled: false };
	}
}
