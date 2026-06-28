import { fail } from '@sveltejs/kit';
import {
	createQuickCaptureNote,
	listDueSoonRoutines,
	listLowStockThings,
	listRecentNoteEvents
} from '$lib/pocketbase/data';
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
	capture: async ({ locals, request }) => {
		const formData = await request.formData();
		const text = String(formData.get('text') ?? '').trim();

		if (!locals.user) {
			return fail(401, { captureError: 'Sign in again before saving a note.' });
		}

		if (!text) {
			return fail(400, { captureError: 'Add a note before saving.' });
		}

		try {
			await createQuickCaptureNote(locals.pb, locals.user.id, text);
		} catch {
			return fail(500, { captureError: 'The note could not be saved.' });
		}

		return { captureSaved: true };
	}
} satisfies Actions;
