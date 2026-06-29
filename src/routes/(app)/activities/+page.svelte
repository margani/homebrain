<script lang="ts">
	import { Activity, Boxes, ChevronRight } from 'lucide-svelte';
	import { editorText, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { JsonValue } from '$lib/pocketbase/types';
	import type { PageData } from './$types';

	type ActivityEvent = PageData['activities'][number];

	let { data }: { data: PageData } = $props();

	function metadataFor(event: { metadata?: JsonValue }) {
		if (event.metadata && !Array.isArray(event.metadata) && typeof event.metadata === 'object') {
			return event.metadata;
		}

		return {};
	}

	function activityTitle(event: ActivityEvent) {
		return event.title || editorText(event.notes) || 'Untitled activity';
	}

	function activityDetail(event: ActivityEvent) {
		const metadata = metadataFor(event);
		return [
			metadata.activity_type ? labelFromValue(String(metadata.activity_type)) : 'Activity',
			metadata.duration_minutes ? `${metadata.duration_minutes} min` : ''
		]
			.filter(Boolean)
			.join(' · ');
	}
</script>

<svelte:head>
	<title>Activities - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Activities</p>
		<h1>Activity log</h1>
	</div>
	<p>Activity records created from Quick Capture notes.</p>
</section>

{#if data.activities.length}
	<section class="notes-archive-list">
		{#each data.activities as event}
			<article class="panel note-archive-card">
				<div class="note-archive-main">
					<span class="soft-icon"><Activity size={19} /></span>
					<div>
						<a class="record-title-link" href={`/notes/${event.id}`}>{activityTitle(event)}</a>
						<div class="note-meta">
							<strong>{activityDetail(event)}</strong>
							<time datetime={event.happened_at || event.created}>{formatDateTime(event.happened_at || event.created)}</time>
						</div>
					</div>
					<a class="icon-button note-open-button" href={`/notes/${event.id}`} aria-label={`Open ${activityTitle(event)}`}>
						<ChevronRight size={18} />
					</a>
				</div>

				{#if editorText(event.notes)}
					<p class="plain-note note-archive-summary">{editorText(event.notes)}</p>
				{/if}

				<div class="note-badge-row">
					<span>Activity</span>
					{#if event.expand?.thing}
						<a class="linked-note-pill" href={`/things/${event.expand.thing.id}`}>
							<Boxes size={14} />
							{event.expand.thing.name}
						</a>
					{:else}
						<span>Unlinked</span>
					{/if}
				</div>
			</article>
		{/each}
	</section>
{:else}
	<section class="panel empty-inbox">
		<span class="soft-icon"><Activity size={20} /></span>
		<div>
			<h2>No activities yet</h2>
			<p class="empty-state">Use Inbox review to log a quick capture as an activity.</p>
		</div>
	</section>
{/if}
