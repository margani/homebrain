<script lang="ts">
	let {
		active = false,
		message = 'Working...',
		global = false
	}: {
		active?: boolean;
		message?: string;
		global?: boolean;
	} = $props();
</script>

{#if active}
	<div class:global class="pending-overlay" role="status" aria-live="polite" aria-label={message}>
		<div class="pending-overlay-content">
			<span class="loading-spinner" aria-hidden="true"></span>
			<span>{message}</span>
		</div>
	</div>
{/if}
