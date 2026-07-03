<script lang="ts">
	import { Activity, Archive, Boxes, Check, FileText, Ruler, ShoppingBasket, X } from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { getBrowserPb, refreshInboxCount, requireUser } from '$lib/pocketbase/client';
	import {
		addNoteEventToNeed,
		createActivityFromNoteEvent,
		createMetricObservationFromNoteEvent,
		createNoteFromNoteEvent,
		createThingFromNoteEvent,
		markNoteEventReviewed
	} from '$lib/pocketbase/data';
	import { editorText, firstNonEmptyLine, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { PageData } from './$types';

	type InboxAction = 'note' | 'activity' | 'need' | 'thing' | 'metric';
	type NeedStatus = 'needed' | 'low' | 'empty';

	let { data }: { data: PageData } = $props();

	let removedInboxItemIds = $state<string[]>([]);
	let activeItemId = $state<string | null>(null);
	let activeAction = $state<InboxAction | null>(null);
	let pendingItemId = $state<string | null>(null);
	let pendingMessage = $state('Updating inbox...');
	let inboxError = $state('');
	let savedItemId = $state<string | null>(null);
	let hideServerSaved = $state(false);
	let savedTimer: ReturnType<typeof setTimeout> | undefined;

	const inboxItems = $derived(
		data.inboxItems.filter((item) => !removedInboxItemIds.includes(item.id))
	);

	function textFor(event: PageData['inboxItems'][number]) {
		return editorText(event.notes);
	}

	function titleFor(event: PageData['inboxItems'][number]) {
		return event.title || firstNonEmptyLine(textFor(event)) || 'Untitled capture';
	}

	function dateTimeInputValue(value?: string | null) {
		const date = value ? new Date(value) : new Date();
		if (Number.isNaN(date.getTime())) return dateTimeInputValue();

		const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
		return offsetDate.toISOString().slice(0, 16);
	}

	function dateTimeFromInput(value: FormDataEntryValue | null) {
		const raw = String(value ?? '').trim();
		if (!raw) return new Date().toISOString();
		const date = new Date(raw);
		if (Number.isNaN(date.getTime())) throw new Error('Choose a valid date and time.');
		return date.toISOString();
	}

	function chooseAction(itemId: string, action: InboxAction) {
		if (pendingItemId) return;
		activeItemId = itemId;
		activeAction = action;
		inboxError = '';
	}

	function closeInlineReview() {
		activeItemId = null;
		activeAction = null;
		inboxError = '';
	}

	function flashSaved(eventId: string) {
		savedItemId = eventId;
		hideServerSaved = false;
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = setTimeout(() => {
			savedItemId = null;
			hideServerSaved = true;
		}, 2000);
	}

	async function runInboxAction(
		event: SubmitEvent,
		message: string,
		mutation: (formData: FormData, eventId: string) => Promise<void>
	) {
		event.preventDefault();
		if (pendingItemId) return;

		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) return;

		const formData = new FormData(form);
		const eventId = String(formData.get('event_id') ?? '').trim();
		if (!eventId) {
			inboxError = 'Choose an inbox item first.';
			return;
		}

		pendingItemId = eventId;
		pendingMessage = message;
		inboxError = '';
		const endPendingWork = beginPendingWork();

		try {
			await mutation(formData, eventId);
			closeInlineReview();
			removedInboxItemIds = [...removedInboxItemIds, eventId];
			flashSaved(eventId);
			refreshInboxCount();
		} catch (error) {
			inboxError = error instanceof Error ? error.message : 'The inbox item could not be updated.';
		} finally {
			endPendingWork();
			pendingItemId = null;
		}
	}

	async function dismissNote(_: FormData, eventId: string) {
		const user = await requireUser();
		await markNoteEventReviewed(getBrowserPb(), user.id, eventId, { dismissed: true });
	}

	async function saveNote(formData: FormData, eventId: string) {
		const title = String(formData.get('title') ?? '').trim();
		const body = String(formData.get('body') ?? '').trim();
		const category = String(formData.get('category') ?? '').trim();
		if (!title) throw new Error('Title is required.');

		const user = await requireUser();
		await createNoteFromNoteEvent(getBrowserPb(), user.id, eventId, {
			title,
			notes: body,
			...(category ? { category } : {})
		});
	}

	async function saveActivity(formData: FormData, eventId: string) {
		const title = String(formData.get('title') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();
		const category = String(formData.get('category') ?? '').trim();
		if (!title) throw new Error('Title is required.');

		const user = await requireUser();
		await createActivityFromNoteEvent(getBrowserPb(), user.id, eventId, {
			title,
			happened_at: dateTimeFromInput(formData.get('happened_at')),
			...(category ? { category } : {}),
			...(notes ? { notes } : {})
		});
	}

	async function saveNeed(formData: FormData, eventId: string) {
		const title = String(formData.get('title') ?? '').trim();
		const category = String(formData.get('category') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();
		const status = String(formData.get('status') ?? 'needed') as NeedStatus;
		if (!title) throw new Error('Title is required.');
		if (!['needed', 'low', 'empty'].includes(status)) throw new Error('Choose a valid need status.');

		const user = await requireUser();
		await addNoteEventToNeed(getBrowserPb(), user.id, eventId, {
			name: title,
			status,
			...(category ? { category } : {}),
			...(notes ? { notes } : {})
		});
	}

	async function saveThing(formData: FormData, eventId: string) {
		const name = String(formData.get('name') ?? '').trim();
		const category = String(formData.get('category') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();
		if (!name) throw new Error('Name is required.');

		const user = await requireUser();
		await createThingFromNoteEvent(
			getBrowserPb(),
			user.id,
			eventId,
			'other',
			'unknown',
			category,
			name,
			notes
		);
	}

	async function saveMetric(formData: FormData, eventId: string) {
		const existingThingId = String(formData.get('thing_id') ?? '').trim();
		const measurement = String(formData.get('measurement') ?? '').trim();
		const value = Number(String(formData.get('value') ?? '').trim());
		const unit = String(formData.get('unit') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();

		if (!measurement) throw new Error('Measurement is required.');
		if (!Number.isFinite(value)) throw new Error('Value must be a valid number.');
		if (!unit) throw new Error('Unit is required.');

		const user = await requireUser();
		await createMetricObservationFromNoteEvent(getBrowserPb(), user.id, eventId, {
			...(existingThingId ? { thingId: existingThingId } : { thingName: measurement }),
			value,
			unit,
			label: measurement,
			happened_at: dateTimeFromInput(formData.get('happened_at')),
			...(notes ? { notes } : {})
		});
	}
</script>

<svelte:head>
	<title>Inbox - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Inbox</p>
		<h1>Review</h1>
	</div>
	<p>Turn quick captures into useful records, dismiss them, or leave them for later.</p>
</section>

{#if inboxError}
	<section class="panel">
		<p class="notice error">{inboxError}</p>
	</section>
{/if}

{#if inboxItems.length}
	<section class="inbox-list">
		{#each inboxItems as item}
			<article class="panel inbox-card pending-region">
				<PendingOverlay active={pendingItemId === item.id} message={pendingMessage} />

				<div class="inbox-card-header">
					<div>
						<p class="eyebrow">Quick Capture</p>
						<h2>{titleFor(item)}</h2>
					</div>
					<time datetime={item.happened_at || item.created}>{formatDateTime(item.happened_at || item.created)}</time>
				</div>

				{#if textFor(item)}
					<p class="plain-note">{textFor(item)}</p>
				{/if}

				{#if savedItemId === item.id && !hideServerSaved}
					<p class="notice success">Saved</p>
				{/if}

				<div class="inbox-card-actions review-action-row">
					<button class="secondary-action compact" type="button" onclick={() => chooseAction(item.id, 'note')} disabled={Boolean(pendingItemId)}>
						<FileText size={16} />
						Create Note
					</button>
					<button class="secondary-action compact" type="button" onclick={() => chooseAction(item.id, 'activity')} disabled={Boolean(pendingItemId)}>
						<Activity size={16} />
						Create Activity
					</button>
					<button class="secondary-action compact" type="button" onclick={() => chooseAction(item.id, 'need')} disabled={Boolean(pendingItemId)}>
						<ShoppingBasket size={16} />
						Create Need
					</button>
					<button class="secondary-action compact" type="button" onclick={() => chooseAction(item.id, 'thing')} disabled={Boolean(pendingItemId)}>
						<Boxes size={16} />
						Create Thing
					</button>
					<button class="secondary-action compact" type="button" onclick={() => chooseAction(item.id, 'metric')} disabled={Boolean(pendingItemId)}>
						<Ruler size={16} />
						Log Metric
					</button>
					<form method="POST" class="inbox-direct-form" onsubmit={(event) => runInboxAction(event, 'Dismissing...', dismissNote)}>
						<input type="hidden" name="event_id" value={item.id} />
						<button class="ghost-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<X size={16} />
							Dismiss
						</button>
					</form>
					<button class="ghost-action compact" type="button" onclick={closeInlineReview} disabled={Boolean(pendingItemId)}>
						Later
					</button>
				</div>

				{#if activeItemId === item.id && activeAction}
					<div class="inbox-inline-review">
						{#if activeAction === 'note'}
							<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Creating note...', saveNote)}>
								<input type="hidden" name="event_id" value={item.id} />
								<div class="inbox-form-grid">
									<label>
										Title
										<input name="title" value={titleFor(item)} required autocomplete="off" />
									</label>
									<label>
										Category optional
										<input name="category" autocomplete="off" />
									</label>
									<label class="wide-field">
										Body
										<textarea name="body" rows="4">{textFor(item)}</textarea>
									</label>
								</div>
								<div class="inbox-form-actions">
									<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
										<Check size={16} />
										Save note
									</button>
									<button class="ghost-action" type="button" onclick={closeInlineReview} disabled={Boolean(pendingItemId)}>Later</button>
								</div>
							</form>
						{:else if activeAction === 'activity'}
							<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Creating activity...', saveActivity)}>
								<input type="hidden" name="event_id" value={item.id} />
								<div class="inbox-form-grid">
									<label>
										Title
										<input name="title" value={titleFor(item)} required autocomplete="off" />
									</label>
									<label>
										Date and time
										<input name="happened_at" type="datetime-local" value={dateTimeInputValue(item.happened_at || item.created)} required />
									</label>
									<label>
										Category optional
										<input name="category" autocomplete="off" />
									</label>
									<label class="wide-field">
										Notes
										<textarea name="notes" rows="3">{textFor(item)}</textarea>
									</label>
								</div>
								<div class="inbox-form-actions">
									<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
										<Check size={16} />
										Save activity
									</button>
									<button class="ghost-action" type="button" onclick={closeInlineReview} disabled={Boolean(pendingItemId)}>Later</button>
								</div>
							</form>
						{:else if activeAction === 'need'}
							<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Creating need...', saveNeed)}>
								<input type="hidden" name="event_id" value={item.id} />
								<div class="inbox-form-grid">
									<label>
										Title
										<input name="title" value={titleFor(item)} required autocomplete="off" />
									</label>
									<label>
										Status
										<select name="status">
											<option value="needed">Need to buy</option>
											<option value="low">Running low</option>
											<option value="empty">Out of stock</option>
										</select>
									</label>
									<label>
										Category optional
										<input name="category" autocomplete="off" />
									</label>
									<label class="wide-field">
										Notes
										<textarea name="notes" rows="3">{textFor(item)}</textarea>
									</label>
								</div>
								<div class="inbox-form-actions">
									<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
										<Check size={16} />
										Save need
									</button>
									<button class="ghost-action" type="button" onclick={closeInlineReview} disabled={Boolean(pendingItemId)}>Later</button>
								</div>
							</form>
						{:else if activeAction === 'thing'}
							<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Creating thing...', saveThing)}>
								<input type="hidden" name="event_id" value={item.id} />
								<div class="inbox-form-grid">
									<label>
										Name
										<input name="name" value={titleFor(item)} required autocomplete="off" />
									</label>
									<label>
										Category optional
										<input name="category" autocomplete="off" />
									</label>
									<label class="wide-field">
										Notes
										<textarea name="notes" rows="3">{textFor(item)}</textarea>
									</label>
								</div>
								<div class="inbox-form-actions">
									<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
										<Check size={16} />
										Save thing
									</button>
									<button class="ghost-action" type="button" onclick={closeInlineReview} disabled={Boolean(pendingItemId)}>Later</button>
								</div>
							</form>
						{:else if activeAction === 'metric'}
							<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Logging metric...', saveMetric)}>
								<input type="hidden" name="event_id" value={item.id} />
								<div class="inbox-form-grid">
									<label>
										Measurement
										<input name="measurement" value={titleFor(item)} required autocomplete="off" />
									</label>
									<label>
										Value
										<input name="value" type="number" step="any" required />
									</label>
									<label>
										Unit
										<input name="unit" placeholder="kg, cm, cans..." autocomplete="off" required />
									</label>
									<label>
										Date and time
										<input name="happened_at" type="datetime-local" value={dateTimeInputValue(item.happened_at || item.created)} required />
									</label>
									<label class="wide-field">
										Thing optional
										<select name="thing_id">
											<option value="">Create a new measurement topic</option>
											{#each data.things as thing}
												<option value={thing.id}>{thing.name}{thing.category ? ` · ${thing.category}` : ''}</option>
											{/each}
										</select>
									</label>
									<label class="wide-field">
										Notes
										<textarea name="notes" rows="3">{textFor(item)}</textarea>
									</label>
								</div>
								<div class="inbox-form-actions">
									<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
										<Check size={16} />
										Save metric
									</button>
									<button class="ghost-action" type="button" onclick={closeInlineReview} disabled={Boolean(pendingItemId)}>Later</button>
								</div>
							</form>
						{/if}
					</div>
				{/if}
			</article>
		{/each}
	</section>
{:else}
	<section class="panel empty-inbox">
		<span class="soft-icon"><Archive size={20} /></span>
		<div>
			<h2>Inbox is clear</h2>
			<p class="empty-state">Nothing to review.</p>
		</div>
	</section>
{/if}
