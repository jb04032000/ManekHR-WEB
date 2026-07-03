'use client';

/**
 * Wave 8 - admin MSG91 wallet dashboard.
 *
 * Reads the latest hourly snapshot, renders balance + 30d burn + projected
 * zero-date + alert level. Provides a "record manual top-up" form for
 * audit trail (actual top-up done out-of-band on MSG91 dashboard).
 */

import { useCallback, useEffect, useState, startTransition } from 'react';
import {
  Card,
  Button,
  Tag,
  Spin,
  Modal,
  Form,
  InputNumber,
  Input,
  message,
  Statistic,
  Empty,
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  PlusOutlined,
  HistoryOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getMsg91Balance,
  recordMsg91TopUp,
  listMsg91TopUps,
  type Msg91BalanceStatus,
  type Msg91TopUpRecord,
} from '@/lib/actions/admin-communications.actions';
import { parseApiError } from '@/lib/utils';

const ALERT_COLOR: Record<string, string> = {
  ok: 'green',
  warn: 'orange',
  alarm: 'red',
  unknown: 'default',
};

export default function AdminMsg91BalancePage() {
  const [status, setStatus] = useState<Msg91BalanceStatus | null>(null);
  const [topUps, setTopUps] = useState<Msg91TopUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([
      getMsg91Balance().catch(() => null),
      listMsg91TopUps(50).catch(() => []),
    ]);
    startTransition(() => {
      setStatus(s ?? null);
      setTopUps(Array.isArray(t) ? t : []);
    });
  }, []);

  useEffect(() => {
    refresh().finally(() =>
      startTransition(() => {
        setLoading(false);
      }),
    );
  }, [refresh]);

  const handleTopUp = async (vals: any) => {
    setSaving(true);
    try {
      await recordMsg91TopUp({
        amountPaise: Math.round(Number(vals.amountRupees) * 100),
        providerReferenceId: vals.providerReferenceId,
        note: vals.note,
      });
      msgApi.success('Top-up recorded');
      setTopUpModalOpen(false);
      form.resetFields();
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      {ctx}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
              MSG91 Wallet
            </h2>
            <p className="m-0 text-sm text-muted">
              Hourly poll of MSG91 wallet balance. Manual top-up recorded for audit. Auto-charge
              intentionally disabled - top up via MSG91 dashboard, then record here.
            </p>
          </div>
          <div className="flex gap-2">
            <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setTopUpModalOpen(true)}>
              Record Top-Up
            </Button>
          </div>
        </div>

        {!status ? (
          <Card className="rounded-2xl">
            <Empty description="No wallet snapshot yet. Cron polls hourly - first run on next ::00." />
          </Card>
        ) : (
          <>
            <Card className="rounded-2xl">
              <div className="flex flex-wrap items-start gap-6">
                <Statistic
                  title="Wallet Balance"
                  value={
                    status.balancePaise < 0
                      ? '-'
                      : `₹${(status.balancePaise / 100).toLocaleString('en-IN')}`
                  }
                />
                <Statistic
                  title="30-day Burn"
                  value={`₹${(status.burn30dPaise / 100).toLocaleString('en-IN')}`}
                />
                <Statistic
                  title="Avg Daily"
                  value={`₹${(status.avgDailyBurnPaise / 100).toLocaleString('en-IN')}`}
                />
                <div>
                  <p className="m-0 mb-1 text-xs text-subtle">Alert Level</p>
                  <Tag
                    color={ALERT_COLOR[status.alertLevel] ?? 'default'}
                    icon={status.alertLevel === 'alarm' ? <WarningOutlined /> : null}
                    className="capitalize"
                  >
                    {status.alertLevel}
                  </Tag>
                </div>
                {status.projectedZeroDate && (
                  <div>
                    <p className="m-0 mb-1 text-xs text-subtle">Projected Zero</p>
                    <p className="m-0 text-sm font-semibold text-heading">
                      {dayjs(status.projectedZeroDate).format('DD MMM YYYY')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="m-0 mb-1 text-xs text-subtle">Last Polled</p>
                  <p className="m-0 text-sm font-semibold text-heading">
                    {status.polledAt ? dayjs(status.polledAt).format('DD MMM HH:mm') : '-'}
                  </p>
                </div>
              </div>
            </Card>

            {status.alertLevel === 'alarm' && (
              <Card className="rounded-2xl border-red-300 bg-red-50">
                <p className="m-0 text-red-700">
                  <strong>ALARM - wallet below 1-day runway.</strong> Top up immediately on the
                  MSG91 dashboard, then record here.
                </p>
              </Card>
            )}
            {status.alertLevel === 'warn' && (
              <Card className="rounded-2xl border-amber-300 bg-amber-50">
                <p className="m-0 text-amber-700">
                  <strong>WARN - wallet below 5-day runway.</strong> Schedule a top-up soon to avoid
                  customer-facing degradation.
                </p>
              </Card>
            )}
          </>
        )}

        <Card
          className="rounded-2xl"
          title={
            <span className="font-display text-base font-bold">
              <HistoryOutlined className="mr-2" /> Top-Up History
            </span>
          }
        >
          {topUps.length === 0 ? (
            <Empty description="No top-ups recorded yet" />
          ) : (
            <div className="flex flex-col gap-2">
              {topUps.map((row) => (
                <div
                  key={row._id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-heading">
                      ₹{(row.amountPaise / 100).toLocaleString('en-IN')}
                      {row.providerReferenceId && (
                        <span className="ml-2 text-xs text-subtle">
                          ref: {row.providerReferenceId}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-subtle">
                      {dayjs(row.createdAt).format('DD MMM YYYY HH:mm')} ·{' '}
                      {typeof row.recordedBy === 'object'
                        ? (row.recordedBy.name ?? row.recordedBy.email ?? '-')
                        : row.recordedBy}
                    </span>
                    {row.note && <span className="text-xs text-muted">{row.note}</span>}
                  </div>
                  <ThunderboltOutlined className="text-blue-700" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={topUpModalOpen}
        onCancel={() => setTopUpModalOpen(false)}
        title="Record manual MSG91 top-up"
        footer={null}
        destroyOnHidden
      >
        <p className="mb-3 text-xs text-muted">
          Record a top-up that you have ALREADY completed on the MSG91 dashboard. This does not
          charge anyone - it&apos;s an audit trail entry.
        </p>
        <Form form={form} layout="vertical" onFinish={handleTopUp}>
          <Form.Item
            name="amountRupees"
            label="Amount (₹)"
            rules={[{ required: true, message: 'Enter amount' }]}
          >
            <InputNumber className="w-full" min={1} step={100} prefix="₹" size="large" />
          </Form.Item>
          <Form.Item name="providerReferenceId" label="MSG91 Transaction Reference (optional)">
            <Input placeholder="e.g. MSG91-TXN-1234567" />
          </Form.Item>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setTopUpModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Record
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
