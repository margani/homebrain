import { searchHomeBrain } from '$lib/pocketbase/data';

export async function load({ locals, url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';

	return {
		q,
		results: await searchHomeBrain(locals.pb, q)
	};
}
