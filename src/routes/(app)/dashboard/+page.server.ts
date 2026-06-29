import {
	countReviewInboxNotes,
	listActiveThingSummaries,
	listDashboardBuyList,
	listDashboardDueRoutines,
	listDashboardRecentNotes,
	listRecentlyLinkedMemoryEvents,
	listTodayPromptAnswers,
	localDateKey
} from '$lib/pocketbase/data';

export async function load({ locals }) {
	const userId = locals.user!.id;
	const dateKey = localDateKey();

	const [
		inboxCount,
		recentNotes,
		recentlyLinked,
		activeThings,
		dueRoutines,
		buyList,
		reflectionAnswers
	] = await Promise.all([
		countReviewInboxNotes(locals.pb, userId),
		listDashboardRecentNotes(locals.pb, userId),
		listRecentlyLinkedMemoryEvents(locals.pb, userId),
		listActiveThingSummaries(locals.pb, userId),
		listDashboardDueRoutines(locals.pb, userId),
		listDashboardBuyList(locals.pb, userId),
		listTodayPromptAnswers(locals.pb, userId, dateKey)
	]);

	const answeredPromptCount = reflectionAnswers.filter((answer) => answer.answer?.trim()).length;

	return {
		inboxCount,
		recentNotes,
		recentlyLinked,
		activeThings,
		dueRoutines,
		buyList,
		reflection: {
			dateKey,
			hasAnswers: reflectionAnswers.length > 0,
			answeredPromptCount
		}
	};
}
