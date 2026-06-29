import { fail } from '@sveltejs/kit';
import {
	completeRoutine,
	createQuickCaptureNote,
	listDueSoonRoutines,
	listLowStockThings,
	listRecentNoteEvents
} from '$lib/pocketbase/data';
import { timeAction } from '$lib/server/timing';
import type { Actions } from './$types';

export async function load({ locals }) {
	const [dueSoon, lowStock, recentNotes] = await Promise.all([
		listDueSoonRoutines(locals.pb),
		listLowStockThings(locals.pb),
		listRecentNoteEvents(locals.pb)
	]);

	return {
		dueSoon,
		lowStock,
		recentNotes
	};
}

export const actions = {
	capture: async ({ locals, request }) =>
		timeAction('today.capture', async () => {
			const formData = await request.formData();
			const text = String(formData.get('text') ?? '').trim();

			if (!locals.user) {
				return fail(401, { captureError: 'Sign in again before saving a note.' });
			}

			if (!text) {
				return fail(400, { captureError: 'Add a note before saving.' });
			}

			let note;
			try {
				note = await createQuickCaptureNote(locals.pb, locals.user.id, text);
			} catch {
				return fail(500, { captureError: 'The note could not be saved.' });
			}

			return { captureSaved: true, note };
		}),
	done: async ({ locals, request }) =>
		timeAction('today.routine_done', async () => {
			if (!locals.user) {
				return fail(401, { doneError: 'Sign in again before updating a routine.' });
			}

			const formData = await request.formData();
			const routineId = String(formData.get('routine_id') ?? '').trim();

			if (!routineId) {
				return fail(400, { doneError: 'Choose a routine to mark done.' });
			}

			let routine;
			try {
				routine = await completeRoutine(locals.pb, locals.user.id, routineId);
			} catch {
				return fail(500, { doneError: 'The routine could not be marked done.' });
			}

			return { doneSaved: true, routineId, routine };
		})
} satisfies Actions;
