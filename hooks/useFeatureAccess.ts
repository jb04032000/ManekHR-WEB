'use client';

import { useCallback } from 'react';
import { useSubscriptionStore } from '@/lib/store';
import type { FeatureAccessLevel } from '@/types';

export interface UseFeatureAccessResult {
  hasAccess: boolean;
  accessLevel: FeatureAccessLevel;
  isLimited: boolean;
  isLocked: boolean;
  /**
   * True when the module is LOCKED and platform-flagged "Coming Soon"
   * (admin-set via /admin/settings, served by the public module-availability
   * endpoint). Presentation-only: callers (FeatureGate/ModuleGate/Sidebar)
   * render a Coming Soon card/badge instead of the upgrade prompt. Always
   * false for an ENABLED module - a plan that includes the module wins.
   */
  isComingSoon: boolean;
  isLoading: boolean;
}

export function useFeatureAccess(module: string, subFeature?: string): UseFeatureAccessResult {
  const { entitlements, comingSoonModules, isLoading, isHydrated } = useSubscriptionStore();

  // Module-level flag: applies to every locked surface of the module,
  // including sub-feature gates (the whole module ships together).
  const flaggedComingSoon = (comingSoonModules || []).includes(module);

  return useCallback(() => {
    if (!isHydrated || isLoading) {
      return {
        hasAccess: false,
        accessLevel: 'locked' as FeatureAccessLevel,
        isLimited: false,
        isLocked: true,
        isComingSoon: false,
        isLoading: true,
      };
    }

    // No plan / no entitlements - everything is locked
    if (!entitlements) {
      return {
        hasAccess: false,
        accessLevel: 'locked' as FeatureAccessLevel,
        isLimited: false,
        isLocked: true,
        isComingSoon: flaggedComingSoon,
        isLoading: false,
      };
    }

    const moduleAccess = entitlements.moduleAccess || [];
    const moduleEntry = moduleAccess.find((m) => m.module === module);

    if (!moduleEntry || !moduleEntry.enabled) {
      return {
        hasAccess: false,
        accessLevel: 'locked' as FeatureAccessLevel,
        isLimited: false,
        isLocked: true,
        isComingSoon: flaggedComingSoon,
        isLoading: false,
      };
    }

    if (!subFeature) {
      return {
        hasAccess: true,
        accessLevel: 'full' as FeatureAccessLevel,
        isLimited: false,
        isLocked: false,
        isComingSoon: false,
        isLoading: false,
      };
    }

    // Grandfather fallback (keep in sync with backend SubscriptionGuard): when a
    // module is enabled but carries NO sub-feature entries at all, the BE treats
    // every sub-feature as FULL (legacy/granted subscriptions predate sub-feature
    // keys). Without this, the FE wrongly locked finance sub-pages the API would
    // actually allow — so a freshly granted/purchased plan didn't reflect here.
    if (!moduleEntry.subFeatures || moduleEntry.subFeatures.length === 0) {
      return {
        hasAccess: true,
        accessLevel: 'full' as FeatureAccessLevel,
        isLimited: false,
        isLocked: false,
        isComingSoon: false,
        isLoading: false,
      };
    }

    const subFeatureEntry = moduleEntry.subFeatures.find((sf) => sf.key === subFeature);
    const accessLevel = subFeatureEntry?.access || 'locked';

    return {
      hasAccess: accessLevel !== 'locked',
      accessLevel,
      isLimited: accessLevel === 'limited',
      isLocked: accessLevel === 'locked',
      isComingSoon: accessLevel === 'locked' && flaggedComingSoon,
      isLoading: false,
    };
  }, [entitlements, isLoading, isHydrated, module, subFeature, flaggedComingSoon])();
}

export function useModuleAccess(module: string): UseFeatureAccessResult {
  return useFeatureAccess(module);
}
