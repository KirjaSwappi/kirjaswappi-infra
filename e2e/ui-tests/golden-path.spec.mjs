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

function ensureGenreInDb() {
  const seedEval = `if(!db.genres.findOne({name:'Fiction'})){db.genres.insertOne({name:'Fiction',parentGenre:null})}`;
  const cmd = `docker compose -f ${COMPOSE_FILE} exec -T mongodb mongosh "mongodb://root:rootpass@localhost:27017/kirjaswappi_e2e?authSource=admin" --quiet --eval "${seedEval}"`;
  execSync(cmd, { stdio: 'pipe' });
}

async function apiCreateBook(token) {
  ensureGenreInDb();

  // Minimal valid JPEG (1x1 pixel)
  const jpegBytes = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
    0x00, 0x7B, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xD9,
  ]);
  const coverBlob = new Blob([jpegBytes], { type: 'image/jpeg' });

  const form = new FormData();
  form.append('title', 'E2E Test Book');
  form.append('author', 'Test Author');
  form.append('language', 'English');
  form.append('condition', 'Good');
  form.append('genres', 'Fiction');
  form.append('coverPhotos', coverBlob, 'cover.jpg');
  form.append('swapCondition', JSON.stringify({
    swapType: 'GiveAway',
    giveAway: true,
    openForOffers: false,
    genres: null,
    books: null,
  }));

  const res = await fetch(`${API_BASE_URL}/api/v1/books`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
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

    const form = page.locator('form', { has: page.locator('input[name="firstName"]') });
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('text=/Please enter/')).toBeVisible({ timeout: 5000 });
  });

  test('login with valid credentials', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);
  });

  test('add book form renders and navigates step 0', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);

    await page.goto('/profile/add-book');
    await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="author"]')).toBeVisible();
    await expect(page.locator('select[name="language"]')).toBeVisible();
    await expect(page.locator('select[name="condition"]')).toBeVisible();

    // Fill step 0 and verify Next button advances
    await page.locator('input[name="title"]').fill('Form Test Book');
    await page.locator('input[name="author"]').fill('Form Author');
    await page.locator('select[name="language"]').selectOption({ index: 1 });
    await page.locator('select[name="condition"]').selectOption({ index: 1 });

    // Upload a cover photo (required for step 0 validation)
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      const pngBytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      );
      await fileInput.setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: pngBytes });
    }

    await page.locator('button:has-text("Next")').click();

    // Confirm we advanced past step 0
    await expect(page.locator('input[name="title"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('book created via API appears on profile page', async ({ page }) => {
    // Create book via API (genres + location require complex UI interactions)
    const bookRes = await apiCreateBook(userToken);
    if (bookRes.status !== 201) {
      throw new Error(`Book creation API returned ${bookRes.status}: ${JSON.stringify(bookRes.json)}`);
    }

    await loginViaUI(page, testEmail, testPassword);
    await page.goto(`/profile/user-profile/${userId}`);
    await page.waitForSelector('text="E2E Test Book"', { timeout: 10000 });
  });

  test('book detail page renders correctly', async ({ page }) => {
    await loginViaUI(page, testEmail, testPassword);

    await page.goto(`/profile/user-profile/${userId}`);
    await page.waitForSelector('text="E2E Test Book"', { timeout: 10000 });
    await page.locator('text=E2E Test Book').last().click();

    await expect(page).toHaveURL(/\/book-details\//, { timeout: 10000 });
    await page.waitForSelector('text="E2E Test Book"', { timeout: 5000 });
    await page.waitForSelector('text="Test Author"', { timeout: 5000 });
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

    await page.goto(`/profile/user-profile/${userId}`);
    await page.waitForSelector('text="E2E Test Book"', { timeout: 10000 });
    await page.locator('text=E2E Test Book').last().click();
    await expect(page).toHaveURL(/\/book-details\//, { timeout: 10000 });

    const swapButton = page.locator('button:has-text("Request Swap")');
    await expect(swapButton).toBeVisible({ timeout: 5000 });
    await swapButton.click();

    const sendButton = page.locator('button:has-text("Send Request")');
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    await expect(
      page.locator('text=/successfully|Success/')
        .or(page.locator('[class*="success"]'))
    ).toBeVisible({ timeout: 10000 });
  });
});
