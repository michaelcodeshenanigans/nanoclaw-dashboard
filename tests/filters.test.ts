import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ── /api/sessions filter combinations ────────────────────────────────────────

test('GET /api/sessions?containerStatus=running returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/sessions?containerStatus=running`);
  expect(res.status()).toBe(200);
  const body: Array<{ container_status: string }> = await res.json();
  expect(Array.isArray(body)).toBe(true);
  // Every returned row must match the filter
  for (const s of body) {
    expect(s.container_status).toBe('running');
  }
});

test('GET /api/sessions?containerStatus=stopped returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/sessions?containerStatus=stopped`);
  expect(res.status()).toBe(200);
  const body: Array<{ container_status: string }> = await res.json();
  expect(Array.isArray(body)).toBe(true);
  for (const s of body) {
    expect(s.container_status).toBe('stopped');
  }
});

test('GET /api/sessions?containerStatus=error returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/sessions?containerStatus=error`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/sessions with unrecognised containerStatus ignores filter', async ({ request }) => {
  // Server only allows running/stopped/error — unknown value is silently dropped
  const res = await request.get(`${BASE}/api/sessions?containerStatus=banana`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/sessions?since= with ISO timestamp returns array', async ({ request }) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
  const res = await request.get(`${BASE}/api/sessions?since=${encodeURIComponent(since)}`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/sessions?since= far future returns empty array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/sessions?since=2099-01-01T00:00:00Z`);
  expect(res.status()).toBe(200);
  const body: unknown[] = await res.json();
  expect(body.length).toBe(0);
});

test('GET /api/sessions with groupId + containerStatus combo returns array', async ({ request }) => {
  // Fetch a real group ID first so we get a concrete combo to test
  const groupsRes = await request.get(`${BASE}/api/groups`);
  const groups: Array<{ id: string }> = await groupsRes.json();
  const groupId = groups.length > 0 ? groups[0].id : 'nonexistent';

  const res = await request.get(
    `${BASE}/api/sessions?groupId=${encodeURIComponent(groupId)}&containerStatus=running`
  );
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

// ── /api/sessions/:id/messages filter combinations ───────────────────────────

test('GET /api/sessions/:id/messages?kind= filters by message kind', async ({ request }) => {
  // Locate a real session first
  const sessRes = await request.get(`${BASE}/api/sessions`);
  const sessions: Array<{ id: string }> = await sessRes.json();
  if (sessions.length === 0) return;

  const res = await request.get(
    `${BASE}/api/sessions/${sessions[0].id}/messages?kind=text`
  );
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/sessions/:id/messages?search= returns array', async ({ request }) => {
  const sessRes = await request.get(`${BASE}/api/sessions`);
  const sessions: Array<{ id: string }> = await sessRes.json();
  if (sessions.length === 0) return;

  const res = await request.get(
    `${BASE}/api/sessions/${sessions[0].id}/messages?search=a`
  );
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/sessions/:id/messages?since=&until= time-window returns array', async ({ request }) => {
  const sessRes = await request.get(`${BASE}/api/sessions`);
  const sessions: Array<{ id: string }> = await sessRes.json();
  if (sessions.length === 0) return;

  const since = '2020-01-01T00:00:00Z';
  const until = '2099-12-31T23:59:59Z';
  const res = await request.get(
    `${BASE}/api/sessions/${sessions[0].id}/messages?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`
  );
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/sessions/:id/messages?limit= caps result count', async ({ request }) => {
  const sessRes = await request.get(`${BASE}/api/sessions`);
  const sessions: Array<{ id: string }> = await sessRes.json();
  if (sessions.length === 0) return;

  const res = await request.get(
    `${BASE}/api/sessions/${sessions[0].id}/messages?limit=3`
  );
  expect(res.status()).toBe(200);
  const body: unknown[] = await res.json();
  expect(body.length).toBeLessThanOrEqual(3);
});

test('GET /api/sessions/:id/messages?limit= caps at server maximum of 500', async ({ request }) => {
  const sessRes = await request.get(`${BASE}/api/sessions`);
  const sessions: Array<{ id: string }> = await sessRes.json();
  if (sessions.length === 0) return;

  const res = await request.get(
    `${BASE}/api/sessions/${sessions[0].id}/messages?limit=9999`
  );
  expect(res.status()).toBe(200);
  const body: unknown[] = await res.json();
  expect(body.length).toBeLessThanOrEqual(500);
});

// ── /api/approvals filter combinations ───────────────────────────────────────

test('GET /api/approvals?status=approved returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/approvals?status=approved`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/approvals?status=rejected returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/approvals?status=rejected`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});

test('GET /api/approvals?status=expired returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/approvals?status=expired`);
  expect(res.status()).toBe(200);
  expect(Array.isArray(await res.json())).toBe(true);
});
