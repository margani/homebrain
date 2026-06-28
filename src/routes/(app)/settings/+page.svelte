<script lang="ts">
	import { goto } from '$app/navigation';
	import { LogOut, Settings } from 'lucide-svelte';
	import { displayName, initialsForUser } from '$lib/pocketbase/auth';
	import { logout } from '$lib/pocketbase/client';
	import { formatDateTime } from '$lib/pocketbase/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let isLoggingOut = $state(false);

	async function handleLogout() {
		isLoggingOut = true;
		try {
			await logout();
			await goto('/login');
		} finally {
			isLoggingOut = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Settings</p>
		<h1>Account</h1>
	</div>
	<p>Profile and authentication basics for this HomeBrain session.</p>
</section>

<section class="settings-grid">
	<article class="panel account-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Signed in</p>
				<h2>{displayName(data.user)}</h2>
			</div>
			<span class="soft-icon"><Settings size={20} /></span>
		</div>
		<div class="profile-row">
			{#if data.user?.avatarUrl}
				<img class="avatar large-avatar" src={data.user.avatarUrl} alt="" />
			{:else}
				<div class="avatar large-avatar initials">{initialsForUser(data.user)}</div>
			{/if}
			<div>
				<strong>{data.user?.email}</strong>
				<span>{data.user?.verified ? 'Verified email' : 'Email not verified'}</span>
			</div>
		</div>
		<dl class="detail-list">
			<div>
				<dt>User ID</dt>
				<dd>{data.user?.id}</dd>
			</div>
			<div>
				<dt>Created</dt>
				<dd>{formatDateTime(data.user?.created)}</dd>
			</div>
			<div>
				<dt>Updated</dt>
				<dd>{formatDateTime(data.user?.updated)}</dd>
			</div>
		</dl>
	</article>

	<article class="panel">
		<h2>Session</h2>
		<p class="panel-copy">Google sign-in is the primary method. Email and password remains available as a fallback.</p>
		<button class="secondary-action icon-text" type="button" onclick={handleLogout} disabled={isLoggingOut}>
			<LogOut size={17} />
			Logout
		</button>
	</article>
</section>
