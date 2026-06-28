import type PocketBase from 'pocketbase';
import { firstNonEmptyLine } from './format';
import type { EventRecord, PromptRecord, RoutineRecord, ThingRecord } from './types';

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

export async function listThings(pb: PocketBase, limit = 50) {
	const result = await pb.collection('things').getList<ThingRecord>(1, limit, {
		sort: 'name',
		expand: 'location'
	});

	return result.items;
}

export async function getThing(pb: PocketBase, id: string) {
	return await pb.collection('things').getOne<ThingRecord>(id, {
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

export async function searchHomeBrain(pb: PocketBase, query: string) {
	const q = query.trim();
	if (!q) {
		return {
			things: [] as ThingRecord[],
			events: [] as EventRecord[],
			routines: [] as RoutineRecord[]
		};
	}

	const [things, events, routines] = await Promise.all([
		pb.collection('things').getList<ThingRecord>(1, 12, {
			filter: pb.filter('name ~ {:q} || notes ~ {:q} || quantity_text ~ {:q}', { q }),
			sort: 'name',
			expand: 'location'
		}),
		pb.collection('events').getList<EventRecord>(1, 12, {
			filter: pb.filter('title ~ {:q} || notes ~ {:q}', { q }),
			sort: '-happened_at,-created',
			expand: 'thing'
		}),
		pb.collection('routines').getList<RoutineRecord>(1, 12, {
			filter: pb.filter('name ~ {:q}', { q }),
			sort: 'next_due_at,name',
			expand: 'thing'
		})
	]);

	return { things: things.items, events: events.items, routines: routines.items };
}
