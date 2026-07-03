'use client';
import { useEffect, useState, startTransition } from 'react';
import { Table, Empty, Skeleton, Tag, Button, message, Pagination } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { portalClient, formatINRPaise } from './portal-client-api';

interface Invoice {
  _id: string;
  voucherNumber: string;
  voucherDate: string;
  state: string;
  paymentStatus?: string;
  grandTotalPaise: number;
  amountDuePaise?: number;
}

const STATUS_COLOR: Record<string, string> = {
  paid: 'success',
  partial: 'warning',
  overdue: 'error',
  unpaid: 'default',
};

// Maps a backend paymentStatus to the i18n key under finance.portal.invoices.
// Unknown statuses fall back to the raw string in render.
const STATUS_LABEL_KEY: Record<string, string> = {
  paid: 'statusPaid',
  partial: 'statusPartial',
  overdue: 'statusOverdue',
  unpaid: 'statusUnpaid',
};

export default function InvoicesTab({ token }: { token: string }) {
  const t = useTranslations('finance.portal');
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    let active = true;
    startTransition(() => {
      setLoading(true);
    });
    portalClient
      .invoices(token, page, limit)
      .then((d) => {
        if (!active) return;
        setData(Array.isArray(d?.data) ? d.data : []);
        setTotal(d?.total ?? 0);
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
  }, [token, page]);

  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

  async function downloadPdf(inv: Invoice) {
    setDownloading(inv._id);
    try {
      // Step 1: ask backend for a 15-min signed sub-URL (via proxy).
      const { url } = await portalClient.invoicePdfUrl(token, inv._id);
      if (!url) throw new Error('No URL');
      // Step 2: stream the PDF through the same proxy (keeps token server-side).
      // The signed sub-URL is the relative path returned by backend (e.g. /portal/invoices/:id/pdf?sig=...&exp=...&n=...).
      const sigQuery = url.includes('?') ? url.substring(url.indexOf('?')) : '';
      const proxied = `/api/portal/${encodeURIComponent(token)}/invoices/${inv._id}/pdf${sigQuery}`;
      // Trigger browser download via anchor click.
      const a = document.createElement('a');
      a.href = proxied;
      a.download = `invoice-${inv.voucherNumber || inv._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      message.error(t('invoices.downloadError'));
    } finally {
      setDownloading(null);
    }
  }

  if (loading && data.length === 0) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }
  if (!loading && data.length === 0) {
    return <Empty description={t('invoices.empty')} />;
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table<Invoice>
          rowKey="_id"
          dataSource={data}
          loading={loading}
          pagination={false}
          size="middle"
          columns={[
            { title: t('invoices.colDate'), dataIndex: 'voucherDate', render: fmtDate, width: 120 },
            { title: t('invoices.colInvoice'), dataIndex: 'voucherNumber', width: 160 },
            {
              title: t('invoices.colAmount'),
              dataIndex: 'grandTotalPaise',
              align: 'right',
              render: (v: number) => formatINRPaise(v),
              width: 140,
            },
            {
              title: t('invoices.colStatus'),
              dataIndex: 'paymentStatus',
              width: 110,
              render: (s?: string) => {
                const key = (s ?? 'unpaid').toLowerCase();
                const labelKey = STATUS_LABEL_KEY[key];
                return (
                  <Tag color={STATUS_COLOR[key] ?? 'default'}>
                    {labelKey ? t(`invoices.${labelKey}`) : key}
                  </Tag>
                );
              },
            },
            {
              title: <span className="sr-only">{t('invoices.actions')}</span>,
              key: 'pdf',
              width: 160,
              align: 'right',
              render: (_: unknown, inv: Invoice) => (
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={downloading === inv._id}
                  onClick={() => downloadPdf(inv)}
                  aria-label={t('invoices.downloadAria', { invoiceNumber: inv.voucherNumber })}
                >
                  {t('invoices.download')}
                </Button>
              ),
            },
          ]}
        />
      </div>

      {/* Mobile card-per-row */}
      <div className="flex flex-col gap-2 md:hidden">
        {data.map((inv) => {
          const key = (inv.paymentStatus ?? 'unpaid').toLowerCase();
          return (
            <div
              key={inv._id}
              className="rounded p-3"
              style={{
                background: 'var(--cr-surface, #fff)',
                border: '1px solid var(--cr-border, var(--cr-border))',
              }}
            >
              <div className="flex justify-between text-xs" style={{ color: 'var(--cr-text-3)' }}>
                <span>{fmtDate(inv.voucherDate)}</span>
                <span>{inv.voucherNumber}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <strong>{formatINRPaise(inv.grandTotalPaise)}</strong>
                <Tag color={STATUS_COLOR[key] ?? 'default'}>
                  {STATUS_LABEL_KEY[key] ? t(`invoices.${STATUS_LABEL_KEY[key]}`) : key}
                </Tag>
              </div>
              <Button
                block
                className="mt-3"
                icon={<DownloadOutlined />}
                style={{ minHeight: 44 }}
                loading={downloading === inv._id}
                onClick={() => downloadPdf(inv)}
                aria-label={t('invoices.downloadAria', { invoiceNumber: inv.voucherNumber })}
              >
                {t('invoices.download')}
              </Button>
            </div>
          );
        })}
      </div>

      {total > limit ? (
        <div className="mt-4 flex justify-center">
          <Pagination
            current={page}
            total={total}
            pageSize={limit}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
      ) : null}
    </div>
  );
}
