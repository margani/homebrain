import { error, fail } from '@sveltejs/kit';
import {
	createLocation,
	getThing,
	listLocations,
	listThingMemoryEvents,
	updateThing
} from '$lib/pocketbase/data';
import { parseThingFormData } from '$lib/pocketbase/forms';
import { timeAction } from '$lib/server/timing';
import type { Actions } from './$types';

export async function load({ locals, params }) {
	try {
		const [thing, locations, relatedEvents] = await Promise.all([
			getThing(locals.pb, params.id),
			listLocations(locals.pb),
			locals.user ? listThingMemoryEvents(locals.pb, locals.user.id, params.id) : []
		]);

		return {
			thing,
			locations,
			relatedEvents
		};
	} catch {
		error(404, 'Thing not found.');
	}
}

export const actions = {
	default: async ({ locals, params, request }) =>
		timeAction('things.edit', async () => {
			if (!locals.user) {
				return fail(401, { thingError: 'Sign in again before saving.' });
			}

			const parsed = parseThingFormData(await request.formData());
			if (parsed.error) {
				return fail(400, { thingError: parsed.error, values: parsed.values });
			}

			let location;
			let thing;
			try {
				if (parsed.newLocation) {
					location = await createLocation(locals.pb, locals.user.id, parsed.newLocation);
					parsed.thing.location = location.id;
				}

				thing = await updateThing(locals.pb, params.id, parsed.thing);
			} catch {
				return fail(500, {
					thingError: 'The thing could not be saved.',
					values: parsed.values
				});
			}

			return { thingSaved: true, thing, location };
		})
} satisfies Actions;
