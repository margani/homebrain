<script lang="ts">
	import { Activity, Boxes, Check, Link2, NotebookText, RotateCcw, X } from 'lucide-svelte';
	import { getBrowserPb, requireUser } from '$lib/pocketbase/client';
	import {
		linkMemoryEventToThing,
		setNoteEventReviewState,
		type NoteReviewState
	} from '$lib/pocketbase/data';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { JsonValue } from '$lib/pocketbase/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const reviewStates: NoteReviewState[] = ['new', 'reviewed', 'dismissed'];
	let noteOverride = $state<PageData['note'] | null>(null);
	let noteError = $state('');
	let noteMessage = $state('');
	let isSaving = $state(false);

	const note = $derived(noteOverride?.id === data.note.id ? noteOverride : data.note);
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

	async function handleReviewState(event: SubmitEvent) {
		event.preventDefault();
		const submitter = event.submitter;
		const stateValue =
			submitter instanceof HTMLButtonElement ? String(submitter.value ?? '') : '';
		if (!reviewStates.includes(stateValue as NoteReviewState)) {
			noteError = 'Choose a valid review state.';
			return;
		}

		isSaving = true;
		noteError = '';
		noteMessage = '';

		try {
			const user = await requireUser();
			noteOverride = await setNoteEventReviewState(
				getBrowserPb(),
				user.id,
				note.id,
				stateValue as NoteReviewState
			);
			noteMessage = 'Review state updated';
		} catch (error) {
			noteError = error instanceof Error ? error.message : 'The note review state could not be updated.';
		} finally {
			isSaving = false;
		}
	}

	async function handleLinkThing(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) return;
		const formData = new FormData(form);
		const thingId = String(formData.get('thing_id') ?? '').trim();
		if (!thingId) {
			noteError = 'Choose a thing to link.';
			return;
		}

		isSaving = true;
		noteError = '';
		noteMessage = '';

		try {
			const user = await requireUser();
			const updated = await linkMemoryEventToThing(getBrowserPb(), user.id, note.id, thingId);
			const thing = data.things.find((item) => item.id === thingId);
			noteOverride = {
				...updated,
				expand: {
					...updated.expand,
					...(thing ? { thing } : {})
				}
			};
			noteMessage = 'Linked to thing';
		} catch (error) {
			noteError = error instanceof Error ? error.message : 'The record could not be linked to that thing.';
		} finally {
			isSaving = false;
		}
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

{#if noteError}
	<section class="panel">
		<p class="notice error">{noteError}</p>
	</section>
{:else if noteMessage}
	<section class="panel">
		<p class="notice success">{noteMessage}</p>
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
				<p class="eyebrow">Link</p>
				<h2>Thing</h2>
			</div>
			<span class="soft-icon"><Link2 size={20} /></span>
		</div>
		{#if data.things.length}
			<form method="POST" class="note-link-form" onsubmit={handleLinkThing}>
				<label>
					Thing
					<select name="thing_id" required>
						<option value="" disabled selected={!note.thing}>Select a thing</option>
						{#each data.things as thing}
							<option value={thing.id} selected={thing.id === note.thing}>
								{thing.name} · {labelFromValue(thing.type)}
							</option>
						{/each}
					</select>
				</label>
				<button class="primary-action compact" type="submit" disabled={isSaving}>
					<Link2 size={16} />
					Link to thing
				</button>
			</form>
		{:else}
			<p class="empty-state">No things are available to link yet.</p>
		{/if}
	</article>

	<article class="panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Review</p>
				<h2>Change state</h2>
			</div>
		</div>
		<p class="panel-copy">This changes archive state only. The note record remains saved.</p>
		<form method="POST" class="note-state-form" onsubmit={handleReviewState}>
			<button class="secondary-action compact" type="submit" name="state" value="new" disabled={isSaving}>
				<RotateCcw size={16} />
				Mark new
			</button>
			<button class="primary-action compact" type="submit" name="state" value="reviewed" disabled={isSaving}>
				<Check size={16} />
				Mark reviewed
			</button>
			<button class="secondary-action compact" type="submit" name="state" value="dismissed" disabled={isSaving}>
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
