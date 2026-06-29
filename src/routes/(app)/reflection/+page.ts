import {
	listReflectionPrompts,
	listTodayPromptAnswers,
	localDateKey
} from '$lib/pocketbase/data';
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();
	const dateKey = localDateKey();
	const [prompts, answers] = await Promise.all([
		listReflectionPrompts(pb, user.id),
		listTodayPromptAnswers(pb, user.id, dateKey)
	]);

	return {
		dateKey,
		prompts,
		answers
	};
}
