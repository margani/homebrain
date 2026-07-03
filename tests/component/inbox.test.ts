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
		addNoteEventToNeed: vi.fn(),
		createActivityFromNoteEvent: vi.fn(),
		createMetricObservationFromNoteEvent: vi.fn(),
		createNoteFromNoteEvent: vi.fn(),
		createThingFromNoteEvent: vi.fn(),
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
	it('shows the note with review actions and no open form by default', () => {
		renderInbox();

		expect(screen.getByText('Buy coffee')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create note/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create activity/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create need/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create thing/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /log metric/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^later$/i })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^save note$/i })).not.toBeInTheDocument();
	});

	it('Create Note opens the note form inline', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create note/i }));

		expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/category optional/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^body$/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^save note$/i })).toBeInTheDocument();
	});

	it('Create Activity opens the activity form inline', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create activity/i }));

		expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/date and time/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/category optional/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^notes$/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^save activity$/i })).toBeInTheDocument();
	});

	it('Later closes the inline form without changing the item', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create activity/i }));
		expect(screen.getByRole('button', { name: /^save activity$/i })).toBeInTheDocument();

		await user.click(screen.getAllByRole('button', { name: /^later$/i }).at(-1)!);

		expect(screen.queryByRole('button', { name: /^save activity$/i })).not.toBeInTheDocument();
		expect(screen.getByText('Buy coffee')).toBeInTheDocument();
	});

	it('Create Need shows status and no quantity fields', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create need/i }));

		expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/category optional/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^notes$/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
		expect(screen.queryByPlaceholderText(/not bought yet/i)).not.toBeInTheDocument();
	});

	it('Log Metric shows metric fields without quantity fields', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /log metric/i }));

		expect(screen.getByLabelText(/measurement/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^value$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^unit$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/date and time/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/thing optional/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^save metric$/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
	});
});
