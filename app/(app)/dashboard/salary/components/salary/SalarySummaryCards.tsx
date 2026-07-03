'use client';

import { Row, Col, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { STATUS_COLORS } from '@/components/ui';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

interface SalarySummaryCardsProps {
  totalPayable: number;
  totalPaid: number;
  totalPending: number;
  totalOverpaid: number;
  isOverpaidTotal: boolean;
  mergedRowsCount: number;
  paidCount: number;
  pendingCount: number;
  /** Employees whose paid amount exceeds their payable salary (BE advanceCount).
   *  Drives the Overpaid card caption - it previously printed pendingCount,
   *  yielding "Total overpayment for 0 employees" (bug fix 2026-07-03). */
  overpaidCount: number;
  selectedMonthLabel: string;
  loading: boolean;
}

export function SalarySummaryCards({
  totalPayable,
  totalPaid,
  totalPending,
  totalOverpaid,
  isOverpaidTotal,
  mergedRowsCount,
  paidCount,
  pendingCount,
  overpaidCount,
  selectedMonthLabel,
  loading,
}: SalarySummaryCardsProps) {
  const currencyFmt = useCurrencyFormatter();
  const formatCurrencyFull = currencyFmt.full;

  const summaryItems = [
    {
      label: 'Total Payable',
      val: formatCurrencyFull(totalPayable),
      color: 'var(--cr-violet)',
      bg: 'var(--cr-violet-bg)',
      icon: <RupeeOutlined className="text-[22px] sm:text-[28px]" />,
      sub: `${mergedRowsCount} employees · ${selectedMonthLabel}`,
      tooltip: 'Total net salary for all employees this month before any payments',
    },
    {
      label: 'Paid',
      val: formatCurrencyFull(totalPaid),
      color: STATUS_COLORS.paid.text,
      bg: STATUS_COLORS.paid.bg,
      icon: <CheckCircleOutlined className="text-[22px] sm:text-[28px]" />,
      sub: `${paidCount} employees fully paid`,
      tooltip:
        'Total settled payroll paid to employees, including commission and same-month earning additions linked to payments',
    },
    isOverpaidTotal
      ? {
          label: 'Overpaid',
          val: formatCurrencyFull(totalOverpaid),
          color: 'var(--cr-warning-500)',
          bg: 'var(--cr-warning-50)',
          icon: <ExclamationCircleOutlined className="text-[22px] sm:text-[28px]" />,
          sub: `Total overpayment for ${overpaidCount} employee${overpaidCount !== 1 ? 's' : ''}`,
          tooltip: 'Amount paid in excess of net salary.',
        }
      : {
          label: 'Pending',
          val: formatCurrencyFull(totalPending),
          color: STATUS_COLORS.pending.text,
          bg: STATUS_COLORS.pending.bg,
          icon: <ClockCircleOutlined className="text-[22px] sm:text-[28px]" />,
          sub: `${pendingCount} employee${pendingCount !== 1 ? 's' : ''} remaining`,
          tooltip: 'Remaining amount to be paid for this month',
        },
  ];

  return (
    <Row gutter={[12, 12]} className="mb-4">
      {summaryItems.map((s, i) => (
        <Col xs={24} sm={8} key={i}>
          <Tooltip title={s.tooltip} placement="top">
            {/* Compact on mobile (tighter padding / smaller icon + value) so the three
                stacked cards don't eat the screen before the table; sm+ restores the
                original desktop sizing. */}
            <div
              className="flex items-center gap-3 rounded-[14px] px-4 py-3 sm:gap-3.5 sm:px-5 sm:py-4"
              style={{ background: s.bg }}
            >
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <p
                  className="m-0 font-display text-lg font-extrabold sm:text-xl"
                  style={{ color: s.color }}
                >
                  {loading ? '-' : s.val}
                </p>
                <p className="m-0 text-xs text-muted">{s.sub}</p>
              </div>
            </div>
          </Tooltip>
        </Col>
      ))}
    </Row>
  );
}
