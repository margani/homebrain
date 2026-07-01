<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Boxes, ChevronRight, LayoutGrid, List, Search, X } from 'lucide-svelte';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import {
		filterAndSortThings,
		matchesThingStatusScope,
		thingLocationSummary as locationSummary,
		uniqueThingCategories,
		uniqueThingLocations
	} from '$lib/pocketbase/things';
	import { thingStatusOptions, thingTypeOptions, type ThingStatus, type ThingType } from '$lib/pocketbase/types';
	import type { PageData } from './$types';

	type ViewMode = 'list' | 'tiles';
	type SortMode = 'updated' | 'name' | 'type' | 'status';
	type Thing = PageData['things'][number];
	let { data }: { data: PageData } = $props();

	let viewMode = $state<ViewMode>('list');
	let viewReady = $state(false);
	let searchTerm = $state('');
	let statusFilter = $state<ThingStatus | 'all'>('all');
	let categoryFilter = $state('all');
	let locationFilter = $state('all');
	let sortMode = $state<SortMode>('updated');

	onMount(() => {
		const saved = localStorage.getItem('homebrain.things.viewMode');
		if (saved === 'tiles' || saved === 'list') {
			viewMode = saved;
		}
		viewReady = true;
	});

	$effect(() => {
		if (viewReady) {
			localStorage.setItem('homebrain.things.viewMode', viewMode);
		}
	});

	function typeHref(type: ThingType | 'all') {
		return type === 'all' ? '/things' : `/things?type=${encodeURIComponent(type)}`;
	}

	function matchesStatusScope(thing: Thing) {
		return matchesThingStatusScope(thing, statusFilter);
	}

	function typeCount(type: ThingType) {
		return statusScopedThings.filter((thing) => thing.type === type).length;
	}

	function clearFilters() {
		searchTerm = '';
		statusFilter = 'all';
		categoryFilter = 'all';
		locationFilter = 'all';
		sortMode = 'updated';
		goto('/things', { noScroll: true, keepFocus: true });
	}

	const statusScopedThings = $derived(data.things.filter((thing) => matchesStatusScope(thing)));
	const typeChips = $derived(thingTypeOptions.filter((type) => typeCount(type) > 0));
	const categoryOptions = $derived(uniqueThingCategories(statusScopedThings));
	const hasUnassignedCategory = $derived(statusScopedThings.some((thing) => !thing.category));
	const locationOptions = $derived(uniqueThingLocations(statusScopedThings));
	const hasUnassignedLocation = $derived(statusScopedThings.some((thing) => !thing.location));
	const hasAnyFilters = $derived(
		Boolean(searchTerm.trim()) ||
			data.selectedType !== 'all' ||
			statusFilter !== 'all' ||
			categoryFilter !== 'all' ||
			locationFilter !== 'all' ||
			sortMode !== 'updated'
	);
	const filteredThings = $derived(filterAndSortThings(data.things, {
		search: searchTerm,
		type: data.selectedType,
		status: statusFilter,
		category: categoryFilter,
		location: locationFilter,
		sort: sortMode
	}));
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
	<section class="things-controls panel">
		<div class="things-toolbar">
			<div class="input-shell things-search">
				<Search size={18} />
				<input bind:value={searchTerm} type="search" placeholder="Search things, categories, notes, locations..." autocomplete="off" />
			</div>
			<div class="view-toggle" aria-label="View mode">
				<button class:active={viewMode === 'list'} type="button" onclick={() => (viewMode = 'list')} aria-pressed={viewMode === 'list'}>
					<List size={16} />
					List
				</button>
				<button class:active={viewMode === 'tiles'} type="button" onclick={() => (viewMode = 'tiles')} aria-pressed={viewMode === 'tiles'}>
					<LayoutGrid size={16} />
					Tiles
				</button>
			</div>
		</div>

		<nav class="thing-type-chip-row" aria-label="Thing type filters">
			<a class:active={data.selectedType === 'all'} class="thing-type-chip" href={typeHref('all')}>All ({statusScopedThings.length})</a>
			{#each typeChips as type}
				<a class:active={data.selectedType === type} class="thing-type-chip" href={typeHref(type)}>
					{type} ({typeCount(type)})
				</a>
			{/each}
		</nav>

		<div class="things-filter-grid">
			<label>
				Status
				<select bind:value={statusFilter}>
					<option value="all">All active statuses</option>
					{#each thingStatusOptions as status}
						<option value={status}>{labelFromValue(status)}</option>
					{/each}
				</select>
			</label>
			<label>
				Location
				<select bind:value={locationFilter}>
					<option value="all">All locations</option>
					{#if hasUnassignedLocation}
						<option value="none">No location</option>
					{/if}
					{#each locationOptions as location}
						<option value={location.id}>{location.name || location.path}</option>
					{/each}
				</select>
			</label>
			<label>
				Category
				<select bind:value={categoryFilter}>
					<option value="all">All categories</option>
					{#if hasUnassignedCategory}
						<option value="none">No category</option>
					{/if}
					{#each categoryOptions as category}
						<option value={category}>{category}</option>
					{/each}
				</select>
			</label>
			<label>
				Sort
				<select bind:value={sortMode}>
					<option value="updated">Recently updated</option>
					<option value="name">Name A-Z</option>
					<option value="type">Type</option>
					<option value="status">Status</option>
				</select>
			</label>
			{#if hasAnyFilters}
				<button class="ghost-action things-clear-action" type="button" onclick={clearFilters}>
					<X size={16} />
					Clear filters
				</button>
			{/if}
		</div>
	</section>

	{#if filteredThings.length}
		{#if viewMode === 'list'}
			<section class="things-list" aria-label="Things list">
				<div class="things-list-header" aria-hidden="true">
					<span>Name</span>
					<span>Type</span>
					<span>Status</span>
					<span>Category</span>
					<span>Location</span>
					<span>Updated</span>
					<span></span>
				</div>
				{#each filteredThings as thing}
					<article class="things-list-row">
						<div class="things-list-name">
							<a class="record-title-link" href={`/things/${thing.id}`}>{thing.name}</a>
							{#if editorText(thing.notes)}
								<p>{editorText(thing.notes)}</p>
							{/if}
						</div>
						<div class="things-list-cell">
							<span class="things-list-label">Type</span>
							<span class="status-pill">{labelFromValue(thing.type)}</span>
						</div>
						<div class="things-list-cell">
							<span class="things-list-label">Status</span>
							{#if thing.status}
								<span class="status-pill">{labelFromValue(thing.status)}</span>
							{:else}
								<span class="muted-value">Not set</span>
							{/if}
						</div>
						<div class="things-list-cell">
							<span class="things-list-label">Category</span>
							<span>{thing.category || 'Not set'}</span>
						</div>
						<div class="things-list-cell">
							<span class="things-list-label">Location</span>
							<span>{locationSummary(thing) || 'Not set'}</span>
						</div>
						<div class="things-list-cell">
							<span class="things-list-label">Updated</span>
							<time datetime={thing.updated}>{formatDateTime(thing.updated)}</time>
						</div>
						<a class="icon-button things-row-open" href={`/things/${thing.id}`} aria-label={`Open ${thing.name}`}>
							<ChevronRight size={18} />
						</a>
					</article>
				{/each}
			</section>
		{:else}
			<section class="thing-grid">
				{#each filteredThings as thing}
					<a class="thing-card" href={`/things/${thing.id}`}>
						<div class="thing-card-top">
							<span class="soft-icon"><Boxes size={19} /></span>
							<ChevronRight size={18} />
						</div>
						<div>
							<h2>{thing.name}</h2>
							<p>{locationSummary(thing) || labelFromValue(thing.type)}</p>
						</div>
						<div class="tag-row">
							<span>{labelFromValue(thing.type)}</span>
							{#if thing.category}
								<span>{thing.category}</span>
							{/if}
							{#if thing.status}
								<span>{labelFromValue(thing.status)}</span>
							{/if}
						</div>
						{#if editorText(thing.notes)}
							<p class="thing-summary">
								{editorText(thing.notes)}
							</p>
						{/if}
					</a>
				{/each}
			</section>
		{/if}
	{:else}
		<section class="panel empty-inbox">
			<span class="soft-icon"><Boxes size={20} /></span>
			<div>
				<h2>No things match these filters</h2>
				<p class="empty-state">Try a broader search or clear the active filters.</p>
				<button class="secondary-action compact icon-text" type="button" onclick={clearFilters}>
					<X size={16} />
					Clear filters
				</button>
			</div>
		</section>
	{/if}
{:else}
	<section class="panel empty-inbox">
		<span class="soft-icon"><Boxes size={20} /></span>
		<div>
			<h2>No things saved yet</h2>
			<p class="empty-state">Create your first Thing to start building HomeBrain memory.</p>
			<a class="primary-action compact icon-text" href="/things/new">New thing</a>
		</div>
	</section>
{/if}
