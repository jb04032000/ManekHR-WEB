'use client';
/**
 * PartyPnlReport - full per-party P&L report view.
 *
 * Layout (top-down):
 *  - Header row: party name, RangePicker, Export button
 *  - 4 KPI cards: Revenue, COGS, Gross Profit, Gross Margin %
 *  - Loud disclaimer banner (D-24): direct margin only - excludes overhead, freight, brokerage, salary
 *  - Breakdown table: invoiceCount, creditNoteCount, avgInvoiceValue
 *
 * Date range:
 *  - Default = current Indian FY-to-date (1 April → today)
 *  - Hard cap 5 years via `disabledDate` (T-17-W2B-01 mitigation, mirrors backend Plan 17-05)
 *
 * Export uses the existing F-14 export pattern via ExportButton + partyPnlFields.
 */

import { startTransition, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Alert,
  Skeleton,
  Statistic,
  Space,
  Typography,
  Button,
  message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { reportsApi } from '@/lib/api/modules/reports.api';
import type { PartyPnlReport } from '@/types';
import { ExportButton } from '@/components/export/ExportButton';
import { PARTY_PNL_EXPORT_FIELDS } from '@/lib/exportFields/partyPnlFields';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

interface Props {
  wsId: string;
  partyId: string;
  partyName?: string;
  initial?: PartyPnlReport | null;
}

function indianFyStart(now: Dayjs): Dayjs {
  // Indian FY: 1 April → 31 March
  const year = now.month() >= 3 ? now.year() : now.year() - 1;
  return dayjs(new Date(year, 3, 1)); // month is 0-indexed, 3 = April
}

function fmtPaise(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return '-';
  return `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PartyPnlReportView({ wsId, partyId, partyName, initial = null }: Props) {
  const t = useTranslations('party-intelligence');

  const today = useMemo(() => dayjs(), []);
  const fyStart = useMemo(() => indianFyStart(today), [today]);

  const [range, setRange] = useState<[Dayjs, Dayjs]>([fyStart, today]);
  const [report, setReport] = useState<PartyPnlReport | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async (from: Dayjs, to: Dayjs) => {
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const res = await reportsApi.getPartyPnl(wsId, partyId, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      startTransition(() => {
        setReport(res);
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      startTransition(() => {
        setError(err?.message ?? 'Failed to load report');
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initial) {
      void reload(range[0], range[1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, partyId]);

  const handleRangeChange = (vals: [Dayjs | null, Dayjs | null] | null) => {
    if (!vals || !vals[0] || !vals[1]) return;
    const [from, to] = vals as [Dayjs, Dayjs];
    // Defence-in-depth: 5-year cap mirrored in UI (T-17-W2B-01)
    const diffYears = to.diff(from, 'year', true);
    if (diffYears > 5) {
      message.warning('Date range capped at 5 years');
      return;
    }
    setRange([from, to]);
    void reload(from, to);
  };

  // disabledDate caps the picker at 5-year span anchored to the current
  // start (or end) of the selection
  const disabledDate = (current: Dayjs): boolean => {
    if (!current) return false;
    if (current.isAfter(today, 'day')) return true;
    // Cap any single date to 5 years before today
    const fiveYearsAgo = today.subtract(5, 'year');
    if (current.isBefore(fiveYearsAgo, 'day')) return true;
    return false;
  };

  const filenameStem = `party-pnl-${partyName ?? partyId}-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}`;

  const exportData = async (): Promise<PartyPnlReport[]> => {
    if (!report) return [];
    return [report];
  };

  return (
    <div style={{ padding: 24, maxWidth: 1280 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={1} style={{ margin: 0, fontSize: 22 }}>
            {partyName ?? report?.partyName ?? 'Party'} - {t('pnl.title')}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Direct-margin P&L for the selected period
          </Text>
        </div>
        <Space>
          <RangePicker
            value={range as [Dayjs, Dayjs]}
            onChange={handleRangeChange}
            disabledDate={disabledDate}
            allowClear={false}
          />
          <ExportButton<PartyPnlReport>
            fields={PARTY_PNL_EXPORT_FIELDS}
            getExportData={exportData}
            title={`${partyName ?? 'Party'} P&L`}
            filename={filenameStem}
            module="finance"
            disabled={!report || loading}
          />
        </Space>
      </div>

      {/* D-24 loud disclaimer */}
      <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={t('pnl.disclaimer')} />

      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button size="small" onClick={() => reload(range[0], range[1])}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {/* KPI cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic title={t('pnl.revenue')} value={fmtPaise(report?.revenuePaise)} />
            )}
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic title={t('pnl.cogs')} value={fmtPaise(report?.cogsPaise)} />
            )}
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic
                title={t('pnl.grossProfit')}
                value={fmtPaise(report?.grossProfitPaise)}
                styles={{
                  content: {
                    color:
                      (report?.grossProfitPaise ?? 0) >= 0
                        ? 'var(--cr-success-700)'
                        : 'var(--cr-danger-700)',
                  },
                }}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic
                title={t('pnl.margin')}
                value={
                  report?.grossMarginPct == null ? '-' : `${report.grossMarginPct.toFixed(2)}%`
                }
                styles={{
                  content: {
                    color:
                      (report?.grossMarginPct ?? 0) >= 0
                        ? 'var(--cr-success-700)'
                        : 'var(--cr-danger-700)',
                  },
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Breakdown */}
      <Card title="Breakdown" size="small">
        {loading ? (
          <Skeleton active />
        ) : report ? (
          <Row gutter={[12, 12]}>
            <Col xs={12} md={8}>
              <Statistic title="Invoices" value={report.invoiceCount ?? 0} />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="Credit Notes" value={report.creditNoteCount ?? 0} />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="Avg Invoice Value" value={fmtPaise(report.avgInvoiceValuePaise)} />
            </Col>
          </Row>
        ) : (
          <Text type="secondary">No data for this period.</Text>
        )}
      </Card>
    </div>
  );
}
