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
		createMetricObservationFromNoteEvent: vi.fn(),
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
	it('initially shows only the note and Review button', () => {
		renderInbox();

		expect(screen.getByText('Buy coffee')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^review$/i })).toBeInTheDocument();
		expect(screen.queryByText('What is this?')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /something i did/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
	});

	it('Review opens the meaning-first chooser', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /^review$/i }));

		const dialog = screen.getByRole('dialog', { name: /buy coffee/i });
		expect(within(dialog).getByText('What is this?')).toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /something i did/i })).toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /something i need/i })).toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /something i measured/i })).toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /something worth remembering/i })).toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /something recurring/i })).toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /nothing important/i })).toBeInTheDocument();
	});

	it('choosing Something I did shows only the activity form', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /^review$/i }));
		await user.click(screen.getByRole('button', { name: /something i did/i }));

		expect(screen.getByLabelText(/activity type/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^duration$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/link to topic optional/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^save activity$/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/item name/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/routine name/i)).not.toBeInTheDocument();
	});

	it('Back returns to the meaning chooser and Cancel closes review', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /^review$/i }));
		await user.click(screen.getByRole('button', { name: /something i did/i }));
		await user.click(screen.getByRole('button', { name: /^back$/i }));

		expect(screen.getByRole('button', { name: /something i need/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/^duration$/i)).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /^cancel$/i }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^review$/i })).toBeInTheDocument();
	});

	it('choosing Something I need shows state choices and no quantity fields', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /^review$/i }));
		await user.click(screen.getByRole('button', { name: /something i need/i }));

		expect(screen.getByRole('button', { name: /need to buy/i })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: /running low/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /out of stock/i })).toBeInTheDocument();
		expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/optional note/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/link to topic optional/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
		expect(screen.queryByPlaceholderText(/not bought yet/i)).not.toBeInTheDocument();
	});

	it('choosing Something I measured shows metric fields without quantity fields', async () => {
		const user = userEvent.setup();
		renderInbox();

		await user.click(screen.getByRole('button', { name: /^review$/i }));
		await user.click(screen.getByRole('button', { name: /something i measured/i }));

		expect(screen.getByLabelText(/link to existing topic optional/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/metric name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^value$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^unit$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/category for new topic optional/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^save measurement$/i })).toBeInTheDocument();
		expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
	});
});
