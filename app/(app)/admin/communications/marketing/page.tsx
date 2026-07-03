'use client';

/**
 * Wave 8.2 - admin marketing campaigns + platform credit pool.
 *
 * Decoupled from customer credit balances. Admin manually tops up the
 * platform pool (after paying MSG91 / AiSensy directly) and dispatches
 * bulk SMS / WhatsApp campaigns from this page. Customer subscription
 * credits are NEVER charged for marketing sends.
 */

import { useCallback, useEffect, useState, startTransition } from 'react';
import {
  Card,
  Button,
  Tabs,
  Statistic,
  Table,
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  Tag,
  Spin,
  Empty,
  message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  HistoryOutlined,
  MessageOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getMarketingPools,
  topUpMarketingPool,
  getMarketingLedger,
  sendMarketingBulk,
  type MarketingPoolBalances,
  type MarketingLedgerRow,
  type MarketingBulkSendResult,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';

export default function AdminMarketingPage() {
  const [pools, setPools] = useState<MarketingPoolBalances>({
    sms: 0,
    whatsapp: 0,
  });
  const [ledger, setLedger] = useState<MarketingLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<MarketingBulkSendResult | null>(null);
  const [topUpForm] = Form.useForm();
  const [sendForm] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    const [p, l] = await Promise.all([
      getMarketingPools().catch(() => ({ sms: 0, whatsapp: 0 })),
      getMarketingLedger(undefined, 100).catch(() => []),
    ]);
    startTransition(() => {
      setPools(p);
      setLedger(Array.isArray(l) ? l : []);
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
      await topUpMarketingPool({
        channel: vals.channel,
        credits: vals.credits,
        ref: vals.ref,
        note: vals.note,
      });
      msgApi.success(`Pool topped up: +${vals.credits} ${vals.channel.toUpperCase()} credits`);
      setTopUpOpen(false);
      topUpForm.resetFields();
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSend = async (vals: any) => {
    setSaving(true);
    try {
      const recipients = String(vals.recipients ?? '')
        .split(/[\s,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (recipients.length === 0) {
        msgApi.error('At least one recipient required');
        setSaving(false);
        return;
      }
      const varsObj: Record<string, string> = {};
      if (vals.var1) varsObj.VAR1 = String(vals.var1);
      if (vals.var2) varsObj.VAR2 = String(vals.var2);
      if (vals.var3) varsObj.VAR3 = String(vals.var3);
      if (vals.var4) varsObj.VAR4 = String(vals.var4);

      const result = await sendMarketingBulk({
        workspaceId: vals.workspaceId,
        templateId: vals.templateId,
        senderId: vals.senderId,
        recipients,
        vars: Object.keys(varsObj).length ? varsObj : undefined,
        note: vals.note,
      });
      setLastResult(result);
      msgApi.success(
        `Campaign dispatched - sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
      );
      setSendOpen(false);
      sendForm.resetFields();
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
              Marketing Campaigns
            </h2>
            <p className="m-0 text-sm text-muted">
              Platform-side credit pool for our own SMS / WhatsApp marketing sends. Separate from
              customer subscription credits - admin tops up manually after paying MSG91 / AiSensy
              directly.
            </p>
          </div>
          <div className="flex gap-2">
            <Button icon={<ReloadOutlined />} onClick={refresh}>
              Refresh
            </Button>
            <Button type="default" icon={<PlusOutlined />} onClick={() => setTopUpOpen(true)}>
              Top Up Pool
            </Button>
            <Button type="primary" icon={<SendOutlined />} onClick={() => setSendOpen(true)}>
              Send Campaign
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-blue-200 bg-blue-50/40">
            <Statistic
              title={
                <span className="flex items-center gap-2 font-semibold text-blue-700">
                  <MessageOutlined /> SMS Marketing Pool
                </span>
              }
              value={pools.sms}
              suffix="credits"
            />
            <p className="m-0 mt-2 text-xs text-muted">
              Each marketing SMS consumes 1 credit per segment.
            </p>
          </Card>
          <Card className="rounded-2xl border-green-200 bg-green-50/40">
            <Statistic
              title={
                <span className="flex items-center gap-2 font-semibold text-green-700">
                  <WhatsAppOutlined /> WhatsApp Marketing Pool
                </span>
              }
              value={pools.whatsapp}
              suffix="credits"
            />
            <p className="m-0 mt-2 text-xs text-muted">
              Each marketing conversation = 1 credit per 24h window per peer.
            </p>
          </Card>
        </div>

        {lastResult && (
          <Card className="rounded-2xl border-blue-300 bg-blue-50">
            <p className="m-0 text-blue-700">
              <strong>Last campaign:</strong> attempted={lastResult.attempted} · sent=
              {lastResult.sent} · failed={lastResult.failed} · skipped=
              {lastResult.skipped} ·{' '}
              <code className="text-xs">campaignId={lastResult.campaignId}</code>
            </p>
          </Card>
        )}

        <Card
          className="rounded-2xl"
          title={
            <span className="font-display text-base font-bold">
              <HistoryOutlined className="mr-2" /> Activity
            </span>
          }
        >
          {ledger.length === 0 ? (
            <Empty description="No top-ups or sends yet" />
          ) : (
            <Table
              rowKey="_id"
              dataSource={ledger}
              pagination={{ pageSize: 25 }}
              columns={[
                {
                  title: 'Time',
                  dataIndex: 'createdAt',
                  render: (v: string) => dayjs(v).format('DD MMM HH:mm'),
                },
                {
                  title: 'Channel',
                  dataIndex: 'channel',
                  render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
                },
                {
                  title: 'Type',
                  dataIndex: 'type',
                  render: (v: string) => (
                    <Tag color={v === 'topup' ? 'green' : v === 'send' ? 'blue' : 'orange'}>
                      {v}
                    </Tag>
                  ),
                },
                {
                  title: 'Amount',
                  dataIndex: 'amount',
                  align: 'right',
                  render: (v: number) =>
                    v >= 0 ? (
                      <span className="text-green-700">+{v}</span>
                    ) : (
                      <span className="text-red-700">{v}</span>
                    ),
                },
                {
                  title: 'Balance After',
                  dataIndex: 'balanceAfter',
                  align: 'right',
                },
                {
                  title: 'Ref',
                  dataIndex: 'ref',
                  render: (v?: string) => v ?? '-',
                },
                {
                  title: 'By',
                  dataIndex: 'recordedBy',
                  render: (v: any) =>
                    typeof v === 'object' && v ? (v.name ?? v.email ?? '-') : (v ?? 'system'),
                },
                {
                  title: 'Note',
                  dataIndex: 'note',
                  render: (v?: string) => v ?? '',
                },
              ]}
            />
          )}
        </Card>
      </div>

      {/* Top-up modal */}
      <Modal
        open={topUpOpen}
        onCancel={() => setTopUpOpen(false)}
        title="Top up marketing pool"
        footer={null}
        destroyOnHidden
      >
        <p className="mb-3 text-xs text-muted">
          Record credits added to the marketing pool. Reflects what you purchased on MSG91 /
          AiSensy. No payment is processed here - purely an audit + balance entry.
        </p>
        <Form form={topUpForm} layout="vertical" onFinish={handleTopUp}>
          <Form.Item name="channel" label="Channel" rules={[{ required: true }]} initialValue="sms">
            <Select
              options={[
                { value: 'sms', label: 'SMS' },
                { value: 'whatsapp', label: 'WhatsApp' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="credits"
            label="Credits to add"
            rules={[{ required: true, message: 'Required' }]}
          >
            <InputNumber className="w-full" min={1} step={100} />
          </Form.Item>
          <Form.Item name="ref" label="MSG91 / AiSensy reference (optional)">
            <Input placeholder="e.g. INV-2026-0123" />
          </Form.Item>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setTopUpOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Record Top-Up
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Bulk send modal */}
      <Modal
        open={sendOpen}
        onCancel={() => setSendOpen(false)}
        title="Send marketing campaign"
        footer={null}
        width={620}
        destroyOnHidden
      >
        <p className="mb-3 text-xs text-muted">
          Bulk SMS / WhatsApp send. Each recipient debits 1+ credits from the marketing pool. MSG91
          wallet pre-flight + DLT compliance still apply. Recipients can be comma / space / newline
          separated.
        </p>
        <Form form={sendForm} layout="vertical" onFinish={handleBulkSend}>
          <Form.Item
            name="workspaceId"
            label="Ops workspace ID (for DLT scope)"
            rules={[{ required: true }]}
          >
            <Input placeholder="MongoDB ObjectId of platform-ops workspace" />
          </Form.Item>
          <Form.Item
            name="templateId"
            label="DLT Template ID (MSG91 flow_id)"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g. 64a1b2c3d4..." />
          </Form.Item>
          <Form.Item name="senderId" label="Sender ID (optional override)">
            <Input placeholder="defaults to MSG91_SENDER_ID env" />
          </Form.Item>
          <Form.Item
            name="recipients"
            label="Recipients (comma / space / newline separated)"
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="9876543210, 9123456789&#10;9988776655"
            />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="var1" label="VAR1">
              <Input />
            </Form.Item>
            <Form.Item name="var2" label="VAR2">
              <Input />
            </Form.Item>
            <Form.Item name="var3" label="VAR3">
              <Input />
            </Form.Item>
            <Form.Item name="var4" label="VAR4">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="note" label="Note (optional)">
            <Input placeholder="e.g. Diwali campaign 2026" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SendOutlined />}>
              Send Now
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
