'use client';

/**
 * Wave 8.2 - admin MSG91 / AiSensy cost-table editor.
 *
 * Versioned: edits insert a new row + auto-close prior open row. History
 * preserved for monthly invoice reconciliation.
 */

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import {
  Card,
  Table,
  Tabs,
  Button,
  Tag,
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  message,
  Empty,
  Switch,
} from 'antd';
import { PlusOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  listMsg91Pricing,
  addMsg91PricingRow,
  closeMsg91PricingRow,
  getAddOnDefinitions,
  type Msg91PricingRow,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { AddOnDefinition } from '@/types';

export default function AdminMsg91PricingPage() {
  const [rows, setRows] = useState<Msg91PricingRow[]>([]);
  const [packs, setPacks] = useState<AddOnDefinition[]>([]);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [r, p] = await Promise.all([
        listMsg91Pricing(includeHistory).catch(() => []),
        getAddOnDefinitions().catch(() => []),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setPacks(Array.isArray(p) ? p.filter((x) => (x as any).type === 'credit_pack') : []);
    } finally {
      setLoading(false);
    }
  }, [includeHistory]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async (vals: any) => {
    setSaving(true);
    try {
      await addMsg91PricingRow({
        provider: vals.provider,
        channel: vals.channel,
        encoding: vals.encoding,
        segments: vals.segments,
        costPaise: Math.round(vals.costRupees * 100),
        country: vals.country || 'IN',
        note: vals.note,
      });
      msgApi.success('Pricing row added (prior row closed)');
      setAddOpen(false);
      form.resetFields();
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (id: string) => {
    try {
      await closeMsg91PricingRow(id);
      msgApi.success('Row closed');
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const activeSmsGsm71 = useMemo(
    () =>
      rows.find(
        (r) =>
          r.channel === 'sms' &&
          r.encoding === 'GSM7' &&
          r.segments === 1 &&
          r.effectiveTo === null,
      ),
    [rows],
  );
  const activeWaConv = useMemo(
    () => rows.find((r) => r.channel === 'whatsapp' && r.effectiveTo === null),
    [rows],
  );

  const marginRows = useMemo(() => {
    if (!activeSmsGsm71 && !activeWaConv) return [];
    return packs.map((p) => {
      const credits =
        (p.entitlementDelta as any)?.creditsDelta?.sms ??
        (p.entitlementDelta as any)?.creditsDelta?.whatsapp ??
        0;
      const isSms = ((p.entitlementDelta as any)?.creditsDelta?.sms ?? 0) > 0;
      const wholesalePerCreditPaise = isSms
        ? (activeSmsGsm71?.costPaise ?? 0)
        : (activeWaConv?.costPaise ?? 0);
      const retailPaise = (p.lifetimePrice ?? 0) * 100;
      const wholesaleTotalPaise = wholesalePerCreditPaise * credits;
      const marginPaise = retailPaise - wholesaleTotalPaise;
      const marginPct = retailPaise > 0 ? (marginPaise / retailPaise) * 100 : 0;
      return {
        slug: p.slug,
        name: p.name,
        channel: isSms ? 'sms' : 'whatsapp',
        credits,
        retailRupees: retailPaise / 100,
        wholesalePerCreditRupees: wholesalePerCreditPaise / 100,
        wholesaleTotalRupees: wholesaleTotalPaise / 100,
        marginPct,
      };
    });
  }, [packs, activeSmsGsm71, activeWaConv]);

  const marginColor = (pct: number): string => (pct >= 35 ? 'green' : pct >= 20 ? 'orange' : 'red');

  return (
    <>
      {ctx}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
              MSG91 / AiSensy Pricing
            </h2>
            <p className="m-0 text-sm text-muted">
              Wholesale per-segment cost. Versioned - edits insert a new row + auto-close prior.
              History preserved for monthly invoice reconciliation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">Show history</span>
            <Switch
              checked={includeHistory}
              onChange={setIncludeHistory}
              aria-label="Show pricing history"
            />
            <Button icon={<ReloadOutlined />} onClick={refresh}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Add Pricing Row
            </Button>
          </div>
        </div>

        <Tabs
          items={[
            {
              key: 'rows',
              label: 'Pricing Rows',
              children: (
                <Card className="rounded-2xl">
                  <Table
                    rowKey="_id"
                    loading={loading}
                    dataSource={rows}
                    pagination={{ pageSize: 25 }}
                    locale={{
                      emptyText: (
                        <Empty description="No rows yet - seed defaults via boot or click Add" />
                      ),
                    }}
                    columns={[
                      {
                        title: 'Provider',
                        dataIndex: 'provider',
                        render: (v: string) => (
                          <Tag color={v === 'msg91' ? 'blue' : 'green'}>{v}</Tag>
                        ),
                      },
                      {
                        title: 'Channel',
                        dataIndex: 'channel',
                        render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
                      },
                      { title: 'Country', dataIndex: 'country' },
                      {
                        title: 'Encoding × Segments',
                        render: (_v, r: Msg91PricingRow) => `${r.encoding} × ${r.segments}`,
                      },
                      {
                        title: 'Cost / unit',
                        dataIndex: 'costPaise',
                        align: 'right',
                        render: (v: number) => `₹${(v / 100).toFixed(2)}`,
                      },
                      {
                        title: 'Effective From',
                        dataIndex: 'effectiveFrom',
                        render: (v: string) => dayjs(v).format('DD MMM YY HH:mm'),
                      },
                      {
                        title: 'Effective To',
                        dataIndex: 'effectiveTo',
                        render: (v: string | null) =>
                          v ? dayjs(v).format('DD MMM YY HH:mm') : <Tag color="green">ACTIVE</Tag>,
                      },
                      { title: 'Note', dataIndex: 'note' },
                      {
                        title: <span className="sr-only">Actions</span>,
                        render: (_v, r: Msg91PricingRow) =>
                          r.effectiveTo === null ? (
                            <Button
                              size="small"
                              danger
                              icon={<CloseCircleOutlined />}
                              onClick={() => handleClose(r._id)}
                            >
                              Close
                            </Button>
                          ) : null,
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: 'margins',
              label: 'Pack Margin Snapshot',
              children: (
                <Card className="rounded-2xl">
                  <p className="mb-3 text-xs text-muted">
                    Live margin per credit-pack vs current wholesale cost. Red = below 20% margin,
                    amber 20–35%, green ≥35%. Click &quot;Reprice&quot; to open the pack editor.
                  </p>
                  <Table
                    rowKey="slug"
                    dataSource={marginRows}
                    pagination={false}
                    locale={{
                      emptyText: <Empty description="No active pricing rows yet" />,
                    }}
                    columns={[
                      {
                        title: 'Pack',
                        dataIndex: 'name',
                      },
                      {
                        title: 'Channel',
                        dataIndex: 'channel',
                        render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
                      },
                      {
                        title: 'Credits',
                        dataIndex: 'credits',
                        align: 'right',
                      },
                      {
                        title: 'Retail',
                        dataIndex: 'retailRupees',
                        align: 'right',
                        render: (v: number) => `₹${v.toLocaleString('en-IN')}`,
                      },
                      {
                        title: 'Wholesale',
                        dataIndex: 'wholesaleTotalRupees',
                        align: 'right',
                        render: (v: number) => `₹${v.toLocaleString('en-IN')}`,
                      },
                      {
                        title: 'Margin',
                        dataIndex: 'marginPct',
                        align: 'right',
                        render: (v: number) => <Tag color={marginColor(v)}>{v.toFixed(1)}%</Tag>,
                        sorter: (a, b) => a.marginPct - b.marginPct,
                      },
                      {
                        title: <span className="sr-only">Reprice action</span>,
                        render: () => (
                          <a href="/admin/add-ons" target="_blank" rel="noreferrer">
                            Reprice →
                          </a>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        title="Add pricing row (auto-closes prior open row)"
        footer={null}
        destroyOnHidden
      >
        <p className="mb-3 text-xs text-muted">
          Insert a new versioned row. Any open row matching the same (provider, channel, country,
          encoding, segments) tuple is automatically closed via <code>effectiveTo = now</code>.
        </p>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAdd}
          initialValues={{
            provider: 'msg91',
            channel: 'sms',
            encoding: 'GSM7',
            segments: 1,
            country: 'IN',
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'msg91', label: 'MSG91 (SMS)' },
                  { value: 'aisensy', label: 'AiSensy (WhatsApp)' },
                ]}
              />
            </Form.Item>
            <Form.Item name="channel" label="Channel" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'sms', label: 'SMS' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                ]}
              />
            </Form.Item>
            <Form.Item name="encoding" label="Encoding" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'GSM7', label: 'GSM-7 (English)' },
                  { value: 'UCS2', label: 'UCS-2 (Hindi/emoji)' },
                  { value: 'N/A', label: 'N/A (WhatsApp)' },
                ]}
              />
            </Form.Item>
            <Form.Item name="segments" label="Segments" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={1} max={10} />
            </Form.Item>
            <Form.Item name="costRupees" label="Cost per unit (₹)" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={0} step={0.01} prefix="₹" />
            </Form.Item>
            <Form.Item name="country" label="Country (ISO-2)">
              <Input placeholder="IN" />
            </Form.Item>
          </div>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={2} placeholder="e.g. MSG91 Q3 rate hike" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Add Row
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
