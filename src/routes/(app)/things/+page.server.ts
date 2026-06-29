import { listUserThings } from '$lib/pocketbase/data';
import { thingTypeOptions, type ThingType } from '$lib/pocketbase/types';

function parseType(value: string | null): ThingType | 'all' {
	if (thingTypeOptions.includes(value as ThingType)) {
		return value as ThingType;
	}

	return 'all';
}

function queryForType(type: ThingType | 'all') {
	return type === 'all' ? '' : `?type=${encodeURIComponent(type)}`;
}

export async function load({ locals, url }) {
	const selectedType = parseType(url.searchParams.get('type'));

	return {
		selectedType,
		typeQuery: queryForType(selectedType),
		things: locals.user ? await listUserThings(locals.pb, locals.user.id, 0) : []
	};
}
