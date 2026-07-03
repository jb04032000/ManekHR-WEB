'use client';

/**
 * Phase 16 / FIN-15-01 - Validator Report Card.
 *
 * Renders the pre-export validator output. Per UI-SPEC §Tally Export and
 * UI-SPEC A11y contract: each row uses icon + color + text (never color-alone).
 *
 * Validator NEVER blocks export - the parent form may still call POST after
 * showing warnings. BLOCKER severity is reserved for future use (Plan 02 D-09);
 * if any blockers ever appear they render with the destructive token.
 */
import { List, Spin } from 'antd';
import { CheckCircleFilled, WarningFilled, CloseCircleFilled } from '@ant-design/icons';
import { DsCard } from '@/components/ui';
import type { TallyValidatorReport, ValidatorIssue } from '@/types';

interface Props {
  loading?: boolean;
  report?: TallyValidatorReport | null;
}

function rowIcon(severity: ValidatorIssue['severity']) {
  if (severity === 'BLOCKER') {
    return (
      <CloseCircleFilled style={{ color: 'var(--cr-error)', fontSize: 16 }} aria-label="Blocker" />
    );
  }
  return (
    <WarningFilled style={{ color: 'var(--cr-warning)', fontSize: 16 }} aria-label="Warning" />
  );
}

export default function ValidatorReportCard({ loading, report }: Props) {
  const issues: ValidatorIssue[] = [
    ...((report?.blockers ?? []) as ValidatorIssue[]),
    ...((report?.warnings ?? []) as ValidatorIssue[]),
  ];
  const zeroIssues = !!report && issues.length === 0;

  return (
    <DsCard
      title="Pre-export Validator"
      style={{ marginTop: 16 }}
      styles={{ header: { fontFamily: 'var(--font-display)', fontWeight: 700 } }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin />
        </div>
      )}

      {!loading && !report && (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cr-text-3)' }}>
          Run validator to preview issues before exporting.
        </p>
      )}

      {!loading && zeroIssues && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircleFilled
            style={{ color: 'var(--cr-success)', fontSize: 18 }}
            aria-label="All clear"
          />
          <span
            style={{
              fontSize: 14,
              color: 'var(--cr-success)',
              fontWeight: 600,
            }}
          >
            All clear. Safe to export.
          </span>
        </div>
      )}

      {!loading && !!report && issues.length > 0 && (
        <List
          dataSource={issues}
          renderItem={(issue) => (
            <List.Item
              style={{
                paddingLeft: 0,
                paddingRight: 0,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ display: 'flex', gap: 8 /* sm */, width: '100%' }}>
                <span style={{ marginTop: 2 }}>{rowIcon(issue.severity)}</span>
                <span
                  style={{
                    fontSize: 14,
                    color: issue.severity === 'BLOCKER' ? 'var(--cr-error)' : 'var(--cr-text)',
                    lineHeight: 1.5,
                  }}
                >
                  {issue.message}
                </span>
              </div>
            </List.Item>
          )}
        />
      )}
    </DsCard>
  );
}
