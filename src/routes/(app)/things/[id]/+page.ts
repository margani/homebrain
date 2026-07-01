import { error } from '@sveltejs/kit';
import { getThing, listLocations, listThingMemoryEvents, listThingMetricEvents } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load({ params }) {
	const { pb, user } = await loadUserAndPb();

	try {
		const [thing, locations, relatedEvents, metricEvents] = await Promise.all([
			getThing(pb, params.id, user.id),
			listLocations(pb, user.id),
			listThingMemoryEvents(pb, user.id, params.id),
			listThingMetricEvents(pb, user.id, params.id)
		]);

		return {
			thing,
			locations,
			relatedEvents,
			metricEvents
		};
	} catch {
		error(404, 'Thing not found.');
	}
}
