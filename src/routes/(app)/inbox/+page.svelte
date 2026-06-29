<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Activity, Archive, Boxes, Check, Repeat, ShoppingBasket, X } from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { editorText, firstNonEmptyLine, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import { activityTypeOptions } from '$lib/pocketbase/types';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { ActionData, PageData } from './$types';

	type InboxAction = 'activity' | 'shopping' | 'thing' | 'routine';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	let activeItemId = $state<string | null>(null);
	let activeAction = $state<InboxAction | null>(null);
	let pendingItemId = $state<string | null>(null);
	let pendingMessage = $state('Updating inbox...');
	let savedItemId = $state<string | null>(null);
	let hideServerSaved = $state(false);
	let savedTimer: ReturnType<typeof setTimeout> | undefined;
	let thingSearch = $state('');

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

	function inboxEnhance(message: string): SubmitFunction {
		return ({ cancel, formData }) => {
			if (pendingItemId) {
				cancel();
				return;
			}

			pendingItemId = String(formData.get('event_id') ?? '');
			pendingMessage = message;
			const endPendingWork = beginPendingWork();

			return async ({ result, update }) => {
				await update();
				endPendingWork();
				const finishedItemId = pendingItemId;
				pendingItemId = null;

				if (result.type === 'success' && finishedItemId) {
					cancelAction();
					flashSaved(finishedItemId);
					await invalidateAll();
				}
			};
		};
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

{#if form?.inboxError}
	<section class="panel">
		<p class="notice error">{form.inboxError}</p>
	</section>
{/if}

{#if data.inboxItems.length}
	<section class="inbox-list">
		{#each data.inboxItems as item}
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

				{#if savedItemId === item.id || (form?.eventId === item.id && form?.inboxSaved && !hideServerSaved)}
					<p class="notice success">{form?.message ?? 'Saved'}</p>
				{/if}

				<div class="inbox-triage">
					<p class="inbox-question">What is this?</p>

					{#if isActionOpen(item.id, 'activity')}
						<form method="POST" action="?/activity" class="inbox-action-panel" use:enhance={inboxEnhance('Logging activity...')}>
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
						<form method="POST" action="?/shopping" class="inbox-action-panel" use:enhance={inboxEnhance('Adding to buy list...')}>
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
						<form method="POST" action="?/thing" class="inbox-action-panel" use:enhance={inboxEnhance('Linking to thing...')}>
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
						<form method="POST" action="?/routine" class="inbox-action-panel" use:enhance={inboxEnhance('Creating routine...')}>
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
							<form method="POST" action="?/reviewed" class="inbox-direct-form" use:enhance={inboxEnhance('Marking reviewed...')}>
								<input type="hidden" name="event_id" value={item.id} />
								<button class="secondary-action compact inbox-choice-button" type="submit" disabled={chooserDisabled(item.id)}>
									<Check size={16} />
									Just reviewed
								</button>
							</form>
							<form method="POST" action="?/dismiss" class="inbox-direct-form" use:enhance={inboxEnhance('Dismissing...')}>
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
			<p class="empty-state">Unprocessed Quick Capture notes will appear here.</p>
		</div>
	</section>
{/if}
