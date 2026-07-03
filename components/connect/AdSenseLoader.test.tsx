/**
 * AdSenseLoader - unit tests.
 *
 * Covers the loader contract that makes "flip the env" the only go-live step:
 *   - UNSET publisher id -> renders nothing (no script, no network call).
 *   - SET publisher id   -> renders exactly ONE loader script with the AdSense
 *     embed attributes (async + crossorigin) and a stable `id` (next/script's
 *     dedupe key, which is what guarantees a single mount across Connect
 *     client-side navigations).
 *
 * next/script is stubbed to a plain <script> so we can assert the props/attrs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';

const h = vi.hoisted(() => ({ env: { adSenseClientId: '' } }));
vi.mock('@/lib/env', () => ({ env: h.env }));

// Stub next/script -> record the props it is rendered with. (React 19 hoists a
// real <script src> out of the container, so we assert on the captured props,
// not the DOM.)
const scriptProps: Array<Record<string, unknown>> = [];
vi.mock('next/script', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => {
    scriptProps.push(props);
    return null;
  },
}));

import AdSenseLoader from './AdSenseLoader';

describe('AdSenseLoader', () => {
  beforeEach(() => {
    h.env.adSenseClientId = '';
    scriptProps.length = 0;
  });

  it('renders nothing when no publisher id is configured', () => {
    render(<AdSenseLoader />);
    expect(scriptProps).toHaveLength(0);
  });

  it('renders a single AdSense loader script with async + crossorigin when configured', () => {
    h.env.adSenseClientId = 'ca-pub-1234567890123456';
    render(<AdSenseLoader />);

    // Exactly one loader mounted.
    expect(scriptProps).toHaveLength(1);

    const props = scriptProps[0];
    // Stable id = next/script's dedupe key (single mount across navigations).
    expect(props.id).toBe('adsbygoogle-loader');
    expect(props.crossOrigin).toBe('anonymous');
    expect(props.async).toBe(true);
    expect(props.strategy).toBe('afterInteractive');
    expect(String(props.src)).toContain(
      'pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456',
    );
  });
});
