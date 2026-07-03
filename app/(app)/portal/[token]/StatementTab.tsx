'use client';
import { useEffect, useState, startTransition } from 'react';
import { Table, Empty, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { portalClient, formatINRPaise } from './portal-client-api';

interface Row {
  entryDate: string;
  voucherNumber: string;
  voucherType: string;
  narration: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  drOrCr: 'Dr' | 'Cr';
}

export default function StatementTab({ token }: { token: string }) {
  const t = useTranslations('finance.portal');
  const [data, setData] = useState<{
    rows: Row[];
    openingBalancePaise: number;
    closingBalancePaise: number;
    openingDrOrCr: 'Dr' | 'Cr';
    closingDrOrCr: 'Dr' | 'Cr';
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    startTransition(() => {
      setLoading(true);
    });
    portalClient
      .statement(token)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setErr(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }
  if (err || !data) {
    return <Empty description={t('statement.loadError')} />;
  }
  if (!data.rows || data.rows.length === 0) {
    return <Empty description={t('statement.empty')} />;
  }

  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

  return (
    <div>
      <div
        className="mb-3 flex justify-between px-1 text-sm"
        style={{ color: 'var(--cr-text-2, var(--cr-text-4))' }}
      >
        <span>
          {t('statement.opening')}{' '}
          <strong>
            {formatINRPaise(Math.abs(data.openingBalancePaise))} {data.openingDrOrCr}
          </strong>
        </span>
        <span>
          {t('statement.closing')}{' '}
          <strong>
            {formatINRPaise(Math.abs(data.closingBalancePaise))} {data.closingDrOrCr}
          </strong>
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table<Row>
          rowKey={(r, i) => `${r.voucherNumber}-${i}`}
          dataSource={data.rows}
          pagination={false}
          size="middle"
          columns={[
            { title: t('statement.colDate'), dataIndex: 'entryDate', render: fmtDate, width: 110 },
            { title: t('statement.colVoucher'), dataIndex: 'voucherNumber', width: 130 },
            { title: t('statement.colDescription'), dataIndex: 'narration' },
            {
              title: t('statement.colDebit'),
              dataIndex: 'debitPaise',
              align: 'right',
              render: (v: number) => (v ? formatINRPaise(v) : '-'),
              width: 120,
            },
            {
              title: t('statement.colCredit'),
              dataIndex: 'creditPaise',
              align: 'right',
              render: (v: number) => (v ? formatINRPaise(v) : '-'),
              width: 120,
            },
            {
              title: t('statement.colBalance'),
              dataIndex: 'runningBalancePaise',
              align: 'right',
              render: (v: number, row: Row) => `${formatINRPaise(v)} ${row.drOrCr}`,
              width: 140,
            },
          ]}
        />
      </div>

      {/* Mobile card-per-row */}
      <div className="flex flex-col gap-2 md:hidden">
        {data.rows.map((r, i) => (
          <div
            key={`${r.voucherNumber}-${i}`}
            className="rounded p-3"
            style={{
              background: 'var(--cr-surface, #fff)',
              border: '1px solid var(--cr-border, var(--cr-border))',
            }}
          >
            <div className="flex justify-between text-xs" style={{ color: 'var(--cr-text-3)' }}>
              <span>{fmtDate(r.entryDate)}</span>
              <span>{r.voucherNumber}</span>
            </div>
            <div className="mt-1 text-sm">{r.narration || r.voucherType}</div>
            <div className="mt-2 flex justify-between text-sm">
              <span>
                {r.debitPaise > 0 ? `Dr ${formatINRPaise(r.debitPaise)}` : ''}
                {r.creditPaise > 0 ? `Cr ${formatINRPaise(r.creditPaise)}` : ''}
              </span>
              <strong>
                {formatINRPaise(r.runningBalancePaise)} {r.drOrCr}
              </strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
