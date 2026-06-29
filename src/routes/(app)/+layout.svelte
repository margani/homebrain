<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import {
		Brain,
		House,
		Inbox,
		LayoutDashboard,
		LogOut,
		MessageSquareText,
		NotebookText,
		Search,
		Settings,
		Boxes
	} from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { displayName, initialsForUser } from '$lib/pocketbase/auth';
	import { logout } from '$lib/pocketbase/client';
	import { hasPendingWork } from '$lib/ui/pending';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const navItems = [
		{ href: '/today', label: 'Today', icon: House },
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/inbox', label: 'Inbox', icon: Inbox },
		{ href: '/notes', label: 'Notes', icon: NotebookText },
		{ href: '/things', label: 'Things', icon: Boxes },
		{ href: '/reflection', label: 'Reflection', icon: MessageSquareText },
		{ href: '/search', label: 'Search', icon: Search },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];
	const bottomNavItems = navItems.filter(
		(item) => item.href !== '/dashboard' && item.href !== '/notes'
	);

	let isLoggingOut = $state(false);
	const showTopLoading = $derived($hasPendingWork || navigating.type !== null || isLoggingOut);
	const showPageLoading = $derived(navigating.type !== null && !$hasPendingWork && !isLoggingOut);

	function isActive(href: string) {
		const pathname = page.url.pathname;
		if (href === '/things') return pathname.startsWith('/things');
		if (href === '/notes') return pathname.startsWith('/notes');
		return pathname === href;
	}

	async function handleLogout() {
		if (isLoggingOut) return;

		isLoggingOut = true;

		try {
			await logout();
			await goto('/login');
		} finally {
			isLoggingOut = false;
		}
	}
</script>

<div class="app-shell">
	<div class:active={showTopLoading} class="top-loading-bar" aria-hidden="true"></div>
	<PendingOverlay active={isLoggingOut} message="Logging out..." global />

	<aside class="sidebar">
		<a class="sidebar-brand" href="/today" aria-label="HomeBrain today">
			<span class="brand-mark small"><Brain size={22} /></span>
			<span>HomeBrain</span>
		</a>

		<nav class="sidebar-nav" aria-label="Primary">
		{#each navItems as item}
			{@const Icon = item.icon}
			<a class:active={isActive(item.href)} href={item.href}>
				<Icon size={19} />
				<span>{item.label}</span>
				{#if item.href === '/inbox' && data.inboxCount}
					<span class="nav-badge">{data.inboxCount}</span>
				{/if}
			</a>
		{/each}
		</nav>

		<div class="sidebar-account">
			<div class="account-card">
				{#if data.user?.avatarUrl}
					<img class="avatar" src={data.user.avatarUrl} alt="" />
				{:else}
					<div class="avatar initials">{initialsForUser(data.user)}</div>
				{/if}
				<div class="account-text">
					<strong>{displayName(data.user)}</strong>
					<span>{data.user?.email}</span>
				</div>
			</div>
			<button class="ghost-action logout-action" type="button" onclick={handleLogout} disabled={isLoggingOut}>
				{#if isLoggingOut}
					<span class="loading-spinner" aria-hidden="true"></span>
					Logging out...
				{:else}
					<LogOut size={16} />
					Logout
				{/if}
			</button>
		</div>
	</aside>

	<div class="app-main page-loading-region">
		<PendingOverlay active={showPageLoading} message="Loading..." />

		<header class="mobile-topbar">
			<a class="mobile-brand" href="/today">
				<span class="brand-mark small"><Brain size={21} /></span>
				<span>HomeBrain</span>
			</a>
			<button
				class="icon-button"
				type="button"
				onclick={handleLogout}
				aria-label={isLoggingOut ? 'Logging out' : 'Logout'}
				title={isLoggingOut ? 'Logging out' : 'Logout'}
				disabled={isLoggingOut}
				aria-busy={isLoggingOut}
			>
				{#if isLoggingOut}
					<span class="loading-spinner" aria-hidden="true"></span>
				{:else}
					<LogOut size={18} />
				{/if}
			</button>
		</header>

		<main class="content-shell">
			{@render children()}
		</main>
	</div>

	<nav class="bottom-nav" aria-label="Primary">
		{#each bottomNavItems as item}
			{@const Icon = item.icon}
			<a class:active={isActive(item.href)} href={item.href}>
				<Icon size={20} />
				<span>{item.label}</span>
				{#if item.href === '/inbox' && data.inboxCount}
					<span class="nav-badge">{data.inboxCount}</span>
				{/if}
			</a>
		{/each}
	</nav>
</div>
