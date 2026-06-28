<script lang="ts">
	import ThingForm from '$lib/components/ThingForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();
</script>

<svelte:head>
	<title>New thing - HomeBrain</title>
</svelte:head>

<section class="detail-header">
	<a class="back-link" href="/things">Things</a>
	<div>
		<p class="eyebrow">Things</p>
		<h1>New thing</h1>
	</div>
</section>

<section class="panel">
	<ThingForm locations={data.locations} {form} submitLabel="Create thing" pendingLabel="Creating..." />
</section>
