import { test, expect } from '@playwright/test';

test.describe('Auth Edge Cases', () => {
  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/auth/login');

    await page.locator('input[name="email"]').fill('nonexistent@test.local');
    await page.locator('input[name="password"]').fill('WrongPass1!');
    await page.locator('button[type="submit"]').click();

    // Should show error (toast or inline message)
    await expect(
      page.locator('[role="alert"]').or(page.locator('.Toastify')).or(page.locator('text=Invalid').or(page.locator('text=invalid')))
    ).toBeVisible({ timeout: 10000 });
  });

  test('registration with mismatched passwords shows validation error', async ({ page }) => {
    await page.goto('/auth/register');

    await page.locator('input[name="firstName"]').fill('Test');
    await page.locator('input[name="lastName"]').fill('User');
    await page.locator('input[name="email"]').fill('mismatch@test.local');
    await page.locator('input[name="password"]').fill('TestPass1!');
    await page.locator('input[name="confirmPassword"]').fill('Different2!');
    await page.locator('button[type="submit"]').click();

    // Should show password mismatch error
    await expect(
      page.locator('text=match').or(page.locator('text=Match').or(page.locator('text=same')))
    ).toBeVisible({ timeout: 5000 });
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/profile/add-book');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/auth/login');

    const registerLink = page.locator('a[href*="/auth/register"], button:has-text("Sign up"), a:has-text("Sign up"), a:has-text("Register")').first();
    await expect(registerLink).toBeVisible({ timeout: 5000 });
  });
});
