import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ── API health ──────────────────────────────────────────────────────────────

test('GET /api/health returns status ok', async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('status');
  // status is 'ok' or 'degraded' depending on environment
  expect(['ok', 'degraded']).toContain(body.status);
});

test('GET /api/groups returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/groups`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /api/sessions returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/sessions`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /api/approvals returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/approvals`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /api/approvals?status=all returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/approvals?status=all`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

// ── Page smoke tests ────────────────────────────────────────────────────────

test('/ renders overview page', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle(/NanoClaw/i);
  await expect(page.getByRole('heading', { name: /NanoClaw Dashboard/i })).toBeVisible();
});

test('/groups renders groups page with table or empty state', async ({ page }) => {
  await page.goto(`${BASE}/groups`);
  await expect(page).toHaveTitle(/NanoClaw/i);
  await expect(page.getByRole('heading', { name: /Agent Groups/i })).toBeVisible();
  // Either a table or an empty-state message should appear after load
  await expect(
    page.locator('table, :text("No agent groups found")')
  ).toBeVisible({ timeout: 10000 });
});

test('/sessions renders sessions page', async ({ page }) => {
  await page.goto(`${BASE}/sessions`);
  await expect(page.getByRole('heading', { name: /Sessions/i })).toBeVisible();
});

test('/approvals renders approvals page', async ({ page }) => {
  await page.goto(`${BASE}/approvals`);
  await expect(page.getByRole('heading', { name: /Approval Queue/i })).toBeVisible();
});

// ── Navigation ──────────────────────────────────────────────────────────────

test('sidebar nav highlights active link during client-side navigation', async ({ page }) => {
  await page.goto(BASE);

  // Navigate to Groups via sidebar
  await page.click('nav a[href="/groups"]');
  await expect(page).toHaveURL(/\/groups/);

  // The Groups link should be visually active (font-medium class applied)
  const groupsLink = page.locator('nav a[href="/groups"]');
  await expect(groupsLink).toHaveClass(/font-medium/);

  // Navigate to Sessions
  await page.click('nav a[href="/sessions"]');
  await expect(page).toHaveURL(/\/sessions/);
  const sessionsLink = page.locator('nav a[href="/sessions"]');
  await expect(sessionsLink).toHaveClass(/font-medium/);

  // Groups link should no longer be active
  await expect(groupsLink).not.toHaveClass(/font-medium/);
});
