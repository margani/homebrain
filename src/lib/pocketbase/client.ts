import { browser } from '$app/environment';
import PocketBase from 'pocketbase';
import { get } from 'svelte/store';
import { derived, writable } from 'svelte/store';
import { toAuthUser } from './auth';
import { getPocketBaseUrl, isPocketBaseConfigured } from './config';
import type { AuthUser, UserRecord } from './types';

let client: PocketBase | null = null;
let initPromise: Promise<AuthUser | null> | null = null;

export const pbConfigured = writable(isPocketBaseConfigured());
export const authReady = writable(false);
export const currentUser = writable<AuthUser | null>(null);
export const inboxCountVersion = writable(0);
export const isAuthenticated = derived(currentUser, ($currentUser) => Boolean($currentUser));

function setUserFromStore(pb: PocketBase) {
	currentUser.set(toAuthUser(pb.authStore.record, pb));
}

export function getBrowserPb() {
	if (!browser) {
		throw new Error('PocketBase browser client is only available in the browser.');
	}

	if (!client) {
		const url = getPocketBaseUrl();
		if (!url) throw new Error('PUBLIC_POCKETBASE_URL is not configured.');

		client = new PocketBase(url);
		client.autoCancellation(false);
		client.authStore.onChange(() => setUserFromStore(client!), true);
	}

	return client;
}

export async function initAuth() {
	if (!browser) {
		authReady.set(true);
		return null;
	}

	if (initPromise) return initPromise;

	initPromise = (async () => {
		pbConfigured.set(isPocketBaseConfigured());

		if (!isPocketBaseConfigured()) {
			authReady.set(true);
			currentUser.set(null);
			return null;
		}

		const pb = getBrowserPb();

		if (pb.authStore.isValid) {
			try {
				await pb.collection('users').authRefresh<UserRecord>();
			} catch {
				pb.authStore.clear();
			}
		}

		setUserFromStore(pb);
		authReady.set(true);
		return get(currentUser);
	})();

	return initPromise;
}

export function currentBrowserUser(): AuthUser | null {
	if (!browser || !isPocketBaseConfigured()) return null;

	try {
		return toAuthUser(getBrowserPb().authStore.record, getBrowserPb());
	} catch {
		return null;
	}
}

export async function requireUser() {
	const user = await initAuth();
	if (!user) throw new Error('Sign in again before continuing.');
	return user;
}

export async function loginWithGoogle() {
	const pb = getBrowserPb();
	const authData = await pb.collection('users').authWithOAuth2<UserRecord>({ provider: 'google' });
	setUserFromStore(pb);
	authReady.set(true);
	return toAuthUser(authData.record, pb);
}

export async function loginWithPassword(email: string, password: string) {
	const pb = getBrowserPb();
	const authData = await pb.collection('users').authWithPassword<UserRecord>(email, password);
	setUserFromStore(pb);
	authReady.set(true);
	return toAuthUser(authData.record, pb);
}

export function logout() {
	if (browser && client) {
		client.authStore.clear();
	}

	currentUser.set(null);
	authReady.set(true);
}

export function refreshInboxCount() {
	inboxCountVersion.update((version) => version + 1);
}
