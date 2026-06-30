<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Brain } from 'lucide-svelte';
	import { completeOAuthRedirect } from '$lib/pocketbase/client';

	let errorMessage = $state('');

	onMount(async () => {
		try {
			const result = await completeOAuthRedirect();
			await goto(result.returnTo || '/today', { replaceState: true });
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Google sign-in failed.';
		}
	});
</script>

<svelte:head>
	<title>Signing in - HomeBrain</title>
</svelte:head>

<main class="login-page">
	<section class="login-panel">
		<div class="brand-lockup">
			<div class="brand-mark">
				<Brain size={28} />
			</div>
			<div>
				<p class="eyebrow">Personal home memory</p>
				<h1>HomeBrain</h1>
			</div>
		</div>

		{#if errorMessage}
			<div class="login-copy">
				<h2>Sign-in needs another try</h2>
				<p>{errorMessage}</p>
			</div>
			<a class="primary-action" href="/login">Return to login</a>
		{:else}
			<div class="login-copy">
				<h2>Signing you in</h2>
				<p>Finishing the Google sign-in handshake...</p>
			</div>
		{/if}
	</section>
</main>
