import { browser } from '$app/environment';
import PocketBase from 'pocketbase';
import { get } from 'svelte/store';
import { derived, writable } from 'svelte/store';
import { toAuthUser } from './auth';
import { getPocketBaseUrl, isPocketBaseConfigured } from './config';
import type { AuthUser, UserRecord } from './types';

let client: PocketBase | null = null;
let initPromise: Promise<AuthUser | null> | null = null;
const oauthRedirectStorageKey = 'homebrain.oauth2.redirect';
const oauthRedirectPath = '/oauth2-redirect';

interface StoredOAuthRedirect {
	provider: string;
	state: string;
	codeVerifier: string;
	redirectURL: string;
	returnTo: string;
}

export const pbConfigured = writable(isPocketBaseConfigured());
export const authReady = writable(false);
export const currentUser = writable<AuthUser | null>(null);
export const inboxCountVersion = writable(0);
export const isAuthenticated = derived(currentUser, ($currentUser) => Boolean($currentUser));

function setUserFromStore(pb: PocketBase) {
	currentUser.set(toAuthUser(pb.authStore.record, pb));
}

function oauthRedirectURL() {
	return new URL(oauthRedirectPath, window.location.origin).toString();
}

function readStoredOAuthRedirect() {
	const raw = window.localStorage.getItem(oauthRedirectStorageKey);
	if (!raw) return null;

	try {
		return JSON.parse(raw) as StoredOAuthRedirect;
	} catch {
		window.localStorage.removeItem(oauthRedirectStorageKey);
		return null;
	}
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
		client.authStore.onChange(() => {
			initPromise = null;
			setUserFromStore(client!);
		}, true);
	}

	return client;
}

export async function syncAuthFromStore(refresh = false) {
	if (!browser || !isPocketBaseConfigured()) {
		authReady.set(true);
		currentUser.set(null);
		return null;
	}

	const pb = getBrowserPb();

	if (!pb.authStore.isValid) {
		currentUser.set(null);
		authReady.set(true);
		return null;
	}

	if (refresh && pb.authStore.isValid) {
		try {
			await pb.collection('users').authRefresh<UserRecord>();
		} catch {
			pb.authStore.clear();
		}
	}

	setUserFromStore(pb);
	authReady.set(true);
	return get(currentUser);
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
	const authMethods = await pb.collection('users').listAuthMethods();
	const provider = authMethods.oauth2.providers.find((candidate) => candidate.name === 'google');

	if (!provider) {
		throw new Error('Google sign-in is not configured for this PocketBase instance.');
	}

	const redirectURL = oauthRedirectURL();
	window.localStorage.setItem(
		oauthRedirectStorageKey,
		JSON.stringify({
			provider: provider.name,
			state: provider.state,
			codeVerifier: provider.codeVerifier,
			redirectURL,
			returnTo: '/today'
		} satisfies StoredOAuthRedirect)
	);

	window.location.assign(provider.authURL + redirectURL);

	return new Promise<never>(() => {
		// Keep the caller pending while the browser leaves for Google.
	});
}

export async function completeOAuthRedirect() {
	const pb = getBrowserPb();
	const params = new URLSearchParams(window.location.search);
	const error = params.get('error') || params.get('error_description');
	const code = params.get('code');
	const state = params.get('state');
	const storedRedirect = readStoredOAuthRedirect();

	if (error) {
		window.localStorage.removeItem(oauthRedirectStorageKey);
		throw new Error(`Google sign-in failed: ${error}`);
	}

	if (!code || !state) {
		throw new Error('Google sign-in did not return a valid authorization code.');
	}

	if (!storedRedirect) {
		throw new Error('Google sign-in session expired. Please try again.');
	}

	if (storedRedirect.state !== state) {
		window.localStorage.removeItem(oauthRedirectStorageKey);
		throw new Error('Google sign-in state did not match. Please try again.');
	}

	const authData = await pb.collection('users').authWithOAuth2Code<UserRecord>(
		storedRedirect.provider,
		code,
		storedRedirect.codeVerifier,
		storedRedirect.redirectURL
	);

	window.localStorage.removeItem(oauthRedirectStorageKey);
	initPromise = null;
	setUserFromStore(pb);
	authReady.set(true);
	return {
		user: toAuthUser(authData.record, pb),
		returnTo: storedRedirect.returnTo
	};
}

export async function loginWithPassword(email: string, password: string) {
	const pb = getBrowserPb();
	const authData = await pb.collection('users').authWithPassword<UserRecord>(email, password);
	initPromise = null;
	setUserFromStore(pb);
	authReady.set(true);
	return toAuthUser(authData.record, pb);
}

export function logout() {
	if (browser && client) {
		client.authStore.clear();
	}

	initPromise = null;
	currentUser.set(null);
	authReady.set(true);
}

export function refreshInboxCount() {
	inboxCountVersion.update((version) => version + 1);
}
