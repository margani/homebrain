import { env } from '$env/dynamic/public';

export function getPocketBaseUrl() {
	return env.PUBLIC_POCKETBASE_URL?.trim() ?? '';
}

export function isPocketBaseConfigured() {
	return getPocketBaseUrl().length > 0;
}
