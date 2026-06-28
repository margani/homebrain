import { fail } from '@sveltejs/kit';
import {
	convertNoteEventToRoutine,
	convertNoteEventToShopping,
	convertNoteEventToThing,
	listUnprocessedNoteEvents,
	markNoteEventProcessed
} from '$lib/pocketbase/data';
import { thingStatusOptions, thingTypeOptions, type ThingStatus, type ThingType } from '$lib/pocketbase/types';
import type { Actions } from './$types';

export async function load({ locals }) {
	return {
		inboxItems: locals.user ? await listUnprocessedNoteEvents(locals.pb, locals.user.id) : []
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
	processed: async ({ locals, request }) => {
		const id = requireEventId(await request.formData());
		if (!locals.user) return fail(401, { inboxError: 'Sign in again before updating inbox.' });
		if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

		try {
			await markNoteEventProcessed(locals.pb, locals.user.id, id);
		} catch {
			return fail(500, { inboxError: 'The item could not be marked processed.' });
		}

		return { inboxSaved: true, eventId: id, message: 'Marked processed' };
	},
	dismiss: async ({ locals, request }) => {
		const id = requireEventId(await request.formData());
		if (!locals.user) return fail(401, { inboxError: 'Sign in again before updating inbox.' });
		if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

		try {
			await markNoteEventProcessed(locals.pb, locals.user.id, id, { dismissed: true });
		} catch {
			return fail(500, { inboxError: 'The item could not be dismissed.' });
		}

		return { inboxSaved: true, eventId: id, message: 'Dismissed' };
	},
	thing: async ({ locals, request }) => {
		const formData = await request.formData();
		const id = requireEventId(formData);
		if (!locals.user) return fail(401, { inboxError: 'Sign in again before converting.' });
		if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

		const typeValue = String(formData.get('type') ?? 'other');
		const statusValue = String(formData.get('status') ?? 'unknown');
		const type = thingTypeOptions.includes(typeValue as ThingType) ? (typeValue as ThingType) : 'other';
		const status = thingStatusOptions.includes(statusValue as ThingStatus)
			? (statusValue as ThingStatus)
			: 'unknown';

		try {
			await convertNoteEventToThing(locals.pb, locals.user.id, id, type, status);
		} catch {
			return fail(500, { inboxError: 'The item could not be converted to a thing.' });
		}

		return { inboxSaved: true, eventId: id, message: 'Converted to thing' };
	},
	routine: async ({ locals, request }) => {
		const formData = await request.formData();
		const id = requireEventId(formData);
		if (!locals.user) return fail(401, { inboxError: 'Sign in again before converting.' });
		if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

		const intervalValue = String(formData.get('interval_days') ?? '').trim();
		const intervalDays = intervalValue ? Number(intervalValue) : undefined;
		if (intervalValue && (!Number.isInteger(intervalDays) || Number(intervalDays) <= 0)) {
			return fail(400, { inboxError: 'Interval days must be a positive whole number.', eventId: id });
		}

		try {
			await convertNoteEventToRoutine(locals.pb, locals.user.id, id, intervalDays);
		} catch {
			return fail(500, { inboxError: 'The item could not be converted to a routine.' });
		}

		return { inboxSaved: true, eventId: id, message: 'Converted to routine' };
	},
	shopping: async ({ locals, request }) => {
		const id = requireEventId(await request.formData());
		if (!locals.user) return fail(401, { inboxError: 'Sign in again before converting.' });
		if (!id) return fail(400, { inboxError: 'Choose an inbox item first.' });

		try {
			await convertNoteEventToShopping(locals.pb, locals.user.id, id);
		} catch {
			return fail(500, { inboxError: 'The item could not be converted to low stock.' });
		}

		return { inboxSaved: true, eventId: id, message: 'Added to low stock' };
	}
} satisfies Actions;
