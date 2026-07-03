'use client';
import { useEffect, useState, startTransition } from 'react';
import { Table, Empty, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { portalClient, formatINRPaise } from './portal-client-api';

interface Receipt {
  _id: string;
  voucherNumber: string;
  receiptDate: string;
  paymentMode?: string;
  referenceNo?: string;
  totalAmountPaise: number;
}

export default function ReceiptsTab({ token }: { token: string }) {
  const t = useTranslations('finance.portal');
  const [data, setData] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    startTransition(() => {
      setLoading(true);
    });
    portalClient
      .receipts(token)
      .then((d) => {
        if (active) setData(Array.isArray(d?.data) ? d.data : []);
      })
      .catch(() => {
        if (active) setData([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;
  if (data.length === 0) return <Empty description={t('receipts.empty')} />;

  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

  return (
    <div>
      <div className="hidden md:block">
        <Table<Receipt>
          rowKey="_id"
          dataSource={data}
          pagination={false}
          size="middle"
          columns={[
            { title: t('receipts.colDate'), dataIndex: 'receiptDate', render: fmtDate, width: 120 },
            { title: t('receipts.colMode'), dataIndex: 'paymentMode', width: 120 },
            { title: t('receipts.colReference'), dataIndex: 'referenceNo' },
            {
              title: t('receipts.colAmount'),
              dataIndex: 'totalAmountPaise',
              align: 'right',
              render: (v: number) => formatINRPaise(v),
              width: 140,
            },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {data.map((r) => (
          <div
            key={r._id}
            className="rounded p-3"
            style={{
              background: 'var(--cr-surface, #fff)',
              border: '1px solid var(--cr-border, var(--cr-border))',
            }}
          >
            <div className="flex justify-between text-xs" style={{ color: 'var(--cr-text-3)' }}>
              <span>{fmtDate(r.receiptDate)}</span>
              <span>{r.paymentMode ?? '-'}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-sm">{r.referenceNo || r.voucherNumber}</span>
              <strong>{formatINRPaise(r.totalAmountPaise)}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
