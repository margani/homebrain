<script lang="ts">
	import { Activity, Boxes, ChevronRight, Inbox, NotebookText } from 'lucide-svelte';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { JsonValue } from '$lib/pocketbase/types';
	import type { PageData } from './$types';

	type NoteFilter = PageData['filter'];
	type NoteItem = PageData['notes'][number];

	let { data }: { data: PageData } = $props();

	const filters: { value: NoteFilter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'new', label: 'New' },
		{ value: 'reviewed', label: 'Reviewed' },
		{ value: 'dismissed', label: 'Dismissed' },
		{ value: 'linked', label: 'Linked' },
		{ value: 'activity', label: 'Activity' }
	];

	function filterHref(filter: NoteFilter) {
		return filter === 'all' ? '/notes' : `/notes?filter=${filter}`;
	}

	function metadataFor(note: { metadata?: JsonValue }) {
		if (note.metadata && !Array.isArray(note.metadata) && typeof note.metadata === 'object') {
			return note.metadata;
		}

		return {};
	}

	function isDismissed(note: NoteItem) {
		return metadataFor(note).dismissed === true;
	}

	function isReviewed(note: NoteItem) {
		const metadata = metadataFor(note);
		return (metadata.reviewed === true || metadata.processed === true) && metadata.dismissed !== true;
	}

	function isNew(note: NoteItem) {
		const metadata = metadataFor(note);
		return metadata.reviewed !== true && metadata.processed !== true && metadata.dismissed !== true;
	}

	function noteBadges(note: NoteItem) {
		const badges: string[] = [];
		if (isNew(note)) badges.push('New');
		if (isReviewed(note)) badges.push('Reviewed');
		if (isDismissed(note)) badges.push('Dismissed');
		if (note.thing) badges.push('Linked');
		return badges;
	}

	function noteTitle(note: NoteItem) {
		return note.title || editorText(note.notes) || 'Untitled note';
	}

	function noteSummary(note: NoteItem) {
		const text = editorText(note.notes);
		if (text && text !== note.title) return text;

		const metadata = metadataFor(note);
		if (note.event_type === 'activity' && metadata.activity_type) {
			return [
				labelFromValue(String(metadata.activity_type)),
				metadata.duration_minutes ? `${metadata.duration_minutes} min` : ''
			]
				.filter(Boolean)
				.join(' · ');
		}

		return '';
	}
</script>

<svelte:head>
	<title>Notes - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Notes</p>
		<h1>Quick capture archive</h1>
	</div>
	<p>Every quick capture remains here after Inbox review.</p>
</section>

<nav class="filter-tabs" aria-label="Note filters">
	{#each filters as filter}
		<a class:active={data.filter === filter.value} href={filterHref(filter.value)}>{filter.label}</a>
	{/each}
</nav>

{#if data.notes.length}
	<section class="notes-archive-list">
		{#each data.notes as note}
			<article class="panel note-archive-card">
				<div class="note-archive-main">
					<span class="soft-icon">
						{#if note.event_type === 'activity'}
							<Activity size={19} />
						{:else}
							<NotebookText size={19} />
						{/if}
					</span>
					<div>
						<a class="record-title-link" href={`/notes/${note.id}`}>{noteTitle(note)}</a>
						<div class="note-meta">
							<span>{labelFromValue(note.event_type)}</span>
							<time datetime={note.happened_at || note.created}>{formatDateTime(note.happened_at || note.created)}</time>
						</div>
					</div>
					<a class="icon-button note-open-button" href={`/notes/${note.id}`} aria-label={`Open ${noteTitle(note)}`}>
						<ChevronRight size={18} />
					</a>
				</div>

				{#if noteSummary(note)}
					<p class="plain-note note-archive-summary">{noteSummary(note)}</p>
				{/if}

				<div class="note-badge-row">
					{#each noteBadges(note) as badge}
						<span class:danger-pill={badge === 'Dismissed'}>{badge}</span>
					{/each}
					{#if note.expand?.thing}
						<a class="linked-note-pill" href={`/things/${note.expand.thing.id}`}>
							<Boxes size={14} />
							{note.expand.thing.name}
						</a>
					{/if}
				</div>
			</article>
		{/each}
	</section>
{:else}
	<section class="panel empty-inbox">
		<span class="soft-icon"><Inbox size={20} /></span>
		<div>
			<h2>No notes found</h2>
			<p class="empty-state">Quick captures will appear here after they are saved.</p>
		</div>
	</section>
{/if}
