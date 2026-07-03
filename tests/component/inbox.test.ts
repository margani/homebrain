import { render, screen } from '@testing-library/svelte';
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
		expect(screen.getByText('Buy coffee')).toHaveAttribute('dir', 'auto');
		expect(screen.getByText('Buy coffee beans')).toHaveAttribute('dir', 'auto');
		expect(screen.getByRole('button', { name: /create note/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create activity/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create need/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create thing/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /log metric/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^later$/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^save note$/i })).not.toBeInTheDocument();
	});

	it('Create Note opens the note form inline', async () => {
		const user = userEvent.setup();
		renderInbox();

		const createNoteButton = screen.getByRole('button', { name: /create note/i });
		await user.click(createNoteButton);

		expect(createNoteButton).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText('Reviewing')).toBeInTheDocument();
		expect(screen.getByText('Creating Note')).toBeInTheDocument();
		expect(screen.getByText(/From quick capture: Buy coffee beans/i)).toHaveAttribute('dir', 'auto');
		expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/category optional/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^body$/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^save note$/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^later$/i })).not.toBeInTheDocument();
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

	it('Cancel closes the inline form without changing the item', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create activity/i }));
		expect(screen.getByRole('button', { name: /^save activity$/i })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /^cancel$/i }));

		expect(screen.queryByRole('button', { name: /^save activity$/i })).not.toBeInTheDocument();
		expect(screen.getByText('Buy coffee')).toBeInTheDocument();
	});

	it('does not show Later while an inline form is open', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create activity/i }));
		expect(screen.getByText('Creating Activity')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^later$/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeInTheDocument();
	});

	it('switches between create/log actions while a form is open', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create need/i }));
		expect(screen.getByText('Creating Need')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create need/i })).toHaveAttribute('aria-pressed', 'true');

		await user.click(screen.getByRole('button', { name: /log metric/i }));

		expect(screen.queryByText('Creating Need')).not.toBeInTheDocument();
		expect(screen.getByText('Logging Metric')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create need/i })).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: /log metric/i })).toHaveAttribute('aria-pressed', 'true');
	});

	it('Create Need shows status and no quantity fields', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /create need/i }));

		expect(screen.getByRole('button', { name: /create need/i })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText('Creating Need')).toBeInTheDocument();
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

		expect(screen.getByRole('button', { name: /log metric/i })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText('Logging Metric')).toBeInTheDocument();
		expect(screen.getByLabelText(/measurement/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^value$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^unit$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/date and time/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/thing optional/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^save metric$/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
	});
});
