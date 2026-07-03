'use client';

/**
 * Phase 16 / FIN-15-02 - Journals Preview (Step 3).
 *
 * Read-only preview of the closing + opening journals for the FY in question.
 * Backend doesn't expose a dedicated "preview" endpoint yet (the close itself
 * computes lines inside its transaction), so this component renders a
 * structural / informational summary plus the canonical retained-earnings
 * note. After close completes, the actual posted journals are queryable via
 * fy.closingJournalId / fy.openingJournalId on the FiscalYearRow.
 *
 * All copy verbatim per UI-SPEC §FY Close - Step 3.
 */
import { DsCard, DsTable } from '@/components/ui';
import type { FiscalYearRow } from '@/types';

interface PreviewLine {
  account: string;
  debit: string;
  credit: string;
}

interface Props {
  fy: FiscalYearRow;
  effectiveCloseDate: string;
}

function formatDate(d: string | Date | undefined): string {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export default function JournalsPreview({ fy, effectiveCloseDate }: Props) {
  const startDate = formatDate(fy.startDate);
  const endDate = formatDate(effectiveCloseDate || fy.endDate);
  const nextStart = (() => {
    const e = new Date(effectiveCloseDate || fy.endDate);
    if (isNaN(e.getTime())) return '-';
    return formatDate(new Date(e.getTime() + 24 * 60 * 60 * 1000));
  })();

  const closingLines: PreviewLine[] = [
    {
      account: 'All Income accounts (zeroed → Retained Earnings)',
      debit: 'computed',
      credit: '-',
    },
    {
      account: 'All Expense accounts (zeroed → Retained Earnings)',
      debit: '-',
      credit: 'computed',
    },
    {
      account: 'Retained Earnings (auto-created under Reserves & Surplus)',
      debit: 'computed',
      credit: 'computed',
    },
  ];

  const openingLines: PreviewLine[] = [
    {
      account: 'All Asset accounts (closing balance carried forward)',
      debit: 'computed',
      credit: '-',
    },
    {
      account: 'All Liability accounts (closing balance carried forward)',
      debit: '-',
      credit: 'computed',
    },
    {
      account: 'All Capital accounts (incl. Retained Earnings) carried forward',
      debit: '-',
      credit: 'computed',
    },
  ];

  const columns = [
    { title: 'Account', dataIndex: 'account', key: 'account' },
    {
      title: 'Debit',
      dataIndex: 'debit',
      key: 'debit',
      align: 'right' as const,
    },
    {
      title: 'Credit',
      dataIndex: 'credit',
      key: 'credit',
      align: 'right' as const,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 /* md */ }}>
      <DsCard
        title={`Closing Journal - dated ${endDate}`}
        styles={{
          header: { fontFamily: 'var(--font-display)', fontWeight: 700 },
        }}
      >
        <DsTable<PreviewLine>
          rowKey={(r) => r.account}
          dataSource={closingLines}
          columns={columns}
          pagination={false}
          size="small"
        />
      </DsCard>

      <DsCard
        title={`Opening Journal - dated ${nextStart}`}
        styles={{
          header: { fontFamily: 'var(--font-display)', fontWeight: 700 },
        }}
      >
        <DsTable<PreviewLine>
          rowKey={(r) => r.account}
          dataSource={openingLines}
          columns={columns}
          pagination={false}
          size="small"
        />
      </DsCard>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--cr-text-3)',
          lineHeight: 1.5,
        }}
      >
        These journals post atomically. If any line fails, none are written.
      </p>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--cr-text-3)',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}
      >
        Per-line amounts are computed from your trial balance for {startDate}–{endDate} when you
        confirm the close.
      </p>
    </div>
  );
}
