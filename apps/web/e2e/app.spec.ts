import { expect, test } from './fixtures/page';

test.describe('Web app golden path', () => {
  test('boots into Today view with demo data', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Today/ })).toBeVisible();
    // h1 inside main shows "Today"
    await expect(page.locator('main h1')).toHaveText('Today');
  });

  test('adding an area + project persists across reload (OPFS + IDB CryptoKey end-to-end)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toHaveText('Today');

    // Create an area.
    await page.getByRole('button', { name: 'New area' }).click();
    const areaDialog = page.getByRole('dialog', { name: 'New area' });
    await areaDialog.getByPlaceholder('Personal, Work…').fill('Work');
    await areaDialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Work', { exact: true })).toBeVisible();

    // Create a project via the area's "+" affordance.
    await page.getByRole('button', { name: 'New List' }).click();
    const projectDialog = page.getByRole('dialog', { name: 'New project' });
    await projectDialog.getByPlaceholder('Launch v1, Renovate kitchen…').fill('Launch v2');
    await projectDialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Launch v2', { exact: true })).toBeVisible();

    // Reload — both must survive.
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('Today');
    await expect(page.getByText('Work', { exact: true })).toBeVisible();
    await expect(page.getByText('Launch v2', { exact: true })).toBeVisible();
  });

  test('adding a todo from Today persists across reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toHaveText('Today');

    await page.getByRole('button', { name: 'New To-Do' }).click();
    const title = page.getByRole('textbox', { name: /New to-do title/i });
    await title.fill('Buy milk');
    await title.press('Enter');

    await expect(page.getByText('Buy milk', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.locator('main h1')).toHaveText('Today');
    await expect(page.getByText('Buy milk', { exact: true })).toBeVisible();
  });

  test('reload with no data starts cleanly (no leaked state between tests)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toHaveText('Today');
    await expect(page.getByText('No areas yet')).toBeVisible();
  });
});
