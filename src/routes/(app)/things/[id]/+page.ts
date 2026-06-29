import { error } from '@sveltejs/kit';
import { getThing, listLocations, listThingMemoryEvents } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load({ params }) {
	const { pb, user } = await loadUserAndPb();

	try {
		const [thing, locations, relatedEvents] = await Promise.all([
			getThing(pb, params.id, user.id),
			listLocations(pb, user.id),
			listThingMemoryEvents(pb, user.id, params.id)
		]);

		return {
			thing,
			locations,
			relatedEvents
		};
	} catch {
		error(404, 'Thing not found.');
	}
}
