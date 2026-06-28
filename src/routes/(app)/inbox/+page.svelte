<script lang="ts">
	import { Inbox, Notebook } from 'lucide-svelte';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Inbox - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Inbox</p>
		<h1>Recent memory</h1>
	</div>
	<p>Fresh captures, prompts, and activity waiting to be reviewed.</p>
</section>

<section class="split-grid">
	<article class="panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Prompts</p>
				<h2>Active</h2>
			</div>
			<span class="soft-icon"><Inbox size={20} /></span>
		</div>
		{#if data.activePrompts.length}
			<ul class="simple-list">
				{#each data.activePrompts as prompt}
					<li>
						<strong>{prompt.text}</strong>
						<span>{labelFromValue(prompt.prompt_type)} prompt</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">No active prompts.</p>
		{/if}
	</article>

	<article class="panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Events</p>
				<h2>Latest</h2>
			</div>
			<span class="soft-icon"><Notebook size={20} /></span>
		</div>
		{#if data.recentEvents.length}
			<ul class="note-list compact-list">
				{#each data.recentEvents as event}
					<li>
						<div class="note-meta">
							<strong>{event.title || labelFromValue(event.event_type)}</strong>
							<time datetime={event.happened_at || event.created}>{formatDateTime(event.happened_at || event.created)}</time>
						</div>
						{#if editorText(event.notes)}
							<p>{editorText(event.notes)}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">No recent events.</p>
		{/if}
	</article>
</section>
