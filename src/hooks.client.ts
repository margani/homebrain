import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = function ({ error }) {
	console.error(error);
};
