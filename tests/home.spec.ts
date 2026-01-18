import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Rota Fácil/);
});

test('main heading is visible', async ({ page }) => {
    await page.goto('/');

    // Check if there is a heading with "ROTA FÁCIL" (picks the first one if multiple exist)
    const heading = page.getByRole('heading', { name: /ROTA FÁCIL/i }).first();
    await expect(heading).toBeVisible();
});
