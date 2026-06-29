import { error, fail } from '@sveltejs/kit';
import {
	getNoteArchiveEvent,
	linkMemoryEventToThing,
	listUserThings,
	setNoteEventReviewState,
	type NoteReviewState
} from '$lib/pocketbase/data';
import type { Actions } from './$types';

const reviewStates: NoteReviewState[] = ['new', 'reviewed', 'dismissed'];

export async function load({ locals, params }) {
	if (!locals.user) {
		error(401, 'Sign in again before viewing notes.');
	}

	try {
		const [note, things] = await Promise.all([
			getNoteArchiveEvent(locals.pb, locals.user.id, params.id),
			listUserThings(locals.pb, locals.user.id)
		]);

		return {
			note,
			things
		};
	} catch {
		error(404, 'Note not found.');
	}
}

export const actions = {
	reviewState: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { noteError: 'Sign in again before updating this note.' });
		}

		const formData = await request.formData();
		const stateValue = String(formData.get('state') ?? '');
		if (!reviewStates.includes(stateValue as NoteReviewState)) {
			return fail(400, { noteError: 'Choose a valid review state.' });
		}

		try {
			await setNoteEventReviewState(locals.pb, locals.user.id, params.id, stateValue as NoteReviewState);
		} catch {
			return fail(500, { noteError: 'The note review state could not be updated.' });
		}

		return { noteSaved: true, message: 'Review state updated' };
	},
	linkThing: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { noteError: 'Sign in again before linking this record.' });
		}

		const formData = await request.formData();
		const thingId = String(formData.get('thing_id') ?? '').trim();
		if (!thingId) {
			return fail(400, { noteError: 'Choose a thing to link.' });
		}

		try {
			await linkMemoryEventToThing(locals.pb, locals.user.id, params.id, thingId);
		} catch {
			return fail(500, { noteError: 'The record could not be linked to that thing.' });
		}

		return { noteSaved: true, message: 'Linked to thing' };
	}
} satisfies Actions;
