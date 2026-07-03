'use client';

import dayjs from 'dayjs';
import { BulbOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

interface AdvanceTargetSelectorProps {
  payModal: { month?: number; year?: number } | null;
  advanceTarget: 'next_month' | 'this_month';
  setAdvanceTarget: (v: 'next_month' | 'this_month') => void;
  canAdvance?: boolean;
}

export function AdvanceTargetSelector({
  payModal,
  advanceTarget,
  setAdvanceTarget,
  canAdvance = true,
}: AdvanceTargetSelectorProps) {
  const t = useTranslations('salary.advanceTargetSelector');

  if (!canAdvance) {
    return (
      <div
        className="overflow-hidden rounded-xl"
        style={{ border: '1px solid var(--cr-warning-50)', background: 'var(--cr-warning-50)' }}
      >
        <div className="flex items-center gap-2 px-3.5 py-3">
          <LockOutlined className="text-[13px] text-amber-700" />
          <p className="m-0 text-[12px] font-semibold text-amber-700">{t('upgradeLocked')}</p>
        </div>
      </div>
    );
  }

  const base = dayjs(`${payModal?.year}-${String(payModal?.month ?? 1).padStart(2, '0')}-01`);
  const nextMonth = base.add(1, 'month').format('MMMM YYYY');
  const thisMonth = base.format('MMMM YYYY');

  const options: { value: 'next_month' | 'this_month'; label: string; sub: string }[] = [
    {
      value: 'next_month',
      label: t('nextMonthLabel'),
      sub: t('nextMonthSub', { thisMonth, nextMonth }),
    },
    {
      value: 'this_month',
      label: t('thisMonthLabel'),
      sub: t('thisMonthSub', { thisMonth }),
    },
  ];

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--cr-indigo-100)' }}
    >
      <div
        className="flex items-center gap-2 px-3.5 py-2"
        style={{ background: 'var(--cr-indigo-50)' }}
      >
        <BulbOutlined className="text-[13px] text-purple-700" />
        <p className="m-0 text-[12px] font-semibold text-purple-700">{t('header')}</p>
      </div>
      <div
        className="flex flex-col gap-2 px-3.5 py-3"
        style={{ background: 'var(--cr-indigo-50)' }}
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-2.5"
            onClick={() => setAdvanceTarget(opt.value)}
          >
            <div
              className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2"
              style={{
                borderColor:
                  advanceTarget === opt.value ? 'var(--cr-indigo-400)' : 'var(--cr-neutral-300)',
                background:
                  advanceTarget === opt.value ? 'var(--cr-indigo-400)' : 'var(--cr-surface, #fff)',
              }}
            >
              {advanceTarget === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <p className="m-0 text-[13px] font-semibold text-heading">{opt.label}</p>
              <p className="m-0 text-[11px] text-muted">{opt.sub}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
