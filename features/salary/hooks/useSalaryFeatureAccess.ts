import { useEffect, useMemo, useRef } from 'react';
import { env } from '@/lib/env';
import { useSubscriptionStore } from '@/lib/store';
import { usePayrollConfigStore } from '../store/usePayrollConfigStore';
import { SALARY_FEATURE_MAP } from '../constants/feature-access-map';

export interface FeatureAccessResult {
  enabled: boolean;
  visible: boolean;
  subscriptionAllows: boolean;
  configAllows: boolean;
  gatedBy: 'subscription' | 'config' | 'both' | null;
}

export function useSalaryFeatureAccess(featureName: string): FeatureAccessResult {
  const entitlements = useSubscriptionStore((s) => s.entitlements);
  const plan = useSubscriptionStore((s) => s.plan);
  const config = usePayrollConfigStore((s) => s.config);
  const configLoading = usePayrollConfigStore((s) => s.isLoading);
  const debugSignatureRef = useRef('');

  const mapping = SALARY_FEATURE_MAP[featureName];

  let subscriptionAllows = true;
  const salaryModule = entitlements?.moduleAccess?.find((m) => m.module === 'salary');
  const subFeature = mapping?.subscriptionKey
    ? salaryModule?.subFeatures?.find((sf) => sf.key === mapping.subscriptionKey)
    : null;

  if (mapping?.subscriptionKey) {
    if (!entitlements) {
      subscriptionAllows = false;
    } else {
      subscriptionAllows = (subFeature?.access ?? 'locked') !== 'locked';
    }
  }

  let configAllows = true;
  if (mapping?.configKey) {
    if (config && !configLoading) {
      configAllows = config.features[mapping.configKey] ?? true;
    }
  }

  // Unmapped features pass through as fully enabled (preserves prior behavior).
  if (!mapping) {
    subscriptionAllows = true;
    configAllows = true;
  }

  const enabled = subscriptionAllows && configAllows;
  const visible = configAllows;

  let gatedBy: FeatureAccessResult['gatedBy'] = null;
  if (!subscriptionAllows && !configAllows) gatedBy = 'both';
  else if (!subscriptionAllows) gatedBy = 'subscription';
  else if (!configAllows) gatedBy = 'config';

  useEffect(() => {
    if (env.isProd || !mapping) return;

    const signature = JSON.stringify({
      featureName,
      gatedBy,
      access: subFeature?.access ?? null,
      configAllows,
      configLoading,
      salaryModuleEnabled: salaryModule?.enabled ?? null,
      planTier: plan?.tier ?? null,
    });

    if (signature === debugSignatureRef.current) return;
    debugSignatureRef.current = signature;

    if (!subscriptionAllows || !configAllows) {
      console.info('[SalaryFeatureAccess]', {
        featureName,
        subscriptionKey: mapping.subscriptionKey ?? null,
        configKey: mapping.configKey ?? null,
        gatedBy,
        subscriptionAllows,
        configAllows,
        configLoading,
        planTier: plan?.tier ?? null,
        salaryModuleEnabled: salaryModule?.enabled ?? null,
        subFeatureAccess: subFeature?.access ?? null,
        hasEntitlements: !!entitlements,
      });
    }
  }, [
    configAllows,
    configLoading,
    entitlements,
    featureName,
    gatedBy,
    mapping,
    plan?.tier,
    salaryModule?.enabled,
    subFeature?.access,
    subscriptionAllows,
  ]);

  // Memoize so consumers don't churn on every render. Without this,
  // `useSalaryFeatures()` produces 28 new inner objects per render which
  // destabilizes any useEffect/useCallback that depends on them - directly
  // contributing to the mount POST burst observed across team/attendance/
  // salary/dashboard pages.
  return useMemo(
    () => ({ enabled, visible, subscriptionAllows, configAllows, gatedBy }),
    [enabled, visible, subscriptionAllows, configAllows, gatedBy],
  );
}
