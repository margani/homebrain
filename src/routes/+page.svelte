<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentBrowserUser, initAuth } from '$lib/pocketbase/client';

	onMount(async () => {
		await initAuth();
		await goto(currentBrowserUser() ? '/today' : '/login', { replaceState: true });
	});
</script>

<main class="login-page">
	<section class="login-panel">
		<p class="eyebrow">HomeBrain</p>
		<h1>Loading</h1>
		<p class="empty-state">Opening your home memory...</p>
	</section>
</main>
