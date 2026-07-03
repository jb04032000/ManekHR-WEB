'use client';

import { startTransition, useEffect, useState } from 'react';
import { Button, Card, Alert, Empty, Typography, Row, Col } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store';
import { getCurrentFirm, getSetupChecklist } from '@/lib/actions/finance.actions';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { FinanceDashboardSkeleton } from '@/components/finance/FinanceDashboardSkeleton';
import { SalesKpiPanel } from '@/components/finance/SalesKpiPanel';
import { KpiDashboard } from '@/components/finance/reports/KpiDashboard';
import { RevenueTrendChart } from '@/components/finance/reports/RevenueTrendChart';
// PowerBI-style accounting KPI section (ratios, P&L trend, cash movement, aging,
// balance sheet). Self-fetching from the aggregate accountingDashboard endpoint.
import { AccountingInsights } from '@/components/finance/reports/AccountingInsights';
import type { Firm, FinanceChecklistItem } from '@/types';

const { Title, Text } = Typography;

export default function FinanceDashboardPage() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [firm, setFirm] = useState<Firm | null>(null);
  const [checklist, setChecklist] = useState<FinanceChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Finance entitlement (mirrors Sidebar 'Billing & Accounts' gate). Drives the
  // "not in your plan" locked state below so a 403 from a locked module no longer
  // masquerades as "business profile missing". When the owner grants access or
  // buys the plan, entitlements.moduleAccess updates and this flips to unlocked.
  const financeAccess = useFeatureAccess('finance');

  useEffect(() => {
    if (!wsId) return;
    startTransition(() => {
      setLoading(true);
    });
    getCurrentFirm(wsId)
      .then(async (f) => {
        setFirm(f ?? null);
        if (f) {
          const cl = await getSetupChecklist(wsId, f._id).catch(() => []);
          setChecklist(cl ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wsId]);

  if (loading || financeAccess.isLoading) return <FinanceDashboardSkeleton />;

  // Finance/accounting is NOT included in the current plan → show an explicit
  // "not in your plan" locked state with an upgrade CTA (consistent with how other
  // gated modules surface lock state), instead of the old silent "profile missing"
  // empty-state that swallowed the 403 from a locked module.
  if (financeAccess.isLocked) {
    return (
      <div style={{ maxWidth: 600, margin: '64px auto', textAlign: 'center' }}>
        <Card style={{ borderColor: 'var(--cr-border)' }}>
          <LockOutlined style={{ fontSize: 40, color: 'var(--cr-text-3)' }} />
          <Title level={1} style={{ fontSize: 20, margin: '16px 0 8px' }}>
            Billing &amp; Accounts isn&apos;t included in your plan
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Accounting, ledgers, GST and financial reports are part of a higher plan or add-on.
            Upgrade or enable the Accounts add-on to start using them. If your owner just granted
            access, refresh to see it here.
          </Text>
          <Button
            type="primary"
            size="large"
            // Add-Ons tab hidden for this phase (owner decision 2026-06-25): route
            // this upgrade CTA to the visible Plans tab instead of the hidden
            // Add-Ons tab. Restore '/account/subscription/addons' + "& add-ons"
            // wording when Add-Ons returns.
            onClick={() => router.push('/account/subscription/plans')}
          >
            View plans
          </Button>
        </Card>
      </div>
    );
  }

  // Edge case: workspace exists but firm cascade failed at create-time.
  // Surface a recovery prompt rather than a "create firm" CTA.
  if (!firm) {
    return (
      <div style={{ maxWidth: 600, margin: '64px auto', textAlign: 'center' }}>
        <Empty
          description={
            <span>
              <Title level={1} style={{ fontSize: 20, margin: 0 }}>
                Business profile missing
              </Title>
              <Text type="secondary">
                Your business profile wasn&apos;t set up automatically. Open workspace settings to
                retry, or contact support if this persists.
              </Text>
            </span>
          }
        >
          <Button
            type="primary"
            size="large"
            icon={<SettingOutlined />}
            onClick={() => router.push('/dashboard/workspace?section=business')}
          >
            Open Workspace Settings
          </Button>
        </Empty>
      </div>
    );
  }

  const incompleteBadges = checklist.filter((c) => !c.done);
  const setupIncomplete =
    !firm.setupChecklistState?.step1Done ||
    !firm.setupChecklistState?.step2Done ||
    !firm.setupChecklistState?.step3Done;

  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={1} style={{ margin: 0, fontSize: 22 }}>
          Billing & Accounts - {firm.firmName}
        </Title>
        {setupIncomplete && (
          <Button
            type="primary"
            icon={<ExclamationCircleOutlined />}
            onClick={() => router.push('/dashboard/finance/firms/new')}
          >
            Complete Business Setup
          </Button>
        )}
      </div>

      {incompleteBadges.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Text strong>Setup checklist</Text>
          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            {incompleteBadges.map((item) => (
              <Col key={item.key}>
                <Card
                  size="small"
                  style={{
                    background: 'var(--cr-warning-50)',
                    borderColor: 'var(--cr-warning-500)',
                    cursor: 'pointer',
                  }}
                  onClick={() => router.push(item.route)}
                >
                  <ExclamationCircleOutlined
                    style={{ color: 'var(--cr-warning-500)', marginRight: 8 }}
                  />
                  {item.label}
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {checklist.length > 0 && incompleteBadges.length === 0 && (
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          title="Setup complete! Your business is ready for voucher entry."
          style={{ marginBottom: 24 }}
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>
          Sales
        </Text>
        <SalesKpiPanel firmId={firm._id} />
      </div>

      {/* ── Finance KPI Dashboard ───────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <KpiDashboard wsId={wsId} firmId={firm._id} />
      </div>

      {/* ── Revenue Trend Chart ─────────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <RevenueTrendChart wsId={wsId} firmId={firm._id} />
      </div>

      {/* ── Accounting Insights (PowerBI-style KPI section) ─────────────── */}
      <div style={{ marginTop: 32 }}>
        <AccountingInsights wsId={wsId} firmId={firm._id} />
      </div>

      {/* ── Quick Access tiles ──────────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--cr-text-3)',
            display: 'block',
            marginBottom: 12,
          }}
        >
          Quick Access
        </span>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}
          className="md:grid-cols-4"
        >
          {[
            { label: 'Trial Balance', path: 'reports/financial-statements/trial-balance' },
            { label: 'Party Statement', path: 'reports/party-ledger/party-statement' },
            { label: 'GST Output Register', path: 'reports/gst-registers/output-register' },
            { label: 'View All Reports', path: 'reports' },
          ].map((t) => (
            <a
              key={t.label}
              href={`/dashboard/finance/firms/${firm._id}/${t.path}`}
              style={{
                display: 'block',
                padding: '12px 16px',
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
                color: 'var(--cr-text)',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
