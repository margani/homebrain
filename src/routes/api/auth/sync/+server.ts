import { error, json } from '@sveltejs/kit';
import type { AuthRecord } from 'pocketbase';
import { toAuthUser } from '$lib/pocketbase/auth';
import type { UserRecord } from '$lib/pocketbase/types';

export async function POST({ locals, request, url }) {
	if (!locals.pbConfigured) {
		error(500, 'PUBLIC_POCKETBASE_URL is not configured.');
	}

	const body = (await request.json().catch(() => null)) as
		| { token?: string; record?: AuthRecord }
		| null;

	if (!body?.token || !body.record) {
		error(400, 'Missing PocketBase auth session.');
	}

	locals.pb.authStore.save(body.token, body.record);

	try {
		await locals.pb.collection('users').authRefresh<UserRecord>();
	} catch {
		locals.pb.authStore.clear();
		error(401, 'PocketBase auth session could not be verified.');
	}

	const user = toAuthUser(locals.pb.authStore.record, locals.pb);

	return json(
		{ user },
		{
			headers: {
				'set-cookie': locals.pb.authStore.exportToCookie({
					httpOnly: true,
					path: '/',
					sameSite: 'lax',
					secure: url.protocol === 'https:'
				})
			}
		}
	);
}
