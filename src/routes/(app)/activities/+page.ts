import { listActivityEvents } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();

	return {
		activities: await listActivityEvents(pb, user.id)
	};
}
