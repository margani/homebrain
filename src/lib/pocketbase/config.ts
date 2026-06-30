import { browser } from '$app/environment';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

export function getPocketBaseUrl() {
	const configuredUrl = PUBLIC_POCKETBASE_URL.trim();
	if (configuredUrl) return configuredUrl;
	if (browser) return window.location.origin;

	return '';
}

export function isPocketBaseConfigured() {
	return getPocketBaseUrl().length > 0;
}
