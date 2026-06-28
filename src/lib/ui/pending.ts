import { derived, writable } from 'svelte/store';

const pendingCount = writable(0);

export const hasPendingWork = derived(pendingCount, ($pendingCount) => $pendingCount > 0);

export function beginPendingWork() {
	pendingCount.update((count) => count + 1);

	let ended = false;

	return () => {
		if (ended) return;
		ended = true;
		pendingCount.update((count) => Math.max(0, count - 1));
	};
}
