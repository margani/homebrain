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
import { loadUserAndPb } from '$lib/pocketbase/load';

export async function load() {
	const { pb, user } = await loadUserAndPb();
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
		countReviewInboxNotes(pb, user.id),
		listDashboardRecentNotes(pb, user.id),
		listRecentlyLinkedMemoryEvents(pb, user.id),
		listActiveThingSummaries(pb, user.id),
		listDashboardDueRoutines(pb, user.id),
		listDashboardBuyList(pb, user.id),
		listTodayPromptAnswers(pb, user.id, dateKey)
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
