import { fail } from '@sveltejs/kit';
import {
	addNoteEventToBuyList,
	createRoutineFromNoteEvent,
	createThingFromNoteEvent,
	linkMemoryEventToThing,
	listUnreviewedNoteEvents,
	listUserThings,
	logNoteEventAsActivity,
	markNoteEventReviewed
} from '$lib/pocketbase/data';
import {
	activityTypeOptions,
	thingStatusOptions,
	thingTypeOptions,
	type ActivityType,
	type ThingStatus,
	type ThingType
} from '$lib/pocketbase/types';
import { timeAction } from '$lib/server/timing';
import type { Actions } from './$types';

export async function load({ locals }) {
	return {
		inboxItems: locals.user ? await listUnreviewedNoteEvents(locals.pb, locals.user.id) : [],
		things: locals.user ? await listUserThings(locals.pb, locals.user.id) : []
	};
}

function eventId(formData: FormData) {
	return String(formData.get('event_id') ?? '').trim();
}

function requireEventId(formData: FormData) {
	const id = eventId(formData);
	if (!id) return null;

	return id;
}

export const actions = {
	dismiss: async ({ locals, request }) =>
		timeAction('inbox.dismiss', async () => {
			const id = requireEventId(await request.formData());
			if (!locals.user) return fail(401, { inboxError: 'Sign in again before updating inbox.' });
			if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

			try {
				await markNoteEventReviewed(locals.pb, locals.user.id, id, { dismissed: true });
			} catch {
				return fail(500, { inboxError: 'The item could not be dismissed.' });
			}

			return { inboxSaved: true, eventId: id, message: 'Dismissed' };
		}),
	reviewed: async ({ locals, request }) =>
		timeAction('inbox.reviewed', async () => {
			const id = requireEventId(await request.formData());
			if (!locals.user) return fail(401, { inboxError: 'Sign in again before updating inbox.' });
			if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

			try {
				await markNoteEventReviewed(locals.pb, locals.user.id, id);
			} catch {
				return fail(500, { inboxError: 'The item could not be marked reviewed.' });
			}

			return { inboxSaved: true, eventId: id, message: 'Marked reviewed' };
		}),
	thing: async ({ locals, request }) =>
		timeAction('inbox.link_thing', async () => {
			const formData = await request.formData();
			const id = requireEventId(formData);
			if (!locals.user) return fail(401, { inboxError: 'Sign in again before linking.' });
			if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

			const thingId = String(formData.get('thing_id') ?? '').trim();
			if (thingId) {
				try {
					await linkMemoryEventToThing(locals.pb, locals.user.id, id, thingId);
				} catch {
					return fail(500, { inboxError: 'The item could not be linked to that thing.' });
				}

				return { inboxSaved: true, eventId: id, message: 'Linked to thing' };
			}

			const typeValue = String(formData.get('type') ?? 'other');
			const statusValue = String(formData.get('status') ?? 'unknown');
			const type = thingTypeOptions.includes(typeValue as ThingType) ? (typeValue as ThingType) : 'other';
			const status = thingStatusOptions.includes(statusValue as ThingStatus)
				? (statusValue as ThingStatus)
				: 'unknown';

			try {
				await createThingFromNoteEvent(locals.pb, locals.user.id, id, type, status);
			} catch {
				return fail(500, { inboxError: 'The item could not be saved as a thing.' });
			}

			return { inboxSaved: true, eventId: id, message: 'Saved as thing' };
		}),
	routine: async ({ locals, request }) =>
		timeAction('inbox.create_routine', async () => {
			const formData = await request.formData();
			const id = requireEventId(formData);
			if (!locals.user) return fail(401, { inboxError: 'Sign in again before creating a routine.' });
			if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

			const routineName = String(formData.get('routine_name') ?? '').trim();
			if (formData.has('routine_name') && !routineName) {
				return fail(400, { inboxError: 'Routine name is required.', eventId: id });
			}

			const intervalValue = String(formData.get('interval_days') ?? '').trim();
			const intervalDays = intervalValue ? Number(intervalValue) : undefined;
			if (formData.has('interval_days') && !intervalValue) {
				return fail(400, { inboxError: 'Interval days is required.', eventId: id });
			}
			if (intervalValue && (!Number.isInteger(intervalDays) || Number(intervalDays) <= 0)) {
				return fail(400, { inboxError: 'Interval days must be a positive whole number.', eventId: id });
			}

			try {
				await createRoutineFromNoteEvent(
					locals.pb,
					locals.user.id,
					id,
					intervalDays,
					routineName || undefined
				);
			} catch {
				return fail(500, { inboxError: 'The routine could not be created.' });
			}

			return { inboxSaved: true, eventId: id, message: 'Created routine' };
		}),
	shopping: async ({ locals, request }) =>
		timeAction('inbox.add_to_buy_list', async () => {
			const formData = await request.formData();
			const id = requireEventId(formData);
			if (!locals.user) return fail(401, { inboxError: 'Sign in again before adding to the buy list.' });
			if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

			const itemName = String(formData.get('item_name') ?? '').trim();
			if (formData.has('item_name') && !itemName) {
				return fail(400, { inboxError: 'Item name is required.', eventId: id });
			}
			const quantityText = String(formData.get('quantity_text') ?? '').trim();

			try {
				await addNoteEventToBuyList(locals.pb, locals.user.id, id, {
					...(itemName ? { name: itemName } : {}),
					...(quantityText ? { quantity_text: quantityText } : {})
				});
			} catch {
				return fail(500, { inboxError: 'The item could not be added to the buy list.' });
			}

			return { inboxSaved: true, eventId: id, message: 'Added to buy list' };
		}),
	activity: async ({ locals, request }) =>
		timeAction('inbox.log_activity', async () => {
			const formData = await request.formData();
			const id = requireEventId(formData);
			if (!locals.user) return fail(401, { inboxError: 'Sign in again before logging activity.' });
			if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

			const activityTypeValue = String(formData.get('activity_type') ?? 'other');
			if (!activityTypeOptions.includes(activityTypeValue as ActivityType)) {
				return fail(400, { inboxError: 'Choose a valid activity type.', eventId: id });
			}

			const durationValue = String(formData.get('duration_minutes') ?? '').trim();
			const durationMinutes = Number(durationValue);
			if (
				!durationValue ||
				!Number.isInteger(durationMinutes) ||
				Number(durationMinutes) <= 0
			) {
				return fail(400, {
					inboxError: 'Duration minutes must be a positive whole number.',
					eventId: id
				});
			}

			const notes = String(formData.get('notes') ?? '').trim();

			try {
				await logNoteEventAsActivity(locals.pb, locals.user.id, id, {
					activity_type: activityTypeValue as ActivityType,
					duration_minutes: durationMinutes,
					...(notes ? { notes } : {})
				});
			} catch {
				return fail(500, { inboxError: 'The item could not be logged as an activity.' });
			}

			return { inboxSaved: true, eventId: id, message: 'Logged as activity' };
		})
} satisfies Actions;
