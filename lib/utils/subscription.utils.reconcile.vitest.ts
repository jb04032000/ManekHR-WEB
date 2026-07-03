import { describe, it, expect } from 'vitest';
import { reconcileModuleAccessWithRegistry } from './subscription.utils';
import {
  FEATURE_ACCESS_REGISTRY,
  FEATURE_ACCESS_MAP,
} from '@/lib/constants/feature-access.registry';
import type { ModuleAccessEntry } from '@/types';

// Tests for reconcileModuleAccessWithRegistry — the helper that fixes the admin
// plan-editor drift bug (stored moduleAccess missing newer modules / sub-feature
// keys so their controls were dead no-ops). See subscription.utils.ts for the
// empty-enabled=FULL invariant tied to the backend SubscriptionGuard.

const REGISTRY_MODULES = FEATURE_ACCESS_REGISTRY.filter((m) => m.module !== 'bills').map(
  (m) => m.module,
);

function entryFor(out: ModuleAccessEntry[], moduleKey: string): ModuleAccessEntry | undefined {
  return out.find((e) => e.module === moduleKey);
}

describe('reconcileModuleAccessWithRegistry', () => {
  it('empty stored [] returns an entry for every registry module (except bills), all locked + disabled', () => {
    const out = reconcileModuleAccessWithRegistry([]);

    // One entry per registry module, bills excluded.
    expect(out.map((e) => e.module).sort()).toEqual([...REGISTRY_MODULES].sort());
    expect(out.some((e) => e.module === 'bills')).toBe(false);

    for (const entry of out) {
      expect(entry.enabled).toBe(false);
      const registryDef = FEATURE_ACCESS_MAP[entry.module];
      // every registry sub-feature key present and locked
      expect(entry.subFeatures.map((sf) => sf.key).sort()).toEqual(
        registryDef.subFeatures.map((sf) => sf.key).sort(),
      );
      expect(entry.subFeatures.every((sf) => sf.access === 'locked')).toBe(true);
    }
  });

  it('enabled module with EMPTY subFeatures → ALL registry keys backfilled as full (FULL preserved)', () => {
    const stored: ModuleAccessEntry[] = [{ module: 'machines', enabled: true, subFeatures: [] }];
    const out = reconcileModuleAccessWithRegistry(stored);

    const machines = entryFor(out, 'machines');
    expect(machines).toBeDefined();
    expect(machines!.enabled).toBe(true);

    const machinesDef = FEATURE_ACCESS_MAP['machines'];
    expect(machines!.subFeatures.map((sf) => sf.key).sort()).toEqual(
      machinesDef.subFeatures.map((sf) => sf.key).sort(),
    );
    // every backfilled key is FULL (not locked) — preserves runtime FULL access.
    expect(machines!.subFeatures.every((sf) => sf.access === 'full')).toBe(true);
  });

  it('stored missing locations entirely → locations added, disabled, key(s) locked', () => {
    const stored: ModuleAccessEntry[] = [
      { module: 'attendance', enabled: true, subFeatures: [{ key: 'mark', access: 'full' }] },
    ];
    const out = reconcileModuleAccessWithRegistry(stored);

    const locations = entryFor(out, 'locations');
    expect(locations).toBeDefined();
    expect(locations!.enabled).toBe(false);
    const locDef = FEATURE_ACCESS_MAP['locations'];
    expect(locations!.subFeatures.map((sf) => sf.key).sort()).toEqual(
      locDef.subFeatures.map((sf) => sf.key).sort(),
    );
    expect(locations!.subFeatures.every((sf) => sf.access === 'locked')).toBe(true);
  });

  it('stored module with PARTIAL keys (not empty) → existing keys preserved, missing keys locked', () => {
    // machines registry has 3 keys; supply only one with full. enabled true but
    // subFeatures is NON-empty so emptyEnabled is false → missing keys default to locked.
    const stored: ModuleAccessEntry[] = [
      {
        module: 'machines',
        enabled: true,
        subFeatures: [{ key: 'machines_basic', access: 'full' }],
      },
    ];
    const out = reconcileModuleAccessWithRegistry(stored);

    const machines = entryFor(out, 'machines');
    expect(machines).toBeDefined();
    const byKey = Object.fromEntries(machines!.subFeatures.map((sf) => [sf.key, sf.access]));
    expect(byKey['machines_basic']).toBe('full'); // preserved
    expect(byKey['machines_assignments']).toBe('locked'); // backfilled locked
    expect(byKey['production_utilisation_dashboard']).toBe('locked'); // backfilled locked
  });

  it("stored entry with a 'limited' access on a key is preserved as 'limited'", () => {
    const stored: ModuleAccessEntry[] = [
      {
        module: 'attendance',
        enabled: true,
        subFeatures: [{ key: 'export_pdf', access: 'limited' }],
      },
    ];
    const out = reconcileModuleAccessWithRegistry(stored);

    const attendance = entryFor(out, 'attendance');
    expect(attendance).toBeDefined();
    const exportPdf = attendance!.subFeatures.find((sf) => sf.key === 'export_pdf');
    expect(exportPdf?.access).toBe('limited');
    // other registry keys backfilled locked (non-empty → not emptyEnabled)
    const mark = attendance!.subFeatures.find((sf) => sf.key === 'mark');
    expect(mark?.access).toBe('locked');
  });

  it('stored unknown module is preserved/appended unchanged', () => {
    const legacy: ModuleAccessEntry = {
      module: 'legacy_x',
      enabled: true,
      subFeatures: [{ key: 'old_key', access: 'full' }],
    };
    const out = reconcileModuleAccessWithRegistry([legacy]);

    const found = entryFor(out, 'legacy_x');
    expect(found).toBeDefined();
    expect(found).toEqual(legacy); // appended verbatim
  });

  it('does not mutate the input array or its entries', () => {
    const stored: ModuleAccessEntry[] = [{ module: 'machines', enabled: true, subFeatures: [] }];
    const snapshot = JSON.parse(JSON.stringify(stored));
    reconcileModuleAccessWithRegistry(stored);
    expect(stored).toEqual(snapshot);
  });
});
