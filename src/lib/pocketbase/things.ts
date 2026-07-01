import { editorText } from './format';
import type { LocationRecord, ThingRecord, ThingStatus, ThingType } from './types';

export type ThingSortMode = 'updated' | 'name' | 'type' | 'status';

export interface ThingFilterOptions {
	search?: string;
	type?: ThingType | 'all';
	status?: ThingStatus | 'all';
	location?: string;
	sort?: ThingSortMode;
}

export const needStatuses = ['needed', 'low', 'empty'] as const;

export function normalizeThingStatus(status?: string | null) {
	if (status === 'ok') return 'have';
	if (status === 'missing') return 'needed';
	return status || '';
}

export function isNeedsStatus(status?: string | null) {
	return needStatuses.includes(normalizeThingStatus(status) as (typeof needStatuses)[number]);
}

export function thingLocationSummary(thing: ThingRecord) {
	return thing.expand?.location?.name || thing.expand?.location?.path || '';
}

export function thingSearchText(thing: ThingRecord) {
	return [
		thing.name,
		editorText(thing.notes),
		thingLocationSummary(thing),
		thing.expand?.location?.path
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}

export function matchesThingStatusScope(thing: ThingRecord, status: ThingStatus | 'all' = 'all') {
	const normalizedStatus = normalizeThingStatus(thing.status);
	return status === 'all' ? normalizedStatus !== 'archived' : normalizedStatus === status;
}

export function filterAndSortThings(things: ThingRecord[], options: ThingFilterOptions = {}) {
	const query = options.search?.trim().toLowerCase() ?? '';
	const type = options.type ?? 'all';
	const status = options.status ?? 'all';
	const location = options.location ?? 'all';
	const sort = options.sort ?? 'updated';

	const matches = things.filter((thing) => {
		if (type !== 'all' && thing.type !== type) return false;
		if (!matchesThingStatusScope(thing, status)) return false;
		if (location === 'none' && thing.location) return false;
		if (location !== 'all' && location !== 'none' && thing.location !== location) return false;
		if (query && !thingSearchText(thing).includes(query)) return false;

		return true;
	});

	return [...matches].sort((a, b) => {
		if (sort === 'name') return a.name.localeCompare(b.name);
		if (sort === 'type') return `${a.type} ${a.name}`.localeCompare(`${b.type} ${b.name}`);
		if (sort === 'status') {
			return `${normalizeThingStatus(a.status)} ${a.name}`.localeCompare(`${normalizeThingStatus(b.status)} ${b.name}`);
		}

		return new Date(b.updated).getTime() - new Date(a.updated).getTime();
	});
}

export function uniqueThingLocations(things: ThingRecord[]) {
	return things
		.filter((thing) => thing.expand?.location)
		.map((thing) => thing.expand!.location as LocationRecord)
		.filter((location, index, locations) => locations.findIndex((item) => item.id === location.id) === index)
		.sort((a, b) => (a.name || a.path || '').localeCompare(b.name || b.path || ''));
}
