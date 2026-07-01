<script lang="ts">
	import { Ruler, X } from 'lucide-svelte';
	import { editorText, formatDateTime } from '$lib/pocketbase/format';
	import { metricMetadataFor } from '$lib/pocketbase/data';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let categoryFilter = $state('all');
	let thingFilter = $state('all');
	let unitFilter = $state('all');

	function categoryFor(event: PageData['metricEvents'][number]) {
		return event.expand?.thing?.category || '';
	}

	function thingNameFor(event: PageData['metricEvents'][number]) {
		return event.expand?.thing?.name || event.title || 'Measurement';
	}

	const categoryOptions = $derived(
		[...new Set(data.metricEvents.map((event) => categoryFor(event)).filter(Boolean))].sort()
	);
	const thingOptions = $derived(
		data.things
			.filter((thing) => data.metricEvents.some((event) => event.thing === thing.id))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const unitOptions = $derived(
		[
			...new Set(
				data.metricEvents
					.map((event) => metricMetadataFor(event).metric_unit)
					.filter(Boolean)
			)
		].sort()
	);
	const hasFilters = $derived(
		categoryFilter !== 'all' || thingFilter !== 'all' || unitFilter !== 'all'
	);
	const filteredEvents = $derived(
		data.metricEvents.filter((event) => {
			const metric = metricMetadataFor(event);
			if (categoryFilter !== 'all' && categoryFor(event) !== categoryFilter) return false;
			if (thingFilter !== 'all' && event.thing !== thingFilter) return false;
			if (unitFilter !== 'all' && metric.metric_unit !== unitFilter) return false;
			return true;
		})
	);

	function clearFilters() {
		categoryFilter = 'all';
		thingFilter = 'all';
		unitFilter = 'all';
	}
</script>

<svelte:head>
	<title>Metrics - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Metrics</p>
		<h1>Measurements</h1>
	</div>
	<p>Measurement events linked to stable HomeBrain topics.</p>
</section>

<section class="things-controls panel">
	<div class="things-filter-grid">
		<label>
			Category
			<select bind:value={categoryFilter}>
				<option value="all">All categories</option>
				{#each categoryOptions as category}
					<option value={category}>{category}</option>
				{/each}
			</select>
		</label>
		<label>
			Topic
			<select bind:value={thingFilter}>
				<option value="all">All topics</option>
				{#each thingOptions as thing}
					<option value={thing.id}>{thing.name}</option>
				{/each}
			</select>
		</label>
		<label>
			Unit
			<select bind:value={unitFilter}>
				<option value="all">All units</option>
				{#each unitOptions as unit}
					<option value={unit}>{unit}</option>
				{/each}
			</select>
		</label>
		{#if hasFilters}
			<button class="ghost-action things-clear-action" type="button" onclick={clearFilters}>
				<X size={16} />
				Clear filters
			</button>
		{/if}
	</div>
</section>

{#if filteredEvents.length}
	<section class="metrics-list" aria-label="Metrics list">
		{#each filteredEvents as event}
			{@const metric = metricMetadataFor(event)}
			<article class="panel metric-card">
				<span class="soft-icon"><Ruler size={18} /></span>
				<div>
					<a class="record-title-link" href={event.thing ? `/things/${event.thing}` : '/metrics'}>{thingNameFor(event)}</a>
					<div class="dashboard-pill-row metric-meta-row">
						{#if categoryFor(event)}
							<span class="status-pill">{categoryFor(event)}</span>
						{/if}
						<time datetime={event.happened_at || event.created}>{formatDateTime(event.happened_at || event.created)}</time>
					</div>
					{#if editorText(event.notes)}
						<p>{editorText(event.notes)}</p>
					{/if}
				</div>
				<strong>{metric.metric_value} {metric.metric_unit}</strong>
			</article>
		{/each}
	</section>
{:else}
	<section class="panel empty-inbox">
		<span class="soft-icon"><Ruler size={20} /></span>
		<div>
			<h2>No measurements found</h2>
			<p class="empty-state">Metric observations will appear here after inbox review.</p>
		</div>
	</section>
{/if}
