import { describe, it, expect, vi } from 'vitest';

// flags.ts reads `env.connectPhase`. Mock the env module so each behaviour can
// be exercised at a controlled phase.
vi.mock('@/lib/env', () => ({ env: { connectPhase: 4 } }));

import {
  CONNECT_MODULES,
  MODULE_PHASE,
  isConnectModuleEnabled,
  enabledConnectModules,
  isConnectEnabledForUser,
} from './flags';

describe('connect flags - module registry', () => {
  it('every module has a phase mapping', () => {
    for (const mod of CONNECT_MODULES) {
      expect(MODULE_PHASE[mod]).toBeGreaterThanOrEqual(1);
    }
  });

  it('profile is the first module (Phase 1)', () => {
    expect(MODULE_PHASE.profile).toBe(1);
  });
});

describe('isConnectModuleEnabled - at connectPhase 4', () => {
  it('enables modules whose phase is reached', () => {
    expect(isConnectModuleEnabled('profile')).toBe(true); // phase 1
    expect(isConnectModuleEnabled('network')).toBe(true); // phase 2
    expect(isConnectModuleEnabled('marketplace')).toBe(true); // phase 4
  });

  it('disables modules whose phase is not yet reached', () => {
    expect(isConnectModuleEnabled('jobs')).toBe(false); // phase 5
    expect(isConnectModuleEnabled('inbox')).toBe(false); // phase 7
  });

  it('enabledConnectModules returns only reached modules', () => {
    const enabled = enabledConnectModules();
    expect(enabled).toContain('marketplace');
    expect(enabled).not.toContain('jobs');
  });
});

describe('isConnectEnabledForUser - closed-beta gate', () => {
  it('is true only when connectEnabled === true', () => {
    expect(isConnectEnabledForUser({ connectEnabled: true })).toBe(true);
  });

  it('is false for absent / null / false', () => {
    expect(isConnectEnabledForUser({ connectEnabled: false })).toBe(false);
    expect(isConnectEnabledForUser({ connectEnabled: null })).toBe(false);
    expect(isConnectEnabledForUser({})).toBe(false);
    expect(isConnectEnabledForUser(null)).toBe(false);
    expect(isConnectEnabledForUser(undefined)).toBe(false);
  });
});
