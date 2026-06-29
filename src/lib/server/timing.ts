import { dev } from '$app/environment';

export async function timeAction<T>(label: string, action: () => Promise<T>) {
	const start = performance.now();

	try {
		return await action();
	} finally {
		if (dev) {
			console.info(`[action] ${label} ${Math.round(performance.now() - start)}ms`);
		}
	}
}
