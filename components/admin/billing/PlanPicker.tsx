'use client';

import { useEffect, useState } from 'react';
import { Select } from 'antd';
import { getAdminPlans } from '@/lib/actions';
import type { Plan } from '@/types';

interface Props {
  value?: string;
  onChange?: (id: string | undefined) => void;
  /** When false, hide custom plans (isCustom). Default true. */
  includeCustom?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Admin plan picker - fetches the catalogue once + caches across mounts
 * via module-scoped promise so a page that opens N modals doesn't
 * re-fetch N times.
 */
let plansCache: Promise<Plan[]> | null = null;

function loadPlans(): Promise<Plan[]> {
  if (!plansCache) plansCache = getAdminPlans().catch(() => []) as Promise<Plan[]>;
  return plansCache;
}

export function PlanPicker({
  value,
  onChange,
  includeCustom = true,
  placeholder = 'Select plan',
  disabled,
}: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPlans().then((p) => {
      if (cancelled) return;
      setPlans(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = includeCustom
    ? plans
    : plans.filter((p) => !(p as Plan & { isCustom?: boolean }).isCustom);

  return (
    <Select
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      optionFilterProp="label"
      style={{ width: '100%' }}
      options={filtered.map((p) => ({
        value: p._id,
        label: `${p.name} - ₹${p.monthlyPrice}/mo · ₹${p.yearlyPrice}/yr (${p.tier})`,
      }))}
    />
  );
}
