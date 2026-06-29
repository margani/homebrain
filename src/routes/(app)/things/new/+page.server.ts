import { fail, redirect } from '@sveltejs/kit';
import { createLocation, createThing, listLocations } from '$lib/pocketbase/data';
import { parseThingFormData } from '$lib/pocketbase/forms';
import { timeAction } from '$lib/server/timing';
import type { Actions } from './$types';

export async function load({ locals }) {
	return {
		locations: await listLocations(locals.pb)
	};
}

export const actions = {
	default: async ({ locals, request }) =>
		timeAction('things.create', async () => {
			if (!locals.user) {
				return fail(401, { thingError: 'Sign in again before saving.' });
			}

			const parsed = parseThingFormData(await request.formData());
			if (parsed.error) {
				return fail(400, { thingError: parsed.error, values: parsed.values });
			}

			let thing;
			try {
				if (parsed.newLocation) {
					const location = await createLocation(locals.pb, locals.user.id, parsed.newLocation);
					parsed.thing.location = location.id;
				}

				thing = await createThing(locals.pb, locals.user.id, parsed.thing);
			} catch {
				return fail(500, {
					thingError: 'The thing could not be saved.',
					values: parsed.values
				});
			}

			redirect(303, `/things/${thing.id}`);
		})
} satisfies Actions;
