<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		Activity,
		Brain,
		House,
		Inbox,
		LayoutDashboard,
		LogOut,
		MessageSquareText,
		NotebookText,
		Search,
		Settings,
		ShoppingBasket,
		Boxes
	} from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { displayName, initialsForUser } from '$lib/pocketbase/auth';
	import {
		authReady,
		currentUser,
		getBrowserPb,
		inboxCountVersion,
		initAuth,
		logout
	} from '$lib/pocketbase/client';
	import { getCachedInboxCount, sharedInboxCount } from '$lib/pocketbase/data';
	import { hasPendingWork } from '$lib/ui/pending';

	let { children }: { children: import('svelte').Snippet } = $props();

	const navItems = [
		{ href: '/today', label: 'Today', icon: House },
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/inbox', label: 'Inbox', icon: Inbox },
		{ href: '/needs', label: 'Needs', icon: ShoppingBasket },
		{ href: '/notes', label: 'Notes', icon: NotebookText },
		{ href: '/activities', label: 'Activities', icon: Activity },
		{ href: '/things', label: 'Things', icon: Boxes },
		{ href: '/reflection', label: 'Reflection', icon: MessageSquareText },
		{ href: '/search', label: 'Search', icon: Search },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];
	const bottomNavItems = navItems.filter(
		(item) =>
			item.href !== '/dashboard' &&
			item.href !== '/needs' &&
			item.href !== '/notes' &&
			item.href !== '/activities'
	);

	let isLoggingOut = $state(false);
	let inboxCount = $state(0);
	const showTopLoading = $derived($hasPendingWork || navigating.type !== null || isLoggingOut);
	const showPageLoading = $derived(navigating.type !== null && !$hasPendingWork && !isLoggingOut);

	onMount(() => {
		initAuth();
	});

	$effect(() => {
		if (!$authReady) return;

		if (!$currentUser) {
			goto('/login', { replaceState: true });
		}
	});

	$effect(() => {
		const user = $currentUser;
		const version = $inboxCountVersion;
		const cachedCount = $sharedInboxCount;
		if (!$authReady || !user) {
			inboxCount = 0;
			return;
		}

		void version;
		if (cachedCount !== null) {
			inboxCount = cachedCount;
			return;
		}

		getCachedInboxCount(getBrowserPb(), user.id)
			.then((count) => {
				inboxCount = count;
			})
			.catch(() => {
				inboxCount = 0;
			});
	});

	function isActive(href: string) {
		const pathname = page.url.pathname;
		if (href === '/things') return pathname.startsWith('/things');
		if (href === '/needs') return pathname.startsWith('/needs');
		if (href === '/notes') return pathname.startsWith('/notes');
		if (href === '/activities') return pathname.startsWith('/activities');
		return pathname === href;
	}

	async function handleLogout() {
		if (isLoggingOut) return;

		isLoggingOut = true;

		try {
			logout();
			await goto('/login');
		} finally {
			isLoggingOut = false;
		}
	}
</script>

{#if !$authReady || !$currentUser}
	<main class="login-page">
		<section class="login-panel">
			<p class="eyebrow">HomeBrain</p>
			<h1>Loading</h1>
			<p class="empty-state">Checking your PocketBase session...</p>
		</section>
	</main>
{:else}
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
				{#if item.href === '/inbox' && inboxCount}
					<span class="nav-badge">{inboxCount}</span>
				{/if}
			</a>
		{/each}
		</nav>

		<div class="sidebar-account">
			<div class="account-card">
				{#if $currentUser?.avatarUrl}
					<img class="avatar" src={$currentUser.avatarUrl} alt="" />
				{:else}
					<div class="avatar initials">{initialsForUser($currentUser)}</div>
				{/if}
				<div class="account-text">
					<strong>{displayName($currentUser)}</strong>
					<span>{$currentUser?.email}</span>
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
				{#if item.href === '/inbox' && inboxCount}
					<span class="nav-badge">{inboxCount}</span>
				{/if}
			</a>
		{/each}
	</nav>
</div>
{/if}
