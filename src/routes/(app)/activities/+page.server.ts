import { listActivityEvents } from '$lib/pocketbase/data';

export async function load({ locals }) {
	return {
		activities: locals.user ? await listActivityEvents(locals.pb, locals.user.id) : []
	};
}
