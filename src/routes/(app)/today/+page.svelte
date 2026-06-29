<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		CalendarClock,
		Check,
		Frown,
		Meh,
		Notebook,
		Plus,
		ShoppingBasket,
		Smile
	} from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import {
		editorText,
		firstNonEmptyLine,
		formatDate,
		formatDateTime,
		labelFromValue
	} from '$lib/pocketbase/format';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	type RecentNote = PageData['recentNotes'][number];
	type CaptureResultData = { captureSaved?: boolean; note?: RecentNote };

	const moodOptions = [
		{ label: 'Good', icon: Smile },
		{ label: 'Okay', icon: Meh },
		{ label: 'Bad', icon: Frown }
	];

	let captureSubmitting = $state(false);
	let captureText = $state('');
	let doneSubmittingId = $state<string | null>(null);
	let hiddenDoneRoutineIds = $state<string[]>([]);
	let pendingRecentNotes = $state<RecentNote[]>([]);
	let showCaptureSaved = $state(false);
	let hideCaptureServerSaved = $state(false);
	let hideDoneServerSaved = $state(false);
	let doneSavedId = $state<string | null>(null);
	let captureSavedTimer: ReturnType<typeof setTimeout> | undefined;
	let doneSavedTimer: ReturnType<typeof setTimeout> | undefined;

	const dueSoon = $derived(
		data.dueSoon.filter((routine) => !hiddenDoneRoutineIds.includes(routine.id))
	);
	const recentNotes = $derived(
		[...pendingRecentNotes, ...data.recentNotes]
			.filter((note, index, notes) => notes.findIndex((item) => item.id === note.id) === index)
			.slice(0, 6)
	);

	function flashCaptureSaved() {
		showCaptureSaved = true;
		hideCaptureServerSaved = false;
		if (captureSavedTimer) clearTimeout(captureSavedTimer);
		captureSavedTimer = setTimeout(() => {
			showCaptureSaved = false;
			hideCaptureServerSaved = true;
		}, 2000);
	}

	function flashDone(routineId: string) {
		doneSavedId = routineId;
		hideDoneServerSaved = false;
		if (doneSavedTimer) clearTimeout(doneSavedTimer);
		doneSavedTimer = setTimeout(() => {
			doneSavedId = null;
			hideDoneServerSaved = true;
		}, 2000);
	}

	function optimisticNote(text: string): RecentNote {
		const now = new Date().toISOString();

		return {
			id: `pending-${Date.now()}`,
			collectionId: 'events',
			collectionName: 'events',
			user: data.user?.id ?? '',
			event_type: 'note',
			title: firstNonEmptyLine(text) ?? 'Untitled note',
			notes: text,
			happened_at: now,
			created: now,
			updated: now
		};
	}

	const captureEnhance: SubmitFunction = ({ cancel, formData }) => {
		if (captureSubmitting) {
			cancel();
			return;
		}

		const text = String(formData.get('text') ?? '').trim();
		const pendingNote = optimisticNote(text);
		captureSubmitting = true;
		captureText = '';
		pendingRecentNotes = [pendingNote, ...pendingRecentNotes].slice(0, 6);
		const endPendingWork = beginPendingWork();

		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: false });
			endPendingWork();
			captureSubmitting = false;

			if (result.type === 'success') {
				const savedNote = (result.data as CaptureResultData | undefined)?.note;
				if (savedNote) {
					pendingRecentNotes = pendingRecentNotes.map((note) =>
						note.id === pendingNote.id ? savedNote : note
					);
				}
				flashCaptureSaved();
				await invalidate('homebrain:inbox-count');
			} else {
				pendingRecentNotes = pendingRecentNotes.filter((note) => note.id !== pendingNote.id);
				captureText = text;
			}
		};
	};

	function routineDoneEnhance(routineId: string): SubmitFunction {
		return ({ cancel }) => {
			if (doneSubmittingId) {
				cancel();
				return;
			}

			doneSubmittingId = routineId;
			hiddenDoneRoutineIds = [...hiddenDoneRoutineIds, routineId];
			const endPendingWork = beginPendingWork();

			return async ({ result, update }) => {
				await update({ invalidateAll: false });
				endPendingWork();
				doneSubmittingId = null;

				if (result.type === 'success') {
					flashDone(routineId);
				} else {
					hiddenDoneRoutineIds = hiddenDoneRoutineIds.filter((id) => id !== routineId);
				}
			};
		};
	}
</script>

<svelte:head>
	<title>Today - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Today</p>
		<h1>Home dashboard</h1>
	</div>
	<p>A calm scan of what needs attention around home.</p>
</section>

<section class="today-grid">
	<article class="panel mood-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Check in</p>
				<h2>Mood</h2>
			</div>
			<span class="soft-icon"><Smile size={20} /></span>
		</div>
		<div class="mood-row" aria-label="Mood check-in placeholder">
			{#each moodOptions as mood}
				{@const Icon = mood.icon}
				<button class="mood-choice" type="button" disabled title="Mood check-in coming soon">
					<Icon size={20} />
					<span>{mood.label}</span>
				</button>
			{/each}
		</div>
	</article>

	<article class="panel capture-panel pending-region">
		<PendingOverlay active={captureSubmitting} message="Saving your note..." />
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Capture</p>
				<h2>Quick note</h2>
			</div>
			<span class="soft-icon"><Plus size={20} /></span>
		</div>
		<form method="POST" action="?/capture" class="capture-form" use:enhance={captureEnhance}>
			<textarea
				name="text"
				rows="6"
				bind:value={captureText}
				placeholder="First line becomes the title. Add the full note here."
				required
			></textarea>
			<div class="form-footer">
				{#if showCaptureSaved || (form?.captureSaved && !hideCaptureServerSaved)}
					<p class="notice success">Saved</p>
				{:else if form?.captureError}
					<p class="notice error">{form.captureError}</p>
				{:else}
					<p class="hint">Stored as an event note with the current time.</p>
				{/if}
				<button class="primary-action compact" type="submit" disabled={captureSubmitting} aria-busy={captureSubmitting}>
					{#if captureSubmitting}
						<span class="loading-spinner light" aria-hidden="true"></span>
						Saving...
					{:else}
						Save note
					{/if}
				</button>
			</div>
		</form>
	</article>

	<article class="panel list-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Routines</p>
				<h2>Due soon</h2>
			</div>
			<span class="soft-icon"><CalendarClock size={20} /></span>
		</div>
		{#if form?.doneSaved && !hideDoneServerSaved}
			<p class="notice success">Done</p>
		{:else if form?.doneError}
			<p class="notice error">{form.doneError}</p>
		{/if}
		{#if dueSoon.length}
			<ul class="record-list">
				{#each dueSoon as routine}
					<li class="pending-region">
						<PendingOverlay active={doneSubmittingId === routine.id} message="Marking routine done..." />
						<div>
							<strong>{routine.name}</strong>
							<span>
								{#if doneSavedId === routine.id}
									Done
								{:else}
									{routine.expand?.thing?.name ?? 'Home routine'}
								{/if}
							</span>
						</div>
						<div class="routine-actions">
							<time datetime={routine.next_due_at}>{formatDate(routine.next_due_at)}</time>
							<form method="POST" action="?/done" use:enhance={routineDoneEnhance(routine.id)}>
								<input type="hidden" name="routine_id" value={routine.id} />
								<button
									class="secondary-action compact routine-done-action"
									type="submit"
									disabled={Boolean(doneSubmittingId)}
									aria-busy={doneSubmittingId === routine.id}
									aria-label={`Mark ${routine.name} done`}
								>
									{#if doneSubmittingId === routine.id}
										<span class="loading-spinner" aria-hidden="true"></span>
										Marking done...
									{:else}
										<Check size={17} />
										Done
									{/if}
								</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">No active routines with dates right now.</p>
		{/if}
	</article>

	<article class="panel list-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Inventory</p>
				<h2>Low stock</h2>
			</div>
			<span class="soft-icon"><ShoppingBasket size={20} /></span>
		</div>
		{#if data.lowStock.length}
			<ul class="record-list">
				{#each data.lowStock as thing}
					<li>
						<div>
							<strong>{thing.name}</strong>
							<span>
								{thing.quantity_text || [thing.quantity_number, thing.unit].filter(Boolean).join(' ') || thing.expand?.location?.name || 'Needs attention'}
							</span>
						</div>
						<span class="status-pill">{labelFromValue(thing.status)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">Nothing is marked low or empty.</p>
		{/if}
	</article>

	<article class="panel list-panel wide-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Memory</p>
				<h2>Recent notes</h2>
			</div>
			<span class="soft-icon"><Notebook size={20} /></span>
		</div>
		{#if recentNotes.length}
			<ul class="note-list">
				{#each recentNotes as note}
					<li>
						<div class="note-meta">
							<strong>{note.title || 'Untitled note'}</strong>
							<time datetime={note.happened_at || note.created}>{formatDateTime(note.happened_at || note.created)}</time>
						</div>
						{#if editorText(note.notes)}
							<p>{editorText(note.notes)}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">Quick Capture notes will appear here.</p>
		{/if}
	</article>
</section>
