'use client';

import { useEffect, useState, startTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Spin, Tag, Button, Descriptions, Empty, Tooltip, message } from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  RollbackOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getInvoiceMeta, downloadInvoice, adminRegenerateInvoice } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import { DirectRefundModal } from '@/components/admin/billing/DirectRefundModal';
import { AuditLogTable } from '@/components/admin/billing/AuditLogTable';
import type { SubscriptionPayment } from '@/types';

/**
 * Admin payment detail page. The self-serve `GET /api/subscriptions/
 * payments/:id/invoice` endpoint allows ANY authed user to fetch any
 * payment's invoice metadata - for admin we leverage the same shape.
 * The subscription/payment full record is hydrated via that endpoint
 * extended with refunds + plan info from the list payload.
 */
export default function AdminPaymentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [payment, setPayment] = useState<SubscriptionPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  const refresh = async () => {
    if (!id) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      // Reuse the self-serve invoice meta endpoint as a quick handle.
      // For full payment hydration use the cross-user list filter.
      const m = await getInvoiceMeta(id).catch(() => null);
      // Pull the full payment row by querying for invoiceNumber match.
      // BE doesn't expose a public per-payment fetch yet - we use list
      // with the invoice number to retrieve the full row.
      const inv = (m as { invoiceNumber?: string } | null)?.invoiceNumber;
      if (inv) {
        const { listPayments } = await import('@/lib/actions');
        const res = await listPayments({ invoiceNumber: inv, limit: 1 });
        startTransition(() => {
          setPayment(res.items[0] ?? null);
        });
      }
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDownload = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const res = await downloadInvoice(id);
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setDownloading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!id) return;
    setRegenerating(true);
    try {
      await adminRegenerateInvoice(id);
      msgApi.success('Invoice regenerated (same number)');
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !payment) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  if (!payment) {
    return (
      <Card className="rounded-2xl">
        <Empty description="Payment not found, or invoice not yet generated" />
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push('/admin/billing/payments')}>Back</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {ctx}

      <div className="flex items-center justify-between">
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          className="px-0"
          onClick={() => router.push('/admin/billing/payments')}
        >
          Back to payments
        </Button>
        <div className="flex items-center gap-2">
          {payment.invoiceNumber && (
            <Tooltip title="Download PDF">
              <Button icon={<DownloadOutlined />} onClick={handleDownload} loading={downloading}>
                Invoice PDF
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Force regenerate (reuses invoice number per GST rules)">
            <Button icon={<ReloadOutlined />} onClick={handleRegenerate} loading={regenerating}>
              Regenerate
            </Button>
          </Tooltip>
          <Button danger icon={<RollbackOutlined />} onClick={() => setRefundOpen(true)}>
            Direct Refund
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Payment id">
            <span className="font-mono text-xs">{payment._id}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={payment.status === 'captured' ? 'green' : 'default'}>{payment.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Plan">
            {typeof payment.planId === 'object' ? payment.planId.name : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Cycle">
            <Tag className="capitalize">{payment.billingCycle}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Mode">
            <Tag className="capitalize">{payment.paymentMode.replace('_', '-')}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Gateway">
            <Tag>{payment.gateway}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Total">
            <strong>{Money.fromPaise(payment.totalPaise).format()}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="GST">
            {Money.fromPaise(payment.gstPaise).format()} ({payment.gstRatePercent}%)
          </Descriptions.Item>
          {payment.discountPaise > 0 && (
            <Descriptions.Item label="Coupon discount" span={2}>
              −{Money.fromPaise(payment.discountPaise).format()} ({payment.appliedCouponCode ?? '-'}
              )
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Razorpay order">
            <span className="font-mono text-xs">{payment.gatewayOrderId ?? '-'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Razorpay payment">
            <span className="font-mono text-xs">{payment.gatewayPaymentId ?? '-'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Invoice number">
            {payment.invoiceNumber ?? <span className="text-muted">Not generated</span>}
          </Descriptions.Item>
          <Descriptions.Item label="Captured at">
            {payment.capturedAt ? dayjs(payment.capturedAt).format('DD MMM YYYY HH:mm') : '-'}
          </Descriptions.Item>
        </Descriptions>

        {payment.refunds && payment.refunds.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold">Refunds applied</p>
            <div className="flex flex-col gap-1.5">
              {payment.refunds.map((r) => (
                <div
                  key={r.refundId}
                  className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Tag
                      color={
                        r.status === 'processed'
                          ? 'green'
                          : r.status === 'failed'
                            ? 'red'
                            : 'orange'
                      }
                    >
                      {r.status}
                    </Tag>
                    <span className="font-mono text-xs">{r.refundId}</span>
                  </div>
                  <span className="font-medium">−{Money.fromPaise(r.amountPaise).format()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div>
        <h3 className="m-0 mb-2 font-display text-base font-bold text-heading">
          Audit trail for this payment
        </h3>
        <AuditLogTable scope={{ paymentId: id }} />
      </div>

      <DirectRefundModal
        open={refundOpen}
        payment={payment}
        onCancel={() => setRefundOpen(false)}
        onIssued={() => {
          setRefundOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
