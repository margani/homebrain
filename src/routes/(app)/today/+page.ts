import {
	listDueSoonRoutines,
	listLowStockThings,
	listRecentNoteEvents
} from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();

	const [dueSoon, lowStock, recentNotes] = await Promise.all([
		listDueSoonRoutines(pb, user.id),
		listLowStockThings(pb, user.id),
		listRecentNoteEvents(pb, user.id)
	]);

	return {
		user,
		dueSoon,
		lowStock,
		recentNotes
	};
}
