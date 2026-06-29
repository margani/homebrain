import { listNoteArchiveEvents, noteArchiveFilters, type NoteArchiveFilter } from '$lib/pocketbase/data';

function parseFilter(value: string | null): NoteArchiveFilter {
	if (noteArchiveFilters.includes(value as NoteArchiveFilter)) {
		return value as NoteArchiveFilter;
	}

	return 'all';
}

export async function load({ locals, url }) {
	const filter = parseFilter(url.searchParams.get('filter'));

	return {
		filter,
		notes: locals.user ? await listNoteArchiveEvents(locals.pb, locals.user.id, filter) : []
	};
}
