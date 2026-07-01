<script lang="ts">
	import { Activity, Boxes, NotebookText } from 'lucide-svelte';
	import ThingForm from '$lib/components/ThingForm.svelte';
	import { getBrowserPb, requireUser } from '$lib/pocketbase/client';
	import { createLocation, updateThing } from '$lib/pocketbase/data';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { ParsedThingForm } from '$lib/pocketbase/forms';
	import type { JsonValue } from '$lib/pocketbase/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let localThing = $state<PageData['thing'] | null>(null);
	let localLocations = $state<PageData['locations']>([]);

	const thing = $derived(localThing?.id === data.thing.id ? localThing : data.thing);
	const locations = $derived(
		[...localLocations, ...data.locations]
			.filter((location, index, items) => items.findIndex((item) => item.id === location.id) === index)
			.sort((a, b) => (a.path || a.name || '').localeCompare(b.path || b.name || ''))
	);
	const metadata = $derived(thing.metadata ? JSON.stringify(thing.metadata, null, 2) : '');

	function eventTitle(event: PageData['relatedEvents'][number]) {
		return event.title || editorText(event.notes) || labelFromValue(event.event_type);
	}

	function eventMetadata(event: { metadata?: JsonValue }) {
		if (event.metadata && !Array.isArray(event.metadata) && typeof event.metadata === 'object') {
			return event.metadata;
		}

		return {};
	}

	function eventSummary(event: PageData['relatedEvents'][number]) {
		const text = editorText(event.notes);
		if (text && text !== event.title) return text;

		const eventMeta = eventMetadata(event);
		if (event.event_type === 'activity' && eventMeta.activity_type) {
			return [
				labelFromValue(String(eventMeta.activity_type)),
				eventMeta.duration_minutes ? `${eventMeta.duration_minutes} min` : ''
			]
				.filter(Boolean)
				.join(' · ');
		}

		return '';
	}

	async function saveThing(parsed: ParsedThingForm) {
		const user = await requireUser();
		const pb = getBrowserPb();

		if (parsed.newLocation) {
			const location = await createLocation(pb, user.id, parsed.newLocation);
			parsed.thing.location = location.id;
			localLocations = [
				location,
				...locations.filter((item) => item.id !== location.id)
			].sort((a, b) => (a.path || a.name || '').localeCompare(b.path || b.name || ''));
		}

		localThing = await updateThing(pb, thing.id, parsed.thing);
	}
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

	<article class="panel wide-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Memory</p>
				<h2>Related notes and activities</h2>
			</div>
		</div>
		{#if data.relatedEvents.length}
			<ul class="note-list">
				{#each data.relatedEvents as event}
					<li>
						<div class="note-meta">
							<div class="inline-record-link">
								{#if event.event_type === 'activity'}
									<Activity size={15} />
								{:else}
									<NotebookText size={15} />
								{/if}
								<a href={`/notes/${event.id}`}>{eventTitle(event)}</a>
							</div>
							<div class="dashboard-pill-row">
								<span class="status-pill">{labelFromValue(event.event_type)}</span>
								<time datetime={event.happened_at || event.created}>{formatDateTime(event.happened_at || event.created)}</time>
							</div>
						</div>
						{#if eventSummary(event)}
							<p>{eventSummary(event)}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">Linked notes and activities will appear here.</p>
		{/if}
	</article>

	<article class="panel wide-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Edit</p>
				<h2>Update thing</h2>
			</div>
		</div>
		<ThingForm
			thing={thing}
			locations={locations}
			onSave={saveThing}
			submitLabel="Save changes"
			pendingLabel="Updating..."
			pendingMessage="Updating thing..."
			locationPendingMessage="Updating thing and creating location..."
			successMessage="Saved"
		/>
	</article>
</section>
