<script lang="ts">
	import { Activity, Archive, Boxes, Check, Repeat, ShoppingBasket, X } from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { parseActivityDurationMinutes } from '$lib/pocketbase/activity';
	import {
		getBrowserPb,
		refreshInboxCount,
		requireUser
	} from '$lib/pocketbase/client';
	import {
		addNoteEventToNeed,
		createRoutineFromNoteEvent,
		linkMemoryEventToThing,
		logNoteEventAsActivity,
		markNoteEventReviewed
	} from '$lib/pocketbase/data';
	import { editorText, firstNonEmptyLine, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import { activityTypeOptions, type ActivityType } from '$lib/pocketbase/types';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { PageData } from './$types';

	type InboxAction = 'activity' | 'shopping' | 'memory' | 'routine';
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
	let thingSearch = $state('');
	let needStatus = $state<NeedStatus>('needed');

	const inboxItems = $derived(
		data.inboxItems.filter((item) => !removedInboxItemIds.includes(item.id))
	);
	const activeItem = $derived(inboxItems.find((item) => item.id === activeItemId) ?? null);

	function titleFor(event: PageData['inboxItems'][number]) {
		return event.title || firstNonEmptyLine(editorText(event.notes)) || 'Untitled capture';
	}

	function openReview(itemId: string) {
		if (pendingItemId) return;
		activeItemId = itemId;
		activeAction = null;
		thingSearch = '';
		needStatus = 'needed';
	}

	function closeReview() {
		activeItemId = null;
		activeAction = null;
		thingSearch = '';
		needStatus = 'needed';
	}

	function chooseMeaning(action: InboxAction) {
		if (pendingItemId) return;
		activeAction = action;
		thingSearch = '';
		needStatus = 'needed';
	}

	function backToMeaning() {
		activeAction = null;
		thingSearch = '';
		needStatus = 'needed';
	}

	function needChoiceLabel(status: NeedStatus) {
		if (status === 'low') return 'Running low';
		if (status === 'empty') return 'Out of stock';
		return 'Need to buy';
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
			closeReview();
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

	async function maybeLinkTopic(formData: FormData, eventId: string) {
		const thingId = String(formData.get('thing_id') ?? '').trim();
		if (!thingId) return false;

		const user = await requireUser();
		await linkMemoryEventToThing(getBrowserPb(), user.id, eventId, thingId);
		return true;
	}

	async function rememberNote(formData: FormData, eventId: string) {
		if (await maybeLinkTopic(formData, eventId)) return;

		const user = await requireUser();
		await markNoteEventReviewed(getBrowserPb(), user.id, eventId);
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
		const result = await createRoutineFromNoteEvent(getBrowserPb(), user.id, eventId, intervalDays, routineName);
		const topicId = String(formData.get('thing_id') ?? '').trim() || result.thing.id;
		await linkMemoryEventToThing(getBrowserPb(), user.id, eventId, topicId);
	}

	async function saveNeed(formData: FormData, eventId: string) {
		const itemName = String(formData.get('item_name') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();
		const statusValue = String(formData.get('need_status') ?? 'needed') as NeedStatus;
		if (!itemName) throw new Error('Item name is required.');
		if (!['needed', 'low', 'empty'].includes(statusValue)) throw new Error('Choose a need state.');

		const user = await requireUser();
		const selectedTopicId = String(formData.get('thing_id') ?? '').trim();
		const thing = await addNoteEventToNeed(getBrowserPb(), user.id, eventId, {
			name: itemName,
			status: statusValue,
			...(notes ? { notes } : {}),
			...(selectedTopicId ? { topicId: selectedTopicId } : {})
		});
		const topicId = selectedTopicId || thing.id;
		await linkMemoryEventToThing(getBrowserPb(), user.id, eventId, topicId);
	}

	async function logActivity(formData: FormData, eventId: string) {
		const activityTypeValue = String(formData.get('activity_type') ?? 'other');
		if (!activityTypeOptions.includes(activityTypeValue as ActivityType)) {
			throw new Error('Choose a valid activity type.');
		}

		const parsedDuration = parseActivityDurationMinutes(formData.get('duration_minutes'));
		if (parsedDuration.error) {
			throw new Error(parsedDuration.error);
		}

		const notes = String(formData.get('notes') ?? '').trim();
		const user = await requireUser();
		await logNoteEventAsActivity(getBrowserPb(), user.id, eventId, {
			activity_type: activityTypeValue as ActivityType,
			duration_minutes: parsedDuration.minutes!,
			...(notes ? { notes } : {})
		});
		await maybeLinkTopic(formData, eventId);
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

				<div class="inbox-card-actions">
					<button class="primary-action compact" type="button" onclick={() => openReview(item.id)} disabled={Boolean(pendingItemId)}>
						Review
					</button>
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

{#if activeItem}
	<div class="review-modal-backdrop" role="presentation">
		<div class="review-modal pending-region" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
			<PendingOverlay active={pendingItemId === activeItem.id} message={pendingMessage} />
			<div class="review-modal-header">
				<div>
					<p class="eyebrow">Review quick note</p>
					<h2 id="review-modal-title">{titleFor(activeItem)}</h2>
				</div>
				<button class="icon-button" type="button" onclick={closeReview} aria-label="Cancel review" disabled={Boolean(pendingItemId)}>
					<X size={18} />
				</button>
			</div>

			<div class="review-note-preview">
				<time datetime={activeItem.happened_at || activeItem.created}>{formatDateTime(activeItem.happened_at || activeItem.created)}</time>
				{#if editorText(activeItem.notes)}
					<p>{editorText(activeItem.notes)}</p>
				{/if}
			</div>

			{#if activeAction === null}
				<div class="inbox-triage">
					<p class="inbox-question">What is this?</p>
					<div class="inbox-choice-grid meaning-choice-grid">
						<button class="secondary-action inbox-choice-button" type="button" onclick={() => chooseMeaning('activity')} disabled={Boolean(pendingItemId)}>
							<Activity size={16} />
							Something I did
						</button>
						<button class="secondary-action inbox-choice-button" type="button" onclick={() => chooseMeaning('shopping')} disabled={Boolean(pendingItemId)}>
							<ShoppingBasket size={16} />
							Something I need
						</button>
						<button class="secondary-action inbox-choice-button" type="button" onclick={() => chooseMeaning('memory')} disabled={Boolean(pendingItemId)}>
							<Boxes size={16} />
							Something worth remembering
						</button>
						<button class="secondary-action inbox-choice-button" type="button" onclick={() => chooseMeaning('routine')} disabled={Boolean(pendingItemId)}>
							<Repeat size={16} />
							Something recurring
						</button>
						<form method="POST" class="inbox-direct-form" onsubmit={(event) => runInboxAction(event, 'Dismissing...', dismissNote)}>
							<input type="hidden" name="event_id" value={activeItem.id} />
							<button class="secondary-action inbox-choice-button" type="submit" disabled={Boolean(pendingItemId)}>
								<X size={16} />
								Nothing important
							</button>
						</form>
					</div>
					<div class="inbox-form-actions">
						<button class="ghost-action" type="button" onclick={closeReview} disabled={Boolean(pendingItemId)}>Cancel</button>
					</div>
				</div>
			{:else if activeAction === 'activity'}
				<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Saving activity...', logActivity)}>
					<input type="hidden" name="event_id" value={activeItem.id} />
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
							Duration
							<input name="duration_minutes" type="number" min="1" step="1" placeholder="30" required />
						</label>
						<label class="wide-field">
							Link to topic optional
							<select name="thing_id">
								<option value="">No topic link</option>
								{#each filteredThings() as thing}
									<option value={thing.id}>{thingOptionLabel(thing)}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="inbox-form-actions">
						<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<Activity size={16} />
							Save activity
						</button>
						<button class="ghost-action" type="button" onclick={backToMeaning} disabled={Boolean(pendingItemId)}>Back</button>
						<button class="ghost-action" type="button" onclick={closeReview} disabled={Boolean(pendingItemId)}>Cancel</button>
					</div>
				</form>
			{:else if activeAction === 'shopping'}
				<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Saving need...', saveNeed)}>
					<input type="hidden" name="event_id" value={activeItem.id} />
					<input type="hidden" name="need_status" value={needStatus} />
					<div class="inbox-form-grid">
						<div class="wide-field inbox-choice-grid need-choice-grid" aria-label="Need state">
							{#each ['needed', 'low', 'empty'] as status}
								<button
									class:active={needStatus === status}
									class="secondary-action inbox-choice-button"
									type="button"
									aria-pressed={needStatus === status}
									onclick={() => (needStatus = status as NeedStatus)}
									disabled={Boolean(pendingItemId)}
								>
									{needChoiceLabel(status as NeedStatus)}
								</button>
							{/each}
						</div>
						<label>
							Name
							<input name="item_name" value={titleFor(activeItem)} required />
						</label>
						<label>
							Optional note
							<input name="notes" value={editorText(activeItem.notes)} autocomplete="off" />
						</label>
						<label class="wide-field">
							Link to topic optional
							<select name="thing_id">
								<option value="">Use this need as topic</option>
								{#each filteredThings() as thing}
									<option value={thing.id}>{thingOptionLabel(thing)}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="inbox-form-actions">
						<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<ShoppingBasket size={16} />
							Save need
						</button>
						<button class="ghost-action" type="button" onclick={backToMeaning} disabled={Boolean(pendingItemId)}>Back</button>
						<button class="ghost-action" type="button" onclick={closeReview} disabled={Boolean(pendingItemId)}>Cancel</button>
					</div>
				</form>
			{:else if activeAction === 'memory'}
				<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Saving memory...', rememberNote)}>
					<input type="hidden" name="event_id" value={activeItem.id} />
					<div class="inbox-form-grid">
						{#if data.things.length}
							<label class="wide-field">
								Search topics
								<input type="search" bind:value={thingSearch} placeholder="Type to narrow topics" autocomplete="off" />
							</label>
							<label class="wide-field">
								Link to existing topic optional
								<select name="thing_id">
									<option value="">Just mark as reviewed</option>
									{#each filteredThings() as thing}
										<option value={thing.id}>{thingOptionLabel(thing)}</option>
									{/each}
								</select>
							</label>
						{:else}
							<p class="empty-state wide-field">No topics are available yet. You can still mark this note as reviewed.</p>
						{/if}
					</div>
					<div class="inbox-form-actions">
						<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<Check size={16} />
							Save memory
						</button>
						<button class="ghost-action" type="button" onclick={backToMeaning} disabled={Boolean(pendingItemId)}>Back</button>
						<button class="ghost-action" type="button" onclick={closeReview} disabled={Boolean(pendingItemId)}>Cancel</button>
					</div>
				</form>
			{:else if activeAction === 'routine'}
				<form method="POST" class="inbox-action-panel" onsubmit={(event) => runInboxAction(event, 'Creating routine...', createRoutine)}>
					<input type="hidden" name="event_id" value={activeItem.id} />
					<div class="inbox-form-grid">
						<label>
							Routine name
							<input name="routine_name" value={titleFor(activeItem)} required />
						</label>
						<label>
							Repeat every N days
							<input name="interval_days" type="number" min="1" step="1" placeholder="7" required />
						</label>
						<label class="wide-field">
							Link to topic optional
							<select name="thing_id">
								<option value="">Use the recurring topic</option>
								{#each filteredThings() as thing}
									<option value={thing.id}>{thingOptionLabel(thing)}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="inbox-form-actions">
						<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<Repeat size={16} />
							Create routine
						</button>
						<button class="ghost-action" type="button" onclick={backToMeaning} disabled={Boolean(pendingItemId)}>Back</button>
						<button class="ghost-action" type="button" onclick={closeReview} disabled={Boolean(pendingItemId)}>Cancel</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
