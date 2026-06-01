import { expect, test } from './fixtures/page';

test.describe('M4 robustness — error surfacing', () => {
  test('an unhandled promise rejection surfaces as a toast (role=alert)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toHaveText('Today');

    // Simulate a background failure that would otherwise die silently. The
    // global handler installed at startup routes it to the toast surface.
    await page.evaluate(() => {
      void Promise.reject(new Error('simulated background failure'));
    });

    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('simulated background failure');

    // Errors persist until dismissed — the dismiss control clears it.
    await toast.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
