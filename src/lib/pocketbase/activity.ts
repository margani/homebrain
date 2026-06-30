export function parseActivityDurationMinutes(value: FormDataEntryValue | null) {
	const raw = String(value ?? '').trim();
	const minutes = Number(raw);

	if (!raw || !Number.isInteger(minutes) || minutes <= 0) {
		return {
			error: 'Duration minutes must be a positive whole number.'
		};
	}

	return { minutes };
}

export function formatActivityDuration(minutes: unknown) {
	const value = Number(minutes);
	if (!Number.isFinite(value) || value <= 0) return '';

	return `${value} min`;
}
