import { redirect } from '@sveltejs/kit';
import { countUnprocessedNoteEvents } from '$lib/pocketbase/data';

export async function load({ locals }) {
	if (!locals.user) redirect(303, '/login');

	return {
		pbConfigured: locals.pbConfigured,
		user: locals.user,
		inboxCount: await countUnprocessedNoteEvents(locals.pb, locals.user.id)
	};
}
