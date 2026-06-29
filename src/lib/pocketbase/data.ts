import type PocketBase from 'pocketbase';
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

export interface ThingInput {
	name: string;
	type: ThingType;
	status?: ThingStatus | '';
	location?: string;
	quantity_text?: string;
	quantity_number?: number;
	unit?: string;
	notes?: string;
	metadata?: JsonValue;
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

export interface ShoppingConversionInput {
	name?: string;
	quantity_text?: string;
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

export interface ActiveThingSummary {
	id: string;
	name: string;
	type: ThingType;
	status?: ThingStatus;
	linkedEventCount: number;
	latestActivity: string;
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

function recordMetadata(record: { metadata?: JsonValue }) {
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

function isNoteArchiveEvent(event: EventRecord) {
	return event.event_type === 'note' || event.event_type === 'activity';
}

function isNewNoteArchiveEvent(event: EventRecord) {
	const metadata = recordMetadata(event);
	return metadata.reviewed !== true && metadata.processed !== true && metadata.dismissed !== true;
}

function isReviewedNoteArchiveEvent(event: EventRecord) {
	const metadata = recordMetadata(event);
	return (metadata.reviewed === true || metadata.processed === true) && metadata.dismissed !== true;
}

function isDismissedNoteArchiveEvent(event: EventRecord) {
	return recordMetadata(event).dismissed === true;
}

function isLinkedNoteArchiveEvent(event: EventRecord) {
	return Boolean(event.thing);
}

function isActivityNoteArchiveEvent(event: EventRecord) {
	const metadata = recordMetadata(event);
	return event.event_type === 'activity' || typeof metadata.activity_type === 'string';
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

export async function listDueSoonRoutines(pb: PocketBase, limit = 6) {
	try {
		const result = await pb.collection('routines').getList<RoutineRecord>(1, limit, {
			filter: 'active = true && next_due_at != ""',
			sort: 'next_due_at',
			expand: 'thing'
		});

		return result.items;
	} catch {
		const result = await pb.collection('routines').getList<RoutineRecord>(1, Math.max(limit, 50), {
			filter: 'active = true',
			sort: 'next_due_at',
			expand: 'thing'
		});

		return result.items.filter((routine) => Boolean(routine.next_due_at)).slice(0, limit);
	}
}

export async function listLowStockThings(pb: PocketBase, limit = 6) {
	const result = await pb.collection('things').getList<ThingRecord>(1, limit, {
		filter: 'status = "low" || status = "empty"',
		sort: 'status,name',
		expand: 'location'
	});

	return result.items;
}

export async function listRecentNoteEvents(pb: PocketBase, limit = 6) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: 'event_type = "note"',
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return result.items;
}

export async function listRecentEvents(pb: PocketBase, limit = 12) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
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
	const events = await pb.collection('events').getFullList<EventRecord>({
		filter: pb.filter('user = {:userId} && (event_type = "note" || event_type = "activity")', {
			userId
		}),
		sort: '-happened_at,-created',
		expand: 'thing'
	});

	return events.filter((event) => matchesNoteArchiveFilter(event, filter));
}

export async function listUnprocessedNoteEvents(pb: PocketBase, userId: string, limit = 50) {
	try {
		const result = await pb.collection('events').getList<EventRecord>(1, limit, {
			filter: pb.filter(
				'user = {:userId} && event_type = "note" && metadata.reviewed != true && metadata.processed != true',
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
				return metadata.reviewed !== true && metadata.processed !== true;
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

export async function countUnprocessedNoteEvents(pb: PocketBase, userId: string) {
	return (await listUnprocessedNoteEvents(pb, userId, 100)).length;
}

export async function countReviewInboxNotes(pb: PocketBase, userId: string) {
	try {
		const result = await pb.collection('events').getList<EventRecord>(1, 1, {
			filter: pb.filter(
				'user = {:userId} && event_type = "note" && metadata.reviewed != true && metadata.processed != true',
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
			return metadata.reviewed !== true && metadata.processed !== true;
		}).length;
	}
}

export async function listDashboardRecentNotes(pb: PocketBase, userId: string, limit = 10) {
	const result = await pb.collection('events').getList<EventRecord>(1, limit, {
		filter: pb.filter('user = {:userId} && event_type = "note"', { userId }),
		sort: '-happened_at,-created'
	});

	return result.items;
}

export async function listRecentlyLinkedNoteEvents(pb: PocketBase, userId: string, limit = 10) {
	try {
		const result = await pb.collection('events').getList<EventRecord>(1, limit, {
			filter: pb.filter('user = {:userId} && event_type = "note" && thing != ""', { userId }),
			sort: '-updated,-happened_at,-created',
			expand: 'thing'
		});

		return result.items;
	} catch {
		const result = await pb.collection('events').getList<EventRecord>(1, Math.max(limit, 50), {
			filter: pb.filter('user = {:userId} && event_type = "note"', { userId }),
			sort: '-updated,-happened_at,-created',
			expand: 'thing'
		});

		return result.items.filter((event) => Boolean(event.thing)).slice(0, limit);
	}
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

export async function listDashboardBuyList(pb: PocketBase, userId: string) {
	try {
		return await pb.collection('things').getFullList<ThingRecord>({
			filter: pb.filter(
				'user = {:userId} && type = "inventory" && (status = "low" || status = "empty")',
				{ userId }
			),
			sort: 'status,name'
		});
	} catch {
		const things = await pb.collection('things').getFullList<ThingRecord>({
			filter: pb.filter('user = {:userId} && type = "inventory"', { userId }),
			sort: 'status,name'
		});

		return things.filter((thing) => thing.status === 'low' || thing.status === 'empty');
	}
}

export async function createQuickCaptureNote(pb: PocketBase, userId: string, text: string) {
	const trimmed = text.trim();
	const title = firstNonEmptyLine(trimmed) ?? 'Untitled note';

	return await pb.collection('events').create<EventRecord>({
		user: userId,
		event_type: 'note',
		title,
		notes: trimmed,
		happened_at: new Date().toISOString()
	});
}

export async function markNoteEventProcessed(
	pb: PocketBase,
	userId: string,
	eventId: string,
	metadata: Record<string, JsonValue> = {}
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');

	return await pb.collection('events').update<EventRecord>(eventId, {
		metadata: {
			...recordMetadata(event),
			processed: true,
			...metadata
		}
	});
}

export async function markNoteEventReviewed(
	pb: PocketBase,
	userId: string,
	eventId: string,
	metadata: Record<string, JsonValue> = {}
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');

	return await pb.collection('events').update<EventRecord>(eventId, {
		metadata: {
			...recordMetadata(event),
			reviewed: true,
			...metadata
		}
	});
}

export async function setNoteEventReviewState(
	pb: PocketBase,
	userId: string,
	eventId: string,
	state: NoteReviewState
) {
	const event = await getNoteArchiveEvent(pb, userId, eventId);
	const metadata = {
		...recordMetadata(event)
	};

	if (state === 'new') {
		metadata.reviewed = false;
		metadata.processed = false;
		metadata.dismissed = false;
	} else if (state === 'dismissed') {
		metadata.reviewed = true;
		metadata.dismissed = true;
	} else {
		metadata.reviewed = true;
		metadata.dismissed = false;
	}

	return await pb.collection('events').update<EventRecord>(
		eventId,
		{ metadata },
		{ expand: 'thing' }
	);
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

	if (input.notes !== undefined) {
		payload.notes = input.notes;
	}

	return await pb.collection('events').update<EventRecord>(eventId, payload);
}

export async function completeRoutine(pb: PocketBase, userId: string, routineId: string) {
	const routine = await pb.collection('routines').getOne<RoutineRecord>(routineId);
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
	const result = await pb.collection('things').getList<ThingRecord>(1, limit, {
		filter: pb.filter('user = {:userId}', { userId }),
		sort: 'name',
		expand: 'location'
	});

	return result.items;
}

export async function listLocations(pb: PocketBase, limit = 100) {
	const result = await pb.collection('locations').getList<LocationRecord>(1, limit, {
		sort: 'path,name'
	});

	return result.items;
}

export async function getThing(pb: PocketBase, id: string) {
	return await pb.collection('things').getOne<ThingRecord>(id, {
		expand: 'location'
	});
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
		location: input.location || '',
		quantity_text: input.quantity_text || '',
		quantity_number: input.quantity_number ?? null,
		unit: input.unit || '',
		notes: input.notes || '',
		metadata: input.metadata ?? null
	};
}

export async function createThing(pb: PocketBase, userId: string, input: ThingInput) {
	return await pb.collection('things').create<ThingRecord>(toThingPayload(userId, input));
}

export async function updateThing(pb: PocketBase, id: string, input: ThingInput) {
	return await pb.collection('things').update<ThingRecord>(id, toThingPayload(null, input), {
		expand: 'location'
	});
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

export async function linkNoteEventToThing(
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
	if (event.event_type !== 'note') throw new Error('Only note events can be linked from inbox.');
	if (thing.user !== userId) throw new Error('Thing does not belong to the current user.');

	return await pb.collection('events').update<EventRecord>(eventId, {
		thing: thingId,
		metadata: {
			...recordMetadata(event),
			reviewed: true,
			linked_to: 'thing',
			thing_id: thingId
		}
	});
}

export async function convertNoteEventToThing(
	pb: PocketBase,
	userId: string,
	eventId: string,
	type: ThingType = 'other',
	status: ThingStatus = 'unknown'
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');

	const thing = await createThing(pb, userId, {
		name: noteEventName(event),
		type,
		status,
		notes: event.notes || ''
	});

	await markNoteEventProcessed(pb, userId, eventId, {
		converted_to: 'thing',
		thing_id: thing.id
	});

	return thing;
}

export async function convertNoteEventToRoutine(
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

	await markNoteEventProcessed(pb, userId, eventId, {
		converted_to: 'routine',
		thing_id: thing.id,
		routine_id: routine.id
	});

	return { thing, routine };
}

export async function convertNoteEventToShopping(
	pb: PocketBase,
	userId: string,
	eventId: string,
	input: ShoppingConversionInput = {}
) {
	const event = await pb.collection('events').getOne<EventRecord>(eventId);
	if (event.user !== userId) throw new Error('Event does not belong to the current user.');

	const name = input.name?.trim() || noteEventName(event);
	const quantityText = input.quantity_text?.trim() || 'not bought yet';
	const existing = await pb.collection('things').getList<ThingRecord>(1, 1, {
		filter: pb.filter('user = {:userId} && type = "inventory" && name = {:name}', { userId, name }),
		sort: '-updated'
	});
	const thing = existing.items[0]
		? await updateThing(pb, existing.items[0].id, {
				name,
				type: 'inventory',
				status: 'low',
				quantity_number: 0,
				quantity_text: quantityText,
				notes: event.notes || ''
			})
		: await createThing(pb, userId, {
				name,
				type: 'inventory',
				status: 'low',
				quantity_number: 0,
				quantity_text: quantityText,
				notes: event.notes || ''
			});

	await markNoteEventProcessed(pb, userId, eventId, {
		converted_to: 'shopping',
		thing_id: thing.id
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

export async function searchHomeBrain(pb: PocketBase, query: string) {
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
			filter: pb.filter('name ~ {:q} || notes ~ {:q} || quantity_text ~ {:q} || unit ~ {:q}', {
				q
			}),
			sort: 'name',
			expand: 'location'
		}),
		pb.collection('locations').getList<LocationRecord>(1, 12, {
			filter: pb.filter('name ~ {:q} || path ~ {:q} || notes ~ {:q}', { q }),
			sort: 'path,name'
		}),
		pb.collection('events').getList<EventRecord>(1, 12, {
			filter: pb.filter('title ~ {:q} || notes ~ {:q}', { q }),
			sort: '-happened_at,-created',
			expand: 'thing'
		})
	]);

	return { things: things.items, locations: locations.items, events: events.items };
}
