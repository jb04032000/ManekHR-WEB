'use client';

/**
 * Phase 16 / FIN-15-02 - FY-Close Audit Trail panel.
 *
 * Renders the close/reopen history at the bottom of the page. Each row shows
 *   at | by | action | reason
 * (IP + user-agent are server-side only per CONTEXT.md D-17.)
 *
 * UI-SPEC §FY Close: "Audit panel title - Close history".
 */
import { DsCard, DsTable } from '@/components/ui';
import type { FyAuditEntry } from '@/types';

interface Props {
  entries: FyAuditEntry[];
}

function formatAt(at: string): string {
  if (!at) return '-';
  const d = new Date(at);
  if (isNaN(d.getTime())) return at;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditTrail({ entries }: Props) {
  const sorted = [...(entries ?? [])].sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return tb - ta;
  });

  return (
    <DsCard
      title="Close history"
      style={{ marginTop: 24 /* lg */ }}
      styles={{
        header: { fontFamily: 'var(--font-display)', fontWeight: 700 },
      }}
    >
      {sorted.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cr-text-3)' }}>No close history yet.</p>
      ) : (
        <DsTable<FyAuditEntry>
          rowKey={(r) => `${r.at}-${r.action}`}
          dataSource={sorted}
          pagination={false}
          size="small"
          columns={[
            {
              title: 'When',
              dataIndex: 'at',
              key: 'at',
              render: (at: string) => formatAt(at),
            },
            {
              title: 'Action',
              dataIndex: 'action',
              key: 'action',
              render: (a: string) => {
                const isReopen = a === 'REOPEN';
                return (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      background: isReopen ? 'var(--cr-error-bg)' : 'var(--cr-success-bg)',
                      color: isReopen ? 'var(--cr-error)' : 'var(--cr-success)',
                      borderRadius: 'var(--cr-radius-md)',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {a}
                  </span>
                );
              },
            },
            {
              title: 'By',
              dataIndex: 'by',
              key: 'by',
              render: (by: string) => (
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {by ? String(by).slice(-6) : '-'}
                </span>
              ),
            },
            {
              title: 'Reason',
              dataIndex: 'reason',
              key: 'reason',
              render: (r?: string) => r || '-',
            },
          ]}
        />
      )}
    </DsCard>
  );
}
