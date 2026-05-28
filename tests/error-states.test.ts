import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const BOGUS_ID = '00000000-dead-beef-0000-000000000000';

// ── API 404s ─────────────────────────────────────────────────────────────────

test('GET /api/groups/:id returns 404 for unknown id', async ({ request }) => {
  const res = await request.get(`${BASE}/api/groups/${BOGUS_ID}`);
  expect(res.status()).toBe(404);
});

test('GET /api/sessions/:id returns 404 for unknown id', async ({ request }) => {
  const res = await request.get(`${BASE}/api/sessions/${BOGUS_ID}`);
  expect(res.status()).toBe(404);
});

test('GET /api/sessions/:id/messages returns 404 for unknown session', async ({ request }) => {
  const res = await request.get(`${BASE}/api/sessions/${BOGUS_ID}/messages`);
  expect(res.status()).toBe(404);
});

test('GET /api/groups/:id/members returns 404 for unknown group', async ({ request }) => {
  const res = await request.get(`${BASE}/api/groups/${BOGUS_ID}/members`);
  expect(res.status()).toBe(404);
});

test('GET /api/groups/:id/sessions returns 404 for unknown group', async ({ request }) => {
  const res = await request.get(`${BASE}/api/groups/${BOGUS_ID}/sessions`);
  expect(res.status()).toBe(404);
});

test('GET /api/groups/:id/destinations returns 404 for unknown group', async ({ request }) => {
  const res = await request.get(`${BASE}/api/groups/${BOGUS_ID}/destinations`);
  expect(res.status()).toBe(404);
});

// ── Approval status guard ─────────────────────────────────────────────────────

test('GET /api/approvals?status=invalid falls back to pending (returns array)', async ({ request }) => {
  // The server normalises unknown statuses to "pending" rather than 400ing
  const res = await request.get(`${BASE}/api/approvals?status=invalid_value`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

// ── Page error states ─────────────────────────────────────────────────────────

test('/groups/:id for unknown id does not crash the browser', async ({ page }) => {
  const response = await page.goto(`${BASE}/groups/${BOGUS_ID}`);
  // SvelteKit returns a proper response (4xx or 200 with graceful error state), never a browser crash
  expect(response).not.toBeNull();
  await expect(page.locator('body')).not.toBeEmpty();
});

test('/sessions/:id for unknown id does not crash the browser', async ({ page }) => {
  const response = await page.goto(`${BASE}/sessions/${BOGUS_ID}`);
  // SvelteKit returns a proper response (4xx or 200 with error state), never a browser crash
  expect(response).not.toBeNull();
  // Page should have some content
  await expect(page.locator('body')).not.toBeEmpty();
});

test('/sessions/:id/messages for unknown id does not crash the browser', async ({ page }) => {
  const response = await page.goto(`${BASE}/sessions/${BOGUS_ID}/messages`);
  expect(response).not.toBeNull();
  await expect(page.locator('body')).not.toBeEmpty();
});
