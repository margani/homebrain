import adapter from '@sveltejs/adapter-auto';
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
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	]
});
