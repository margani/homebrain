import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TodayPage from '../../src/routes/(app)/today/+page.svelte';
import { fixtureEvents, fixtureRoutines, fixtureThings, fixtureUser } from '../fixtures/homebrain';

const mocks = vi.hoisted(() => ({
	createQuickCaptureNote: vi.fn()
}));

vi.mock('$lib/pocketbase/client', () => ({
	getBrowserPb: vi.fn(() => ({})),
	refreshInboxCount: vi.fn(),
	requireUser: vi.fn(async () => fixtureUser)
}));

vi.mock('$lib/pocketbase/data', async () => {
	const actual = await vi.importActual<typeof import('../../src/lib/pocketbase/data')>('../../src/lib/pocketbase/data');
	return {
		...actual,
		createQuickCaptureNote: mocks.createQuickCaptureNote,
		completeRoutine: vi.fn()
	};
});

vi.mock('$lib/ui/pending', () => ({
	beginPendingWork: vi.fn(() => () => undefined)
}));

function renderToday() {
	return render(TodayPage, {
		props: {
			data: {
				user: fixtureUser,
				dueSoon: fixtureRoutines,
				lowStock: [fixtureThings[0]],
				recentNotes: [fixtureEvents[1]]
			}
		}
	});
}

beforeEach(() => {
	mocks.createQuickCaptureNote.mockReset();
});

describe('Quick Capture form', () => {
	it('typing text enables a successful save and clears the input', async () => {
		const user = userEvent.setup();
		mocks.createQuickCaptureNote.mockResolvedValueOnce({
			...fixtureEvents[0],
			id: 'event_saved',
			title: 'Fresh note',
			notes: 'Fresh note'
		});
		renderToday();

		const input = screen.getByPlaceholderText('First line becomes the title. Add the full note here.');
		await user.type(input, 'Fresh note');
		await user.click(screen.getByRole('button', { name: /save note/i }));

		expect(mocks.createQuickCaptureNote).toHaveBeenCalledWith({}, fixtureUser.id, 'Fresh note');
		expect(input).toHaveValue('');
		expect(await screen.findByText('Saved')).toBeInTheDocument();
	});

	it('restores text and shows an error when save fails', async () => {
		const user = userEvent.setup();
		mocks.createQuickCaptureNote.mockRejectedValueOnce(new Error('PocketBase is unavailable'));
		renderToday();

		const input = screen.getByPlaceholderText('First line becomes the title. Add the full note here.');
		await user.type(input, 'Needs retry');
		await user.click(screen.getByRole('button', { name: /save note/i }));

		expect(await screen.findByText('PocketBase is unavailable')).toBeInTheDocument();
		expect(input).toHaveValue('Needs retry');
	});
});
