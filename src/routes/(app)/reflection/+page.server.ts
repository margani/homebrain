import { fail } from '@sveltejs/kit';
import {
	listReflectionPrompts,
	listTodayPromptAnswers,
	localDateKey,
	upsertPromptAnswer
} from '$lib/pocketbase/data';
import type { Actions } from './$types';

export async function load({ locals }) {
	const userId = locals.user?.id;

	if (!userId) {
		return {
			dateKey: localDateKey(),
			prompts: [],
			answers: []
		};
	}

	const dateKey = localDateKey();
	const [prompts, answers] = await Promise.all([
		listReflectionPrompts(locals.pb, userId),
		listTodayPromptAnswers(locals.pb, userId, dateKey)
	]);

	return {
		dateKey,
		prompts,
		answers
	};
}

export const actions = {
	save: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { reflectionError: 'Sign in again before saving.' });
		}

		const formData = await request.formData();
		const promptId = String(formData.get('prompt') ?? '').trim();
		const answer = String(formData.get('answer') ?? '');
		const dateKey = String(formData.get('date') ?? localDateKey()).trim() || localDateKey();

		if (!promptId) {
			return fail(400, { reflectionError: 'Choose a question before saving.' });
		}

		try {
			await upsertPromptAnswer(locals.pb, locals.user.id, promptId, answer, dateKey);
		} catch {
			return fail(500, { reflectionError: 'The answer could not be saved.' });
		}

		return { reflectionSaved: true, promptId };
	}
} satisfies Actions;
