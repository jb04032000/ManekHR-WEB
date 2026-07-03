'use client';
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import type { CapitalGoodsItcSchedule } from '@/types';

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const STATUS_COLOR: Record<string, string> = {
  amortising: 'blue',
  completed: 'green',
  reversed: 'default',
};

interface Props {
  schedule?: CapitalGoodsItcSchedule;
}

export default function CapitalGoodsItcBadge({ schedule }: Props) {
  const t = useTranslations('finance.purchases');
  if (!schedule) {
    return (
      <Tag color="orange" style={{ fontSize: 11 }}>
        {t('editor.capitalGoods.pendingPost')}
      </Tag>
    );
  }

  const label = t('editor.capitalGoods.monthsLabel', {
    amortised: schedule.monthsAmortised,
    total: schedule.monthsTotal,
    monthly: formatPaise(schedule.monthlyAmountPaise),
  });
  const tooltipContent = (
    <div>
      <div>{t('editor.capitalGoods.status', { status: schedule.status })}</div>
      <div>
        {t('editor.capitalGoods.totalItc', { amount: formatPaise(schedule.totalItcPaise) })}
      </div>
      <div>{t('editor.capitalGoods.nextRelease', { month: schedule.nextAmortisationMonth })}</div>
    </div>
  );

  return (
    <Tooltip title={tooltipContent}>
      <Tag
        color={STATUS_COLOR[schedule.status] ?? 'default'}
        style={{ fontSize: 11, cursor: 'default' }}
      >
        {t('editor.capitalGoods.itcLabel', { label })}
      </Tag>
    </Tooltip>
  );
}
