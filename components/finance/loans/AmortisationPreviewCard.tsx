'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Card, Table, Typography, Spin, Divider, Collapse } from 'antd';
import { previewLoanSchedule, type ScheduleRowPreview } from '@/lib/actions/finance-loans.actions';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

interface AmortisationPreviewCardProps {
  wsId: string;
  firmId: string;
  sanctionedAmountPaise: number | null;
  interestRateAnnual: number | null;
  tenureMonths: number | null;
  repaymentStartDate: string | null;
}

export default function AmortisationPreviewCard({
  wsId,
  firmId,
  sanctionedAmountPaise,
  interestRateAnnual,
  tenureMonths,
  repaymentStartDate,
}: AmortisationPreviewCardProps) {
  const [rows, setRows] = useState<ScheduleRowPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allValid =
    sanctionedAmountPaise != null &&
    sanctionedAmountPaise > 0 &&
    interestRateAnnual != null &&
    interestRateAnnual >= 0 &&
    tenureMonths != null &&
    tenureMonths > 0 &&
    repaymentStartDate != null;

  const fetchPreview = useCallback(() => {
    if (!allValid || !wsId || !firmId) return;
    setLoading(true);
    setError(null);
    previewLoanSchedule(wsId, firmId, {
      sanctionedAmountPaise: sanctionedAmountPaise!,
      interestRateAnnual: interestRateAnnual!,
      tenureMonths: tenureMonths!,
      repaymentStartDate: repaymentStartDate!,
    })
      .then(setRows)
      .catch(() => setError('Could not compute preview'))
      .finally(() => setLoading(false));
  }, [
    wsId,
    firmId,
    sanctionedAmountPaise,
    interestRateAnnual,
    tenureMonths,
    repaymentStartDate,
    allValid,
  ]);

  useEffect(() => {
    if (!allValid) {
      startTransition(() => {
        setRows([]);
      });
      return;
    }
    const timer = setTimeout(fetchPreview, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [fetchPreview, allValid]);

  if (!allValid) return null;

  const emiAmount = rows[0]?.emiAmountPaise ?? 0;
  const totalPayment = rows.reduce((s, r) => s + r.emiAmountPaise, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interestComponentPaise, 0);

  // Show first 3 + last 3 rows in summary; full table in expandable
  const previewRows = rows.length <= 6 ? rows : [...rows.slice(0, 3), ...rows.slice(-3)];
  const showEllipsis = rows.length > 6;

  const columns: ColumnsType<ScheduleRowPreview> = [
    { title: 'Month', dataIndex: 'month', key: 'month', width: 90 },
    {
      title: 'Opening',
      dataIndex: 'openingPrincipalPaise',
      key: 'opening',
      align: 'right',
      render: (p) => formatPaise(p),
    },
    {
      title: 'EMI',
      dataIndex: 'emiAmountPaise',
      key: 'emi',
      align: 'right',
      render: (p) => <Text strong>{formatPaise(p)}</Text>,
    },
    {
      title: 'Principal',
      dataIndex: 'principalComponentPaise',
      key: 'principal',
      align: 'right',
      render: (p) => formatPaise(p),
    },
    {
      title: 'Interest',
      dataIndex: 'interestComponentPaise',
      key: 'interest',
      align: 'right',
      render: (p) => <Text type="warning">{formatPaise(p)}</Text>,
    },
    {
      title: 'Closing',
      dataIndex: 'closingPrincipalPaise',
      key: 'closing',
      align: 'right',
      render: (p) => formatPaise(p),
    },
  ];

  return (
    <Card
      size="small"
      title="Amortisation Preview"
      style={{ background: 'var(--cr-neutral-100)', marginBottom: 16 }}
    >
      <Spin spinning={loading}>
        {error ? (
          <Text type="danger">{error}</Text>
        ) : rows.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap gap-6">
              <div>
                <Text type="secondary">Monthly EMI</Text>
                <br />
                <Text strong style={{ fontSize: 18 }}>
                  {formatPaise(emiAmount)}
                </Text>
              </div>
              <div>
                <Text type="secondary">Total Interest</Text>
                <br />
                <Text style={{ color: 'var(--cr-warning-500)' }}>{formatPaise(totalInterest)}</Text>
                <Text type="secondary"> over {tenureMonths} months</Text>
              </div>
              <div>
                <Text type="secondary">Total Repayment</Text>
                <br />
                <Text>{formatPaise(totalPayment)}</Text>
              </div>
            </div>

            <Table
              rowKey="monthIndex"
              dataSource={previewRows}
              columns={columns}
              size="small"
              pagination={false}
              footer={
                showEllipsis
                  ? () => <Text type="secondary">… {rows.length - 6} more months …</Text>
                  : undefined
              }
            />

            {rows.length > 6 && (
              <Collapse
                ghost
                size="small"
                style={{ marginTop: 8 }}
                items={[
                  {
                    key: 'full',
                    label: `View full schedule (${rows.length} months)`,
                    children: (
                      <Table
                        rowKey="monthIndex"
                        dataSource={rows}
                        columns={columns}
                        size="small"
                        pagination={{ pageSize: 24 }}
                      />
                    ),
                  },
                ]}
              />
            )}
          </>
        ) : null}
      </Spin>
    </Card>
  );
}
