import type { Page, Route } from '@playwright/test';
import {
	fixtureEvents,
	fixturePromptAnswers,
	fixtureRoutines,
	fixtureThings,
	fixtureUserRecord
} from '../fixtures/homebrain';

function json(route: Route, body: unknown, status = 200) {
	return route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

function token() {
	const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify({ id: fixtureUserRecord.id, exp: 1_999_999_999 })).toString('base64url');
	return `${header}.${payload}.signature`;
}

function listResponse(items: unknown[], url: URL) {
	const page = Number(url.searchParams.get('page') ?? '1');
	const perPage = Number(url.searchParams.get('perPage') ?? (items.length || 50));
	const start = (page - 1) * perPage;

	return {
		page,
		perPage,
		totalItems: items.length,
		totalPages: Math.max(1, Math.ceil(items.length / perPage)),
		items: items.slice(start, start + perPage)
	};
}

function filterCollection(name: string, records: any[], url: URL, allThings = fixtureThings) {
	const filter = url.searchParams.get('filter') ?? '';
	let items = [...records];

	if (filter.includes('event_type = "note"') && filter.includes('event_type = "activity"')) {
		items = items.filter((item) => item.event_type === 'note' || item.event_type === 'activity');
	} else if (filter.includes('event_type = "note"')) {
		items = items.filter((item) => item.event_type === 'note');
	} else if (filter.includes('event_type = "activity"')) {
		items = items.filter((item) => item.event_type === 'activity');
	} else if (filter.includes('event_type = "metric"')) {
		items = items.filter((item) => item.event_type === 'metric');
	}
	const thingMatch = filter.match(/thing = "([^"]+)"/);
	if (thingMatch) {
		items = items.filter((item) => item.thing === thingMatch[1]);
	}
	if (filter.includes('metadata.reviewed != true')) {
		items = items.filter((item) => item.metadata?.reviewed !== true);
	}
	if (filter.includes('metadata.processed != true')) {
		items = items.filter((item) => item.metadata?.processed !== true);
	}
	if (filter.includes('metadata.reviewStatus != "completed"')) {
		items = items.filter((item) => item.metadata?.reviewStatus !== 'completed');
	}
	if (filter.includes('metadata.reviewStatus != "dismissed"')) {
		items = items.filter((item) => item.metadata?.reviewStatus !== 'dismissed');
	}
	if (filter.includes('thing != ""')) {
		items = items.filter((item) => item.thing);
	}
	if (filter.includes('type = "inventory"')) {
		items = items.filter((item) => item.type === 'inventory');
	}
	const nameMatch = filter.match(/name = "([^"]+)"/);
	if (nameMatch) {
		items = items.filter((item) => item.name === nameMatch[1]);
	}
	if (
		filter.includes('status = "needed"') ||
		filter.includes('status = "low"') ||
		filter.includes('status = "empty"') ||
		filter.includes('status = "missing"')
	) {
		const wanted = new Set<string>();
		for (const status of ['needed', 'low', 'empty', 'missing']) {
			if (filter.includes(`status = "${status}"`)) wanted.add(status);
		}
		items = items.filter((item) => wanted.has(item.status));
	}
	if (filter.includes('active = true')) {
		items = items.filter((item) => item.active);
	}
	if (filter.includes('next_due_at != ""')) {
		items = items.filter((item) => item.next_due_at);
	}
	if (name === 'events') {
		items = items.map((event) => ({
				...event,
				expand: event.thing
				? { thing: allThings.find((thing) => thing.id === event.thing) }
				: event.expand
		}));
	}

	return items;
}

export async function authenticate(page: Page) {
	await page.addInitScript(
		({ authToken, user }) => {
			window.localStorage.setItem('pocketbase_auth', JSON.stringify({ token: authToken, record: user }));
		},
		{ authToken: token(), user: fixtureUserRecord }
	);
}

export async function mockPocketBase(page: Page) {
	const state = {
		events: structuredClone(fixtureEvents),
		things: structuredClone(fixtureThings),
		routines: structuredClone(fixtureRoutines),
		prompt_answers: structuredClone(fixturePromptAnswers)
	};

	await page.route('http://127.0.0.1:8090/api/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;

		if (path.endsWith('/api/collections/users/auth-refresh')) {
			return json(route, { token: token(), record: fixtureUserRecord });
		}

		const match = path.match(/\/api\/collections\/([^/]+)\/records(?:\/([^/]+))?/);
		if (!match) return json(route, { message: 'Not mocked' }, 404);

		const [, collection, id] = match;
		const records = (state as Record<string, any[]>)[collection] ?? [];

		if (request.method() === 'GET' && id) {
			const record = records.find((item) => item.id === id);
			return record ? json(route, record) : json(route, { message: 'Not found' }, 404);
		}

		if (request.method() === 'GET') {
			return json(route, listResponse(filterCollection(collection, records, url, state.things), url));
		}

		if (request.method() === 'POST') {
			const payload = await request.postDataJSON();
			const record = {
				id: `${collection}_${records.length + 1}`,
				collectionId: collection,
				collectionName: collection,
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				...payload
			};
			records.unshift(record);
			return json(route, record);
		}

		if ((request.method() === 'PATCH' || request.method() === 'PUT') && id) {
			const payload = await request.postDataJSON();
			const index = records.findIndex((item) => item.id === id);
			if (index === -1) return json(route, { message: 'Not found' }, 404);

			records[index] = { ...records[index], ...payload, updated: new Date().toISOString() };
			return json(route, records[index]);
		}

		return json(route, { message: 'Not mocked' }, 404);
	});
}
