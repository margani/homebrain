import { listMetricEvents, listUserThings } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();
	const [metricEvents, things] = await Promise.all([
		listMetricEvents(pb, user.id),
		listUserThings(pb, user.id, 0)
	]);

	return {
		metricEvents,
		things
	};
}
