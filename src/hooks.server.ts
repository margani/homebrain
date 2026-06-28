import type { Handle } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { getPocketBaseUrl, isPocketBaseConfigured } from '$lib/pocketbase/config';
import { toAuthUser } from '$lib/pocketbase/auth';
import type { UserRecord } from '$lib/pocketbase/types';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.pbConfigured = isPocketBaseConfigured();
	event.locals.pb = new PocketBase(getPocketBaseUrl());

	event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '');

	if (event.locals.pbConfigured && event.locals.pb.authStore.isValid) {
		try {
			await event.locals.pb.collection('users').authRefresh<UserRecord>();
		} catch {
			event.locals.pb.authStore.clear();
		}
	}

	event.locals.user = toAuthUser(event.locals.pb.authStore.record, event.locals.pb);

	const response = await resolve(event);

	response.headers.append(
		'set-cookie',
		event.locals.pb.authStore.exportToCookie({
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: event.url.protocol === 'https:'
		})
	);

	return response;
};
