<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Brain, Lock, Mail } from 'lucide-svelte';
	import {
		authReady,
		currentUser,
		initAuth,
		loginWithGoogle,
		loginWithPassword,
		pbConfigured
	} from '$lib/pocketbase/client';

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let busy = $state(false);

	onMount(() => {
		initAuth();
	});

	$effect(() => {
		if ($authReady && $currentUser) {
			goto('/today', { replaceState: true });
		}
	});

	async function handleGoogleLogin() {
		errorMessage = '';
		busy = true;

		try {
			await loginWithGoogle();
			await goto('/today');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Google sign-in failed.';
		} finally {
			busy = false;
		}
	}

	async function handlePasswordLogin(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		busy = true;

		try {
			await loginWithPassword(email, password);
			await goto('/today');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Email login failed.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Login - HomeBrain</title>
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

		<div class="login-copy">
			<h2>Welcome back</h2>
			<p>Keep track of what matters around the house, quietly and without clutter.</p>
		</div>

		{#if !$pbConfigured}
			<p class="notice error">Set PUBLIC_POCKETBASE_URL in your environment before signing in.</p>
		{/if}

		<button class="primary-action google-action" type="button" onclick={handleGoogleLogin} disabled={busy || !$pbConfigured}>
			<span class="google-g">G</span>
			Continue with Google
		</button>

		<div class="divider"><span>Email fallback</span></div>

		<form class="stacked-form" onsubmit={handlePasswordLogin}>
			<label>
				<span>Email</span>
				<div class="input-shell">
					<Mail size={18} />
					<input bind:value={email} autocomplete="email" name="email" placeholder="you@example.com" type="email" />
				</div>
			</label>

			<label>
				<span>Password</span>
				<div class="input-shell">
					<Lock size={18} />
					<input
						bind:value={password}
						autocomplete="current-password"
						name="password"
						placeholder="Your password"
						type="password"
					/>
				</div>
			</label>

			<button class="secondary-action" type="submit" disabled={busy || !$pbConfigured}>
				Sign in with email
			</button>
		</form>

		{#if errorMessage}
			<p class="notice error">{errorMessage}</p>
		{/if}
	</section>
</main>
