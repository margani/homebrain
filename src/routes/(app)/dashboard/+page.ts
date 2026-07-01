import {
	getCachedInboxCount,
	listActiveThingSummaries,
	listDashboardDueRoutines,
	listDashboardNeeds,
	listDashboardRecentNotes,
	listRecentlyLinkedMemoryEvents,
	listTodayPromptAnswers,
	localDateKey,
	seedInboxCountCache
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
		needs,
		reflectionAnswers
	] = await Promise.all([
		getCachedInboxCount(pb, user.id),
		listDashboardRecentNotes(pb, user.id),
		listRecentlyLinkedMemoryEvents(pb, user.id),
		listActiveThingSummaries(pb, user.id),
		listDashboardDueRoutines(pb, user.id),
		listDashboardNeeds(pb, user.id),
		listTodayPromptAnswers(pb, user.id, dateKey)
	]);

	const answeredPromptCount = reflectionAnswers.filter((answer) => answer.answer?.trim()).length;
	seedInboxCountCache(user.id, inboxCount);

	return {
		inboxCount,
		recentNotes,
		recentlyLinked,
		activeThings,
		dueRoutines,
		needs,
		reflection: {
			dateKey,
			hasAnswers: reflectionAnswers.length > 0,
			answeredPromptCount
		}
	};
}
