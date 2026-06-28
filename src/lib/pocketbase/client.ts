import { browser } from '$app/environment';
import PocketBase from 'pocketbase';
import { getPocketBaseUrl } from './config';
import { toAuthUser } from './auth';
import type { AuthUser, UserRecord } from './types';

let client: PocketBase | null = null;

export function getBrowserPb() {
	if (!browser) {
		throw new Error('PocketBase browser client is only available in the browser.');
	}

	if (!client) {
		const url = getPocketBaseUrl();
		if (!url) throw new Error('PUBLIC_POCKETBASE_URL is not configured.');
		client = new PocketBase(url);
	}

	return client;
}

export function currentBrowserUser(): AuthUser | null {
	if (!browser) return null;

	try {
		const pb = getBrowserPb();
		return toAuthUser(pb.authStore.record, pb);
	} catch {
		return null;
	}
}

export async function syncAuthToServer(pb = getBrowserPb()) {
	const token = pb.authStore.token;
	const record = pb.authStore.record;

	if (!token || !record) {
		throw new Error('No PocketBase auth session is available to sync.');
	}

	const response = await fetch('/api/auth/sync', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ token, record })
	});

	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || 'Unable to sync the PocketBase session.');
	}

	return (await response.json()) as { user: AuthUser };
}

export async function loginWithGoogle() {
	const pb = getBrowserPb();
	await pb.collection('users').authWithOAuth2<UserRecord>({ provider: 'google' });
	await syncAuthToServer(pb);
	return toAuthUser(pb.authStore.record, pb);
}

export async function loginWithPassword(email: string, password: string) {
	const pb = getBrowserPb();
	await pb.collection('users').authWithPassword<UserRecord>(email, password);
	await syncAuthToServer(pb);
	return toAuthUser(pb.authStore.record, pb);
}

export async function logout() {
	if (browser && client) {
		client.authStore.clear();
	}

	await fetch('/api/auth/logout', {
		method: 'POST'
	});
}
