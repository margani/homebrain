export function formatDateTime(value?: string | null) {
	if (!value) return 'No date';

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'No date';

	return new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(date);
}

export function formatDate(value?: string | null) {
	if (!value) return 'No date';

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'No date';

	return new Intl.DateTimeFormat('en', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	}).format(date);
}

export function labelFromValue(value?: string | null) {
	if (!value) return 'Unknown';

	return value
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function editorText(value?: string | null) {
	if (!value) return '';

	return value
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

export function firstNonEmptyLine(value: string) {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
}
