import type PocketBase from 'pocketbase';
import { writable } from 'svelte/store';
import { firstNonEmptyLine } from './format';
import type {
	ActivityType,
	EventRecord,
	JsonValue,
	LocationRecord,
	PromptAnswerRecord,
	PromptRecord,
	RoutineRecord,
	ThingRecord,
	ThingStatus,
	ThingType
} from './types';
import { isNeedsStatus } from './things';

export interface ThingInput {
	name: string;
	type: ThingType;
	status?: ThingStatus | '';
	category?: string;
	location?: string;
	notes?: string;
	metadata?: JsonValue;
}

export interface MetricObservationInput {
	thingId?: string;
	thingName?: string;
	category?: string;
	value: number;
	unit: string;
	happened_at?: string;
	label?: string;
	notes?: string;
}

export interface LocationInput {
	name: string;
	path?: string;
	notes?: string;
}

export interface RoutineInput {
	name: string;
	thing?: string;
	interval_days?: number;
	next_due_at?: string;
	active?: boolean;
	metadata?: JsonValue;
}

export interface ActivityLogInput {
	activity_type: ActivityType;
	duration_minutes: number;
	notes?: string;
}

export interface ReviewNoteInput {
	title: string;
	notes?: string;
	category?: string;
}

export interface ReviewActivityInput {
	title: string;
	happened_at?: string;
	category?: string;
	notes?: string;
}

export interface NeedConversionInput {
	name?: string;
	status?: 'needed' | 'low' | 'empty';
	category?: string;
	notes?: string;
	topicId?: string;
}

export const noteArchiveFilters = [
	'all',
	'new',
	'reviewed',
	'dismissed',
	'linked',
	'activity'
] as const;

export type NoteArchiveFilter = (typeof noteArchiveFilters)[number];
export type NoteReviewState = 'new' | 'reviewed' | 'dismissed';
export type ReviewTargetType = 'notes' | 'activities' | 'needs' | 'things' | 'metrics';

export interface ActiveThingSummary {
	id: string;
	name: string;
	type: ThingType;
	status?: ThingStatus;
	category?: string;
	linkedEventCount: number;
	latestActivity: string;
}

const shortCacheTtlMs = 30_000;

interface CacheEntry<T> {
	userId: string;
	value: T;
	updatedAt: number;
}

export const sharedInboxCount = writable<number | null>(null);

let inboxCountCache: CacheEntry<number> | null = null;
let thingsCache: CacheEntry<ThingRecord[]> | null = null;
let noteArchiveCache: CacheEntry<EventRecord[]> | null = null;

function isFreshCache<T>(cache: CacheEntry<T> | null, userId: string) {
	return Boolean(
		cache && cache.userId === userId && Date.now() - cache.updatedAt < shortCacheTtlMs
	);
}

export function seedInboxCountCache(userId: string, count: number) {
	inboxCountCache = { userId, value: count, updatedAt: Date.now() };
	sharedInboxCount.set(count);
}

export function invalidateInboxCountCache() {
	inboxCountCache = null;
	sharedInboxCount.set(null);
}

export function invalidateThingsCache() {
	thingsCache = null;
}

export function invalidateNoteArchiveCache() {
	noteArchiveCache = null;
	// Reviewed/activity changes affect both the archive pages and the sidebar inbox badge.
	invalidateInboxCountCache();
}

const reflectionPromptTypes = [
	'daily_reflection',
	'mood',
	'task_capture',
	'shopping',
	'custom'
] as const;

export function localDateKey(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

export function recordMetadata(record: { metadata?: JsonValue }) {
	if (record.metadata && !Array.isArray(record.metadata) && typeof record.metadata === 'object') {
		return record.metadata;
	}

	return {};
}

function recentCutoffIso(days: number) {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function eventActivityDate(event: EventRecord) {
	return event.happened_at || event.updated || event.created;
}

function groupActiveThingEvents(events: EventRecord[]) {
	const summaries = new Map<string, ActiveThingSummary>();

	for (const event of events) {
		const thing = event.expand?.thing;
		if (!thing) continue;

		const latestActivity = eventActivityDate(event);
		const existing = summaries.get(thing.id);

		if (!existing) {
			summaries.set(thing.id, {
					id: thing.id,
					name: thing.name,
					type: thing.type,
					status: thing.status,
					category: thing.category,
					linkedEventCount: 1,
					latestActivity
			});
			continue;
		}

		existing.linkedEventCount += 1;
		if (new Date(latestActivity).getTime() > new Date(existing.latestActivity).getTime()) {
			existing.latestActivity = latestActivity;
		}
	}

	return [...summaries.values()].sort(
		(a, b) => new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime()
	);
}

function noteEventName(event: EventRecord) {
	return event.title || firstNonEmptyLine(event.notes ?? '') || 'Untitled capture';
}

function reviewMetadata(
	event: EventRecord,
	status: 'completed' | 'dismissed',
	target?: { type: ReviewTargetType; id: string },
	extra: Record<string, JsonValue> = {}
) {
	const metadata: Record<string, JsonValue> = {
		...recordMetadata(event),
		reviewed: true,
		reviewStatus: status,
		reviewedAt: new Date().toISOString(),
		...extra
	};
	delete metadata.processed;

	if (status === 'dismissed') {
		metadata.dismissed = true;
	}

	if (target) {
		metadata.reviewTargetType = target.type;
		metadata.reviewTargetId = target.id;
	}

	return metadata;
}

function isNoteArchiveEvent(event: EventRecord) {
	return event.event_type === 'note' || event.event_type === 'activity';
}

export function isNewNoteArchiveEvent(event: EventRecord) {
	const metadata = recordMetadata(event);
	return (
		metadata.reviewed !== true &&
		metadata.processed !== true &&
		metadata.dismissed !== true &&
		metadata.reviewStatus !== 'completed' &&
		metadata.reviewStatus !== 'dismissed'
	);
}

export function isReviewedNoteArchiveEvent(event: EventRecord) {
	const metadata = recordMetadata(event);
	return (metadata.reviewed === true || metadata.processed === true) && metadata.dismissed !== true;
}

export function isDismissedNoteArchiveEvent(event: EventRecord) {
	return recordMetadata(event).dismissed === true;
}

export function isLinkedNoteArchiveEvent(event: EventRecord) {
	return Boolean(event.thing);
}

export function isActivityNoteArchiveEvent(event: EventRecord) {
	const metadata = recordMetadata(event);
	return event.event_type === 'activity' || typeof metadata.activity_type === 'string';
}

export function activityMetadataFor(event: EventRecord) {
	const metadata = recordMetadata(event);

	return {
		activity_type: typeof metadata.activity_type === 'string' ? metadata.activity_type : '',
		duration_minutes:
			typeof metadata.duration_minutes === 'number' ? metadata.duration_minutes : undefined
	};
}

export function metricMetadataFor(event: EventRecord) {
	const metadata = recordMetadata(event);
	const rawValue = metadata.metric_value;
	const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);

	return {
		metric_value: Number.isFinite(value) ? value : undefined,
		metric_unit: typeof metadata.metric_unit === 'string' ? metadata.metric_unit : '',
		metric_label: typeof metadata.metric_label === 'string' ? metadata.metric_label : ''
	};
}

export function metricEventSummary(event: EventRecord) {
	const metric = metricMetadataFor(event);
	if (metric.metric_value === undefined || !metric.metric_unit) return event.title || '';

	return `${metric.metric_label || event.expand?.thing?.name || 'Measurement'}: ${metric.metric_value} ${metric.metric_unit}`;
}

function matchesNoteArchiveFilter(event: EventRecord, filter: NoteArchiveFilter) {
	if (filter === 'new') return isNewNoteArchiveEvent(event);
	if (filter === 'reviewed') return isReviewedNoteArchiveEvent(event);
	if (filter === 'dismissed') return isDismissedNoteArchiveEvent(event);
	if (filter === 'linked') return isLinkedNoteArchiveEvent(event);
	if (filter === 'activity') return isActivityNoteArchiveEvent(event);

	return true;
}

function nextDueFromInterval(intervalDays?: number) {
	const days = Number(intervalDays);
	if (!Number.isFinite(days) || days <= 0) return new Date().toISOString();

	return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function listDueSoonRoutines(pb: PocketBase, userId: string, limit = 6) {
	try {
		const result = await pb.collection('routines').getList<RoutineRecord>(1, limit, {
			filter: pb.filter('user = {:userId} && active = true && next_due_at != ""', { userId }),
			sort: 'next_due_at',
			expand: 'thing'
		});

		return result.items;
	} catch {
		const result = await pb.collection('routines').getList<RoutineRecord>(1, Math.max(limit, 50), {
			filter: pb.filter('user = {:userId} && active = true', { userId }),
			sort: 'next_due_at',
			expand: 'thing'
		});

		return result.items.filter((routine) => Boolean(routine.next_due_at)).slice(0, limit);
	}
}

export async function listLowStockThings(pb: PocketBase, userId: string, limit = 6) {
	const result = await pb.collection('things').getList<ThingRecord>(1, limit, {
		filter: pb.filter('user = {:userId} && type = "inventory" && (status = "needed" || status = "low" || status = "empty" || status = "missing")', { userId }),
		sort: 'status,name',
		expand: 'location'
	});

	return result.items;
}

export async function listNeeds(pb: PocketBase, userId: string, limit = 200) {
	try {
		const result = await pb.collection('things').getList<ThingRecord>(1, limit, {
			filter: pb.filter(
				'user = {:userId} && type = "inventory" && (status = "needed" || status = "low" || status = "empty" || status = "missing")',
				{ userId }
			),
			sort: 'status,name',
			expand: 'location'
		});

		return result.items;
	} catch {
		const result = await pb.collection('things').getList<ThingRecord>(1, Math.max(limit, 200), {
			filter: pb.filter('user = {:userId} && type = "inventory"', { userId }),
			sort: 'status,name',
			expand: 'location'
		});

		return result.items.filter((thing) => isNeedsStatus(thing.status)).slice(0, limit);
	}
}

export async function listRecentNoteEvents(pb: PocketBase, userId: string, limit = 6) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter('user = {:userId} && event_type = "note"', { userId }),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return result.items;
}

export async function listRecentEvents(pb: PocketBase, userId: string, limit = 12) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter('user = {:userId}', { userId }),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return result.items;
}

export async function listNoteArchiveEvents(
	pb: PocketBase,
	userId: string,
	filter: NoteArchiveFilter = 'all'
) {
	const events = await listCachedNoteArchiveEvents(pb, userId);

	return events.filter((event) => matchesNoteArchiveFilter(event, filter));
}

export async function listCachedNoteArchiveEvents(pb: PocketBase, userId: string) {
	if (isFreshCache(noteArchiveCache, userId)) {
		return noteArchiveCache!.value;
	}

	const events = await pb.collection('events').getFullList<EventRecord>({
		filter: pb.filter('user = {:userId} && (event_type = "note" || event_type = "activity")', {
			userId
		}),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	noteArchiveCache = { userId, value: events, updatedAt: Date.now() };
	return events;
}

export async function listUnreviewedNoteEvents(pb: PocketBase, userId: string, limit = 50) {
	try {
		const result = await pb.collection('events').getList<EventRecord>(1, limit, {
			filter: pb.filter(
				'user = {:userId} && event_type = "note" && metadata.reviewed != true && metadata.processed != true && metadata.reviewStatus != "completed" && metadata.reviewStatus != "dismissed"',
				{ userId }
			),
			sort: '-happened_at,-created'
		});

		return result.items;
	} catch {
		const result = await pb.collection('events').getList<EventRecord>(1, Math.max(limit, 100), {
			filter: pb.filter('user = {:userId} && event_type = "note"', { userId }),
			sort: '-happened_at,-created'
		});

		return result.items
			.filter((event) => {
				const metadata = recordMetadata(event);
				return (
					metadata.reviewed !== true &&
					metadata.processed !== true &&
					metadata.reviewStatus !== 'completed' &&
					metadata.reviewStatus !== 'dismissed'
				);
			})
			.slice(0, limit);
	}
}

export async function getNoteArchiveEvent(pb: PocketBase, userId: string, eventId: string) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId, {
		expand: 'thing'
	});
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');
	if (!isNoteArchiveEvent(event)) throw new Error('Event is not a note archive record.');

	return event;
}

export async function countUnreviewedNoteEvents(pb: PocketBase, userId: string) {
	return await getCachedInboxCount(pb, userId);
}

export async function countReviewInboxNotes(pb: PocketBase, userId: string) {
	try {
		const result = await pb.collection('events').getList<EventRecord>(1, 1, {
			filter: pb.filter(
				'user = {:userId} && event_type = "note" && metadata.reviewed != true && metadata.processed != true && metadata.reviewStatus != "completed" && metadata.reviewStatus != "dismissed"',
				{ userId }
			)
		});

		return result.totalItems;
	} catch {
		const events = await pb.collection('events').getFullList<EventRecord>({
			filter: pb.filter('user = {:userId} && event_type = "note"', { userId }),
			sort: '-happened_at,-created'
		});

		return events.filter((event) => {
			const metadata = recordMetadata(event);
			return (
				metadata.reviewed !== true &&
				metadata.processed !== true &&
				metadata.reviewStatus !== 'completed' &&
				metadata.reviewStatus !== 'dismissed'
			);
		}).length;
	}
}

export async function getCachedInboxCount(pb: PocketBase, userId: string) {
	if (isFreshCache(inboxCountCache, userId)) {
		sharedInboxCount.set(inboxCountCache!.value);
		return inboxCountCache!.value;
	}

	const count = await countReviewInboxNotes(pb, userId);
	seedInboxCountCache(userId, count);
	return count;
}

export async function listDashboardRecentNotes(pb: PocketBase, userId: string, limit = 10) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter('user = {:userId} && event_type = "note"', { userId }),
		sort: '-happened_at,-created'
	});

	return result.items;
}

export async function listRecentlyLinkedMemoryEvents(pb: PocketBase, userId: string, limit = 10) {
	try {
		const result = await pb.collection('events').getList<EventRecord>(1, limit, {
			filter: pb.filter(
				'user = {:userId} && (event_type = "note" || event_type = "activity") && thing != ""',
				{ userId }
			),
			sort: '-updated,-happened_at,-created',
			expand: 'thing'
		});

		return result.items;
	} catch {
		const result = await pb.collection('events').getList<EventRecord>(1, Math.max(limit, 50), {
			filter: pb.filter('user = {:userId} && (event_type = "note" || event_type = "activity")', {
				userId
			}),
			sort: '-updated,-happened_at,-created',
			expand: 'thing'
		});

		return result.items.filter((event) => Boolean(event.thing)).slice(0, limit);
	}
}

export async function listActivityEvents(pb: PocketBase, userId: string, limit = 100) {
	if (limit <= 0 || limit === 100) {
		const archiveEvents = await listCachedNoteArchiveEvents(pb, userId);
		const activities = archiveEvents.filter((event) => event.event_type === 'activity');
		return limit <= 0 ? activities : activities.slice(0, limit);
	}

	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter('user = {:userId} && event_type = "activity"', { userId }),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return result.items;
}

export async function listMetricEvents(pb: PocketBase, userId: string, limit = 200) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter('user = {:userId} && event_type = "metric"', { userId }),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return result.items;
}

export async function listThingMetricEvents(
	pb: PocketBase,
	userId: string,
	thingId: string,
	limit = 50
) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter('user = {:userId} && thing = {:thingId} && event_type = "metric"', {
			userId,
			thingId
		}),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return result.items;
}

export async function listActiveThingSummaries(pb: PocketBase, userId: string, days = 30) {
	const cutoff = recentCutoffIso(days);

	try {
		const events = await pb.collection('events').getFullList<EventRecord>({
			filter: pb.filter('user = {:userId} && thing != "" && happened_at >= {:cutoff}', {
				userId,
				cutoff
			}),
			sort: '-happened_at,-created',
			expand: 'thing'
		});

		return groupActiveThingEvents(events);
	} catch {
		const events = await pb.collection('events').getFullList<EventRecord>({
			filter: pb.filter(
				'user = {:userId} && event_type = "note" && thing != "" && happened_at >= {:cutoff}',
				{ userId, cutoff }
			),
			sort: '-happened_at,-created',
			expand: 'thing'
		});

		return groupActiveThingEvents(events);
	}
}

export async function listDashboardDueRoutines(pb: PocketBase, userId: string) {
	try {
		return await pb.collection('routines').getFullList<RoutineRecord>({
			filter: pb.filter('user = {:userId} && active = true && next_due_at != ""', { userId }),
			sort: 'next_due_at',
			expand: 'thing'
		});
	} catch {
		const routines = await pb.collection('routines').getFullList<RoutineRecord>({
			filter: pb.filter('user = {:userId} && active = true', { userId }),
			sort: 'next_due_at',
			expand: 'thing'
		});

		return routines.filter((routine) => Boolean(routine.next_due_at));
	}
}

export async function listDashboardNeeds(pb: PocketBase, userId: string) {
	try {
		return await pb.collection('things').getFullList<ThingRecord>({
			filter: pb.filter(
				'user = {:userId} && type = "inventory" && (status = "needed" || status = "low" || status = "empty" || status = "missing")',
				{ userId }
			),
			sort: 'status,name'
		});
	} catch {
		const things = await pb.collection('things').getFullList<ThingRecord>({
			filter: pb.filter('user = {:userId} && type = "inventory"', { userId }),
			sort: 'status,name'
		});

		return things.filter((thing) => isNeedsStatus(thing.status));
	}
}

export async function listDashboardRecentMetricEvents(pb: PocketBase, userId: string, limit = 5) {
	return await listMetricEvents(pb, userId, limit);
}

export async function createQuickCaptureNote(pb: PocketBase, userId: string, text: string) {
	const trimmed = text.trim();
	const title = firstNonEmptyLine(trimmed) ?? 'Untitled note';

	const note = await pb.collection('events').create<EventRecord>({
		user: userId,
		event_type: 'note',
		title,
		notes: trimmed,
		happened_at: new Date().toISOString()
	});
	invalidateNoteArchiveCache();
	return note;
}

export async function markNoteEventReviewed(
	pb: PocketBase,
	userId: string,
	eventId: string,
	metadata: Record<string, JsonValue> = {}
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');
	const nextMetadata = reviewMetadata(
		event,
		metadata.dismissed === true ? 'dismissed' : 'completed',
		typeof metadata.reviewTargetType === 'string' && typeof metadata.reviewTargetId === 'string'
			? { type: metadata.reviewTargetType as ReviewTargetType, id: metadata.reviewTargetId }
			: undefined,
		metadata
	);

	const updated = await pb.collection('events').update<EventRecord>(eventId, {
		metadata: nextMetadata
	});
	invalidateNoteArchiveCache();
	return updated;
}

export async function setNoteEventReviewState(
	pb: PocketBase,
	userId: string,
	eventId: string,
	state: NoteReviewState
) {
	const event = await getNoteArchiveEvent(pb, userId, eventId);
	const metadata: Record<string, JsonValue> = {
		...recordMetadata(event)
	};
	delete metadata.processed;

	if (state === 'new') {
		metadata.reviewed = false;
		metadata.dismissed = false;
		metadata.reviewStatus = 'pending';
		delete metadata.reviewedAt;
		delete metadata.reviewTargetType;
		delete metadata.reviewTargetId;
	} else if (state === 'dismissed') {
		metadata.reviewed = true;
		metadata.dismissed = true;
		metadata.reviewStatus = 'dismissed';
		metadata.reviewedAt = new Date().toISOString();
	} else {
		metadata.reviewed = true;
		metadata.dismissed = false;
		metadata.reviewStatus = 'completed';
		metadata.reviewedAt = new Date().toISOString();
	}

	const updated = await pb.collection('events').update<EventRecord>(
		eventId,
		{ metadata },
		{ expand: 'thing' }
	);
	invalidateNoteArchiveCache();
	return updated;
}

export async function logNoteEventAsActivity(
	pb: PocketBase,
	userId: string,
	eventId: string,
	input: ActivityLogInput
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');
	if (event.event_type !== 'note') throw new Error('Only note events can be logged as activities.');

	const payload: Partial<EventRecord> = {
		event_type: 'activity',
		metadata: {
			...recordMetadata(event),
			reviewed: true,
			activity_type: input.activity_type,
			duration_minutes: input.duration_minutes
		}
	};
	if (payload.metadata && !Array.isArray(payload.metadata) && typeof payload.metadata === 'object') {
		delete payload.metadata.processed;
	}

	if (input.notes !== undefined) {
		payload.notes = input.notes;
	}

	const updated = await pb.collection('events').update<EventRecord>(eventId, payload);
	invalidateNoteArchiveCache();
	return updated;
}

export async function createNoteFromNoteEvent(
	pb: PocketBase,
	userId: string,
	eventId: string,
	input: ReviewNoteInput
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');
	if (event.event_type !== 'note') throw new Error('Only note events can become reviewed notes.');

	const title = input.title.trim() || noteEventName(event);
	const notes = input.notes?.trim() || event.notes || '';
	const note = await pb.collection('events').create<EventRecord>({
		user: userId,
		event_type: 'note',
		title,
		notes,
		happened_at: new Date().toISOString(),
		metadata: {
			reviewed: true,
			reviewStatus: 'completed',
			source_event_id: event.id,
			...(input.category?.trim() ? { category: input.category.trim() } : {})
		}
	});

	await markNoteEventReviewed(pb, userId, eventId, {
		reviewed_as: 'note',
		reviewTargetType: 'notes',
		reviewTargetId: note.id
	});

	return note;
}

export async function createActivityFromNoteEvent(
	pb: PocketBase,
	userId: string,
	eventId: string,
	input: ReviewActivityInput
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');
	if (event.event_type !== 'note') throw new Error('Only note events can become activities.');

	const title = input.title.trim() || noteEventName(event);
	const activity = await pb.collection('events').create<EventRecord>({
		user: userId,
		event_type: 'activity',
		title,
		notes: input.notes?.trim() || event.notes || '',
		happened_at: input.happened_at || new Date().toISOString(),
		metadata: {
			reviewed: true,
			reviewStatus: 'completed',
			source_event_id: event.id,
			activity_type: 'other',
			...(input.category?.trim() ? { category: input.category.trim() } : {})
		}
	});

	await markNoteEventReviewed(pb, userId, eventId, {
		reviewed_as: 'activity',
		reviewTargetType: 'activities',
		reviewTargetId: activity.id
	});

	return activity;
}

export async function completeRoutine(pb: PocketBase, userId: string, routineId: string) {
	const routine = await pb.collection('routines').getOne<RoutineRecord>(routineId);
	if (routine.user !== userId) throw new Error('Routine does not belong to the current user.');
	const now = new Date();
	const nowIso = now.toISOString();
	const intervalDays = Number(routine.interval_days);
	const routineUpdate: Partial<RoutineRecord> = {
		last_done_at: nowIso
	};

	if (Number.isFinite(intervalDays) && intervalDays > 0) {
		routineUpdate.next_due_at = new Date(
			now.getTime() + intervalDays * 24 * 60 * 60 * 1000
		).toISOString();
	}

	const [updatedRoutine] = await Promise.all([
		pb.collection('routines').update<RoutineRecord>(routineId, routineUpdate),
		pb.collection('events').create<EventRecord>({
			user: userId,
			...(routine.thing ? { thing: routine.thing } : {}),
			event_type: 'done',
			title: `Done: ${routine.name}`,
			happened_at: nowIso
		})
	]);

	return updatedRoutine;
}

export async function listThings(pb: PocketBase, limit = 50) {
	const result = await pb.collection('things').getList<ThingRecord>(1, limit, {
		sort: 'name',
		expand: 'location'
	});

	return result.items;
}

export async function listUserThings(pb: PocketBase, userId: string, limit = 200) {
	if (limit <= 0) {
		if (isFreshCache(thingsCache, userId)) {
			return thingsCache!.value;
		}

		const things = await pb.collection('things').getFullList<ThingRecord>({
			filter: pb.filter('user = {:userId}', { userId }),
			sort: 'name',
			expand: 'location'
		});
		thingsCache = { userId, value: things, updatedAt: Date.now() };
		return things;
	}

	if (isFreshCache(thingsCache, userId)) {
		return thingsCache!.value.slice(0, limit);
	}

	const result = await pb.collection('things').getList<ThingRecord>(1, limit, {
		filter: pb.filter('user = {:userId}', { userId }),
		sort: 'name',
		expand: 'location'
	});

	return result.items;
}

export async function listThingMemoryEvents(
	pb: PocketBase,
	userId: string,
	thingId: string,
	limit = 50
) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter(
			'user = {:userId} && thing = {:thingId} && (event_type = "note" || event_type = "activity")',
			{ userId, thingId }
		),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return result.items;
}

export async function listLocations(pb: PocketBase, userId: string, limit = 100) {
	const result = await pb.collection('locations').getList<LocationRecord>(1, limit, {
		filter: pb.filter('user = {:userId}', { userId }),
		sort: 'path,name'
	});

	return result.items;
}

export async function getThing(pb: PocketBase, id: string, userId?: string) {
	const thing = await pb.collection('things').getOne<ThingRecord>(id, {
		expand: 'location'
	});
	if (userId && thing.user !== userId) throw new Error('Thing does not belong to the current user.');

	return thing;
}

export async function createLocation(pb: PocketBase, userId: string, input: LocationInput) {
	return await pb.collection('locations').create<LocationRecord>({
		user: userId,
		name: input.name,
		path: input.path || '',
		notes: input.notes || ''
	});
}

function toThingPayload(userId: string | null, input: ThingInput) {
	return {
		...(userId ? { user: userId } : {}),
		name: input.name,
		type: input.type,
		status: input.status || '',
		category: input.category || '',
		location: input.location || '',
		notes: input.notes || '',
		metadata: input.metadata ?? null
	};
}

export async function createThing(pb: PocketBase, userId: string, input: ThingInput) {
	const thing = await pb.collection('things').create<ThingRecord>(toThingPayload(userId, input));
	invalidateThingsCache();
	return thing;
}

export async function updateThing(pb: PocketBase, id: string, input: ThingInput) {
	const thing = await pb.collection('things').update<ThingRecord>(id, toThingPayload(null, input), {
		expand: 'location'
	});
	invalidateThingsCache();
	return thing;
}

export async function updateThingStatus(
	pb: PocketBase,
	userId: string,
	id: string,
	status: ThingStatus
) {
	const thing = await pb.collection('things').getOne<ThingRecord>(id);
	if (thing.user !== userId) throw new Error('Thing does not belong to the current user.');

	const updated = await pb.collection('things').update<ThingRecord>(
		id,
		{ status },
		{ expand: 'location' }
	);
	invalidateThingsCache();
	return updated;
}

export async function createMetricObservation(
	pb: PocketBase,
	userId: string,
	input: MetricObservationInput
) {
	const unit = input.unit.trim();
	const value = input.value;
	const label = input.label?.trim() || input.thingName?.trim() || 'Measurement';
	if (!Number.isFinite(value)) throw new Error('Metric value must be a valid number.');
	if (!unit) throw new Error('Metric unit is required.');

	let thing: ThingRecord;
	if (input.thingId) {
		thing = await pb.collection('things').getOne<ThingRecord>(input.thingId);
		if (thing.user !== userId) throw new Error('Thing does not belong to the current user.');
	} else {
		const name = input.thingName?.trim() || label;
		if (!name) throw new Error('Metric name is required.');
		thing = await createThing(pb, userId, {
			name,
			type: 'other',
			status: 'unknown',
			category: input.category?.trim() || '',
			notes: ''
		});
	}

	const metricLabel = input.label?.trim() || thing.name;
	const event = await pb.collection('events').create<EventRecord>({
		user: userId,
		thing: thing.id,
		event_type: 'metric',
		title: `${metricLabel}: ${value} ${unit}`,
		notes: input.notes?.trim() || '',
		happened_at: input.happened_at || new Date().toISOString(),
		metadata: {
			metric_value: value,
			metric_unit: unit,
			metric_label: metricLabel
		}
	});
	invalidateNoteArchiveCache();
	return { thing, event };
}

export async function createRoutine(pb: PocketBase, userId: string, input: RoutineInput) {
	return await pb.collection('routines').create<RoutineRecord>({
		user: userId,
		name: input.name,
		thing: input.thing || '',
		interval_days: input.interval_days ?? null,
		next_due_at: input.next_due_at || '',
		active: input.active ?? true,
		metadata: input.metadata ?? null
	});
}

export async function linkMemoryEventToThing(
	pb: PocketBase,
	userId: string,
	eventId: string,
	thingId: string
) {
	const [event, thing] = await Promise.all([
		pb.collection('events').getOne<EventRecord>(eventId),
		pb.collection('things').getOne<ThingRecord>(thingId)
	]);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');
	if (!isNoteArchiveEvent(event)) throw new Error('Only note and activity events can be linked.');
	if (thing.user !== userId) throw new Error('Thing does not belong to the current user.');
	const metadata: Record<string, JsonValue> = {
		...recordMetadata(event),
		reviewed: true,
		linked_to: 'thing',
		thing_id: thingId
	};
	delete metadata.processed;

	const updated = await pb.collection('events').update<EventRecord>(eventId, {
		thing: thingId,
		metadata
	});
	invalidateNoteArchiveCache();
	return updated;
}

export async function createThingFromNoteEvent(
	pb: PocketBase,
	userId: string,
	eventId: string,
	type: ThingType = 'other',
	status: ThingStatus = 'unknown',
	category = '',
	nameOverride?: string,
	notesOverride?: string
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');

	const thing = await createThing(pb, userId, {
		name: nameOverride?.trim() || noteEventName(event),
		type,
		status,
		category,
		notes: notesOverride?.trim() || event.notes || ''
	});

	await markNoteEventReviewed(pb, userId, eventId, {
		reviewed_as: 'thing',
		thing_id: thing.id,
		reviewTargetType: 'things',
		reviewTargetId: thing.id
	});

	return thing;
}

export async function createRoutineFromNoteEvent(
	pb: PocketBase,
	userId: string,
	eventId: string,
	intervalDays?: number,
	nameOverride?: string
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');

	const name = nameOverride?.trim() || noteEventName(event);
	const thing = await createThing(pb, userId, {
		name,
		type: 'routine',
		status: 'unknown',
		notes: event.notes || ''
	});
	const routine = await createRoutine(pb, userId, {
		name,
		thing: thing.id,
		interval_days: intervalDays,
		next_due_at: nextDueFromInterval(intervalDays),
		active: true
	});

	await markNoteEventReviewed(pb, userId, eventId, {
		reviewed_as: 'routine',
		thing_id: thing.id,
		routine_id: routine.id,
		reviewTargetType: 'things',
		reviewTargetId: thing.id
	});

	return { thing, routine };
}

export async function createMetricObservationFromNoteEvent(
	pb: PocketBase,
	userId: string,
	eventId: string,
	input: MetricObservationInput
) {
	const note = await pb.collection('events').getOne<EventRecord>(eventId);
	if (note.user !== userId) throw new Error('Event does not belong to the current user.');
	if (note.event_type !== 'note') throw new Error('Only note events can become measurements.');

	const result = await createMetricObservation(pb, userId, input);
	await markNoteEventReviewed(pb, userId, eventId, {
		reviewed_as: 'metric',
		thing_id: result.thing.id,
		metric_event_id: result.event.id,
		reviewTargetType: 'metrics',
		reviewTargetId: result.event.id
	});

	return result;
}

export async function addNoteEventToNeed(
	pb: PocketBase,
	userId: string,
	eventId: string,
	input: NeedConversionInput = {}
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');

	const name = input.name?.trim() || noteEventName(event);
	const status = input.status ?? 'needed';
	const notes = input.notes?.trim() || event.notes || '';
	const existing = await pb.collection('things').getList<ThingRecord>(1, 1, {
		filter: pb.filter('user = {:userId} && type = "inventory" && name = {:name}', { userId, name }),
		sort: '-updated'
	});
	const existingThing = existing.items[0];
	const metadata = input.topicId
		? {
				...recordMetadata(existingThing ?? {}),
				topic_id: input.topicId
			}
		: existingThing?.metadata;
	const thing = existing.items[0]
			? await updateThing(pb, existingThing.id, {
				name,
					type: 'inventory',
					status,
					category: existingThing.category || '',
					location: existingThing.location || '',
					notes,
				metadata
			})
		: await createThing(pb, userId, {
				name,
				type: 'inventory',
				status,
				category: input.category || '',
				notes,
				metadata
			});

	await markNoteEventReviewed(pb, userId, eventId, {
		reviewed_as: 'need',
		thing_id: thing.id,
		reviewTargetType: 'needs',
		reviewTargetId: thing.id
	});

	return thing;
}

export async function listActivePrompts(pb: PocketBase, limit = 8) {
	const result = await pb.collection('prompts').getList<PromptRecord>(1, limit, {
		filter: 'active = true',
		sort: 'sort_order,created'
	});

	return result.items;
}

export async function listReflectionPrompts(pb: PocketBase, userId: string, limit = 50) {
	const typeFilter = reflectionPromptTypes.map((type) => `prompt_type = "${type}"`).join(' || ');
	const result = await pb.collection('prompts').getList<PromptRecord>(1, limit, {
		filter: pb.filter(`active = true && (${typeFilter}) && (user = {:userId} || is_system = true)`, {
			userId
		}),
		sort: 'sort_order,created'
	});

	return result.items;
}

export async function listTodayPromptAnswers(pb: PocketBase, userId: string, dateKey = localDateKey()) {
	try {
		const result = await pb.collection('prompt_answers').getList<PromptAnswerRecord>(1, 100, {
			filter: pb.filter('user = {:userId} && metadata.date = {:dateKey}', { userId, dateKey }),
			sort: 'created',
			expand: 'prompt'
		});

		return result.items;
	} catch {
		const result = await pb.collection('prompt_answers').getList<PromptAnswerRecord>(1, 200, {
			filter: pb.filter('user = {:userId}', { userId }),
			sort: '-answered_at,-created',
			expand: 'prompt'
		});

		return result.items.filter(
			(answer) =>
				answer.metadata &&
				!Array.isArray(answer.metadata) &&
				typeof answer.metadata === 'object' &&
				answer.metadata.date === dateKey
		);
	}
}

export async function upsertPromptAnswer(
	pb: PocketBase,
	userId: string,
	promptId: string,
	answer: string,
	dateKey = localDateKey()
) {
	const trimmed = answer.trim();
	const now = new Date().toISOString();
	const payload = {
		user: userId,
		prompt: promptId,
		answer: trimmed,
		answered_at: now,
		metadata: { date: dateKey }
	};

	let existing;
	try {
		existing = await pb.collection('prompt_answers').getList<PromptAnswerRecord>(1, 1, {
			filter: pb.filter('user = {:userId} && prompt = {:promptId} && metadata.date = {:dateKey}', {
				userId,
				promptId,
				dateKey
			})
		});
	} catch {
		const fallback = await pb.collection('prompt_answers').getList<PromptAnswerRecord>(1, 50, {
			filter: pb.filter('user = {:userId} && prompt = {:promptId}', {
				userId,
				promptId
			}),
			sort: '-answered_at,-created'
		});

		existing = {
			items: fallback.items.filter(
				(answer) =>
					answer.metadata &&
					!Array.isArray(answer.metadata) &&
					typeof answer.metadata === 'object' &&
					answer.metadata.date === dateKey
			)
		};
	}

	if (existing.items[0]) {
		return await pb.collection('prompt_answers').update<PromptAnswerRecord>(existing.items[0].id, payload);
	}

	return await pb.collection('prompt_answers').create<PromptAnswerRecord>(payload);
}

export async function searchHomeBrain(pb: PocketBase, userId: string, query: string) {
	const q = query.trim();
	if (!q) {
		return {
			things: [] as ThingRecord[],
			locations: [] as LocationRecord[],
			events: [] as EventRecord[]
		};
	}

	const [things, locations, events] = await Promise.all([
		pb.collection('things').getList<ThingRecord>(1, 12, {
			filter: pb.filter(
				'user = {:userId} && (name ~ {:q} || category ~ {:q} || notes ~ {:q})',
				{ userId, q }
			),
			sort: 'name',
			expand: 'location'
		}),
		pb.collection('locations').getList<LocationRecord>(1, 12, {
			filter: pb.filter('user = {:userId} && (name ~ {:q} || path ~ {:q} || notes ~ {:q})', {
				userId,
				q
			}),
			sort: 'path,name'
		}),
		pb.collection('events').getList<EventRecord>(1, 12, {
			filter: pb.filter('user = {:userId} && (title ~ {:q} || notes ~ {:q})', { userId, q }),
			sort: '-happened_at,-created',
			expand: 'thing'
		})
	]);

	return { things: things.items, locations: locations.items, events: events.items };
}
