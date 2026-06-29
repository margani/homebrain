import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

export function getPocketBaseUrl() {
	return PUBLIC_POCKETBASE_URL.trim();
}

export function isPocketBaseConfigured() {
	return getPocketBaseUrl().length > 0;
}
