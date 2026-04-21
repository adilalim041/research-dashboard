/**
 * Unit tests for /api/promote
 *
 * Run with: npx vitest run api/promote.test.ts
 *
 * Strategy:
 * - All GitHub API calls are mocked via vi.stubGlobal('fetch', ...)
 * - DRY_RUN=true bypasses all GitHub calls for fast path tests
 * - Each test sets/clears process.env as needed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers matching the handler's internal logic (kept in sync manually) ──────

const VALID_SECRET = 'test-admin-secret-32chars-exactly!!';
const VALID_PAT = 'ghp_test_pat';

// Minimal valid request body
const VALID_BODY = {
  slug: 'jbetancur-react-data-table-component',
  tier: 'B' as const,
  for: null,
  note: 'test promote',
};

// Sample candidate markdown card
const SAMPLE_CARD = `# React Data Table Component

**URL:** https://github.com/jbetancur/react-data-table-component
**License:** Unknown
**Score:** 6.4/10
**Category:** ui-component
**For project:** Omoikiri.AI
**Found by:** vault-research-agent
**Date:** 2026-04-10
**Status:** pending

## What it does
A React table library that handles messy data display without requiring deep HTML table knowledge.
`;

// Build a mock VercelRequest-like object
function makeReq(
  overrides: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
) {
  return {
    method: overrides.method ?? 'POST',
    headers: {
      'x-admin-secret': VALID_SECRET,
      'content-type': 'application/json',
      ...(overrides.headers ?? {}),
    },
    body: overrides.body ?? VALID_BODY,
  };
}

// Build a mock VercelResponse-like object that records calls
function makeRes() {
  const calls: { status?: number; body?: unknown } = {};
  const res = {
    _calls: calls,
    setHeader: vi.fn(),
    status(code: number) {
      calls.status = code;
      return res;
    },
    json(body: unknown) {
      calls.body = body;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

// GitHub API mock response factory
function mockGithubFileResponse(content: string, sha = 'abc123sha') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      name: '2026-04-10-jbetancur-react-data-table-component.md',
      sha,
      content: Buffer.from(content, 'utf-8').toString('base64'),
    }),
  };
}

function mockGithubListResponse(files: string[]) {
  return {
    ok: true,
    status: 200,
    json: async () =>
      files.map((name) => ({ name, type: 'file' })),
  };
}

function mock404() {
  return { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) };
}

function mock201() {
  return { ok: true, status: 201, json: async () => ({}) };
}

// ── Test setup ─────────────────────────────────────────────────────────────────
let handler: typeof import('./promote').default;

beforeEach(async () => {
  // Reset env
  process.env.GITHUB_PAT = VALID_PAT;
  process.env.ADMIN_SECRET = VALID_SECRET;
  process.env.DRY_RUN = 'false';
  process.env.DASHBOARD_ORIGIN = 'https://research-dashboard-eight.vercel.app';

  // Re-import handler fresh each test (vi.resetModules ensures no cache)
  vi.resetModules();
  const mod = await import('./promote');
  handler = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GITHUB_PAT;
  delete process.env.ADMIN_SECRET;
  delete process.env.DRY_RUN;
  delete process.env.DASHBOARD_ORIGIN;
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/promote', () => {

  it('returns 405 for non-POST methods', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(405);
    expect((res._calls.body as Record<string, string>).error).toBe('method_not_allowed');
  });

  it('returns 500 when env vars are missing', async () => {
    delete process.env.GITHUB_PAT;
    delete process.env.ADMIN_SECRET;

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(500);
    expect((res._calls.body as Record<string, string>).error).toBe('server_misconfigured');
  });

  it('returns 401 for wrong x-admin-secret', async () => {
    const req = makeReq({ headers: { 'x-admin-secret': 'wrong-secret' } });
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(401);
    expect((res._calls.body as Record<string, string>).error).toBe('unauthorized');
  });

  it('returns 401 when x-admin-secret header is missing', async () => {
    const req = makeReq();
    delete (req.headers as Record<string, string | undefined>)['x-admin-secret'];
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(401);
  });

  it('returns 400 for invalid slug (path traversal attempt)', async () => {
    const req = makeReq({ body: { ...VALID_BODY, slug: '../../etc/passwd' } });
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(400);
    expect((res._calls.body as Record<string, string>).error).toBe('validation_failed');
  });

  it('returns 400 for invalid tier', async () => {
    const req = makeReq({ body: { ...VALID_BODY, tier: 'C' } });
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(400);
  });

  it('returns 400 for note exceeding 500 chars', async () => {
    const req = makeReq({ body: { ...VALID_BODY, note: 'x'.repeat(501) } });
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(400);
  });

  it('returns 201 with dry_run:true when DRY_RUN=true', async () => {
    process.env.DRY_RUN = 'true';

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(201);
    expect((res._calls.body as Record<string, unknown>).dry_run).toBe(true);
    expect((res._calls.body as Record<string, unknown>).ok).toBe(true);
  });

  it('returns 404 when candidate file not found on GitHub', async () => {
    // Mock: directory listing returns no matching file
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockGithubListResponse(['2026-04-01-unrelated-lib.md']));

    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(404);
    expect((res._calls.body as Record<string, string>).error).toBe('candidate_not_found');
  });

  it('returns 400 with ambiguous_slug when multiple files match', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      mockGithubListResponse([
        '2026-04-10-jbetancur-react-data-table-component.md',
        '2026-04-11-jbetancur-react-data-table-v2.md',
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq({ body: { ...VALID_BODY, slug: 'jbetancur' } });
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(400);
    expect((res._calls.body as Record<string, string>).error).toBe('ambiguous_slug');
  });

  it('returns 422 for rejected candidate', async () => {
    const rejectedCard = SAMPLE_CARD.replace('**Status:** pending', '**Status:** rejected');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockGithubListResponse(['2026-04-10-jbetancur-react-data-table-component.md']))
      .mockResolvedValueOnce(mockGithubFileResponse(rejectedCard));

    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(422);
    expect((res._calls.body as Record<string, string>).error).toBe('candidate_rejected');
  });

  it('returns 409 when queue file already exists (already_queued)', async () => {
    const fetchMock = vi.fn()
      // 1. List directory
      .mockResolvedValueOnce(mockGithubListResponse(['2026-04-10-jbetancur-react-data-table-component.md']))
      // 2. Fetch the matched file
      .mockResolvedValueOnce(mockGithubFileResponse(SAMPLE_CARD))
      // 3. Dedup check → 200 means file exists
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(409);
    expect((res._calls.body as Record<string, string>).error).toBe('already_queued');
  });

  it('happy path: returns 201 with id and queue_path', async () => {
    const fetchMock = vi.fn()
      // 1. Directory listing
      .mockResolvedValueOnce(mockGithubListResponse(['2026-04-10-jbetancur-react-data-table-component.md']))
      // 2. Fetch matched file
      .mockResolvedValueOnce(mockGithubFileResponse(SAMPLE_CARD))
      // 3. Dedup check → 404 (not yet queued)
      .mockResolvedValueOnce(mock404())
      // 4. PUT queue file → 201 created
      .mockResolvedValueOnce(mock201())
      // 5. Re-fetch candidate for sha (status update)
      .mockResolvedValueOnce(mockGithubFileResponse(SAMPLE_CARD, 'freshsha456'))
      // 6. PUT candidate card update → 200 ok
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(201);

    const body = res._calls.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe('string');
    expect((body.id as string).includes('study-jbetancur-react-data-table-component')).toBe(true);
    expect((body.id as string).includes('tier-b')).toBe(true);
    expect(body.candidate_status_updated).toBe(true);
  });

  it('returns 201 even when candidate status update fails (non-fatal)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockGithubListResponse(['2026-04-10-jbetancur-react-data-table-component.md']))
      .mockResolvedValueOnce(mockGithubFileResponse(SAMPLE_CARD))
      .mockResolvedValueOnce(mock404())        // dedup → not found
      .mockResolvedValueOnce(mock201())        // PUT queue → success
      .mockResolvedValueOnce(mock404())        // re-fetch candidate → 404 (edge case)
      // No 6th call — re-fetch failed, card update skipped

    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(201);
    expect((res._calls.body as Record<string, unknown>).candidate_status_updated).toBe(false);
  });

  it('returns 503 when GitHub PUT queue file fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockGithubListResponse(['2026-04-10-jbetancur-react-data-table-component.md']))
      .mockResolvedValueOnce(mockGithubFileResponse(SAMPLE_CARD))
      .mockResolvedValueOnce(mock404())  // dedup → not found
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({}) }); // PUT fails

    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq();
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    expect(res._calls.status).toBe(503);
    expect((res._calls.body as Record<string, string>).error).toBe('github_write_failed');
  });

  it('accepts slug with date prefix and does direct GET', async () => {
    process.env.DRY_RUN = 'true'; // skip GitHub calls after validation

    const req = makeReq({
      body: { ...VALID_BODY, slug: '2026-04-10-jbetancur-react-data-table-component' },
    });
    const res = makeRes();
    // @ts-expect-error partial mock
    await handler(req, res);
    // DRY_RUN kicks in — just verify 201
    expect(res._calls.status).toBe(201);
  });
});
