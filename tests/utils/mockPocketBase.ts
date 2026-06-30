import { vi } from 'vitest';
import type { JsonValue } from '../../src/lib/pocketbase/types';

type RecordLike = {
	id: string;
	collectionId?: string;
	collectionName?: string;
	[key: string]: unknown;
};

type Collections = Record<string, RecordLike[]>;

function clone<T>(value: T): T {
	return structuredClone(value);
}

function getValue(record: RecordLike, key: string) {
	return key.split('.').reduce<unknown>((value, part) => {
		if (!value || typeof value !== 'object') return undefined;
		return (value as Record<string, unknown>)[part];
	}, record);
}

function matchesFilter(record: RecordLike, filter = '') {
	if (!filter) return true;
	if (filter.includes('user =') && !filter.includes(String(record.user))) return false;
	if (filter.includes('event_type = "note"') && filter.includes('event_type = "activity"')) {
		if (record.event_type !== 'note' && record.event_type !== 'activity') return false;
	} else {
		if (filter.includes('event_type = "note"') && record.event_type !== 'note') return false;
		if (filter.includes('event_type = "activity"') && record.event_type !== 'activity') return false;
	}
	if (filter.includes('type = "inventory"') && record.type !== 'inventory') return false;
	if (filter.includes('active = true') && record.active !== true) return false;
	if (filter.includes('thing != ""') && !record.thing) return false;
	if (filter.includes('next_due_at != ""') && !record.next_due_at) return false;
	if (filter.includes('metadata.reviewed != true') && getValue(record, 'metadata.reviewed') === true) return false;
	if (filter.includes('metadata.processed != true') && getValue(record, 'metadata.processed') === true) return false;
	if (filter.includes('status = "low" || status = "empty"')) {
		return record.status === 'low' || record.status === 'empty';
	}

	const nameMatch = filter.match(/name = "([^"]+)"/);
	if (nameMatch && record.name !== nameMatch[1]) return false;

	return true;
}

function sortRecords<T extends RecordLike>(records: T[], sort = '') {
	const fields = sort.split(',').filter(Boolean);
	const sorted = [...records];

	for (const field of fields.reverse()) {
		const direction = field.startsWith('-') ? -1 : 1;
		const key = field.replace(/^-/, '');
		sorted.sort((a, b) => String(getValue(a, key) ?? '').localeCompare(String(getValue(b, key) ?? '')) * direction);
	}

	return sorted;
}

export function createMockPocketBase(seed: Collections = {}) {
	const collections: Collections = clone(seed);
	const calls: Array<{ collection: string; method: string; args: unknown[] }> = [];

	function ensureCollection(name: string) {
		collections[name] ??= [];
		return collections[name];
	}

	const pb = {
		calls,
		collections,
		filter: vi.fn((template: string, values: Record<string, JsonValue> = {}) => {
			return Object.entries(values).reduce((filter, [key, value]) => {
				const replacement = typeof value === 'string' ? `"${value}"` : String(value);
				return filter.replaceAll(`{:${key}}`, replacement);
			}, template);
		}),
		authStore: {
			token: 'test-token',
			record: null,
			isValid: true,
			clear: vi.fn(),
			save: vi.fn(),
			onChange: vi.fn()
		},
		collection(name: string) {
			return {
				getList: vi.fn(async (page = 1, perPage = 50, options: { filter?: string; sort?: string } = {}) => {
					calls.push({ collection: name, method: 'getList', args: [page, perPage, options] });
					const all = sortRecords(
						ensureCollection(name).filter((record) => matchesFilter(record, options.filter)),
						options.sort
					);
					const start = (page - 1) * perPage;
					return {
						page,
						perPage,
						totalItems: all.length,
						totalPages: Math.ceil(all.length / perPage),
						items: clone(all.slice(start, start + perPage))
					};
				}),
				getFullList: vi.fn(async (options: { filter?: string; sort?: string } = {}) => {
					calls.push({ collection: name, method: 'getFullList', args: [options] });
					return clone(
						sortRecords(
							ensureCollection(name).filter((record) => matchesFilter(record, options.filter)),
							options.sort
						)
					);
				}),
				getOne: vi.fn(async (id: string) => {
					calls.push({ collection: name, method: 'getOne', args: [id] });
					const record = ensureCollection(name).find((item) => item.id === id);
					if (!record) throw new Error(`${name} record not found: ${id}`);
					return clone(record);
				}),
				create: vi.fn(async (payload: Record<string, unknown>) => {
					calls.push({ collection: name, method: 'create', args: [payload] });
					const now = new Date().toISOString();
					const record = {
						id: `${name}_${ensureCollection(name).length + 1}`,
						collectionId: name,
						collectionName: name,
						created: now,
						updated: now,
						...payload
					};
					ensureCollection(name).push(record);
					return clone(record);
				}),
				update: vi.fn(async (id: string, payload: Record<string, unknown>) => {
					calls.push({ collection: name, method: 'update', args: [id, payload] });
					const records = ensureCollection(name);
					const index = records.findIndex((item) => item.id === id);
					if (index === -1) throw new Error(`${name} record not found: ${id}`);
					records[index] = { ...records[index], ...payload, updated: new Date().toISOString() };
					return clone(records[index]);
				})
			};
		}
	};

	return pb;
}
