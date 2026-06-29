<script lang="ts">
	import { goto } from '$app/navigation';
	import ThingForm from '$lib/components/ThingForm.svelte';
	import { getBrowserPb, requireUser } from '$lib/pocketbase/client';
	import { createLocation, createThing } from '$lib/pocketbase/data';
	import type { ParsedThingForm } from '$lib/pocketbase/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	async function saveThing(parsed: ParsedThingForm) {
		const user = await requireUser();
		const pb = getBrowserPb();

		if (parsed.newLocation) {
			const location = await createLocation(pb, user.id, parsed.newLocation);
			parsed.thing.location = location.id;
		}

		const thing = await createThing(pb, user.id, parsed.thing);
		await goto(`/things/${thing.id}`);
	}
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
	<ThingForm
		locations={data.locations}
		onSave={saveThing}
		submitLabel="Create thing"
		pendingLabel="Creating..."
		pendingMessage="Creating thing..."
		locationPendingMessage="Creating thing and location..."
		successMessage="Saved"
	/>
</section>
