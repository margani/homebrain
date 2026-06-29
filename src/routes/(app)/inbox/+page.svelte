<script lang="ts">
	import { Activity, Archive, Boxes, Check, Repeat, ShoppingBasket, X } from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import {
		getBrowserPb,
		refreshInboxCount,
		requireUser
	} from '$lib/pocketbase/client';
	import {
		addNoteEventToBuyList,
		createRoutineFromNoteEvent,
		linkMemoryEventToThing,
		logNoteEventAsActivity,
		markNoteEventReviewed
	} from '$lib/pocketbase/data';
	import { editorText, firstNonEmptyLine, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import { activityTypeOptions, type ActivityType } from '$lib/pocketbase/types';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { PageData } from './$types';

	type InboxAction = 'activity' | 'shopping' | 'thing' | 'routine';
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
	let thingSearch = $state('');

	const inboxItems = $derived(
		data.inboxItems.filter((item) => !removedInboxItemIds.includes(item.id))
	);

	function titleFor(event: PageData['inboxItems'][number]) {
		return event.title || firstNonEmptyLine(editorText(event.notes)) || 'Untitled capture';
	}

	function openAction(itemId: string, action: InboxAction) {
		if (pendingItemId) return;
		activeItemId = itemId;
		activeAction = action;
		thingSearch = '';
	}

	function cancelAction() {
		activeItemId = null;
		activeAction = null;
		thingSearch = '';
	}

	function isActionOpen(itemId: string, action: InboxAction) {
		return activeItemId === itemId && activeAction === action;
	}

	function chooserDisabled(itemId: string) {
		return Boolean(pendingItemId) || (activeItemId !== null && activeItemId !== itemId);
	}

	function filteredThings() {
		const query = thingSearch.trim().toLowerCase();
		const things = query
			? data.things.filter((thing) =>
					`${thing.name} ${thing.type} ${thing.status ?? ''}`.toLowerCase().includes(query)
				)
			: data.things;

		return things.slice(0, 40);
	}

	function thingOptionLabel(thing: PageData['things'][number]) {
		return [thing.name, labelFromValue(thing.type), thing.status ? labelFromValue(thing.status) : '']
			.filter(Boolean)
			.join(' · ');
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
			cancelAction();
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

	async function markReviewed(_: FormData, eventId: string) {
		const user = await requireUser();
		await markNoteEventReviewed(getBrowserPb(), user.id, eventId);
	}

	async function dismissNote(_: FormData, eventId: string) {
		const user = await requireUser();
		await markNoteEventReviewed(getBrowserPb(), user.id, eventId, { dismissed: true });
	}

	async function linkThing(formData: FormData, eventId: string) {
		const thingId = String(formData.get('thing_id') ?? '').trim();
		if (!thingId) throw new Error('Choose a thing to link.');

		const user = await requireUser();
		await linkMemoryEventToThing(getBrowserPb(), user.id, eventId, thingId);
	}

	async function createRoutine(formData: FormData, eventId: string) {
		const routineName = String(formData.get('routine_name') ?? '').trim();
		const intervalValue = String(formData.get('interval_days') ?? '').trim();
		const intervalDays = Number(intervalValue);

		if (!routineName) throw new Error('Routine name is required.');
		if (!intervalValue) throw new Error('Interval days is required.');
		if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
			throw new Error('Interval days must be a positive whole number.');
		}

		const user = await requireUser();
		await createRoutineFromNoteEvent(getBrowserPb(), user.id, eventId, intervalDays, routineName);
	}

	async function addToBuyList(formData: FormData, eventId: string) {
		const itemName = String(formData.get('item_name') ?? '').trim();
		const quantityText = String(formData.get('quantity_text') ?? '').trim();
		if (!itemName) throw new Error('Item name is required.');

		const user = await requireUser();
		await addNoteEventToBuyList(getBrowserPb(), user.id, eventId, {
			name: itemName,
			...(quantityText ? { quantity_text: quantityText } : {})
		});
	}

	async function logActivity(formData: FormData, eventId: string) {
		const activityTypeValue = String(formData.get('activity_type') ?? 'other');
		if (!activityTypeOptions.includes(activityTypeValue as ActivityType)) {
			throw new Error('Choose a valid activity type.');
		}

		const durationValue = String(formData.get('duration_minutes') ?? '').trim();
		const durationMinutes = Number(durationValue);
		if (!durationValue || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
			throw new Error('Duration minutes must be a positive whole number.');
		}

		const notes = String(formData.get('notes') ?? '').trim();
		const user = await requireUser();
		await logNoteEventAsActivity(getBrowserPb(), user.id, eventId, {
			activity_type: activityTypeValue as ActivityType,
			duration_minutes: durationMinutes,
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
		<h1>Capture triage</h1>
	</div>
	<p>Review quick notes and decide what they are.</p>
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

				{#if editorText(item.notes)}
					<p class="plain-note">{editorText(item.notes)}</p>
				{/if}

				{#if savedItemId === item.id && !hideServerSaved}
					<p class="notice success">Saved</p>
				{/if}

				<div class="inbox-triage">
					<p class="inbox-question">What is this?</p>

					{#if isActionOpen(item.id, 'activity')}
					<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Logging activity...', logActivity)}>
							<input type="hidden" name="event_id" value={item.id} />
							<div class="inbox-form-grid">
								<label>
									Activity type
									<select name="activity_type">
										{#each activityTypeOptions as type}
											<option value={type}>{labelFromValue(type)}</option>
										{/each}
									</select>
								</label>
								<label>
									Duration minutes
									<input name="duration_minutes" type="number" min="1" step="1" placeholder="30" required />
								</label>
							</div>
							<div class="inbox-form-actions">
								<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
									<Activity size={16} />
									Log activity
								</button>
								<button class="ghost-action" type="button" onclick={cancelAction} disabled={Boolean(pendingItemId)}>Cancel</button>
							</div>
						</form>
					{:else if isActionOpen(item.id, 'shopping')}
						<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Adding to buy list...', addToBuyList)}>
							<input type="hidden" name="event_id" value={item.id} />
							<div class="inbox-form-grid">
								<label>
									Item name
									<input name="item_name" value={titleFor(item)} required />
								</label>
								<label>
									Quantity text
									<input name="quantity_text" placeholder="not bought yet" />
								</label>
							</div>
							<div class="inbox-form-actions">
								<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
									<ShoppingBasket size={16} />
									Add to buy list
								</button>
								<button class="ghost-action" type="button" onclick={cancelAction} disabled={Boolean(pendingItemId)}>Cancel</button>
							</div>
						</form>
					{:else if isActionOpen(item.id, 'thing')}
						<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Linking to thing...', linkThing)}>
							<input type="hidden" name="event_id" value={item.id} />
							{#if data.things.length}
								<div class="inbox-form-grid">
									<label class="wide-field">
										Search things
										<input type="search" bind:value={thingSearch} placeholder="Type to narrow the list" autocomplete="off" />
									</label>
									<label class="wide-field">
										Thing
										<select name="thing_id" required>
											<option value="" disabled selected>Select a thing</option>
											{#each filteredThings() as thing}
												<option value={thing.id}>{thingOptionLabel(thing)}</option>
											{/each}
										</select>
									</label>
								</div>
								{#if thingSearch && filteredThings().length === 0}
									<p class="hint">No matching things.</p>
								{/if}
							{:else}
								<p class="empty-state">No things are available to link yet.</p>
							{/if}
							<div class="inbox-form-actions">
								<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId) || !data.things.length}>
									<Boxes size={16} />
									Link
								</button>
								<button class="ghost-action" type="button" onclick={cancelAction} disabled={Boolean(pendingItemId)}>Cancel</button>
							</div>
						</form>
					{:else if isActionOpen(item.id, 'routine')}
						<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Creating routine...', createRoutine)}>
							<input type="hidden" name="event_id" value={item.id} />
							<div class="inbox-form-grid">
								<label>
									Routine name
									<input name="routine_name" value={titleFor(item)} required />
								</label>
								<label>
									Interval days
									<input name="interval_days" type="number" min="1" step="1" placeholder="7" required />
								</label>
							</div>
							<div class="inbox-form-actions">
								<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
									<Repeat size={16} />
									Create routine
								</button>
								<button class="ghost-action" type="button" onclick={cancelAction} disabled={Boolean(pendingItemId)}>Cancel</button>
							</div>
						</form>
					{:else}
						<div class="inbox-choice-grid">
							<button class="secondary-action compact inbox-choice-button" type="button" onclick={() => openAction(item.id, 'activity')} disabled={chooserDisabled(item.id)}>
								<Activity size={16} />
								Log activity
							</button>
							<button class="secondary-action compact inbox-choice-button" type="button" onclick={() => openAction(item.id, 'shopping')} disabled={chooserDisabled(item.id)}>
								<ShoppingBasket size={16} />
								Add to buy list
							</button>
							<button class="secondary-action compact inbox-choice-button" type="button" onclick={() => openAction(item.id, 'thing')} disabled={chooserDisabled(item.id)}>
								<Boxes size={16} />
								Link to thing
							</button>
							<button class="secondary-action compact inbox-choice-button" type="button" onclick={() => openAction(item.id, 'routine')} disabled={chooserDisabled(item.id)}>
								<Repeat size={16} />
								Create routine
							</button>
							<form method="POST" class="inbox-direct-form" onsubmit={(event) => runInboxAction(event, 'Marking reviewed...', markReviewed)}>
								<input type="hidden" name="event_id" value={item.id} />
								<button class="secondary-action compact inbox-choice-button" type="submit" disabled={chooserDisabled(item.id)}>
									<Check size={16} />
									Just reviewed
								</button>
							</form>
							<form method="POST" class="inbox-direct-form" onsubmit={(event) => runInboxAction(event, 'Dismissing...', dismissNote)}>
								<input type="hidden" name="event_id" value={item.id} />
								<button class="secondary-action compact inbox-choice-button" type="submit" disabled={chooserDisabled(item.id)}>
									<X size={16} />
									Dismiss
								</button>
							</form>
						</div>
					{/if}
				</div>
			</article>
		{/each}
	</section>
{:else}
	<section class="panel empty-inbox">
		<span class="soft-icon"><Archive size={20} /></span>
		<div>
			<h2>Inbox is clear</h2>
			<p class="empty-state">Unreviewed Quick Capture notes will appear here.</p>
		</div>
	</section>
{/if}
