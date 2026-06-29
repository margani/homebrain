import { execFileSync } from 'node:child_process';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const pocketbaseSdkPattern = /node_modules[/\\](?:\.vite[/\\]deps[/\\])?pocketbase(?:\.js|[/\\])/;

function git(args: string[]) {
	try {
		return execFileSync('git', args, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
	} catch {
		return '';
	}
}

function formatUtcBuildTime(date = new Date()) {
	const pad = (value: number) => String(value).padStart(2, '0');

	return [
		date.getUTCFullYear(),
		'-',
		pad(date.getUTCMonth() + 1),
		'-',
		pad(date.getUTCDate()),
		' ',
		pad(date.getUTCHours()),
		':',
		pad(date.getUTCMinutes()),
		' UTC'
	].join('');
}

function normalizeRepositoryUrl(url: string) {
	const trimmed = url.trim();
	if (!trimmed) return '';

	const withoutGitSuffix = trimmed.replace(/\.git$/, '');
	if (withoutGitSuffix.startsWith('git@github.com:')) {
		return `https://github.com/${withoutGitSuffix.replace('git@github.com:', '')}`;
	}

	if (withoutGitSuffix.startsWith('https://github.com/')) {
		return withoutGitSuffix;
	}

	return '';
}

function populateBuildMetadata() {
	const configuredCommit = process.env.PUBLIC_GIT_COMMIT?.trim() ?? '';
	const configuredFullCommit = process.env.PUBLIC_GIT_COMMIT_FULL?.trim() ?? '';
	const cloudflareCommit = process.env.CF_PAGES_COMMIT_SHA?.trim() ?? '';
	const gitFullCommit = git(['rev-parse', 'HEAD']);
	const gitShortCommit = git(['rev-parse', '--short=7', 'HEAD']);
	const fullCommit =
		configuredFullCommit ||
		(configuredCommit.length > 7 ? configuredCommit : '') ||
		cloudflareCommit ||
		gitFullCommit ||
		configuredCommit ||
		gitShortCommit ||
		'unknown';
	const shortCommit =
		configuredCommit && configuredCommit.length <= 7
			? configuredCommit
			: fullCommit === 'unknown'
				? gitShortCommit || 'unknown'
				: fullCommit.slice(0, 7);

	process.env.PUBLIC_GIT_COMMIT = shortCommit;
	process.env.PUBLIC_GIT_COMMIT_FULL = fullCommit;
	process.env.PUBLIC_BUILD_TIME ||= formatUtcBuildTime();
	process.env.PUBLIC_REPOSITORY_URL ||= normalizeRepositoryUrl(git(['remote', 'get-url', 'origin']));
}

populateBuildMetadata();

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
