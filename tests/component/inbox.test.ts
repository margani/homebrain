import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InboxPage from '../../src/routes/(app)/inbox/+page.svelte';
import { fixtureEvents, fixtureThings, fixtureUser } from '../fixtures/homebrain';

vi.mock('$lib/pocketbase/client', () => ({
	getBrowserPb: vi.fn(() => ({})),
	refreshInboxCount: vi.fn(),
	requireUser: vi.fn(async () => fixtureUser)
}));

vi.mock('$lib/pocketbase/data', async () => {
	const actual = await vi.importActual<typeof import('../../src/lib/pocketbase/data')>('../../src/lib/pocketbase/data');
	return {
		...actual,
		addNoteEventToBuyList: vi.fn(),
		createRoutineFromNoteEvent: vi.fn(),
		linkMemoryEventToThing: vi.fn(),
		logNoteEventAsActivity: vi.fn(),
		markNoteEventReviewed: vi.fn()
	};
});

vi.mock('$lib/ui/pending', () => ({
	beginPendingWork: vi.fn(() => () => undefined)
}));

function renderInbox() {
	return render(InboxPage, {
		props: {
			data: {
				inboxItems: [fixtureEvents[0]],
				things: fixtureThings
			}
		}
	});
}

describe('Inbox card', () => {
	it('initially shows only the action chooser', () => {
		renderInbox();

		expect(screen.getByText('What is this?')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /log activity/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /add to buy list/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/duration minutes/i)).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
	});

	it('choosing Activity shows only the activity form', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /log activity/i }));

		expect(screen.getByLabelText(/activity type/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/duration minutes/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^log activity$/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/item name/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/routine name/i)).not.toBeInTheDocument();
	});

	it('Cancel returns to the action chooser', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /log activity/i }));
		await user.click(screen.getByRole('button', { name: /^cancel$/i }));

		expect(screen.getByRole('button', { name: /add to buy list/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/duration minutes/i)).not.toBeInTheDocument();
	});
});
