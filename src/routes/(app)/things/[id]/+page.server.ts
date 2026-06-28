import { error } from '@sveltejs/kit';
import { getThing } from '$lib/pocketbase/data';

export async function load({ locals, params }) {
	try {
		return {
			thing: await getThing(locals.pb, params.id)
		};
	} catch {
		error(404, 'Thing not found.');
	}
}
