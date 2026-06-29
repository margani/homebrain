import { listUnreviewedNoteEvents, listUserThings } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();

	return {
		inboxItems: await listUnreviewedNoteEvents(pb, user.id),
		things: await listUserThings(pb, user.id)
	};
}
