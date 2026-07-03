'use client';

import { Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';

interface UpcomingJoinersHintProps {
  count: number;
  nextJoinerMonth: number | null;
  nextJoinerYear: number | null;
  onViewMonth: (month: number, year: number) => void;
}

export function UpcomingJoinersHint({
  count,
  nextJoinerMonth,
  nextJoinerYear,
  onViewMonth,
}: UpcomingJoinersHintProps) {
  const t = useTranslations();

  if (count <= 0 || !nextJoinerMonth || !nextJoinerYear) {
    return null;
  }

  const monthLabel = dayjs(
    `${nextJoinerYear}-${String(nextJoinerMonth).padStart(2, '0')}-01`,
  ).format('MMMM YYYY');

  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 md:flex-row md:items-center md:justify-between"
      style={{
        borderColor: 'var(--cr-primary-border, var(--cr-primary-border))',
        background: 'var(--cr-primary-light, var(--cr-primary-light))',
      }}
    >
      <p className="m-0 text-[13px] text-heading">
        {t('salary.runPayroll.upcomingJoinersHint', { count })}
      </p>
      <Button
        size="small"
        icon={<ArrowRightOutlined />}
        onClick={() => onViewMonth(nextJoinerMonth, nextJoinerYear)}
      >
        {t('salary.runPayroll.viewUpcomingMonth', { month: monthLabel })}
      </Button>
    </div>
  );
}
