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

		await page.getByRole('button', { name: /^review$/i }).click();
		await page.getByRole('button', { name: /something i did/i }).click();
		await page.getByRole('spinbutton', { name: 'Duration' }).fill('15');
		await page.getByRole('button', { name: /^save activity$/i }).click();
		await expect(page.getByText('Inbox is clear')).toBeVisible();

		await page.goto('/activities');
		await expect(page.getByRole('link', { name: 'Buy coffee', exact: true })).toBeVisible();
		await expect(page.getByText('Walking · 15 min')).toBeVisible();
	});

	test('things page renders list view and filters by type', async ({ page }) => {
		await page.goto('/things');

		await expect(page.getByLabel('Things list')).toBeVisible();
		await expect(page.getByText('Coffee beans')).toBeVisible();

		await page.goto('/things?type=routine');
		await expect(page.getByText('Water plants')).toBeVisible();
		await expect(page.getByText('Coffee beans')).not.toBeVisible();
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
	});
});
