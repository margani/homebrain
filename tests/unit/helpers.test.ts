import { describe, expect, it } from 'vitest';
import { parseActivityDurationMinutes, formatActivityDuration } from '../../src/lib/pocketbase/activity';
import { toAuthUser } from '../../src/lib/pocketbase/auth';
import {
	activityMetadataFor,
	isActivityNoteArchiveEvent,
	isDismissedNoteArchiveEvent,
	isLinkedNoteArchiveEvent,
	isNewNoteArchiveEvent,
	isReviewedNoteArchiveEvent,
	localDateKey,
	metricEventSummary,
	metricMetadataFor
} from '../../src/lib/pocketbase/data';
import { editorText, firstNonEmptyLine, formatDateTime, labelFromValue } from '../../src/lib/pocketbase/format';
import { filterAndSortThings, isNeedsStatus, thingLocationSummary, uniqueThingCategories } from '../../src/lib/pocketbase/things';
import { fixtureEvents, fixtureThings } from '../fixtures/homebrain';

describe('auth helpers', () => {
	it('does not create an auth user without a record id', () => {
		expect(toAuthUser({ email: 'missing-id@example.com' } as never)).toBeNull();
	});
});

describe('date and formatting helpers', () => {
	it('creates local date keys', () => {
		expect(localDateKey(new Date(2026, 5, 30, 9, 15))).toBe('2026-06-30');
	});

	it('formats empty and rich text safely', () => {
		expect(formatDateTime('')).toBe('No date');
		expect(labelFromValue('personal_care')).toBe('Personal Care');
		expect(editorText('<p>Hello&nbsp;&amp;&nbsp;home</p>')).toBe('Hello & home');
		expect(firstNonEmptyLine('\nFirst\nSecond')).toBe('First');
	});
});

describe('activity helpers', () => {
	it('parses and formats valid activity duration', () => {
		expect(parseActivityDurationMinutes('30')).toEqual({ minutes: 30 });
		expect(formatActivityDuration(30)).toBe('30 min');
	});

	it('rejects invalid activity duration', () => {
		expect(parseActivityDurationMinutes('0').error).toContain('positive whole number');
		expect(parseActivityDurationMinutes('2.5').error).toContain('positive whole number');
		expect(formatActivityDuration(undefined)).toBe('');
	});
});

describe('note metadata helpers', () => {
	it('detects review states', () => {
		expect(isNewNoteArchiveEvent(fixtureEvents[0])).toBe(true);
		expect(isReviewedNoteArchiveEvent(fixtureEvents[1])).toBe(true);
		expect(isDismissedNoteArchiveEvent(fixtureEvents[2])).toBe(true);
		expect(isLinkedNoteArchiveEvent(fixtureEvents[3])).toBe(true);
		expect(isActivityNoteArchiveEvent(fixtureEvents[4])).toBe(true);
	});

	it('extracts activity metadata', () => {
		expect(activityMetadataFor(fixtureEvents[4])).toEqual({
			activity_type: 'walking',
			duration_minutes: 30
		});
	});

	it('extracts metric metadata and summaries', () => {
		expect(metricMetadataFor(fixtureEvents[5])).toEqual({
			metric_value: 94,
			metric_unit: 'kg',
			metric_label: 'Weight'
		});
		expect(metricEventSummary(fixtureEvents[5])).toBe('Weight: 94 kg');
	});
});

describe('things filtering and sorting', () => {
	it('searches by name, notes, and location', () => {
		expect(filterAndSortThings(fixtureThings, { search: 'coffee' }).map((thing) => thing.id)).toEqual([
			'thing_inventory'
		]);
		expect(filterAndSortThings(fixtureThings, { search: 'kitchen' }).map((thing) => thing.id)).toEqual([
			'thing_inventory',
			'thing_empty'
		]);
		expect(filterAndSortThings(fixtureThings, { search: 'herbs' }).map((thing) => thing.id)).toEqual([
			'thing_routine'
		]);
		expect(filterAndSortThings(fixtureThings, { search: 'health' }).map((thing) => thing.id)).toEqual([
			'thing_weight'
		]);
	});

	it('filters by type, status, category, and location', () => {
		expect(filterAndSortThings(fixtureThings, { type: 'routine' }).map((thing) => thing.id)).toEqual([
			'thing_routine'
		]);
		expect(filterAndSortThings(fixtureThings, { status: 'low' }).map((thing) => thing.id)).toEqual([
			'thing_inventory'
		]);
		expect(filterAndSortThings(fixtureThings, { location: 'none' }).map((thing) => thing.id)).toEqual([
			'thing_weight',
			'thing_routine'
		]);
		expect(filterAndSortThings(fixtureThings, { category: 'Groceries' }).map((thing) => thing.id)).toEqual([
			'thing_inventory',
			'thing_have'
		]);
	});

	it('sorts by updated, name, type, and status', () => {
		expect(filterAndSortThings(fixtureThings, { sort: 'updated' })[0].id).toBe('thing_inventory');
		expect(filterAndSortThings(fixtureThings, { sort: 'name' }).map((thing) => thing.name)).toEqual([
			'Coffee beans',
			'Dish soap',
			'Rice',
			'Water plants',
			'Weight'
		]);
		expect(filterAndSortThings(fixtureThings, { sort: 'type' })[0].type).toBe('inventory');
		expect(filterAndSortThings(fixtureThings, { sort: 'status' })[0].status).toBe('due');
	});

	it('summarizes location and need states', () => {
		expect(thingLocationSummary(fixtureThings[0])).toBe('Kitchen');
		expect(isNeedsStatus('needed')).toBe(true);
		expect(isNeedsStatus('low')).toBe(true);
		expect(isNeedsStatus('empty')).toBe(true);
		expect(isNeedsStatus('have')).toBe(false);
		expect(uniqueThingCategories(fixtureThings)).toEqual(['Groceries', 'Health', 'Home']);
	});
});
