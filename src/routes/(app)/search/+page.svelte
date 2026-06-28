<script lang="ts">
	import { Boxes, CalendarClock, Notebook, Search } from 'lucide-svelte';
	import { editorText, formatDate, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const hasResults = $derived(
		data.results.things.length || data.results.events.length || data.results.routines.length
	);
</script>

<svelte:head>
	<title>Search - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Search</p>
		<h1>Find home memory</h1>
	</div>
	<p>Search things, notes, events, and routines.</p>
</section>

<form class="search-form" method="GET" action="/search">
	<div class="input-shell search-shell">
		<Search size={19} />
		<input name="q" value={data.q} placeholder="Search pantry, batteries, filter change..." autocomplete="off" />
	</div>
	<button class="primary-action compact" type="submit">Search</button>
</form>

{#if data.q && hasResults}
	<section class="search-results">
		{#if data.results.things.length}
			<article class="panel">
				<div class="panel-heading">
					<h2>Things</h2>
					<span class="soft-icon"><Boxes size={19} /></span>
				</div>
				<ul class="simple-list">
					{#each data.results.things as thing}
						<li>
							<a href={`/things/${thing.id}`}>
								<strong>{thing.name}</strong>
								<span>{thing.expand?.location?.name ?? labelFromValue(thing.type)}</span>
							</a>
						</li>
					{/each}
				</ul>
			</article>
		{/if}

		{#if data.results.events.length}
			<article class="panel">
				<div class="panel-heading">
					<h2>Events</h2>
					<span class="soft-icon"><Notebook size={19} /></span>
				</div>
				<ul class="note-list compact-list">
					{#each data.results.events as event}
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
			</article>
		{/if}

		{#if data.results.routines.length}
			<article class="panel">
				<div class="panel-heading">
					<h2>Routines</h2>
					<span class="soft-icon"><CalendarClock size={19} /></span>
				</div>
				<ul class="record-list">
					{#each data.results.routines as routine}
						<li>
							<div>
								<strong>{routine.name}</strong>
								<span>{routine.expand?.thing?.name ?? 'Home routine'}</span>
							</div>
							<time datetime={routine.next_due_at}>{formatDate(routine.next_due_at)}</time>
						</li>
					{/each}
				</ul>
			</article>
		{/if}
	</section>
{:else if data.q}
	<section class="panel">
		<p class="empty-state">No results found for "{data.q}".</p>
	</section>
{:else}
	<section class="panel">
		<p class="empty-state">Type a phrase to search your HomeBrain records.</p>
	</section>
{/if}
