<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Archive, Boxes, Check, Repeat, ShoppingBasket, X } from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { editorText, firstNonEmptyLine, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import { thingStatusOptions, thingTypeOptions } from '$lib/pocketbase/types';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	let pendingItemId = $state<string | null>(null);
	let pendingMessage = $state('Updating inbox...');
	let savedItemId = $state<string | null>(null);
	let hideServerSaved = $state(false);
	let savedTimer: ReturnType<typeof setTimeout> | undefined;

	function titleFor(event: PageData['inboxItems'][number]) {
		return event.title || firstNonEmptyLine(editorText(event.notes)) || 'Untitled capture';
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
	<p>Review quick notes and turn them into things, routines, or low-stock reminders.</p>
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

				<div class="inbox-actions">
					<form method="POST" action="?/processed" use:enhance={inboxEnhance('Marking processed...')}>
						<input type="hidden" name="event_id" value={item.id} />
						<button class="secondary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<Check size={16} />
							Processed
						</button>
					</form>

					<form method="POST" action="?/dismiss" use:enhance={inboxEnhance('Dismissing...')}>
						<input type="hidden" name="event_id" value={item.id} />
						<button class="secondary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<X size={16} />
							Dismiss
						</button>
					</form>
				</div>

				<div class="inbox-conversions">
					<form method="POST" action="?/thing" class="inbox-convert-form" use:enhance={inboxEnhance('Converting to thing...')}>
						<input type="hidden" name="event_id" value={item.id} />
						<label>
							Type
							<select name="type">
								{#each thingTypeOptions as type}
									<option value={type} selected={type === 'other'}>{labelFromValue(type)}</option>
								{/each}
							</select>
						</label>
						<label>
							Status
							<select name="status">
								{#each thingStatusOptions as status}
									<option value={status} selected={status === 'unknown'}>{labelFromValue(status)}</option>
								{/each}
							</select>
						</label>
						<button class="primary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<Boxes size={16} />
							Convert to Thing
						</button>
					</form>

					<form method="POST" action="?/routine" class="inbox-convert-form" use:enhance={inboxEnhance('Converting to routine...')}>
						<input type="hidden" name="event_id" value={item.id} />
						<label>
							Interval days
							<input name="interval_days" inputmode="numeric" placeholder="7" />
						</label>
						<button class="secondary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<Repeat size={16} />
							Convert to Routine
						</button>
					</form>

					<form method="POST" action="?/shopping" class="inbox-convert-form" use:enhance={inboxEnhance('Adding to low stock...')}>
						<input type="hidden" name="event_id" value={item.id} />
						<button class="secondary-action compact" type="submit" disabled={Boolean(pendingItemId)}>
							<ShoppingBasket size={16} />
							Shopping / Low Stock
						</button>
					</form>
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
