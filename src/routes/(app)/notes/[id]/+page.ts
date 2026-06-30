import { error } from '@sveltejs/kit';
import { getNoteArchiveEvent, listUserThings } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load({ params }) {
	const { pb, user } = await loadUserAndPb();

	try {
		const [note, things] = await Promise.all([
			getNoteArchiveEvent(pb, user.id, params.id),
			listUserThings(pb, user.id, 0)
		]);

		return {
			note,
			things
		};
	} catch {
		error(404, 'Note not found.');
	}
}
