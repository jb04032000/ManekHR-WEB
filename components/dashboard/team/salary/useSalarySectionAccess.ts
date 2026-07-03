'use client';

import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { visibleSalarySections } from './salarySections';
import type { SalarySectionDef } from './salarySections';

export interface SalarySectionAccess {
  sections: SalarySectionDef[];
  /** True when the current user may perform write actions on salary data. */
  canAct: boolean;
}

export function useSalarySectionAccess(): SalarySectionAccess {
  const features = useSalaryFeatures();
  const { data, can } = useMyPermissions();

  const isOwner = data?.isOwner ?? false;

  const sections = visibleSalarySections((f) => {
    const key = f as keyof typeof features;
    return features[key]?.enabled ?? false;
  });

  const canAct = isOwner || can('salary', 'edit');

  return { sections, canAct };
}
