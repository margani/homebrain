import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const pocketbaseSdkPattern = /node_modules[/\\](?:\.vite[/\\]deps[/\\])?pocketbase(?:\.js|[/\\])/;

export default defineConfig({
	plugins: [
		{
			name: 'homebrain-pocketbase-import-method-compat',
			enforce: 'pre',
			transform(code, id) {
				if (!pocketbaseSdkPattern.test(id)) return null;
				if (!code.includes('async import(')) return null;

				// Prevent Vite from mistaking PocketBase's admin method name for dynamic import(...).
				return code.replaceAll('async import(', 'async ["import"](');
			}
		},
		sveltekit()
	]
});
