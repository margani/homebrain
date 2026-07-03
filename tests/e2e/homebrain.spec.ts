import { expect, test } from '@playwright/test';
import { authenticate, mockPocketBase } from './mockPocketBase';

test.beforeEach(async ({ page }) => {
	await mockPocketBase(page);
});

test('unauthenticated user sees login page', async ({ page }) => {
	await page.goto('/today');

	await expect(page.getByRole('heading', { name: 'HomeBrain' })).toBeVisible();
	await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
});

test.describe('authenticated app smoke tests', () => {
	test.beforeEach(async ({ page }) => {
		await authenticate(page);
	});

	test('mocked authenticated user can load Today and quick capture adds a note optimistically', async ({ page }) => {
		await page.goto('/today');

		await expect(page.getByRole('heading', { name: 'Home dashboard' })).toBeVisible();
		await page.getByPlaceholder('First line becomes the title. Add the full note here.').fill('A new capture');
		await page.getByRole('button', { name: /save note/i }).click();
		await expect(page.getByText('A new capture').first()).toBeVisible();
	});

	test('inbox note can be logged as activity and activities page shows it', async ({ page }) => {
		await page.goto('/inbox');

		await page.getByRole('button', { name: /create activity/i }).click();
		await page.getByRole('button', { name: /^save activity$/i }).click();
		await expect(page.getByText('Inbox is clear')).toBeVisible();

		await page.goto('/activities');
		await expect(page.getByRole('link', { name: 'Buy coffee', exact: true })).toBeVisible();
	});

	test('inbox note can become a reviewed Note', async ({ page }) => {
		await page.goto('/inbox');

		await page.getByRole('button', { name: /create note/i }).click();
		await page.getByRole('textbox', { name: 'Category optional' }).fill('Personal');
		await page.getByRole('button', { name: /^save note$/i }).click();
		await expect(page.getByText('Inbox is clear')).toBeVisible();

		await page.goto('/notes');
		await expect(page.getByText('Buy coffee').first()).toBeVisible();
	});

	test('inbox note can become a Need without quantity fields', async ({ page }) => {
		await page.goto('/inbox');

		await page.getByRole('button', { name: /create need/i }).click();
		await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
		await expect(page.getByLabel('Status')).toBeVisible();
		await expect(page.getByLabel(/quantity/i)).toHaveCount(0);
		await page.getByRole('button', { name: /^save need$/i }).click();
		await expect(page.getByText('Inbox is clear')).toBeVisible();

		await page.goto('/needs');
		await expect(page.getByRole('heading', { name: 'What needs attention' })).toBeVisible();
		await expect(page.locator('.need-card').filter({ hasText: 'Buy coffee' })).toContainText('Needed');
	});

	test('inbox note can become a Thing', async ({ page }) => {
		await page.goto('/inbox');

		await page.getByRole('button', { name: /create thing/i }).click();
		await page.getByRole('textbox', { name: 'Category optional' }).fill('Groceries');
		await page.getByRole('button', { name: /^save thing$/i }).click();
		await expect(page.getByText('Inbox is clear')).toBeVisible();

		await page.goto('/things');
		await expect(page.getByRole('link', { name: 'Buy coffee', exact: true })).toBeVisible();
		await expect(page.locator('article').filter({ hasText: 'Buy coffee' })).toContainText('Groceries');
	});

	test('inbox note can be dismissed', async ({ page }) => {
		await page.goto('/inbox');

		await page.getByRole('button', { name: /dismiss/i }).click();
		await expect(page.getByText('Inbox is clear')).toBeVisible();
		await expect(page.getByText('Nothing to review.')).toBeVisible();
	});

	test('Needs page shows low and empty items and Mark as Have removes an item', async ({ page }) => {
		await page.goto('/needs');

		await expect(page.locator('.need-card').filter({ hasText: 'Coffee beans' })).toContainText('Low');
		await expect(page.locator('.need-card').filter({ hasText: 'Dish soap' })).toContainText('Empty');
		await expect(page.getByText('Rice')).not.toBeVisible();

		const coffee = page.locator('.need-card').filter({ hasText: 'Coffee beans' });
		await coffee.getByRole('button', { name: /mark as have/i }).click();
		await expect(coffee).not.toBeVisible();
	});

	test('Log Metric creates a metric event from an inbox note', async ({ page }) => {
		await page.goto('/inbox');

		await page.getByRole('button', { name: /log metric/i }).click();
		await page.getByRole('textbox', { name: 'Measurement' }).fill('Waist');
		await page.getByRole('spinbutton', { name: 'Value' }).fill('105');
		await page.getByRole('textbox', { name: 'Unit' }).fill('cm');
		await expect(page.getByLabel(/quantity/i)).toHaveCount(0);
		await page.getByRole('button', { name: /^save metric$/i }).click();
		await expect(page.getByText('Inbox is clear')).toBeVisible();

		await page.goto('/metrics');
		await expect(page.getByRole('heading', { name: 'Measurements' })).toBeVisible();
		await expect(page.locator('.metric-card').filter({ hasText: 'Waist' })).toContainText('105 cm');
	});

	test('things page renders list view and filters by type', async ({ page }) => {
		await page.goto('/things');

		await expect(page.getByLabel('Things list')).toBeVisible();
		await expect(page.getByText('Coffee beans')).toBeVisible();

		await page.goto('/things?type=routine');
		await expect(page.getByText('Water plants')).toBeVisible();
		await expect(page.getByText('Coffee beans')).not.toBeVisible();
	});

	test('category appears on Things list and detail, and category filter works', async ({ page }) => {
		await page.goto('/things');

		await expect(page.locator('article').filter({ hasText: 'Coffee beans' })).toContainText('Groceries');
		await page.getByLabel('Category').selectOption('Health');
		await expect(page.getByRole('link', { name: 'Weight', exact: true })).toBeVisible();
		await expect(page.getByText('Coffee beans')).not.toBeVisible();

		await page.goto('/things/thing_weight');
		await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
		await expect(page.getByText('Health').first()).toBeVisible();
	});

	test('Thing detail and Metrics page list metric events', async ({ page }) => {
		await page.goto('/things/thing_weight');

		await expect(page.getByRole('heading', { name: 'Measurements' })).toBeVisible();
		await expect(page.getByText('94 kg')).toBeVisible();
		await expect(page.getByText('Morning weigh-in')).toBeVisible();

		await page.goto('/metrics');
		await expect(page.locator('.metric-card').filter({ hasText: 'Weight' })).toContainText('94 kg');
		await expect(page.locator('.metric-card').filter({ hasText: 'Coffee beans' })).toContainText('2 bags');
		await page.getByLabel('Unit').selectOption('kg');
		await expect(page.locator('.metric-card').filter({ hasText: 'Weight' })).toBeVisible();
		await expect(page.locator('.metric-card').filter({ hasText: 'Coffee beans' })).not.toBeVisible();
	});

	test('quantity fields are not shown in Things or Needs UI', async ({ page }) => {
		await page.goto('/things');

		await expect(page.getByText(/^Quantity$/)).toHaveCount(0);
		await expect(page.getByPlaceholder(/quantities/i)).toHaveCount(0);

		await page.goto('/needs');
		await expect(page.getByText(/^Quantity$/)).toHaveCount(0);
		await expect(page.getByLabel(/quantity/i)).toHaveCount(0);
	});

	test('notes page shows reviewed, dismissed, and activity filters', async ({ page }) => {
		await page.goto('/notes');

		await expect(page.getByRole('link', { name: 'Reviewed', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Dismissed', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Activity', exact: true })).toBeVisible();

		await page.goto('/notes?filter=dismissed');
		await expect(page.getByText('Dismissed note')).toBeVisible();
	});

	test('dashboard loads without crashing', async ({ page }) => {
		await page.goto('/dashboard');

		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
		await expect(page.getByRole('link', { name: /inbox to review/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /needs open/i })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Open Needs' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Recent Measurements' })).toBeVisible();
		await expect(page.getByText('Weight: 94 kg')).toBeVisible();
	});
});
