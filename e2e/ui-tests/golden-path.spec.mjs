import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';
const COMPOSE_FILE = process.env.COMPOSE_FILE || '../docker-compose.ci.yml';

const testEmail = `e2e-ui-${Date.now()}@test.local`;
const testPassword = 'TestPass1!';
const testFirstName = 'UITest';
const testLastName = 'User';

async function apiPost(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

function verifyEmailInDb(email) {
  const mongoEval = `db.users.updateOne({email:'${email}'},{\\$set:{isEmailVerified:true}})`;
  const cmd = `docker compose -f ${COMPOSE_FILE} exec -T mongodb mongosh "mongodb://root:rootpass@localhost:27017/kirjaswappi_e2e?authSource=admin" --quiet --eval "${mongoEval}"`;
  execSync(cmd, { stdio: 'pipe' });
}

async function createVerifiedUser(email, password, firstName, lastName) {
  await apiPost('/api/v1/users/signup', {
    firstName,
    lastName,
    email,
    password,
    confirmPassword: password,
  });
  verifyEmailInDb(email);
  const login = await apiPost('/api/v1/users/login', { email, password });
  return login.json;
}

async function loginViaUI(page, email, password) {
  await page.goto('/auth/login');
  const form = page.locator('form', { has: page.locator('input[name="email"]') });
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);

  // Wait for the login API response before checking navigation
  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/users/login') && resp.request().method() === 'POST'
  );
  await form.locator('button[type="submit"]').click();
  const response = await responsePromise;

  if (response.status() !== 200) {
    throw new Error(`Login API returned ${response.status()}: ${await response.text()}`);
  }

  await expect(page).toHaveURL('/', { timeout: 15000 });
}

test.describe.serial('Golden Path: User Journey', () => {
  let userToken;
  let userId;

  test.beforeAll(async () => {
    const user = await createVerifiedUser(testEmail, testPassword, testFirstName, testLastName);
    userToken = user?.userToken;
    userId = user?.id;
  });

  test.use({
    storageState: undefined,
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('language', 'en');
    });
  });

  test('registration form renders and validates', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    // Submit empty form should show validation errors
    const form = page.locator('form', { has: page.locator('input[name="firstName"]') });
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('text=/Please enter/')).toBeVisible({ timeout: 5000 });
  });

  test('login with valid credentials', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);
  });

  test('home page loads with book listing area', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);

    // The main content area should be present
    await expect(page.locator('main, [role="main"], .container').first()).toBeVisible();
  });

  test('add a book (multi-step form)', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);

    // Navigate to add book page
    await page.goto('/profile/add-book');
    await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10000 });

    // Step 1: Book Details
    await page.locator('input[name="title"]').fill('E2E Test Book');
    await page.locator('input[name="author"]').fill('Test Author');

    // Select language (native select)
    const langSelect = page.locator('select[name="language"]');
    if (await langSelect.isVisible()) {
      const langOptions = await langSelect.locator('option').allTextContents();
      if (langOptions.length > 1) {
        await langSelect.selectOption({ index: 1 });
      }
    }

    // Select condition (native select)
    const condSelect = page.locator('select[name="condition"]');
    if (await condSelect.isVisible()) {
      const condOptions = await condSelect.locator('option').allTextContents();
      if (condOptions.length > 1) {
        await condSelect.selectOption({ index: 1 });
      }
    }

    // Click Next to go to step 2
    await page.locator('button:has-text("Next")').click();

    // Step 2: Other Details (genres + location)
    // Try to select a genre if the genre selector is visible
    const genreButton = page.locator('button:has-text("genre"), button:has-text("Genre")').first();
    if (await genreButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genreButton.click();
      const genreOption = page.locator('[role="dialog"] button, .modal button').first();
      if (await genreOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await genreOption.click();
        const doneButton = page.locator('button:has-text("Done"), button:has-text("Save"), button:has-text("OK")').first();
        if (await doneButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await doneButton.click();
        }
      }
    }

    // Click Next to go to step 3
    await page.locator('button:has-text("Next")').click();

    // Step 3: Swap Conditions
    // Select GiveAway swap type (radio)
    const giveAwayRadio = page.locator('input[value="GiveAway"], label:has-text("Give Away")').first();
    if (await giveAwayRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
      await giveAwayRadio.click();
    }

    // Click Save
    await page.locator('button:has-text("Save")').click();

    // Should see success or redirect to profile
    await expect(
      page.locator('text=/successfully|Success/')
        .or(page.locator(`[href*="/profile/user-profile"]`))
    ).toBeVisible({ timeout: 15000 });
  });

  test('book appears on profile page', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);

    await page.goto(`/profile/user-profile/${userId}`);
    await expect(page.locator('text=E2E Test Book')).toBeVisible({ timeout: 10000 });
  });

  test('book detail page renders correctly', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);

    await page.goto(`/profile/user-profile/${userId}`);
    await page.locator('text=E2E Test Book').first().click();

    await expect(page).toHaveURL(/\/book-details\//, { timeout: 10000 });
    await expect(page.locator('text=E2E Test Book')).toBeVisible();
    await expect(page.locator('text=Test Author')).toBeVisible();
  });

  test('swap request from another user via UI', async ({ page }) => {
    const user2Email = `e2e-ui-user2-${Date.now()}@test.local`;
    const user2Password = 'TestPass2!';
    const user2 = await createVerifiedUser(user2Email, user2Password, 'Swap', 'Tester');

    if (!user2?.userToken) {
      test.skip(true, 'Could not create second user');
      return;
    }

    await loginViaUI(page, user2Email, user2Password);

    // Navigate to user1's profile to find the book
    await page.goto(`/profile/user-profile/${userId}`);
    await expect(page.locator('text=E2E Test Book')).toBeVisible({ timeout: 10000 });

    // Click on the book to go to details
    await page.locator('text=E2E Test Book').first().click();
    await expect(page).toHaveURL(/\/book-details\//, { timeout: 10000 });

    // Click Request Swap button
    const swapButton = page.locator('button:has-text("Request Swap")');
    await expect(swapButton).toBeVisible({ timeout: 5000 });
    await swapButton.click();

    // Swap modal should appear — look for the Send Request button
    const sendButton = page.locator('button:has-text("Send Request")');
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    // Should show success animation or modal disappears
    await expect(
      page.locator('text=/successfully|Success/')
        .or(page.locator('[class*="success"]'))
    ).toBeVisible({ timeout: 10000 });
  });
});
