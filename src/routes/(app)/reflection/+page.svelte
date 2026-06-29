<script lang="ts">
	import { ArrowLeft, ArrowRight, Check, SkipForward } from 'lucide-svelte';
	import PendingOverlay from '$lib/components/PendingOverlay.svelte';
	import { getBrowserPb, requireUser } from '$lib/pocketbase/client';
	import { upsertPromptAnswer } from '$lib/pocketbase/data';
	import { editorText } from '$lib/pocketbase/format';
	import { beginPendingWork } from '$lib/ui/pending';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let index = $state(0);
	let draftAnswer = $state('');
	let isSaving = $state(false);
	let isComplete = $state(false);
	let answerOverrides = $state<Record<string, string>>({});
	let showSaved = $state(false);
	let hideServerSaved = $state(false);
	let reflectionError = $state('');
	let savedTimer: ReturnType<typeof setTimeout> | undefined;
	let loadedPromptId = $state<string | null>(null);

	const prompts = $derived(data.prompts);
	const currentPrompt = $derived(prompts[index]);
	const answersByPrompt = $derived(
		new Map([
			...data.answers.map((answer) => [answer.prompt, editorText(answer.answer)] as const),
			...Object.entries(answerOverrides)
		])
	);
	const answeredPrompts = $derived(
		prompts.filter((prompt) => Boolean((answersByPrompt.get(prompt.id) ?? '').trim()))
	);
	const progressLabel = $derived(
		prompts.length ? `Question ${Math.min(index + 1, prompts.length)} of ${prompts.length}` : 'No questions'
	);
	const isLastQuestion = $derived(index >= prompts.length - 1);

	$effect(() => {
		const promptId = currentPrompt?.id;
		if (promptId === loadedPromptId) return;

		draftAnswer = promptId ? (answersByPrompt.get(promptId) ?? '') : '';
		loadedPromptId = promptId ?? null;
	});

	function flashSaved() {
		showSaved = true;
		hideServerSaved = false;
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = setTimeout(() => {
			showSaved = false;
			hideServerSaved = true;
		}, 2000);
	}

	function goBack() {
		showSaved = false;
		hideServerSaved = true;
		index = Math.max(0, index - 1);
		isComplete = false;
	}

	function skip() {
		showSaved = false;
		hideServerSaved = true;

		if (isLastQuestion) {
			isComplete = true;
			return;
		}

		index += 1;
	}

	async function handleSave(event: SubmitEvent) {
		event.preventDefault();
		if (isSaving) {
			return;
		}

		if (!currentPrompt) return;
		reflectionError = '';
		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) return;
		const formData = new FormData(form);
		const promptId = String(formData.get('prompt') ?? '').trim();
		const answer = String(formData.get('answer') ?? '').trim();
		isSaving = true;
		const endPendingWork = beginPendingWork();

		try {
			const user = await requireUser();
			await upsertPromptAnswer(getBrowserPb(), user.id, promptId, answer, data.dateKey);
			answerOverrides = { ...answerOverrides, [promptId]: answer };
			flashSaved();

			if (isLastQuestion) {
				isComplete = true;
			} else {
				index += 1;
			}
		} catch (error) {
			reflectionError = error instanceof Error ? error.message : 'The answer could not be saved.';
		} finally {
			endPendingWork();
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Reflection - HomeBrain</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Reflection</p>
		<h1>Daily reflection</h1>
	</div>
	<p>Answer one prompt at a time and keep today’s memory gentle.</p>
</section>

{#if !prompts.length}
	<section class="panel">
		<p class="empty-state">No active reflection prompts are available yet.</p>
	</section>
{:else if isComplete}
	<section class="panel reflection-complete">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Complete</p>
				<h2>Reflection saved</h2>
			</div>
			<span class="soft-icon"><Check size={20} /></span>
		</div>

		{#if answeredPrompts.length}
			<ul class="simple-list">
				{#each answeredPrompts as prompt}
					<li>
						<strong>{prompt.text}</strong>
						<span>{answersByPrompt.get(prompt.id)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">No answers were saved today.</p>
		{/if}

		<a class="primary-action compact reflection-return" href="/today">Back to Today</a>
	</section>
{:else if currentPrompt}
	<section class="panel reflection-panel pending-region">
		<PendingOverlay active={isSaving} message="Saving reflection..." />

		<div class="panel-heading">
			<div>
				<p class="eyebrow">{progressLabel}</p>
				<h2>{currentPrompt.text}</h2>
			</div>
		</div>

		<form method="POST" class="stacked-form reflection-form" onsubmit={handleSave}>
			<input type="hidden" name="prompt" value={currentPrompt.id} />
			<input type="hidden" name="date" value={data.dateKey} />

			<label>
				Answer
				<textarea
					name="answer"
					rows="8"
					bind:value={draftAnswer}
					placeholder="Write what feels useful to remember."
				></textarea>
			</label>

			<div class="reflection-status">
				{#if reflectionError}
					<p class="notice error">{reflectionError}</p>
				{:else if showSaved && !hideServerSaved}
					<p class="notice success">Saved</p>
				{:else}
					<p class="hint">Answers are saved for {data.dateKey}.</p>
				{/if}
			</div>

			<div class="reflection-actions">
				<button class="secondary-action compact" type="button" onclick={goBack} disabled={index === 0 || isSaving}>
					<ArrowLeft size={17} />
					Back
				</button>
				<button class="secondary-action compact" type="button" onclick={skip} disabled={isSaving}>
					<SkipForward size={17} />
					Skip
				</button>
				<button class="primary-action compact" type="submit" disabled={isSaving} aria-busy={isSaving}>
					{#if isSaving}
						<span class="loading-spinner light" aria-hidden="true"></span>
						Saving...
					{:else if isLastQuestion}
						<Check size={17} />
						Finish
					{:else}
						<ArrowRight size={17} />
						Save & Next
					{/if}
				</button>
			</div>
		</form>
	</section>
{/if}
