import { listUnreviewedNoteEvents, listUserThings, seedInboxCountCache } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();
	const [inboxItems, things] = await Promise.all([
		listUnreviewedNoteEvents(pb, user.id),
		listUserThings(pb, user.id, 0)
	]);
	seedInboxCountCache(user.id, inboxItems.length);

	return {
		inboxItems,
		things
	};
}
