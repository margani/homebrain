import { searchHomeBrain } from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load({ url }) {
	const { pb, user } = await loadUserAndPb();
	const q = url.searchParams.get('q')?.trim() ?? '';

	return {
		q,
		results: await searchHomeBrain(pb, user.id, q)
	};
}
