'use client';

/**
 * Phase 16 / FIN-15-01 - Recent Exports list.
 *
 * Lightweight last-10 view backed by the audit log via
 * `getRecentExports(wsId, firmId, 10)`. Per Plan 16-06 plan & threat-model
 * T-16-06-02: when `expiresAt` is in the past OR `downloadUrl` is absent,
 * render an "Expired" pill instead of a clickable link. We never auto-refresh
 * signed URLs.
 *
 * MVP backend (Plan 02 deferred): downloadUrl/expiresAt are not yet wired -
 * every row renders the "Expired" pill. The component is forward-compatible.
 */
import { useEffect, useState, startTransition } from 'react';
import { Spin } from 'antd';
import { DsCard, DsTable, DsButton } from '@/components/ui';
import { getRecentExports } from '@/lib/actions/tally-export.actions';
import type { TallyRecentExport } from '@/types';

interface Props {
  wsId: string;
  firmId: string;
  reloadKey?: number; // bumped by parent after a successful export
}

function humanReadableBytes(n: number): string {
  if (!n || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRange(fromDate: string, toDate: string): string {
  const from = fromDate ? fromDate.slice(0, 10) : '-';
  const to = toDate ? toDate.slice(0, 10) : '-';
  return `${from} – ${to}`;
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

export default function RecentExportsList({ wsId, firmId, reloadKey }: Props) {
  const [rows, setRows] = useState<TallyRecentExport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wsId || !firmId) {
      startTransition(() => {
        setRows([]);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
    });
    getRecentExports(wsId, firmId, 10)
      .then((r) => setRows(r ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [wsId, firmId, reloadKey]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'at',
      key: 'at',
      render: (at: string) => formatAt(at),
    },
    {
      title: 'Range',
      key: 'range',
      render: (_: unknown, row: TallyRecentExport) => formatRange(row.fromDate, row.toDate),
    },
    {
      title: 'Voucher count',
      dataIndex: 'voucherCount',
      key: 'voucherCount',
      align: 'right' as const,
      render: (n: number) => n?.toLocaleString('en-IN') ?? 0,
    },
    {
      title: 'File size',
      dataIndex: 'fileSizeBytes',
      key: 'fileSizeBytes',
      align: 'right' as const,
      render: (n: number) => humanReadableBytes(n),
    },
    {
      title: 'Download',
      key: 'download',
      render: (_: unknown, row: TallyRecentExport) => {
        const expired =
          !row.downloadUrl || (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now());
        if (expired) {
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                background: 'var(--cr-surface-2)',
                color: 'var(--cr-text-3)',
                borderRadius: 'var(--cr-radius-md)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Expired
            </span>
          );
        }
        return (
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            href={row.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </DsButton>
        );
      },
    },
  ];

  return (
    <DsCard
      title="Recent exports"
      style={{ marginTop: 16 }}
      styles={{ header: { fontFamily: 'var(--font-display)', fontWeight: 700 } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cr-text-3)' }}>
          No exports yet. Run your first export above.
        </p>
      ) : (
        <DsTable<TallyRecentExport>
          rowKey={(r) => `${r.at}-${r.fromDate}-${r.toDate}`}
          dataSource={rows}
          columns={columns}
          pagination={false}
          size="small"
        />
      )}
    </DsCard>
  );
}
