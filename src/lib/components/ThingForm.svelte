<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Plus } from 'lucide-svelte';
	import { editorText, labelFromValue } from '$lib/pocketbase/format';
	import type { ThingFormValues } from '$lib/pocketbase/forms';
	import {
		thingStatusOptions,
		thingTypeOptions,
		type LocationRecord,
		type ThingRecord
	} from '$lib/pocketbase/types';

	type ThingActionData = {
		thingError?: string;
		thingSaved?: boolean;
		values?: ThingFormValues;
	};

	let {
		thing = null,
		locations,
		form = undefined,
		submitLabel,
		pendingLabel = 'Saving...',
		successMessage = 'Saved.'
	}: {
		thing?: ThingRecord | null;
		locations: LocationRecord[];
		form?: ThingActionData | null;
		submitLabel: string;
		pendingLabel?: string;
		successMessage?: string;
	} = $props();

	let isSubmitting = $state(false);
	let isCreatingLocation = $state(false);

	const initialMetadata = $derived(thing?.metadata ? JSON.stringify(thing.metadata, null, 2) : '');
	const values = $derived({
		name: form?.values?.name ?? thing?.name ?? '',
		type: form?.values?.type ?? thing?.type ?? 'other',
		status: form?.values?.status ?? thing?.status ?? '',
		location: form?.values?.location ?? thing?.location ?? '',
		quantity_text: form?.values?.quantity_text ?? thing?.quantity_text ?? '',
		quantity_number:
			form?.values?.quantity_number ?? (thing?.quantity_number == null ? '' : String(thing.quantity_number)),
		unit: form?.values?.unit ?? thing?.unit ?? '',
		notes: form?.values?.notes ?? editorText(thing?.notes) ?? '',
		metadata: form?.values?.metadata ?? initialMetadata,
		new_location_name: form?.values?.new_location_name ?? '',
		new_location_path: form?.values?.new_location_path ?? '',
		new_location_notes: form?.values?.new_location_notes ?? ''
	});

	const submitEnhance: SubmitFunction = ({ cancel, formData }) => {
		if (isSubmitting) {
			cancel();
			return;
		}

		isSubmitting = true;
		isCreatingLocation = Boolean(String(formData.get('new_location_name') ?? '').trim());

		return async ({ update }) => {
			await update();
			isSubmitting = false;
			isCreatingLocation = false;
		};
	};
</script>

<form method="POST" class="stacked-form domain-form" use:enhance={submitEnhance}>
	{#if form?.thingError}
		<p class="notice error">{form.thingError}</p>
	{:else if form?.thingSaved}
		<p class="notice success">{successMessage}</p>
	{/if}

	<div class="form-grid">
		<label>
			Name
			<input name="name" value={values.name} required autocomplete="off" />
		</label>

		<label>
			Type
			<select name="type">
				{#each thingTypeOptions as type}
					<option value={type} selected={values.type === type}>{labelFromValue(type)}</option>
				{/each}
			</select>
		</label>

		<label>
			Status
			<select name="status">
				<option value="" selected={!values.status}>Not set</option>
				{#each thingStatusOptions as status}
					<option value={status} selected={values.status === status}>{labelFromValue(status)}</option>
				{/each}
			</select>
		</label>

		<label>
			Location
			<select name="location">
				<option value="" selected={!values.location}>Not set</option>
				{#each locations as location}
					<option value={location.id} selected={values.location === location.id}>
						{location.path ? `${location.path} / ${location.name}` : location.name}
					</option>
				{/each}
			</select>
		</label>
	</div>

	<details class="inline-create" open={Boolean(values.new_location_name)}>
		<summary>
			<span><Plus size={17} /> Add a new location</span>
		</summary>
		<div class="form-grid inline-grid">
			<label>
				Location name
				<input name="new_location_name" value={values.new_location_name} autocomplete="off" />
			</label>
			<label>
				Path
				<input name="new_location_path" value={values.new_location_path} placeholder="Kitchen / Pantry" autocomplete="off" />
			</label>
			<label class="wide-field">
				Location notes
				<textarea name="new_location_notes" rows="3">{values.new_location_notes}</textarea>
			</label>
		</div>
		{#if isSubmitting && isCreatingLocation}
			<p class="loading-note"><span class="loading-spinner" aria-hidden="true"></span>Creating location...</p>
		{/if}
	</details>

	<div class="form-grid">
		<label>
			Quantity text
			<input name="quantity_text" value={values.quantity_text} placeholder="Half box, two spare packs..." autocomplete="off" />
		</label>
		<label>
			Quantity number
			<input name="quantity_number" value={values.quantity_number} inputmode="decimal" autocomplete="off" />
		</label>
		<label>
			Unit
			<input name="unit" value={values.unit} placeholder="rolls, kg, bottles..." autocomplete="off" />
		</label>
	</div>

	<label>
		Notes
		<textarea name="notes" rows="5">{values.notes}</textarea>
	</label>

	<label>
		Metadata
		<textarea name="metadata" rows="5" spellcheck="false" placeholder="Optional JSON metadata">{values.metadata}</textarea>
	</label>

	<div class="form-footer">
		<p class="hint">Metadata is optional JSON. Notes are displayed as plain text.</p>
		<button class="primary-action compact" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
			{#if isSubmitting}
				<span class="loading-spinner light" aria-hidden="true"></span>
				{pendingLabel}
			{:else}
				{submitLabel}
			{/if}
		</button>
	</div>
</form>
