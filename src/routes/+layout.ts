import { initAuth } from '$lib/pocketbase/client';

export const ssr = false;

export async function load() {
	await initAuth();
}
