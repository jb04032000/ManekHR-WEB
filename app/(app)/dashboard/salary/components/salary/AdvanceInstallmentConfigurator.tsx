'use client';

import { useEffect, useState, startTransition, useCallback } from 'react';
import { Segmented, InputNumber, Table, Collapse, Tag, Alert, Spin, Typography } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import type {
  AdvanceSchedulePreviewRow,
  AdvanceComplianceBreach,
  AdvanceComplianceWarning,
} from '@/types';

const { Text } = Typography;

export interface AdvanceInstallmentValue {
  mode: 'count' | 'amount';
  installmentCount?: number;
  installmentAmount?: number;
}

interface AdvanceInstallmentConfiguratorProps {
  excessAmount: number;
  startMonth: number;
  startYear: number;
  teamMemberId?: string;
  value: AdvanceInstallmentValue | null;
  onChange: (v: AdvanceInstallmentValue) => void;
  /** Called whenever the preview result changes (including complianceResult). Null when preview is cleared. */
  onComplianceResult?: (
    result: {
      breaches: AdvanceComplianceBreach[];
      warnings: AdvanceComplianceWarning[];
    } | null,
  ) => void;
}

export function AdvanceInstallmentConfigurator({
  excessAmount,
  startMonth,
  startYear,
  teamMemberId,
  value,
  onChange,
  onComplianceResult,
}: AdvanceInstallmentConfiguratorProps) {
  const t = useTranslations();
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const currencyFmt = useCurrencyFormatter();

  const mode = value?.mode ?? 'count';
  const installmentCount = value?.installmentCount;
  const installmentAmount = value?.installmentAmount;

  const [rows, setRows] = useState<AdvanceSchedulePreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [complianceBreaches, setComplianceBreaches] = useState<AdvanceComplianceBreach[]>([]);
  const [complianceWarnings, setComplianceWarnings] = useState<AdvanceComplianceWarning[]>([]);

  const fetchPreview = useCallback(() => {
    if (!currentWorkspaceId || excessAmount <= 0) return;
    if (mode === 'count' && (!installmentCount || installmentCount < 2)) return;
    if (mode === 'amount' && (!installmentAmount || installmentAmount < 1)) return;

    setLoading(true);
    setPreviewError(null);

    salaryApi
      .previewAdvanceSchedule(currentWorkspaceId, {
        totalAmount: excessAmount,
        startMonth,
        startYear,
        ...(mode === 'count' ? { installmentCount } : { installmentAmount }),
        ...(teamMemberId ? { teamMemberId } : {}),
      })
      .then((res) => {
        startTransition(() => {
          setRows(res.installments ?? []);
          const breaches = res.complianceResult?.breaches ?? [];
          const warnings = res.complianceResult?.warnings ?? [];
          setComplianceBreaches(breaches);
          setComplianceWarnings(warnings);
          onComplianceResult?.({ breaches, warnings });
        });
      })
      .catch(() => {
        startTransition(() => {
          setPreviewError(t('salary.advancePlan.previewError'));
          setRows([]);
          setComplianceBreaches([]);
          setComplianceWarnings([]);
          onComplianceResult?.(null);
        });
      })
      .finally(() => setLoading(false));
  }, [
    currentWorkspaceId,
    excessAmount,
    startMonth,
    startYear,
    mode,
    installmentCount,
    installmentAmount,
    teamMemberId,
    t,
    onComplianceResult,
  ]);

  useEffect(() => {
    const timer = setTimeout(fetchPreview, 400);
    return () => clearTimeout(timer);
  }, [fetchPreview]);

  const handleModeChange = (newMode: string) => {
    const m = newMode as 'count' | 'amount';
    onChange({ mode: m });
    startTransition(() => {
      setRows([]);
      setComplianceBreaches([]);
      setComplianceWarnings([]);
      onComplianceResult?.(null);
    });
  };

  const handleCountChange = (v: number | null) => {
    if (v == null) return;
    onChange({ mode: 'count', installmentCount: v });
  };

  const handleAmountChange = (v: number | null) => {
    if (v == null) return;
    onChange({ mode: 'amount', installmentAmount: v });
  };

  const formatMonthLabel = (month: number, year: number) =>
    dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY');

  const columns: ColumnsType<AdvanceSchedulePreviewRow> = [
    {
      title: t('salary.advancePlan.colMonth'),
      key: 'month',
      render: (_: unknown, row: AdvanceSchedulePreviewRow) => formatMonthLabel(row.month, row.year),
      width: 110,
    },
    {
      title: t('salary.advancePlan.colInstallment'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (amt: number, row: AdvanceSchedulePreviewRow) => (
        <span>
          <Text strong>{currencyFmt.full(amt)}</Text>
          {row.capped && (
            <Tag color="warning" style={{ marginLeft: 6, fontSize: 10 }}>
              {t('salary.advancePlan.cappedBadge')}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: t('salary.advancePlan.colProjectedNet'),
      dataIndex: 'projectedNet',
      key: 'projectedNet',
      align: 'right' as const,
      render: (net?: number) =>
        net != null ? (
          <Text type="secondary">{currencyFmt.full(net)}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  const hasCapped = rows.some((r) => r.capped);

  const breachMessage = (breach: AdvanceComplianceBreach): string => {
    if (breach.code === 'DEDUCTION_CAP') {
      return t('salary.payDrawer.compliance.breachDeductionCap', {
        month: formatMonthLabel(breach.month, breach.year),
        proposed: currencyFmt.full(breach.proposed),
        max: currencyFmt.full(breach.maxCompliant),
      });
    }
    return t('salary.payDrawer.compliance.breachMinWage', {
      month: formatMonthLabel(breach.month, breach.year),
      proposed: currencyFmt.full(breach.proposed),
      max: currencyFmt.full(breach.maxCompliant),
    });
  };

  const warningMessage = (warning: AdvanceComplianceWarning): string => {
    if (warning.code === 'ADVISORY_ONE_THIRD') return t('salary.payDrawer.compliance.warnOneThird');
    if (warning.code === 'ADVISORY_12_MONTH') return t('salary.payDrawer.compliance.warn12Month');
    return t('salary.payDrawer.compliance.warnMinWageUnconfigured');
  };

  const tableContent = (
    <Table
      rowKey={(r) => `${r.year}-${r.month}-${r.index}`}
      dataSource={rows}
      columns={columns}
      size="small"
      pagination={false}
    />
  );

  return (
    <div
      className="mt-3 rounded-xl"
      style={{ border: '1px solid var(--cr-indigo-100)', background: 'var(--cr-indigo-50)' }}
    >
      <div
        className="flex items-center gap-2 px-3.5 py-2"
        style={{ borderBottom: '1px solid var(--cr-indigo-100)' }}
      >
        <CalendarOutlined className="text-[13px] text-purple-700" />
        <p className="m-0 text-[12px] font-semibold text-purple-700">
          {t('salary.advancePlan.title')}
        </p>
      </div>

      <div className="flex flex-col gap-3 px-3.5 py-3">
        <Segmented
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: 'count', label: t('salary.advancePlan.byMonths') },
            { value: 'amount', label: t('salary.advancePlan.byAmount') },
          ]}
          style={{ fontSize: 12 }}
        />

        {mode === 'count' ? (
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
              {t('salary.advancePlan.countLabel')}
            </p>
            <InputNumber
              min={2}
              max={24}
              precision={0}
              value={installmentCount ?? null}
              onChange={handleCountChange}
              placeholder={t('salary.advancePlan.countPlaceholder')}
              suffix={t('salary.advancePlan.monthsSuffix')}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
        ) : (
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
              {t('salary.advancePlan.amountLabel')}
            </p>
            <InputNumber
              min={1}
              max={excessAmount}
              precision={0}
              value={installmentAmount ?? null}
              onChange={handleAmountChange}
              placeholder={t('salary.advancePlan.amountPlaceholder')}
              prefix={currencyFmt.symbol}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
        )}

        {hasCapped && (
          <Alert type="warning" showIcon title={t('salary.advancePlan.cappedWarning')} />
        )}

        {complianceBreaches.map((breach, i) => (
          <Alert
            key={`breach-${breach.code}-${breach.month}-${breach.year}-${i}`}
            type="error"
            showIcon
            title={breachMessage(breach)}
          />
        ))}

        {complianceWarnings.map((warning, i) => (
          <Alert
            key={`warn-${warning.code}-${i}`}
            type="warning"
            showIcon
            title={warningMessage(warning)}
          />
        ))}

        {previewError && <Alert type="error" showIcon title={previewError} />}

        {rows.length > 0 && (
          <div>
            <p className="m-0 mb-2 text-[11px] text-muted">
              {t('salary.advancePlan.helperLine', { count: rows.length })}
            </p>
            <Spin spinning={loading}>
              {rows.length > 3 ? (
                <Collapse
                  ghost
                  size="small"
                  defaultActiveKey={[]}
                  items={[
                    {
                      key: 'schedule',
                      label: t('salary.advancePlan.viewSchedule', { count: rows.length }),
                      children: tableContent,
                    },
                  ]}
                />
              ) : (
                tableContent
              )}
            </Spin>
          </div>
        )}

        {rows.length === 0 && loading && (
          <div className="flex justify-center py-4">
            <Spin size="small" />
          </div>
        )}
      </div>
    </div>
  );
}
