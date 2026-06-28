import type PocketBase from 'pocketbase';
import { firstNonEmptyLine } from './format';
import type {
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
