<script lang="ts">
	import { Boxes } from 'lucide-svelte';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const thing = $derived(data.thing);
	const quantity = $derived(
		thing.quantity_text || [thing.quantity_number, thing.unit].filter(Boolean).join(' ')
	);
	const metadata = $derived(thing.metadata ? JSON.stringify(thing.metadata, null, 2) : '');
</script>

<svelte:head>
	<title>{thing.name} - HomeBrain</title>
</svelte:head>

<section class="detail-header">
	<a class="back-link" href="/things">Things</a>
	<div class="detail-title-row">
		<span class="soft-icon large"><Boxes size={24} /></span>
		<div>
			<p class="eyebrow">{labelFromValue(thing.type)}</p>
			<h1>{thing.name}</h1>
		</div>
	</div>
	<div class="tag-row">
		<span>{labelFromValue(thing.type)}</span>
		{#if thing.status}
			<span>{labelFromValue(thing.status)}</span>
		{/if}
	</div>
</section>

<section class="detail-grid">
	<article class="panel">
		<h2>Details</h2>
		<dl class="detail-list">
			<div>
				<dt>Location</dt>
				<dd>{thing.expand?.location?.name ?? 'Not set'}</dd>
			</div>
			<div>
				<dt>Quantity</dt>
				<dd>{quantity || 'Not set'}</dd>
			</div>
			<div>
				<dt>Created</dt>
				<dd>{formatDateTime(thing.created)}</dd>
			</div>
			<div>
				<dt>Updated</dt>
				<dd>{formatDateTime(thing.updated)}</dd>
			</div>
		</dl>
	</article>

	<article class="panel">
		<h2>Notes</h2>
		{#if editorText(thing.notes)}
			<p class="plain-note">{editorText(thing.notes)}</p>
		{:else}
			<p class="empty-state">No notes saved for this thing.</p>
		{/if}
	</article>

	{#if metadata}
		<article class="panel wide-panel">
			<h2>Metadata</h2>
			<pre class="metadata-block">{metadata}</pre>
		</article>
	{/if}
</section>
