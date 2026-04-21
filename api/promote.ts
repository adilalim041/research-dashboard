/**
 * POST /api/promote
 *
 * Serverless endpoint (Vercel Node.js runtime) that promotes a research candidate
 * from research/candidates/ into the study queue at system/queue/pending/.
 *
 * Auth: x-admin-secret header, timing-safe comparison.
 * Write path: GitHub Contents API (PUT), no DB involved.
 *
 * TODO: If ADMIN_SECRET leaks, add Upstash Ratelimit as an extra layer.
 *       See https://github.com/upstash/ratelimit for Vercel Edge/Node integration.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// ── Runtime: must be Node for timingSafeEqual and crypto ─────────────────────
export const config = { runtime: 'nodejs' };

// ── Constants ─────────────────────────────────────────────────────────────────
const GITHUB_API = 'https://api.github.com';
const VAULT_REPO = 'adilalim041/ObsidianVault';
const FETCH_TIMEOUT_MS = 10_000;
const CANDIDATE_DIR = 'research/candidates';
const QUEUE_DIR = 'system/queue/pending';

// ── In-memory rate limit ──────────────────────────────────────────────────────
// Warm-invocation scope only (Vercel serverless — each cold start resets map).
// Goal: mitigate brute-force / flood if ADMIN_SECRET ever leaks. Not a DDoS shield.
// Window: 60s rolling, max 10 requests per IP.
const RL_WINDOW_MS = 60_000;
const RL_MAX_HITS = 10;
const rlHits = new Map<string, number[]>();

function rateLimitHit(ip: string): { allowed: boolean; retry_after_s: number } {
  const now = Date.now();
  const cutoff = now - RL_WINDOW_MS;
  const hits = (rlHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (hits.length >= RL_MAX_HITS) {
    const oldest = hits[0] ?? now;
    const retry = Math.ceil((oldest + RL_WINDOW_MS - now) / 1000);
    return { allowed: false, retry_after_s: Math.max(1, retry) };
  }
  hits.push(now);
  rlHits.set(ip, hits);
  // Best-effort cleanup when map grows (prevent unbounded memory)
  if (rlHits.size > 500) {
    for (const [k, v] of rlHits) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) rlHits.delete(k);
      else rlHits.set(k, fresh);
    }
  }
  return { allowed: true, retry_after_s: 0 };
}

// ── Audit log helper — structured JSON for Vercel log aggregation ────────────
// Use for every auth'd terminal outcome (201/401/409/422/503). Field `action`
// is the machine-readable event name; `outcome` is the HTTP status category.
function audit(
  outcome: 'success' | 'denied' | 'conflict' | 'invalid' | 'upstream_error',
  fields: Record<string, unknown>
) {
  console.log(
    JSON.stringify({
      level: 'audit',
      action: 'promote.create',
      outcome,
      ts: new Date().toISOString(),
      ...fields,
    })
  );
}

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0].split(',')[0].trim();
  return 'unknown';
}

// ── Structured logger (no secrets, no full card body) ─────────────────────────
function log(
  level: 'info' | 'warn' | 'error',
  msg: string,
  fields: Record<string, unknown> = {}
) {
  // Never log ADMIN_SECRET, GITHUB_PAT, or card full content.
  console.log(JSON.stringify({ level, msg, ts: new Date().toISOString(), ...fields }));
}

// ── Startup env guard ─────────────────────────────────────────────────────────
// Both variables must be present. If either is missing we return 500 without
// revealing which one is absent (prevents oracle).
function validateEnv(): { pat: string; secret: string } | null {
  const pat = process.env.GITHUB_PAT;
  const secret = process.env.ADMIN_SECRET;
  if (!pat || !secret) return null;
  return { pat, secret };
}

// ── Zod validation schema ─────────────────────────────────────────────────────
const BodySchema = z.object({
  slug: z
    .string()
    .regex(
      /^[a-z0-9-.]{3,120}$/,
      'slug must be 3-120 chars, lowercase alphanumeric, hyphens, or dots'
    ),
  tier: z.enum(['A', 'B']),
  for: z
    .enum(['omoikiri', 'news-ai', 'nexus-ai'])
    .nullable()
    .default(null),
  note: z.string().max(500).optional(),
});

type Body = z.infer<typeof BodySchema>;

// ── GitHub helper: fetch with timeout + auth ──────────────────────────────────
async function githubFetch(
  url: string,
  pat: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Decode base64 content from GitHub response ────────────────────────────────
function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

// ── Encode UTF-8 string to base64 ────────────────────────────────────────────
function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

// ── Extract field from candidate markdown card ────────────────────────────────
// Returns the first match of "**Field:** value" on a single line.
function extractField(markdown: string, fieldName: string): string | null {
  const re = new RegExp(`^\\*\\*${fieldName}:\\*\\*\\s*(.+)$`, 'm');
  const match = re.exec(markdown);
  return match ? match[1].trim() : null;
}

// ── Extract "What it does" section (first 300 chars) ─────────────────────────
function extractWhatItDoes(markdown: string): string {
  const re = /## What it does\s+([\s\S]*?)(?=\n## |\n---|\s*$)/;
  const match = re.exec(markdown);
  if (!match) return '';
  return match[1].trim().slice(0, 300);
}

// ── Parse GitHub repo URL → { owner, repo } ──────────────────────────────────
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const re = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/;
  const match = re.exec(url);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// ── Get today's UTC date as YYYY-MM-DD ───────────────────────────────────────
function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Find candidate file on GitHub ─────────────────────────────────────────────
// If slug already has a date prefix (YYYY-MM-DD-) → direct GET.
// Otherwise list directory and find by fragment match.
async function findCandidateFile(
  slug: string,
  pat: string
): Promise<
  | { type: 'found'; filename: string; content: string; sha: string }
  | { type: 'not_found' }
  | { type: 'ambiguous'; matches: string[] }
  | { type: 'github_error'; status: number }
> {
  const hasDatePrefix = /^\d{4}-\d{2}-\d{2}-/.test(slug);

  if (hasDatePrefix) {
    // Direct GET for the full filename (caller may or may not include .md)
    const filename = slug.endsWith('.md') ? slug : `${slug}.md`;
    const url = `${GITHUB_API}/repos/${VAULT_REPO}/contents/${CANDIDATE_DIR}/${filename}`;
    const res = await githubFetch(url, pat);
    if (res.status === 200) {
      const data = (await res.json()) as { content: string; sha: string; name: string };
      return {
        type: 'found',
        filename: data.name,
        content: decodeBase64(data.content),
        sha: data.sha,
      };
    }
    if (res.status === 404) return { type: 'not_found' };
    return { type: 'github_error', status: res.status };
  }

  // Fragment search: list directory
  const listUrl = `${GITHUB_API}/repos/${VAULT_REPO}/contents/${CANDIDATE_DIR}`;
  const listRes = await githubFetch(listUrl, pat);
  if (listRes.status !== 200) {
    return { type: 'github_error', status: listRes.status };
  }

  const files = (await listRes.json()) as Array<{ name: string; type: string }>;
  const mdFiles = files.filter((f) => f.type === 'file' && f.name.endsWith('.md'));
  const matches = mdFiles.filter((f) => f.name.includes(slug)).map((f) => f.name);

  if (matches.length === 0) return { type: 'not_found' };
  if (matches.length > 1) return { type: 'ambiguous', matches };

  // Exactly one match — fetch its content
  const filename = matches[0];
  const fileUrl = `${GITHUB_API}/repos/${VAULT_REPO}/contents/${CANDIDATE_DIR}/${filename}`;
  const fileRes = await githubFetch(fileUrl, pat);
  if (fileRes.status !== 200) return { type: 'github_error', status: fileRes.status };
  const data = (await fileRes.json()) as { content: string; sha: string; name: string };
  return {
    type: 'found',
    filename: data.name,
    content: decodeBase64(data.content),
    sha: data.sha,
  };
}

// ── Check if queue file already exists ────────────────────────────────────────
async function checkQueueDedup(
  id: string,
  pat: string
): Promise<'not_found' | 'exists' | 'github_error'> {
  const url = `${GITHUB_API}/repos/${VAULT_REPO}/contents/${QUEUE_DIR}/${id}.json`;
  const res = await githubFetch(url, pat);
  if (res.status === 200) return 'exists';
  if (res.status === 404) return 'not_found';
  return 'github_error';
}

// ── PUT file to GitHub (create) ───────────────────────────────────────────────
async function putGithubFile(
  path: string,
  content: string,
  message: string,
  pat: string,
  sha?: string
): Promise<{ ok: true } | { ok: false; status: number }> {
  const url = `${GITHUB_API}/repos/${VAULT_REPO}/contents/${path}`;
  const body: Record<string, string> = {
    message,
    content: toBase64(content),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = await githubFetch(url, pat, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (res.status === 200 || res.status === 201) return { ok: true };
  return { ok: false, status: res.status };
}

// ── Hash util for timing-safe comparison ──────────────────────────────────────
// We hash both sides so lengths always match (avoids the "must be same length"
// requirement of timingSafeEqual, which would be a length oracle otherwise).
function constantTimeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — same-domain deployment, but add origin header defensively
  const origin = process.env.DASHBOARD_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ── Step 1: Method check ──────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // ── Startup: env validation ───────────────────────────────────────────────
  const env = validateEnv();
  if (!env) {
    log('error', 'server_misconfigured: missing required env vars');
    return res.status(500).json({ error: 'server_misconfigured' });
  }
  const { pat, secret } = env;

  const ip = clientIp(req);

  // ── Step 1.5: Rate limit per IP (anti-flood for leaked secret scenario) ──
  // Disabled in NODE_ENV=test so unit tests don't hit 429 with shared 'unknown' IP.
  const rl = process.env.NODE_ENV === 'test'
    ? { allowed: true, retry_after_s: 0 }
    : rateLimitHit(ip);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retry_after_s));
    audit('denied', { reason: 'rate_limited', ip, retry_after_s: rl.retry_after_s });
    return res.status(429).json({ error: 'rate_limited', retry_after_s: rl.retry_after_s });
  }

  // ── Step 2: Auth ──────────────────────────────────────────────────────────
  const suppliedSecret = req.headers['x-admin-secret'];
  if (
    typeof suppliedSecret !== 'string' ||
    !constantTimeEqual(suppliedSecret, secret)
  ) {
    audit('denied', { reason: 'unauthorized', ip });
    return res.status(401).json({ error: 'unauthorized' });
  }

  // ── Step 3: Validate body ─────────────────────────────────────────────────
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    audit('invalid', {
      reason: 'validation_failed',
      ip,
      issues: parsed.error.issues.map((e) => e.path.join('.')),
    });
    return res.status(400).json({
      error: 'validation_failed',
      details: parsed.error.issues.map((e) => ({ path: e.path, message: e.message })),
    });
  }
  const body: Body = parsed.data;
  const { slug, tier, note } = body;

  log('info', 'promote request received', { slug, tier, for_project: body.for });

  // ── Step 4: DRY_RUN shortcut ──────────────────────────────────────────────
  if (process.env.DRY_RUN === 'true') {
    const dryId = `${utcDateString()}-study-dry-run-${slug}-tier-${tier.toLowerCase()}`;
    log('info', 'DRY_RUN mode — skipping GitHub calls', { id: dryId });
    return res.status(201).json({
      ok: true,
      id: dryId,
      queue_path: `${QUEUE_DIR}/${dryId}.json`,
      candidate_status_updated: false,
      dry_run: true,
    });
  }

  // ── Step 5: Fetch candidate card ──────────────────────────────────────────
  const findResult = await findCandidateFile(slug, pat);

  if (findResult.type === 'not_found') {
    return res.status(404).json({ error: 'candidate_not_found', slug });
  }
  if (findResult.type === 'ambiguous') {
    return res.status(400).json({
      error: 'ambiguous_slug',
      matches: findResult.matches,
    });
  }
  if (findResult.type === 'github_error') {
    log('error', 'github error fetching candidate', {
      slug,
      status: findResult.status,
    });
    return res.status(503).json({ error: 'github_unavailable', status: findResult.status });
  }

  const { filename, content: cardContent } = findResult;

  // ── Step 6: Parse candidate card ─────────────────────────────────────────
  const repoUrl = extractField(cardContent, 'URL');
  const cardForProject = extractField(cardContent, 'For project');
  const category = extractField(cardContent, 'Category') ?? 'unknown';
  const statusRaw = extractField(cardContent, 'Status') ?? '';
  const status = statusRaw.toLowerCase().trim();

  if (status === 'rejected') {
    audit('invalid', { reason: 'candidate_rejected', ip, slug });
    return res.status(422).json({ error: 'candidate_rejected' });
  }
  if (status === 'studied') {
    audit('invalid', { reason: 'already_studied', ip, slug });
    return res.status(422).json({ error: 'already_studied' });
  }
  if (status.startsWith('promoted-tier-')) {
    audit('conflict', { reason: 'already_promoted', ip, slug, current_status: status });
    return res.status(409).json({ error: 'already_promoted', current_status: status });
  }

  if (!repoUrl) {
    return res.status(422).json({ error: 'card_missing_url', filename });
  }

  const parsed_repo = parseGithubUrl(repoUrl);
  if (!parsed_repo) {
    return res.status(422).json({ error: 'card_invalid_url', url: repoUrl });
  }
  const { owner, repo } = parsed_repo;

  // Resolve for_project: request body > card field > null
  const forProject: string | null =
    body.for ??
    (cardForProject ? normalizeProjectName(cardForProject) : null);

  // Summary from "What it does" section
  const summary = extractWhatItDoes(cardContent);

  // ── Step 7: Generate ID ───────────────────────────────────────────────────
  const today = utcDateString();
  const id = `${today}-study-${owner}-${repo}-tier-${tier.toLowerCase()}`;

  log('info', 'generated queue id', { id, slug, tier });

  // ── Step 8: Dedup check ───────────────────────────────────────────────────
  const dedupResult = await checkQueueDedup(id, pat);
  if (dedupResult === 'exists') {
    audit('conflict', { reason: 'already_queued', ip, id });
    return res.status(409).json({ error: 'already_queued', id });
  }
  if (dedupResult === 'github_error') {
    log('error', 'github error during dedup check', { id });
    audit('upstream_error', { reason: 'github_dedup_error', ip, id });
    return res.status(503).json({ error: 'github_unavailable' });
  }

  // ── Step 9: Build payload ─────────────────────────────────────────────────
  const now = new Date().toISOString();
  const payload = {
    id,
    type: 'study',
    created_at: now,
    created_by: 'adil-dashboard',
    user: 'adil',
    payload: {
      repo: repoUrl,
      owner_repo: `${owner}/${repo}`,
      tier,
      category,
      for_project: forProject,
      candidate_card: `${CANDIDATE_DIR}/${filename}`,
      extras: {
        scan_changelog_and_adr: true,
        scan_github_issues: true,
        scan_our_incidents: true,
        scan_our_studies: true,
        deep_code_top_n: tier === 'A' ? 5 : 0,
      },
      summary_from_candidate: summary,
    },
    source: {
      channel: 'dashboard',
      note: note ?? 'promoted via dashboard',
    },
    priority: 'normal',
    version: '1.0',
  };

  // ── Step 10: PUT queue file ───────────────────────────────────────────────
  const queuePath = `${QUEUE_DIR}/${id}.json`;
  const queueResult = await putGithubFile(
    queuePath,
    JSON.stringify(payload, null, 2),
    `queue: promote ${owner}/${repo} tier-${tier}`,
    pat
  );

  if (!queueResult.ok) {
    log('error', 'github_write_failed for queue file', {
      id,
      status: queueResult.status,
    });
    return res.status(503).json({
      error: 'github_write_failed',
      status: queueResult.status,
    });
  }

  log('info', 'queue file written', { id, queue_path: queuePath });

  // ── Step 11: Update candidate card status ─────────────────────────────────
  // Re-fetch for fresh sha (required for GitHub PUT on existing file).
  let candidateStatusUpdated = false;
  try {
    const refetchUrl = `${GITHUB_API}/repos/${VAULT_REPO}/contents/${CANDIDATE_DIR}/${filename}`;
    const refetchRes = await githubFetch(refetchUrl, pat);
    if (refetchRes.status === 200) {
      const refetchData = (await refetchRes.json()) as {
        content: string;
        sha: string;
      };
      const freshContent = decodeBase64(refetchData.content);
      const freshSha = refetchData.sha;

      // Replace status line
      const updatedContent = freshContent
        .replace(
          /^\*\*Status:\*\*\s*.+$/m,
          `**Status:** promoted-tier-${tier}`
        )
        .trimEnd()
        .concat(
          `\n\n**Promoted:** ${now} via dashboard as tier-${tier}, queue id \`${id}\``
        );

      const updateResult = await putGithubFile(
        `${CANDIDATE_DIR}/${filename}`,
        updatedContent,
        `candidate: mark ${owner}/${repo} as promoted-tier-${tier}`,
        pat,
        freshSha
      );

      if (updateResult.ok) {
        candidateStatusUpdated = true;
        log('info', 'candidate card updated', { filename, tier });
      } else {
        log('warn', 'candidate card update failed (non-fatal)', {
          filename,
          status: updateResult.status,
        });
      }
    } else {
      log('warn', 'candidate card re-fetch failed (non-fatal)', {
        filename,
        status: refetchRes.status,
      });
    }
  } catch (err) {
    // Non-fatal: queue write already succeeded. Log and continue.
    log('warn', 'candidate card update threw (non-fatal)', {
      filename,
      err_msg: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 12: Return 201 ───────────────────────────────────────────────────
  audit('success', {
    ip,
    id,
    slug,
    tier,
    for_project: forProject,
    owner_repo: `${owner}/${repo}`,
    candidate_status_updated: candidateStatusUpdated,
  });
  return res.status(201).json({
    ok: true,
    id,
    queue_path: queuePath,
    candidate_status_updated: candidateStatusUpdated,
  });
}

// ── Normalize "For project:" values from card to API enum ────────────────────
// Card might say "Omoikiri.AI", "News.AI", "Nexus.AI" — normalize to API enum.
function normalizeProjectName(raw: string): 'omoikiri' | 'news-ai' | 'nexus-ai' | null {
  const lower = raw.toLowerCase();
  if (lower.includes('omoikiri')) return 'omoikiri';
  if (lower.includes('news')) return 'news-ai';
  if (lower.includes('nexus')) return 'nexus-ai';
  return null;
}
