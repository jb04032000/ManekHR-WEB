import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureAccess } from './useFeatureAccess';
import { useSubscriptionStore } from '@/lib/store';
import { FEATURE_ACCESS_MAP } from '@/lib/constants/feature-access.registry';
import type { PlanEntitlements } from '@/types';

/**
 * Gating bug (2026-07-02): the sidebar "Bulk Production Entry" crown gates on
 * useFeatureAccess('machines','machines_production'), but the sub-feature key was
 * MISSING from the feature registries + admin module-access editor, so no admin
 * toggle could ever grant it and it always resolved LOCKED. These tests lock the
 * fix: the key must exist in the registry (so the editor renders a toggle) and
 * must resolve UNLOCKED at full / LOCKED when absent. Keep in sync with the BE
 * registry (api/src/common/constants/module-features.registry.ts).
 */

// Drives the zustand subscription store into a hydrated, loaded state with the
// given machines moduleAccess entry so the resolver runs its real branch logic.
function setMachinesEntry(
  subFeatures: Array<{ key: string; access: 'locked' | 'limited' | 'full' }>,
) {
  useSubscriptionStore.setState({
    isHydrated: true,
    isLoading: false,
    entitlements: {
      moduleAccess: [{ module: 'machines', enabled: true, subFeatures }],
    } as unknown as PlanEntitlements,
  });
}

describe('useFeatureAccess machines_production gate', () => {
  beforeEach(() => {
    useSubscriptionStore.setState({ isHydrated: true, isLoading: false, entitlements: null });
  });

  it('registry exposes machines_production so the admin editor renders a toggle', () => {
    const machinesDef = FEATURE_ACCESS_MAP['machines'];
    expect(machinesDef).toBeDefined();
    const keys = machinesDef.subFeatures.map((sf) => sf.key);
    expect(keys).toContain('machines_production');
  });

  it('UNLOCKED when machines_production entry is present at full', () => {
    setMachinesEntry([{ key: 'machines_production', access: 'full' }]);
    const { result } = renderHook(() => useFeatureAccess('machines', 'machines_production'));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.accessLevel).toBe('full');
  });

  it('LOCKED when machines_production sub-feature is absent (module has other keys)', () => {
    setMachinesEntry([{ key: 'machines_basic', access: 'full' }]);
    const { result } = renderHook(() => useFeatureAccess('machines', 'machines_production'));
    expect(result.current.isLocked).toBe(true);
    expect(result.current.hasAccess).toBe(false);
  });

  it('grandfather: empty subFeatures array still grants FULL (unaffected by the fix)', () => {
    setMachinesEntry([]);
    const { result } = renderHook(() => useFeatureAccess('machines', 'machines_production'));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.hasAccess).toBe(true);
  });
});

// Same registry gap as machines_production, for the two sibling machines
// sub-features that were producing 403s (maintenance/due + downtime CRUD).
// Keep in sync with the BE registry MACHINES block + the maintenance/downtime
// controllers' @RequireSubscription gates.
describe.each([
  { key: 'machines_maintenance', sibling: 'machines_basic' },
  { key: 'machines_downtime', sibling: 'machines_basic' },
])('useFeatureAccess $key gate', ({ key, sibling }) => {
  beforeEach(() => {
    useSubscriptionStore.setState({ isHydrated: true, isLoading: false, entitlements: null });
  });

  it('registry exposes the key so the admin editor renders a toggle', () => {
    const machinesDef = FEATURE_ACCESS_MAP['machines'];
    expect(machinesDef).toBeDefined();
    const keys = machinesDef.subFeatures.map((sf) => sf.key);
    expect(keys).toContain(key);
  });

  it('UNLOCKED when the entry is present at full', () => {
    setMachinesEntry([{ key, access: 'full' }]);
    const { result } = renderHook(() => useFeatureAccess('machines', key));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.accessLevel).toBe('full');
  });

  it('LOCKED when the sub-feature is absent (module has other keys)', () => {
    setMachinesEntry([{ key: sibling, access: 'full' }]);
    const { result } = renderHook(() => useFeatureAccess('machines', key));
    expect(result.current.isLocked).toBe(true);
    expect(result.current.hasAccess).toBe(false);
  });
});
