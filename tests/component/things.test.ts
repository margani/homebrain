import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ThingsPage from '../../src/routes/(app)/things/+page.svelte';
import { fixtureThings } from '../fixtures/homebrain';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

function renderThings(selectedType: 'all' | 'inventory' | 'routine' = 'all') {
	return render(ThingsPage, {
		props: {
			data: {
				selectedType,
				typeQuery: selectedType === 'all' ? '' : `?type=${selectedType}`,
				things: fixtureThings
			}
		}
	});
}

describe('Things list', () => {
	it('defaults to List view', () => {
		renderThings();

		expect(screen.getByRole('button', { name: /list/i })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByLabelText('Things list')).toBeInTheDocument();
	});

	it('type chips filter results through route data', () => {
		renderThings('routine');

		expect(screen.getByText('Water plants')).toBeInTheDocument();
		expect(screen.queryByText('Coffee beans')).not.toBeInTheDocument();
	});

	it('view toggle switches from List to Tiles', async () => {
		const user = userEvent.setup();
		renderThings();

		await user.click(screen.getByRole('button', { name: /tiles/i }));

		expect(screen.getByRole('button', { name: /tiles/i })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.queryByLabelText('Things list')).not.toBeInTheDocument();
		expect(screen.getAllByRole('link', { name: /coffee beans|water plants/i }).length).toBeGreaterThan(0);
	});
});
