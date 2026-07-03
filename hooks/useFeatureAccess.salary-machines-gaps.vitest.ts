import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureAccess } from './useFeatureAccess';
import { useSubscriptionStore } from '@/lib/store';
import { FEATURE_ACCESS_MAP } from '@/lib/constants/feature-access.registry';
import type { PlanEntitlements } from '@/types';

/**
 * Gating bug class (2026-07-02): sub-feature keys enforced by
 * useFeatureAccess(module,key) / BE @RequireSubscription but MISSING from the web
 * feature registry could never be granted from the admin editor -> permanent
 * LOCKED. This batch closes four gaps and one BE/web parity gap:
 *   machines.piece_rate_payroll  (piece-rate tab, team/[memberId]/page.tsx)
 *   salary.loan_management / bonus_tracking / daily_wage_ledger (loan/bonus/wage)
 *   attendance.statutory_exports (BE-only entry mirrored here for parity)
 * Keep in sync with the BE registry (api/src/common/constants/module-features.registry.ts).
 */

function setEntry(
  module: string,
  subFeatures: Array<{ key: string; access: 'locked' | 'limited' | 'full' }>,
) {
  useSubscriptionStore.setState({
    isHydrated: true,
    isLoading: false,
    entitlements: {
      moduleAccess: [{ module, enabled: true, subFeatures }],
    } as unknown as PlanEntitlements,
  });
}

const CASES = [
  { module: 'machines', key: 'piece_rate_payroll', sibling: 'machines_basic' },
  { module: 'salary', key: 'loan_management', sibling: 'generate_payroll' },
  { module: 'salary', key: 'bonus_tracking', sibling: 'generate_payroll' },
  { module: 'salary', key: 'daily_wage_ledger', sibling: 'generate_payroll' },
  { module: 'attendance', key: 'statutory_exports', sibling: 'mark' },
];

describe.each(CASES)('useFeatureAccess $module.$key gate', ({ module, key, sibling }) => {
  beforeEach(() => {
    useSubscriptionStore.setState({ isHydrated: true, isLoading: false, entitlements: null });
  });

  it('registry exposes the key so the admin editor renders a toggle', () => {
    const def = FEATURE_ACCESS_MAP[module];
    expect(def).toBeDefined();
    expect(def.subFeatures.map((sf) => sf.key)).toContain(key);
  });

  it('UNLOCKED when the entry is present at full', () => {
    setEntry(module, [{ key, access: 'full' }]);
    const { result } = renderHook(() => useFeatureAccess(module, key));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.accessLevel).toBe('full');
  });

  it('LOCKED when the sub-feature is absent (module has other keys)', () => {
    setEntry(module, [{ key: sibling, access: 'full' }]);
    const { result } = renderHook(() => useFeatureAccess(module, key));
    expect(result.current.isLocked).toBe(true);
    expect(result.current.hasAccess).toBe(false);
  });
});
