/**
 * /ads.txt route - unit tests.
 *
 * Covers the env-driven contract:
 *   - UNSET publisher id  -> 404 (no file), so an unconfigured deploy is
 *     byte-identical to today.
 *   - SET publisher id    -> 200 text/plain with the single Google DIRECT line,
 *     using the bare `pub-...` id (the `ca-` prefix stripped) and Google's fixed
 *     certification-authority id.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable env mock (hoisted so the vi.mock factory can close over it safely).
const h = vi.hoisted(() => ({ env: { adSenseClientId: '' } }));
vi.mock('@/lib/env', () => ({ env: h.env }));

import { GET } from './route';

describe('/ads.txt route', () => {
  beforeEach(() => {
    h.env.adSenseClientId = '';
  });

  it('returns 404 when no publisher id is configured', async () => {
    const res = GET();
    expect(res.status).toBe(404);
    // No DIRECT line leaks when unconfigured.
    expect(await res.text()).not.toContain('google.com');
  });

  it('emits the Google DIRECT line when a publisher id is set', async () => {
    h.env.adSenseClientId = 'ca-pub-1234567890123456';
    const res = GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');

    const body = await res.text();
    // Bare pub id (ca- stripped) + DIRECT + Google's certification-authority id.
    expect(body).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  });
});
