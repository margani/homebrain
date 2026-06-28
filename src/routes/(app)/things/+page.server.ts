import { listThings } from '$lib/pocketbase/data';

export async function load({ locals }) {
	return {
		things: await listThings(locals.pb)
	};
}
