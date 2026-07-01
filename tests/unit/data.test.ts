import type PocketBase from 'pocketbase';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addNoteEventToNeed,
	completeRoutine,
	createQuickCaptureNote,
	getCachedInboxCount,
	invalidateInboxCountCache,
	invalidateNoteArchiveCache,
	invalidateThingsCache,
	linkMemoryEventToThing,
	listNeeds,
	listActivityEvents,
	listNoteArchiveEvents,
	listUserThings,
	logNoteEventAsActivity,
	seedInboxCountCache,
	sharedInboxCount,
	updateThingStatus
} from '../../src/lib/pocketbase/data';
import { fixtureEvents, fixtureRoutines, fixtureThings, fixtureUser } from '../fixtures/homebrain';
import { createMockPocketBase } from '../utils/mockPocketBase';

function pocketBase(seed = {}) {
	return createMockPocketBase(seed) as unknown as PocketBase & ReturnType<typeof createMockPocketBase>;
}

beforeEach(() => {
	vi.useRealTimers();
	invalidateInboxCountCache();
	invalidateThingsCache();
	invalidateNoteArchiveCache();
});

describe('PocketBase mutations', () => {
	it('quick capture creates a note event', async () => {
		vi.useFakeTimers({ now: new Date('2026-06-30T12:00:00.000Z') });
		const pb = pocketBase({ events: [] });

		const note = await createQuickCaptureNote(pb, fixtureUser.id, 'Buy milk\nRemember oat milk');

		expect(note.event_type).toBe('note');
		expect(note.title).toBe('Buy milk');
		expect(note.notes).toBe('Buy milk\nRemember oat milk');
		expect(pb.calls.at(-1)).toMatchObject({ collection: 'events', method: 'create' });
	});

	it('log as activity keeps the event and changes event_type to activity', async () => {
		const pb = pocketBase({ events: fixtureEvents });

		await logNoteEventAsActivity(pb, fixtureUser.id, 'event_new_note', {
			activity_type: 'walking',
			duration_minutes: 25
		});

		const update = pb.calls.find((call) => call.collection === 'events' && call.method === 'update');
		expect(update?.args[0]).toBe('event_new_note');
		expect(update?.args[1]).toMatchObject({
			event_type: 'activity',
			metadata: {
				reviewed: true,
				activity_type: 'walking',
				duration_minutes: 25
			}
		});
	});

	it('links an event to an existing thing and marks it reviewed', async () => {
		const pb = pocketBase({ events: fixtureEvents, things: fixtureThings });

		await linkMemoryEventToThing(pb, fixtureUser.id, 'event_new_note', 'thing_inventory');

		const update = pb.calls.find((call) => call.collection === 'events' && call.method === 'update');
		expect(update?.args[1]).toMatchObject({
			thing: 'thing_inventory',
			metadata: {
				reviewed: true,
				linked_to: 'thing',
				thing_id: 'thing_inventory'
			}
		});
	});

	it('adds a note as a needed inventory thing without quantity tracking', async () => {
		const createPb = pocketBase({ events: fixtureEvents, things: [] });
		await addNoteEventToNeed(createPb, fixtureUser.id, 'event_new_note', { name: 'Tea' });
		const payload = createPb.calls.find((call) => call.collection === 'things' && call.method === 'create')?.args[0];
		expect(payload).toMatchObject({
			name: 'Tea',
			type: 'inventory',
			status: 'needed'
		});
		expect(Object.keys(payload as Record<string, unknown>).some((key) => key.includes('quantity'))).toBe(false);

		const updatePb = pocketBase({ events: fixtureEvents, things: fixtureThings });
		await addNoteEventToNeed(updatePb, fixtureUser.id, 'event_new_note', {
			name: 'Coffee beans',
			status: 'low'
		});
		expect(updatePb.calls.find((call) => call.collection === 'things' && call.method === 'update')?.args[0]).toBe(
			'thing_inventory'
		);
	});

	it('lists open needs and can mark one as have', async () => {
		const pb = pocketBase({ things: fixtureThings });

		expect((await listNeeds(pb, fixtureUser.id)).map((thing) => thing.id)).toEqual([
			'thing_empty',
			'thing_inventory'
		]);

		await updateThingStatus(pb, fixtureUser.id, 'thing_inventory', 'have');
		const update = [...pb.calls].reverse().find((call) => call.collection === 'things' && call.method === 'update');
		expect(update?.args[1]).toMatchObject({
			status: 'have'
		});
	});

	it('routine done updates routine dates and creates a done event', async () => {
		vi.useFakeTimers({ now: new Date('2026-06-30T12:00:00.000Z') });
		const pb = pocketBase({ routines: fixtureRoutines, events: [] });

		await completeRoutine(pb, fixtureUser.id, 'routine_plants');

		expect(pb.calls.find((call) => call.collection === 'routines' && call.method === 'update')?.args[1]).toMatchObject({
			last_done_at: '2026-06-30T12:00:00.000Z',
			next_due_at: '2026-07-07T12:00:00.000Z'
		});
		expect(pb.calls.find((call) => call.collection === 'events' && call.method === 'create')?.args[0]).toMatchObject({
			event_type: 'done',
			title: 'Done: Water plants'
		});
	});
});

describe('client-side caches', () => {
	it('seeds and invalidates the inbox count cache', async () => {
		const pb = pocketBase({ events: fixtureEvents });
		seedInboxCountCache(fixtureUser.id, 3);

		expect(get(sharedInboxCount)).toBe(3);
		expect(await getCachedInboxCount(pb, fixtureUser.id)).toBe(3);
		expect(pb.calls.filter((call) => call.collection === 'events')).toHaveLength(0);

		invalidateInboxCountCache();
		expect(get(sharedInboxCount)).toBeNull();
		expect(await getCachedInboxCount(pb, fixtureUser.id)).toBe(1);
	});

	it('reuses and invalidates the things cache', async () => {
		const pb = pocketBase({ things: fixtureThings });

		await listUserThings(pb, fixtureUser.id, 0);
		await listUserThings(pb, fixtureUser.id, 0);
		expect(pb.calls.filter((call) => call.collection === 'things' && call.method === 'getFullList')).toHaveLength(1);

		invalidateThingsCache();
		await listUserThings(pb, fixtureUser.id, 0);
		expect(pb.calls.filter((call) => call.collection === 'things' && call.method === 'getFullList')).toHaveLength(2);
	});

	it('reuses and invalidates the note/activity archive cache', async () => {
		const pb = pocketBase({ events: fixtureEvents });

		await listNoteArchiveEvents(pb, fixtureUser.id, 'all');
		await listActivityEvents(pb, fixtureUser.id);
		expect(pb.calls.filter((call) => call.collection === 'events' && call.method === 'getFullList')).toHaveLength(1);

		invalidateNoteArchiveCache();
		await listActivityEvents(pb, fixtureUser.id);
		expect(pb.calls.filter((call) => call.collection === 'events' && call.method === 'getFullList')).toHaveLength(2);
	});
});
