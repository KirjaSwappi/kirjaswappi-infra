import { test, expect } from '@playwright/test';

test.describe('Auth Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Set language to English before each test
    await page.addInitScript(() => {
      localStorage.setItem('language', 'en');
    });
  });

  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/auth/login');

    const form = page.locator('form', { has: page.locator('input[name="email"]') });
    await form.locator('input[name="email"]').fill('nonexistent@test.local');
    await form.locator('input[name="password"]').fill('WrongPass1!');
    await form.locator('button[type="submit"]').click();

    // Backend returns "Please provide valid credentials." via inline MessageToastify
    const errorAlert = page.locator('div[role="alert"][aria-live="assertive"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    await expect(errorAlert).toContainText(/credentials|valid|not found/i);
  });

  test('registration with mismatched passwords shows validation error', async ({ page }) => {
    await page.goto('/auth/register');

    const form = page.locator('form', { has: page.locator('input[name="firstName"]') });
    await form.locator('input[name="firstName"]').fill('Test');
    await form.locator('input[name="lastName"]').fill('User');
    await form.locator('input[name="email"]').fill('mismatch@test.local');
    await form.locator('input[name="password"]').fill('TestPass1!');
    await form.locator('input[name="confirmPassword"]').fill('Different2!');
    await form.locator('button[type="submit"]').click();

    // Should show password mismatch error
    await expect(
      page.locator('text=/Passwords must match|must match|match/')
    ).toBeVisible({ timeout: 5000 });
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/profile/add-book');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/auth/login');

    // English text: "Create an account" or link to /auth/register
    const registerLink = page.locator('a[href*="/auth/register"], a:has-text("Create an account"), a:has-text("Sign up"), button:has-text("Create an account")').first();
    await expect(registerLink).toBeVisible({ timeout: 5000 });
  });
});
