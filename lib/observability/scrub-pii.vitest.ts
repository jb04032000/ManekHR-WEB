import { describe, it, expect } from 'vitest';
import { redactPii } from './scrub-pii';

// Parity with the backend scrub-pii util — keep both in sync.
describe('redactPii (web)', () => {
  it('redacts values under sensitive key names', () => {
    const out = redactPii({ password: 'x', panNumber: 'ABCDE1234F', token: 't' }) as Record<
      string,
      unknown
    >;
    expect(out.password).toBe('[redacted]');
    expect(out.panNumber).toBe('[redacted]');
    expect(out.token).toBe('[redacted]');
  });

  it('masks PAN/Aadhaar shapes embedded in strings and keeps other text', () => {
    const out = redactPii({ msg: 'pan ABCDE1234F, aadhaar 1234 5678 9012', ok: 'keep' }) as Record<
      string,
      unknown
    >;
    expect(out.msg).not.toContain('ABCDE1234F');
    expect(out.msg).not.toContain('1234 5678 9012');
    expect(out.msg).toContain('[redacted-id]');
    expect(out.ok).toBe('keep');
  });

  it('recurses and survives circular references', () => {
    const a: any = { nested: { aadhaar: '123412341234' } };
    a.self = a;
    const out = redactPii(a) as any;
    expect(out.nested.aadhaar).toBe('[redacted]');
  });
});
