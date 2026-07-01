<script lang="ts">
	import { Check, CircleAlert, ShoppingBasket } from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { getBrowserPb, requireUser } from '$lib/pocketbase/client';
	import { updateThingStatus } from '$lib/pocketbase/data';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import { isNeedsStatus, normalizeThingStatus } from '$lib/pocketbase/things';
	import type { JsonValue, ThingStatus } from '$lib/pocketbase/types';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { PageData } from './$types';

	type Need = PageData['needs'][number];
	type Topic = PageData['things'][number];

	let { data }: { data: PageData } = $props();

	let localNeeds = $state<Need[]>([]);
	let hiddenNeedIds = $state<string[]>([]);
	let pendingNeedId = $state<string | null>(null);
	let pendingMessage = $state('Updating need...');
	let errorMessage = $state('');

	const needs = $derived(localNeeds.filter((need) => !hiddenNeedIds.includes(need.id)));

	$effect(() => {
		localNeeds = data.needs;
		hiddenNeedIds = [];
	});

	function metadataFor(need: Need) {
		if (need.metadata && !Array.isArray(need.metadata) && typeof need.metadata === 'object') {
			return need.metadata as Record<string, JsonValue>;
		}

		return {};
	}

	function linkedTopic(need: Need): Topic | null {
		const topicId = metadataFor(need).topic_id;
		if (typeof topicId !== 'string' || topicId === need.id) return null;

		return data.things.find((thing) => thing.id === topicId) ?? null;
	}

	function locationLabel(need: Need) {
		return need.expand?.location?.name || need.expand?.location?.path || '';
	}

	function noteExcerpt(need: Need) {
		return editorText(need.notes);
	}

	async function setStatus(need: Need, status: ThingStatus, message: string) {
		if (pendingNeedId) return;

		pendingNeedId = need.id;
		pendingMessage = message;
		errorMessage = '';
		const endPendingWork = beginPendingWork();

		if (!isNeedsStatus(status)) {
			hiddenNeedIds = [...hiddenNeedIds, need.id];
		}

		try {
			const user = await requireUser();
			const updated = await updateThingStatus(getBrowserPb(), user.id, need.id, status);
			if (isNeedsStatus(status)) {
				localNeeds = localNeeds.map((item) => (item.id === need.id ? { ...item, ...updated } : item));
			}
		} catch (error) {
			hiddenNeedIds = hiddenNeedIds.filter((id) => id !== need.id);
			errorMessage = error instanceof Error ? error.message : 'The need could not be updated.';
		} finally {
			endPendingWork();
			pendingNeedId = null;
		}
	}
</script>

<svelte:head>
	<title>Needs - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Needs</p>
		<h1>What needs attention</h1>
	</div>
	<p>Things to buy, things running low, and things that are out.</p>
</section>

{#if errorMessage}
	<section class="panel">
		<p class="notice error">{errorMessage}</p>
	</section>
{/if}

{#if needs.length}
	<section class="needs-list" aria-label="Needs list">
		{#each needs as need}
			{@const topic = linkedTopic(need)}
			<article class="panel need-card pending-region">
				<PendingOverlay active={pendingNeedId === need.id} message={pendingMessage} />
				<div class="need-card-main">
					<div>
						<p class="eyebrow">{labelFromValue(normalizeThingStatus(need.status))}</p>
						<h2><a class="record-title-link" href={`/things/${need.id}`}>{need.name}</a></h2>
					</div>
					<span class="status-pill">{labelFromValue(normalizeThingStatus(need.status))}</span>
				</div>

				<div class="need-detail-grid">
					{#if topic}
						<div>
							<span>Topic</span>
							<a class="inline-record-link" href={`/things/${topic.id}`}>{topic.name}</a>
						</div>
					{/if}
					{#if locationLabel(need)}
						<div>
							<span>Location</span>
							<strong>{locationLabel(need)}</strong>
						</div>
					{/if}
					{#if noteExcerpt(need)}
						<div class="wide-field">
							<span>Note</span>
							<p>{noteExcerpt(need)}</p>
						</div>
					{/if}
					<div>
						<span>Last updated</span>
						<time datetime={need.updated}>{formatDateTime(need.updated)}</time>
					</div>
				</div>

				<div class="need-actions">
					<button class="secondary-action compact" type="button" onclick={() => setStatus(need, 'have', 'Marking as have...')} disabled={Boolean(pendingNeedId)}>
						<Check size={16} />
						Mark as Have
					</button>
					<button class="secondary-action compact" type="button" onclick={() => setStatus(need, 'low', 'Marking low...')} disabled={Boolean(pendingNeedId)}>
						Mark as Low
					</button>
					<button class="secondary-action compact" type="button" onclick={() => setStatus(need, 'empty', 'Marking empty...')} disabled={Boolean(pendingNeedId)}>
						Mark as Empty
					</button>
					<button class="primary-action compact" type="button" onclick={() => setStatus(need, 'have', 'Resolving need...')} disabled={Boolean(pendingNeedId)}>
						Resolve
					</button>
				</div>
			</article>
		{/each}
	</section>
{:else}
	<section class="panel empty-inbox">
		<span class="soft-icon"><CircleAlert size={20} /></span>
		<div>
			<h2>No open needs</h2>
			<p class="empty-state">Items marked needed, low, or empty will appear here.</p>
		</div>
	</section>
{/if}
