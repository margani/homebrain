<script lang="ts">
	import { Activity, Boxes, Check, NotebookText, RotateCcw, X } from 'lucide-svelte';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { JsonValue } from '$lib/pocketbase/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	const note = $derived(data.note);
	const metadata = $derived(metadataFor(note));
	const metadataText = $derived(
		Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : ''
	);

	function metadataFor(record: { metadata?: JsonValue }) {
		if (record.metadata && !Array.isArray(record.metadata) && typeof record.metadata === 'object') {
			return record.metadata;
		}

		return {};
	}

	function isDismissed() {
		return metadata.dismissed === true;
	}

	function isReviewed() {
		return (metadata.reviewed === true || metadata.processed === true) && metadata.dismissed !== true;
	}

	function isNew() {
		return metadata.reviewed !== true && metadata.processed !== true && metadata.dismissed !== true;
	}

	function currentState() {
		if (isDismissed()) return 'Dismissed';
		if (isReviewed()) return 'Reviewed';
		return 'New';
	}

	function noteTitle() {
		return note.title || editorText(note.notes) || 'Untitled note';
	}

	function noteBody() {
		return editorText(note.notes);
	}
</script>

<svelte:head>
	<title>{noteTitle()} - HomeBrain</title>
</svelte:head>

<section class="detail-header">
	<a class="back-link" href="/notes">Notes</a>
	<div class="detail-title-row">
		<span class="soft-icon large">
			{#if note.event_type === 'activity'}
				<Activity size={24} />
			{:else}
				<NotebookText size={24} />
			{/if}
		</span>
		<div>
			<p class="eyebrow">{labelFromValue(note.event_type)}</p>
			<h1>{noteTitle()}</h1>
		</div>
	</div>
	<div class="tag-row">
		<span>{currentState()}</span>
		{#if note.thing}
			<span>Linked</span>
		{/if}
	</div>
</section>

{#if form?.noteError}
	<section class="panel">
		<p class="notice error">{form.noteError}</p>
	</section>
{:else if form?.noteSaved}
	<section class="panel">
		<p class="notice success">{form.message ?? 'Saved'}</p>
	</section>
{/if}

<section class="detail-grid">
	<article class="panel">
		<h2>Record</h2>
		<dl class="detail-list">
			<div>
				<dt>Review state</dt>
				<dd>{currentState()}</dd>
			</div>
			<div>
				<dt>Type</dt>
				<dd>{labelFromValue(note.event_type)}</dd>
			</div>
			<div>
				<dt>Happened</dt>
				<dd>{formatDateTime(note.happened_at || note.created)}</dd>
			</div>
			<div>
				<dt>Created</dt>
				<dd>{formatDateTime(note.created)}</dd>
			</div>
			<div>
				<dt>Updated</dt>
				<dd>{formatDateTime(note.updated)}</dd>
			</div>
		</dl>
	</article>

	<article class="panel">
		<h2>Note</h2>
		{#if noteBody()}
			<p class="plain-note">{noteBody()}</p>
		{:else if note.event_type === 'activity' && metadata.activity_type}
			<p class="plain-note">
				{labelFromValue(String(metadata.activity_type))}
				{#if metadata.duration_minutes}
					· {metadata.duration_minutes} min
				{/if}
			</p>
		{:else}
			<p class="empty-state">No note body saved.</p>
		{/if}
	</article>

	{#if note.expand?.thing}
		<article class="panel">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">Linked</p>
					<h2>{note.expand.thing.name}</h2>
				</div>
				<span class="soft-icon"><Boxes size={20} /></span>
			</div>
			<p class="panel-copy">{labelFromValue(note.expand.thing.type)}</p>
			<a class="secondary-action compact icon-text" href={`/things/${note.expand.thing.id}`}>
				<Boxes size={17} />
				Open thing
			</a>
		</article>
	{/if}

	<article class="panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Review</p>
				<h2>Change state</h2>
			</div>
		</div>
		<p class="panel-copy">This changes archive state only. The note record remains saved.</p>
		<form method="POST" action="?/reviewState" class="note-state-form">
			<button class="secondary-action compact" type="submit" name="state" value="new">
				<RotateCcw size={16} />
				Mark new
			</button>
			<button class="primary-action compact" type="submit" name="state" value="reviewed">
				<Check size={16} />
				Mark reviewed
			</button>
			<button class="secondary-action compact" type="submit" name="state" value="dismissed">
				<X size={16} />
				Dismiss
			</button>
		</form>
	</article>

	{#if metadataText}
		<article class="panel wide-panel">
			<h2>Metadata</h2>
			<pre class="metadata-block">{metadataText}</pre>
		</article>
	{/if}
</section>
