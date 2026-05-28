import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchFirstGroup(request: APIRequestContext) {
  const res = await request.get(`${BASE}/api/groups`);
  const groups: Array<{ id: string; name: string }> = await res.json();
  return groups.length > 0 ? groups[0] : null;
}

async function fetchFirstSession(request: APIRequestContext) {
  const res = await request.get(`${BASE}/api/sessions`);
  const sessions: Array<{ id: string; agent_group_id: string }> = await res.json();
  return sessions.length > 0 ? sessions[0] : null;
}

// ── Group detail API ─────────────────────────────────────────────────────────

test('GET /api/groups/:id returns the full group object', async ({ request }) => {
  const res = await request.get(`${BASE}/api/groups`);
  const groups: Array<{ id: string; name: string }> = await res.json();
  if (groups.length === 0) return; // no data in this environment

  const first = groups[0];
  const detail = await request.get(`${BASE}/api/groups/${first.id}`);
  expect(detail.status()).toBe(200);
  const body = await detail.json();
  expect(body).toHaveProperty('id', first.id);
  expect(body).toHaveProperty('name');
  expect(body).toHaveProperty('folder');
});

test('GET /api/groups/:id/members returns an array', async ({ request }) => {
  const group = await fetchFirstGroup(request);
  if (!group) return;

  const res = await request.get(`${BASE}/api/groups/${group.id}/members`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/groups/:id/sessions returns an array', async ({ request }) => {
  const group = await fetchFirstGroup(request);
  if (!group) return;

  const res = await request.get(`${BASE}/api/groups/${group.id}/sessions`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/groups/:id/destinations returns an array', async ({ request }) => {
  const group = await fetchFirstGroup(request);
  if (!group) return;

  const res = await request.get(`${BASE}/api/groups/${group.id}/destinations`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

// ── Session detail API ───────────────────────────────────────────────────────

test('GET /api/sessions/:id returns the session object', async ({ request }) => {
  const session = await fetchFirstSession(request);
  if (!session) return;

  const res = await request.get(`${BASE}/api/sessions/${session.id}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('id', session.id);
  expect(body).toHaveProperty('agent_group_id');
  expect(body).toHaveProperty('container_status');
});

test('GET /api/sessions/:id/messages returns an array', async ({ request }) => {
  const session = await fetchFirstSession(request);
  if (!session) return;

  const res = await request.get(`${BASE}/api/sessions/${session.id}/messages`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/sessions/:id/messages respects limit param', async ({ request }) => {
  const session = await fetchFirstSession(request);
  if (!session) return;

  const res = await request.get(`${BASE}/api/sessions/${session.id}/messages?limit=5`);
  expect(res.status()).toBe(200);
  const body: unknown[] = await res.json();
  expect(body.length).toBeLessThanOrEqual(5);
});

// ── Group detail pages ───────────────────────────────────────────────────────

test('/groups/:id renders the group detail page', async ({ page, request }) => {
  const group = await fetchFirstGroup(request);
  if (!group) return;

  await page.goto(`${BASE}/groups/${group.id}`);
  await expect(page).toHaveTitle(/NanoClaw/i);
  // Group name should appear somewhere on the page
  await expect(page.locator('body')).toContainText(group.name);
});

test('/groups/:id shows sessions or empty state', async ({ page, request }) => {
  const group = await fetchFirstGroup(request);
  if (!group) return;

  await page.goto(`${BASE}/groups/${group.id}`);
  await expect(
    page.locator('table, :text("No sessions"), :text("no sessions")')
  ).toBeVisible({ timeout: 10000 });
});

// ── Session detail pages ─────────────────────────────────────────────────────

test('/sessions/:id renders the session detail page', async ({ page, request }) => {
  const session = await fetchFirstSession(request);
  if (!session) return;

  await page.goto(`${BASE}/sessions/${session.id}`);
  await expect(page).toHaveTitle(/NanoClaw/i);
  await expect(page.locator('body')).toContainText(session.id);
});

test('/sessions/:id/messages renders or shows empty state', async ({ page, request }) => {
  const session = await fetchFirstSession(request);
  if (!session) return;

  await page.goto(`${BASE}/sessions/${session.id}/messages`);
  await expect(page).toHaveTitle(/NanoClaw/i);
  await expect(
    page.locator('table, :text("No messages"), :text("no messages")')
  ).toBeVisible({ timeout: 10000 });
});
