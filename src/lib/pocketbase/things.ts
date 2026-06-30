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

export function thingQuantitySummary(thing: ThingRecord) {
	const quantity = [thing.quantity_number, thing.unit]
		.filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
		.join(' ');

	return thing.quantity_text || quantity;
}

export function thingLocationSummary(thing: ThingRecord) {
	return thing.expand?.location?.name || thing.expand?.location?.path || '';
}

export function thingSearchText(thing: ThingRecord) {
	return [
		thing.name,
		editorText(thing.notes),
		thing.quantity_text,
		thing.unit,
		thingLocationSummary(thing),
		thing.expand?.location?.path
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}

export function matchesThingStatusScope(thing: ThingRecord, status: ThingStatus | 'all' = 'all') {
	return status === 'all' ? thing.status !== 'archived' : thing.status === status;
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
			return `${a.status ?? ''} ${a.name}`.localeCompare(`${b.status ?? ''} ${b.name}`);
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
