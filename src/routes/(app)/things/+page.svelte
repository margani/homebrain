<script lang="ts">
	import { Boxes, ChevronRight } from 'lucide-svelte';
	import { editorText, labelFromValue } from '$lib/pocketbase/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Things - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Things</p>
		<h1>Home memory</h1>
	</div>
	<div class="header-actions">
		<p>Inventory, routines, notes, and household things in one quiet list.</p>
		<a class="primary-action compact" href="/things/new">New thing</a>
	</div>
</section>

{#if data.things.length}
	<section class="thing-grid">
		{#each data.things as thing}
			<a class="thing-card" href={`/things/${thing.id}`}>
				<div class="thing-card-top">
					<span class="soft-icon"><Boxes size={19} /></span>
					<ChevronRight size={18} />
				</div>
				<div>
					<h2>{thing.name}</h2>
					<p>{thing.expand?.location?.name ?? labelFromValue(thing.type)}</p>
				</div>
				<div class="tag-row">
					<span>{labelFromValue(thing.type)}</span>
					{#if thing.status}
						<span>{labelFromValue(thing.status)}</span>
					{/if}
				</div>
				{#if thing.quantity_text || thing.quantity_number || editorText(thing.notes)}
					<p class="thing-summary">
						{thing.quantity_text || [thing.quantity_number, thing.unit].filter(Boolean).join(' ') || editorText(thing.notes)}
					</p>
				{/if}
			</a>
		{/each}
	</section>
{:else}
	<section class="panel">
		<p class="empty-state">No things are saved yet.</p>
	</section>
{/if}
