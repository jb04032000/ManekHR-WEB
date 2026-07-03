/**
 * Unit tests for the Connect image-delivery helper. Covers the four contract
 * cases called out in the optimisation task: env unset (passthrough), env set
 * (CDN resize form), non-storage host passthrough, private-ref passthrough,
 * plus width/quality formatting + idempotency.
 *
 * env is mocked with a mutable object so each test can flip the transform base
 * on/off without re-importing the module (imageVariant reads env at call time).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { envMock } = vi.hoisted(() => ({ envMock: { imageTransformBase: '' } }));
vi.mock('@/lib/env', () => ({ env: envMock }));

import { imageVariant } from './imageUrl';

const BASE = 'https://cdn.manekhr.test';
const STORAGE_URL = `${BASE}/connect-feed/1700000000000-ab12cd.webp`;
const R2DEV_URL = 'https://pub-abc123.r2.dev/connect-feed/1700000000000-ab12cd.webp';
const EXTERNAL_URL = 'https://lh3.googleusercontent.com/a/avatar=s96';
const PRIVATE_REF = 'r2-private://connect-job-resume/1700000000000-ab12cd.pdf';

describe('imageVariant', () => {
  beforeEach(() => {
    envMock.imageTransformBase = '';
  });

  it('returns the url unchanged when the transform base is unset', () => {
    expect(imageVariant(STORAGE_URL, { w: 400 })).toBe(STORAGE_URL);
  });

  it('rewrites a storage url to the /cdn-cgi/image form when the base is set', () => {
    envMock.imageTransformBase = BASE;
    expect(imageVariant(STORAGE_URL, { w: 400 })).toBe(
      `${BASE}/cdn-cgi/image/w=400,q=75,f=auto/${STORAGE_URL}`,
    );
  });

  it('defaults quality to 75 and honours an explicit quality', () => {
    envMock.imageTransformBase = BASE;
    expect(imageVariant(STORAGE_URL, { w: 600 })).toContain('w=600,q=75,f=auto');
    expect(imageVariant(STORAGE_URL, { w: 160, q: 60 })).toContain('w=160,q=60,f=auto');
  });

  it('transforms r2.dev origins (the bucket served directly)', () => {
    envMock.imageTransformBase = BASE;
    expect(imageVariant(R2DEV_URL, { w: 400 })).toBe(
      `${BASE}/cdn-cgi/image/w=400,q=75,f=auto/${R2DEV_URL}`,
    );
  });

  it('passes through a non-storage (external) host even when the base is set', () => {
    envMock.imageTransformBase = BASE;
    expect(imageVariant(EXTERNAL_URL, { w: 160 })).toBe(EXTERNAL_URL);
  });

  it('passes through a private r2-private:// ref untouched', () => {
    envMock.imageTransformBase = BASE;
    expect(imageVariant(PRIVATE_REF, { w: 400 })).toBe(PRIVATE_REF);
  });

  it('passes through blob:, data: and relative urls', () => {
    envMock.imageTransformBase = BASE;
    expect(imageVariant('blob:https://app/abc', { w: 400 })).toBe('blob:https://app/abc');
    expect(imageVariant('data:image/png;base64,iVBOR', { w: 400 })).toBe(
      'data:image/png;base64,iVBOR',
    );
    expect(imageVariant('/local/placeholder.png', { w: 400 })).toBe('/local/placeholder.png');
  });

  it('passes through empty / nullish input', () => {
    envMock.imageTransformBase = BASE;
    expect(imageVariant('', { w: 400 })).toBe('');
    expect(imageVariant(undefined, { w: 400 })).toBeUndefined();
    expect(imageVariant(null, { w: 400 })).toBeNull();
  });

  it('is idempotent - never double-wraps an already transformed url', () => {
    envMock.imageTransformBase = BASE;
    const once = imageVariant(STORAGE_URL, { w: 400 });
    expect(imageVariant(once, { w: 200 })).toBe(once);
  });
});
