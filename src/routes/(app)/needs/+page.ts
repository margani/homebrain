import { listNeeds, listUserThings } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();
	const [needs, things] = await Promise.all([
		listNeeds(pb, user.id),
		listUserThings(pb, user.id, 0)
	]);

	return {
		needs,
		things
	};
}
