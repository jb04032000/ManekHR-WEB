'use client';

import { useTranslations } from 'next-intl';
import type { TeamMember } from '@/types';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

export interface QuickFactsCardProps {
  member: TeamMember;
  reportsToName?: string;
}

interface FactRowProps {
  label: string;
  value: string;
}

function FactRow({ label, value }: FactRowProps) {
  return (
    <div className="flex min-h-[28px] items-baseline gap-3">
      <span className="w-32 shrink-0 text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
        {label}
      </span>
      <span className="min-w-0 text-[13px] break-words text-[var(--cr-text,var(--cr-text-1))]">
        {value}
      </span>
    </div>
  );
}

export function QuickFactsCard({ member, reportsToName }: QuickFactsCardProps) {
  const t = useTranslations('team');
  const fmt = useCurrencyFormatter();

  // Salary-type label map - reuses existing team.workOption* keys for monthly/hourly;
  // piece_rate uses team.overview.salaryType_piece_rate (new, added to all 4 locales).
  const salaryTypeLabel: Record<string, string> = {
    monthly: t('workOptionMonthly'),
    hourly: t('workOptionHourly'),
    piece_rate: t('overview.salaryType_piece_rate'),
  };

  // Employment-type label map - reuses team.optEmp* keys from useMemberFormOptions.
  const employmentTypeLabel: Record<string, string> = {
    full_time: t('optEmpFullTime'),
    part_time: t('optEmpPartTime'),
    contract: t('optEmpContract'),
    intern: t('optEmpIntern'),
    consultant: t('optEmpConsultant'),
  };

  // Schedule-type label map - reuses team.workOption* keys.
  const scheduleTypeLabel: Record<string, string> = {
    shift: t('workOptionShiftBased'),
    custom: t('workOptionCustom'),
  };

  const rows: FactRowProps[] = [];

  // Salary type
  if (member.salaryType) {
    rows.push({
      label: t('overview.factSalaryType'),
      value: salaryTypeLabel[member.salaryType] ?? member.salaryType,
    });
  }

  // Salary amount
  if (member.salaryAmount != null) {
    rows.push({
      label: t('overview.factSalaryAmount'),
      value: fmt.full(member.salaryAmount),
    });
  }

  // Shift / schedule: prefer the named shift, fall back to labelled scheduleType
  const shiftName = member.shift?.name;
  if (shiftName) {
    rows.push({
      label: t('overview.factShift'),
      value: shiftName,
    });
  } else if (member.scheduleType) {
    rows.push({
      label: t('overview.factShift'),
      value: scheduleTypeLabel[member.scheduleType] ?? member.scheduleType,
    });
  }

  // Employment type
  if (member.employmentType) {
    rows.push({
      label: t('overview.factEmploymentType'),
      value: employmentTypeLabel[member.employmentType] ?? member.employmentType,
    });
  }

  // Reports to - only render when a resolved name is available; never render the raw id.
  if (reportsToName) {
    rows.push({
      label: t('overview.factReportsTo'),
      value: reportsToName,
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-surface p-5">
      <h3 className="m-0 text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">
        {t('overview.quickFactsTitle')}
      </h3>

      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-faint">-</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--cr-border-subtle,rgba(0,0,0,0.06))]">
          {rows.map((row) => (
            <div key={row.label} className="py-2 first:pt-0 last:pb-0">
              <FactRow label={row.label} value={row.value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
