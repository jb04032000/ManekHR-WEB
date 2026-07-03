import { describe, it, expect } from 'vitest';
import { shouldAttemptRepair, REPAIR_INTERVAL_MS } from './pushRepair';

// Gating for the push self-heal: repair ONLY already-opted-in browsers
// (granted + stored device id), at most once per interval.
describe('shouldAttemptRepair', () => {
  const base = {
    supported: true,
    permission: 'granted' as const,
    deviceId: 'dev123',
    lastRepairedAt: null,
    now: 1_000_000_000_000,
  };

  it('repairs an opted-in browser with no prior repair', () => {
    expect(shouldAttemptRepair(base)).toBe(true);
  });

  it('never runs when push is unsupported/unconfigured', () => {
    expect(shouldAttemptRepair({ ...base, supported: false })).toBe(false);
  });

  it('never prompts: skips when permission is not granted', () => {
    expect(shouldAttemptRepair({ ...base, permission: 'default' })).toBe(false);
    expect(shouldAttemptRepair({ ...base, permission: 'denied' })).toBe(false);
  });

  it('skips browsers that never opted in (no device id)', () => {
    expect(shouldAttemptRepair({ ...base, deviceId: null })).toBe(false);
  });

  it('throttles to once per interval', () => {
    const recent = String(base.now - REPAIR_INTERVAL_MS / 2);
    expect(shouldAttemptRepair({ ...base, lastRepairedAt: recent })).toBe(false);
    const old = String(base.now - REPAIR_INTERVAL_MS - 1);
    expect(shouldAttemptRepair({ ...base, lastRepairedAt: old })).toBe(true);
  });

  it('treats a corrupt timestamp as never repaired', () => {
    expect(shouldAttemptRepair({ ...base, lastRepairedAt: 'garbage' })).toBe(true);
  });
});
