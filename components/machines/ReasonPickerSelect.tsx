'use client';

/**
 * ReasonPickerSelect - grouped Select for downtime reason codes (D-02).
 *
 * Renders mechanical and operational categories as separate option groups.
 * System-seeded reasons (`isSystem: true`) get translated labels via
 * `reasons.seed.{key}`; custom workspace reasons fall back to the raw label.
 * Disabled codes are filtered out - the picker shows only what an operator
 * can actually log against today.
 */

import { Select } from 'antd';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { WorkspaceDowntimeReasonConfig } from '@/types';

interface ReasonPickerSelectProps {
  value?: string;
  onChange?: (reasonCodeId: string) => void;
  catalogue: WorkspaceDowntimeReasonConfig;
  disabled?: boolean;
  placeholder?: string;
}

export function ReasonPickerSelect({
  value,
  onChange,
  catalogue,
  disabled,
  placeholder,
}: ReasonPickerSelectProps) {
  const t = useTranslations('machines-downtime');

  const groupedOptions = useMemo(() => {
    const enabled = (catalogue?.codes ?? []).filter((c) => !c.isDisabled);

    const toOption = (code: (typeof enabled)[number]) => {
      // System reasons get i18n label via reasons.seed.{key}; custom reasons
      // (workspace-defined) use their raw label - translation is the
      // workspace owner's responsibility per D-13.
      let label = code.label;
      if (code.isSystem) {
        const key = `reasons.seed.${code.key}`;
        try {
          const translated = t(key as never);
          if (translated && translated !== key) label = translated;
        } catch {
          // missing translation → fall back to raw label
        }
      }
      return { value: code._id, label };
    };

    const sortBy = (a: { sortOrder: number }, b: { sortOrder: number }) =>
      a.sortOrder - b.sortOrder;

    const mechanical = enabled
      .filter((c) => c.category === 'mechanical')
      .sort(sortBy)
      .map(toOption);
    const operational = enabled
      .filter((c) => c.category === 'operational')
      .sort(sortBy)
      .map(toOption);

    const groups: { label: string; options: { value: string; label: string }[] }[] = [];
    if (mechanical.length > 0) {
      groups.push({ label: t('reasons.category.mechanical'), options: mechanical });
    }
    if (operational.length > 0) {
      groups.push({ label: t('reasons.category.operational'), options: operational });
    }
    return groups;
  }, [catalogue, t]);

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder ?? t('drawer.fields.reasonPlaceholder')}
      options={groupedOptions}
      showSearch
      optionFilterProp="label"
      style={{ width: '100%' }}
      size="large"
    />
  );
}

export default ReasonPickerSelect;
