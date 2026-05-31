import { expect, test } from './fixtures/page';

test.describe('M3 data-safety flows', () => {
  test('export downloads an encrypted backup file', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toHaveText('Today');

    // Seed a todo so there is something to back up.
    await page.getByRole('button', { name: 'New To-Do' }).click();
    const title = page.getByRole('textbox', { name: /New to-do title/i });
    await title.fill('Buy milk');
    await title.press('Enter');
    await expect(page.getByText('Buy milk', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'Export backup' }).click();

    const dialog = page.getByRole('dialog', { name: 'Export backup' });
    await dialog.getByLabel('Passphrase', { exact: true }).fill('hunter2hunter2');
    await dialog.getByLabel('Confirm passphrase').fill('hunter2hunter2');

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('todo-p2p-backup.tp2p');
  });

  test('wipe device clears all data and returns to a fresh first-run', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toHaveText('Today');

    await page.getByRole('button', { name: 'New To-Do' }).click();
    const title = page.getByRole('textbox', { name: /New to-do title/i });
    await title.fill('Secret task');
    await title.press('Enter');
    await expect(page.getByText('Secret task', { exact: true })).toBeVisible();

    // Wipe goes through a native confirm() — auto-accept it.
    page.on('dialog', (d) => d.accept());

    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'Wipe device' }).click();

    // The app reloads itself into an empty state; the todo is gone.
    await expect(page.locator('main h1')).toHaveText('Today');
    await expect(page.getByText('Secret task', { exact: true })).toHaveCount(0);
    await expect(page.getByText('No areas yet')).toBeVisible();
  });
});
