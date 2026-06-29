import { listNoteArchiveEvents, noteArchiveFilters, type NoteArchiveFilter } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

function parseFilter(value: string | null): NoteArchiveFilter {
	if (noteArchiveFilters.includes(value as NoteArchiveFilter)) {
		return value as NoteArchiveFilter;
	}

	return 'all';
}

export async function load({ url }) {
	const { pb, user } = await loadUserAndPb();
	const filter = parseFilter(url.searchParams.get('filter'));

	return {
		filter,
		notes: await listNoteArchiveEvents(pb, user.id, filter)
	};
}
