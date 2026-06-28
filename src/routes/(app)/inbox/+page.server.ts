import { listActivePrompts, listRecentEvents } from '$lib/pocketbase/data';

export async function load({ locals }) {
	const [recentEvents, activePrompts] = await Promise.all([
		listRecentEvents(locals.pb),
		listActivePrompts(locals.pb)
	]);

	return {
		recentEvents,
		activePrompts
	};
}
