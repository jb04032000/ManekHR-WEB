'use client';

// D25 finance dashboard (firm home). Surfaces the already-built getDashboardKpis action (which
// had no UI) as a summary strip: revenue, receivables, payables, cash, bank, GST liability, each
// with a vs-previous trend. Replaces the old redirect-to-reports stub; "View full reports" still
// links onward. Data comes from BE report aggregations (D17 will snapshot these for scale later).
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Skeleton, Button, Statistic, Row, Col, Result } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { getDashboardKpis } from '@/lib/actions/finance-reports.actions';
import type { DashboardKpiResponse, KpiValue } from '@/types';

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function FirmDashboardPage() {
  const t = useTranslations('finance.financeDashboard');
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const [kpis, setKpis] = useState<DashboardKpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!wsId || !isHydrated || !firmId) return;
    let active = true;
    // Set state only in the async callbacks - calling setState synchronously in the effect
    // body trips react-hooks/set-state-in-effect. `loading` starts true (initial state).
    getDashboardKpis(wsId, firmId)
      .then((data) => {
        if (active) {
          setKpis(data);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wsId, isHydrated, firmId]);

  const tiles: Array<{ key: string; v: KpiValue }> = kpis
    ? [
        { key: 'revenue', v: kpis.revenue },
        { key: 'outstanding', v: kpis.outstanding },
        { key: 'payables', v: kpis.payables },
        { key: 'cash', v: kpis.cashPosition },
        { key: 'bank', v: kpis.bankPosition },
        { key: 'gst', v: kpis.gstLiability },
      ]
    : [];

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0 }}>{t('title')}</h1>
        <Button
          icon={<FileTextOutlined />}
          onClick={() => router.push(`/dashboard/finance/firms/${firmId}/reports`)}
        >
          {t('viewReports')}
        </Button>
      </div>

      {error ? (
        <Result status="warning" title={t('loadError')} />
      ) : loading ? (
        <Row gutter={[16, 16]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={[16, 16]}>
          {tiles.map(({ key, v }) => (
            <Col xs={24} sm={12} lg={8} key={key}>
              <Card>
                <Statistic title={t(key)} value={inr(v.valuePaise)} valueStyle={{ fontSize: 22 }} />
                {v.trendPct != null ? (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: v.trendPct >= 0 ? 'var(--cr-success-600)' : 'var(--cr-error-600)',
                    }}
                  >
                    {v.trendPct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{' '}
                    {Math.abs(v.trendPct).toFixed(1)}% {t('vsPrev')}
                  </div>
                ) : null}
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
