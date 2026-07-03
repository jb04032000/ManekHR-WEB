'use client';

/**
 * Phase 16 / FIN-15-02 - Pre-close Health Checks panel (Step 2).
 *
 * Renders the 4 health-check rows (D-13 step 2) returned by
 *   GET /workspaces/:wsId/firms/:firmId/fiscal-year/:id/health-checks
 *
 * Pass row template:  "{name} - passed"
 * Fail row template:  "{name} - {n} item(s) need attention"
 *
 * All copy verbatim per UI-SPEC §FY Close.
 */
import { CheckCircleFilled, WarningFilled } from '@ant-design/icons';
import { Alert, List, Spin } from 'antd';
import type { FyHealthChecksReport } from '@/types';

const HEALTH_CHECK_LABELS: Record<string, string> = {
  unreconciledBankRows: 'Unreconciled bank rows',
  draftVouchersInFy: 'Draft vouchers in this FY',
  partyBalanceMismatches: 'Party balance mismatches',
  trialBalanceImbalance: 'Trial balance',
};

interface Props {
  loading: boolean;
  report: FyHealthChecksReport | null;
}

export default function HealthChecksPanel({ loading, report }: Props) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin />
      </div>
    );
  }

  if (!report) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: 'var(--cr-text-3)' }}>
        Health checks have not run yet.
      </p>
    );
  }

  const allPassed = report.allPassed;

  return (
    <div>
      <List
        size="small"
        dataSource={report.checks}
        renderItem={(check) => {
          const label = HEALTH_CHECK_LABELS[check.name] ?? check.name;
          const text = check.passed
            ? `${label} - passed`
            : `${label} - ${check.count} item(s) need attention`;
          const Icon = check.passed ? CheckCircleFilled : WarningFilled;
          const color = check.passed ? 'var(--cr-success)' : 'var(--cr-warning)';
          return (
            <List.Item
              style={{
                padding: '12px 0',
                borderBottom: '1px solid var(--cr-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8 /* sm */,
                  width: '100%',
                }}
              >
                <Icon style={{ color, fontSize: 18, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: 'var(--cr-text)',
                      lineHeight: 1.5,
                    }}
                  >
                    {text}
                  </p>
                  {!check.passed && check.items && check.items.length > 0 && (
                    <ul
                      style={{
                        margin: '4px 0 0',
                        paddingLeft: 20,
                        fontSize: 13,
                        color: 'var(--cr-text-3)',
                      }}
                    >
                      {check.items.slice(0, 10).map((it) => (
                        <li key={it.id}>{it.label}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </List.Item>
          );
        }}
      />

      {!allPassed && (
        <Alert
          type="error"
          showIcon
          title="Resolve the issues above before closing. Health checks must pass."
          style={{
            marginTop: 16 /* md */,
            background: 'var(--cr-error-bg)',
            borderColor: 'var(--cr-error)',
          }}
        />
      )}
    </div>
  );
}
