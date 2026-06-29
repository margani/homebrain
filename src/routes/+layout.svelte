<script lang="ts">
	import {
		PUBLIC_BUILD_TIME,
		PUBLIC_GIT_COMMIT,
		PUBLIC_GIT_COMMIT_FULL,
		PUBLIC_REPOSITORY_URL
	} from '$env/static/public';
	import favicon from '$lib/assets/favicon.svg';
	import './app.css';

	let { children } = $props();

	const commit = PUBLIC_GIT_COMMIT || 'unknown';
	const fullCommit = PUBLIC_GIT_COMMIT_FULL || commit;
	const buildTime = PUBLIC_BUILD_TIME || 'unknown';
	const repositoryUrl = PUBLIC_REPOSITORY_URL?.replace(/\/$/, '') ?? '';
	const commitHref =
		repositoryUrl && fullCommit !== 'unknown' ? `${repositoryUrl}/commit/${fullCommit}` : '';
	const versionTitle = `Full commit: ${fullCommit}\nBuilt: ${buildTime}`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<footer class="app-version-footer" aria-label="Deployment version">
	<span>
		Version:
		{#if commitHref}
			<a href={commitHref} title={versionTitle} rel="noreferrer" target="_blank">{commit}</a>
		{:else}
			<span title={versionTitle}>{commit}</span>
		{/if}
	</span>
	<span>Built: {buildTime}</span>
</footer>
