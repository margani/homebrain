<script lang="ts">
	import {
		Boxes,
		CalendarClock,
		Inbox,
		LayoutDashboard,
		Link2,
		MessageSquareText,
		Notebook,
		ShoppingBasket
	} from 'lucide-svelte';
	import { editorText, firstNonEmptyLine, formatDate, formatDateTime, labelFromValue } from '$lib/pocketbase/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function localDateKey(date = new Date()) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

		return `${year}-${month}-${day}`;
	}

	const todayKey = localDateKey();

	function dateKeyFor(value?: string | null) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';

		return localDateKey(date);
	}

	function dueLabel(value?: string | null) {
		const key = dateKeyFor(value);
		if (!key) return 'Upcoming';
		if (key < todayKey) return 'Overdue';
		if (key === todayKey) return 'Today';

		return 'Upcoming';
	}

	function titleFor(event: PageData['recentNotes'][number]) {
		return event.title || firstNonEmptyLine(editorText(event.notes)) || 'Untitled note';
	}

	function quantityFor(thing: PageData['buyList'][number]) {
		const quantity = [thing.quantity_number, thing.unit]
			.filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
			.join(' ');

		return thing.quantity_text || quantity || 'Needs attention';
	}
</script>

<svelte:head>
	<title>Dashboard - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Review</p>
		<h1>Dashboard</h1>
	</div>
	<p>A quiet view of captures, links, routines, and buy-list items.</p>
</section>

<section class="dashboard-summary-grid" aria-label="Review summary">
	<a class="panel dashboard-summary-card" href="/inbox">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Inbox</p>
				<h2>To review</h2>
			</div>
			<span class="soft-icon"><Inbox size={20} /></span>
		</div>
		<strong>{data.inboxCount}</strong>
		<span>{data.inboxCount === 1 ? 'capture waiting' : 'captures waiting'}</span>
	</a>

	<article class="panel dashboard-summary-card">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Routines</p>
				<h2>Due</h2>
			</div>
			<span class="soft-icon"><CalendarClock size={20} /></span>
		</div>
		<strong>{data.dueRoutines.length}</strong>
		<span>{data.dueRoutines.length === 1 ? 'routine scheduled' : 'routines scheduled'}</span>
	</article>

	<article class="panel dashboard-summary-card">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Inventory</p>
				<h2>Buy list</h2>
			</div>
			<span class="soft-icon"><ShoppingBasket size={20} /></span>
		</div>
		<strong>{data.buyList.length}</strong>
		<span>{data.buyList.length === 1 ? 'item marked low' : 'items marked low'}</span>
	</article>

	<a class="panel dashboard-summary-card" href="/reflection">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Reflection</p>
				<h2>Today</h2>
			</div>
			<span class="soft-icon"><MessageSquareText size={20} /></span>
		</div>
		<strong>{data.reflection.answeredPromptCount}</strong>
		<span>{data.reflection.hasAnswers ? 'answers saved today' : 'no answers yet today'}</span>
	</a>
</section>

<section class="dashboard-grid">
	<article class="panel dashboard-section">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Capture</p>
				<h2>Recent Quick Notes</h2>
			</div>
			<span class="soft-icon"><Notebook size={20} /></span>
		</div>
		{#if data.recentNotes.length}
			<ul class="note-list">
				{#each data.recentNotes as note}
					<li>
						<div class="note-meta">
							<strong>{titleFor(note)}</strong>
							<time datetime={note.happened_at || note.created}>{formatDateTime(note.happened_at || note.created)}</time>
						</div>
						{#if editorText(note.notes)}
							<p>{editorText(note.notes)}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">No quick notes yet.</p>
		{/if}
	</article>

	<article class="panel dashboard-section">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Links</p>
				<h2>Recently Linked</h2>
			</div>
			<span class="soft-icon"><Link2 size={20} /></span>
		</div>
		{#if data.recentlyLinked.length}
			<ul class="note-list">
				{#each data.recentlyLinked as note}
					<li>
						<div class="note-meta">
							<strong>{titleFor(note)}</strong>
							<time datetime={note.updated || note.happened_at || note.created}>{formatDateTime(note.updated || note.happened_at || note.created)}</time>
						</div>
						{#if note.expand?.thing}
							<a class="inline-record-link" href={`/things/${note.expand.thing.id}`}>
								<Boxes size={15} />
								{note.expand.thing.name}
							</a>
						{/if}
						{#if editorText(note.notes)}
							<p>{editorText(note.notes)}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">Linked notes will appear here.</p>
		{/if}
	</article>

	<article class="panel dashboard-section">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Memory</p>
				<h2>Active Things</h2>
			</div>
			<span class="soft-icon"><Boxes size={20} /></span>
		</div>
		{#if data.activeThings.length}
			<ul class="record-list dashboard-record-list">
				{#each data.activeThings as thing}
					<li>
						<div>
							<a class="record-title-link" href={`/things/${thing.id}`}>{thing.name}</a>
							<span>{thing.linkedEventCount} linked {thing.linkedEventCount === 1 ? 'event' : 'events'}</span>
						</div>
						<div class="dashboard-pill-row">
							<span class="status-pill">{labelFromValue(thing.type)}</span>
							{#if thing.status}
								<span class="status-pill">{labelFromValue(thing.status)}</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">Linked things from the last 30 days will appear here.</p>
		{/if}
	</article>

	<article class="panel dashboard-section">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Routines</p>
				<h2>Due Soon</h2>
			</div>
			<span class="soft-icon"><CalendarClock size={20} /></span>
		</div>
		{#if data.dueRoutines.length}
			<ul class="record-list dashboard-record-list">
				{#each data.dueRoutines as routine}
					<li>
						<div>
							<strong>{routine.name}</strong>
							<span>{routine.expand?.thing?.name ?? 'Home routine'}</span>
						</div>
						<div class="dashboard-pill-row">
							<time datetime={routine.next_due_at}>{formatDate(routine.next_due_at)}</time>
							<span class:danger-pill={dueLabel(routine.next_due_at) === 'Overdue'} class="status-pill">
								{dueLabel(routine.next_due_at)}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">No active routines with dates right now.</p>
		{/if}
	</article>

	<article class="panel dashboard-section">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Inventory</p>
				<h2>Buy List</h2>
			</div>
			<span class="soft-icon"><ShoppingBasket size={20} /></span>
		</div>
		{#if data.buyList.length}
			<ul class="record-list dashboard-record-list">
				{#each data.buyList as thing}
					<li>
						<div>
							<a class="record-title-link" href={`/things/${thing.id}`}>{thing.name}</a>
							<span>{quantityFor(thing)}</span>
						</div>
						<span class="status-pill">{labelFromValue(thing.status)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">Nothing is marked low or empty.</p>
		{/if}
	</article>
</section>
