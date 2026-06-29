import { listLocations } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();

	return {
		locations: await listLocations(pb, user.id)
	};
}
