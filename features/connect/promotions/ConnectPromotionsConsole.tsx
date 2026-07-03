'use client';

import { useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Tag,
  Tooltip,
  Alert,
  Space,
  message,
} from 'antd';
import {
  PlusOutlined,
  GiftOutlined,
  TagOutlined,
  EditOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { CouponEditor } from '@/components/admin/billing/CouponEditor';
import { adminListCoupons } from '@/lib/actions';
import type { Coupon } from '@/types';
import { parseApiError } from '@/lib/utils';
import { createCreditDrop, listCreditDrops } from './promotions-admin.actions';
import type { CreditDrop } from './promotions.types';

export interface ConnectPlanOption {
  _id: string;
  name: string;
  tier: string;
}

interface Props {
  initialDrops: CreditDrop[];
  initialCoupons: Coupon[];
  connectPlans: ConnectPlanOption[];
}

type DropTargetChoice = 'all' | 'plan' | 'users';

interface DropFormValues {
  amountPerUser: number;
  note: string;
  target: DropTargetChoice;
  planId?: string;
  userIds?: string[];
  expiresAt?: Dayjs;
}

function formatDiscount(c: Coupon): string {
  if (c.discountType === 'percentage') return `${c.valueOrPaise}% off`;
  if (c.discountType === 'fixed_amount')
    return `₹${(c.valueOrPaise / 100).toLocaleString('en-IN')} off`;
  return `₹${(c.valueOrPaise / 100).toLocaleString('en-IN')} final`;
}

function formatWindow(c: Coupon): string {
  const from = c.validFrom ? dayjs(c.validFrom).format('DD MMM YYYY') : null;
  const until = c.validUntil ? dayjs(c.validUntil).format('DD MMM YYYY') : null;
  if (from && until) return `${from} to ${until}`;
  if (from) return `From ${from}`;
  if (until) return `Until ${until}`;
  return 'Always';
}

export default function ConnectPromotionsConsole({
  initialDrops,
  initialCoupons,
  connectPlans,
}: Props) {
  const [msgApi, ctx] = message.useMessage();

  // ── Credit drops ──────────────────────────────────────────────────
  const [drops, setDrops] = useState<CreditDrop[]>(initialDrops);
  const [dropModalOpen, setDropModalOpen] = useState(false);
  const [savingDrop, setSavingDrop] = useState(false);
  const [dropForm] = Form.useForm<DropFormValues>();
  const targetChoice = Form.useWatch('target', dropForm);

  const connectPlanIds = useMemo(() => connectPlans.map((p) => p._id), [connectPlans]);
  const planName = useMemo(() => {
    const m = new Map(connectPlans.map((p) => [p._id, `${p.name} (${p.tier})`]));
    return (id: string | null) => (id ? (m.get(id) ?? 'a plan') : null);
  }, [connectPlans]);

  const openDropModal = () => {
    dropForm.resetFields();
    dropForm.setFieldsValue({ target: 'all', amountPerUser: 100 });
    setDropModalOpen(true);
  };

  const submitDrop = async (vals: DropFormValues) => {
    setSavingDrop(true);
    try {
      const res = await createCreditDrop({
        amountPerUser: vals.amountPerUser,
        note: vals.note,
        targetMode: vals.target === 'users' ? 'users' : 'subscribers',
        ...(vals.target === 'plan' && vals.planId ? { planId: vals.planId } : {}),
        ...(vals.target === 'users' ? { userIds: vals.userIds ?? [] } : {}),
        ...(vals.expiresAt ? { expiresAt: vals.expiresAt.toISOString() } : {}),
      });
      if (!res.ok) {
        msgApi.error(res.error);
        return;
      }
      msgApi.success(
        `Granted ${res.data.totalCreditsGranted} credits to ${res.data.recipientCount} seller(s)`,
      );
      setDropModalOpen(false);
      const refreshed = await listCreditDrops();
      if (refreshed.ok) setDrops(refreshed.data);
      else setDrops((prev) => [res.data, ...prev]);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingDrop(false);
    }
  };

  const dropColumns: ColumnsType<CreditDrop> = [
    {
      title: 'When',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v?: string) => (v ? dayjs(v).format('DD MMM YYYY, HH:mm') : '-'),
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
    },
    {
      title: 'Per seller',
      dataIndex: 'amountPerUser',
      key: 'amountPerUser',
      render: (v: number) => `${v} credits`,
    },
    {
      title: 'Target',
      key: 'target',
      render: (_, d) =>
        d.targetMode === 'users' ? (
          <Tag color="purple">{d.targetUserIds.length} chosen users</Tag>
        ) : d.planId ? (
          <Tag color="geekblue">{planName(d.planId)}</Tag>
        ) : (
          <Tag color="blue">All subscribers</Tag>
        ),
    },
    {
      title: 'Sellers',
      dataIndex: 'recipientCount',
      key: 'recipientCount',
    },
    {
      title: 'Total credits',
      dataIndex: 'totalCreditsGranted',
      key: 'totalCreditsGranted',
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: 'Expires',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (v: string | null) =>
        v ? dayjs(v).format('DD MMM YYYY') : <span className="text-subtle">No expiry</span>,
    },
  ];

  // ── Coupons (reuse the coupon engine, Connect-scoped) ──────────────
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const refreshCoupons = async () => {
    try {
      const res = await adminListCoupons({ limit: 200 });
      const connectSet = new Set(connectPlanIds);
      const scoped = (res.items ?? []).filter((c) =>
        c.applicablePlanIds.some((id) => connectSet.has(id)),
      );
      setCoupons(scoped);
    } catch {
      // keep the current list on a refresh failure
    }
  };

  const openNewCoupon = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEditCoupon = (c: Coupon) => {
    setEditing(c);
    setEditorOpen(true);
  };

  const couponColumns: ColumnsType<Coupon> = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => <span className="font-mono font-semibold">{v}</span>,
    },
    {
      title: 'Discount',
      key: 'discount',
      render: (_, c) => <Tag color="green">{formatDiscount(c)}</Tag>,
    },
    {
      title: 'Intro offer',
      dataIndex: 'isFirstTimeOnly',
      key: 'isFirstTimeOnly',
      render: (v: boolean) => (v ? <Tag color="gold">First payment</Tag> : '-'),
    },
    {
      title: 'Sale window',
      key: 'window',
      render: (_, c) => formatWindow(c),
    },
    {
      title: 'Used',
      dataIndex: 'redemptionsCount',
      key: 'redemptionsCount',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) =>
        v ? <Tag color="success">Active</Tag> : <Tag color="default">Inactive</Tag>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, c) => (
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          aria-label={`Edit ${c.code}`}
          onClick={() => openEditCoupon(c)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {ctx}

      <header>
        <h1 className="m-0 font-display text-[22px] font-bold text-heading">Promotions & sales</h1>
        <p className="m-0 mt-1.5 text-sm text-subtle">
          Run discounts on Connect plans and drop free boost credits to sellers. Discounts reuse the
          coupon engine; credit drops grant expiring boost credits.
        </p>
      </header>

      {/* Free credit drops */}
      <Card
        title={
          <span className="font-display font-bold">
            <GiftOutlined className="mr-2" />
            Free credit drops
          </span>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openDropModal}>
            New credit drop
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="A drop grants free boost credits to sellers. The credits land in their promotional bucket (spent before any credits they bought) and expire on the date you set, or never if you leave it blank."
        />
        <Table
          rowKey="_id"
          size="middle"
          columns={dropColumns}
          dataSource={drops}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: 'No credit drops yet.' }}
        />
      </Card>

      {/* Discounts & sales (coupons) */}
      <Card
        title={
          <span className="font-display font-bold">
            <TagOutlined className="mr-2" />
            Discounts & sales
          </span>
        }
        extra={
          <Space>
            <Link href="/admin/billing/coupons">
              <Button>Manage all coupons</Button>
            </Link>
            <Button type="primary" icon={<PlusOutlined />} onClick={openNewCoupon}>
              New Connect discount
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message={
            <span>
              An <strong>intro offer</strong> is a coupon with &quot;First-time customers only&quot;
              turned on. A <strong>scheduled sale</strong> is a coupon with a Valid from / Valid
              until window. New discounts here are pre-scoped to your Connect plans.
            </span>
          }
        />
        <Table
          rowKey="_id"
          size="middle"
          columns={couponColumns}
          dataSource={coupons}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{
            emptyText: 'No Connect discounts yet. Create one to run a sale or intro offer.',
          }}
        />
      </Card>

      {/* Credit-drop modal */}
      <Modal
        open={dropModalOpen}
        onCancel={() => setDropModalOpen(false)}
        title={<span className="font-display font-bold">New credit drop</span>}
        onOk={() => dropForm.submit()}
        confirmLoading={savingDrop}
        okText="Grant credits"
        width={560}
        // centered + capped body so the credit-drop form sits mid-screen and
        // scrolls inside the dialog on a short / phone viewport (footer stays put).
        centered
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      >
        <Form form={dropForm} layout="vertical" onFinish={submitDrop} className="mt-4">
          <Form.Item
            name="amountPerUser"
            label={
              <span>
                Credits per seller{' '}
                <Tooltip title="How many free boost credits each targeted seller receives.">
                  <QuestionCircleOutlined className="text-faint" />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: 'Enter an amount' }]}
          >
            <InputNumber className="w-full" min={1} max={1000000} />
          </Form.Item>

          <Form.Item
            name="note"
            label="Campaign note"
            rules={[{ required: true, message: 'Add a short label', max: 280 }]}
          >
            <Input placeholder="e.g. Diwali 2026 seller gift" maxLength={280} />
          </Form.Item>

          <Form.Item name="target" label="Who gets it" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'all', label: 'All Connect subscribers' },
                { value: 'plan', label: 'Subscribers on a specific plan' },
                { value: 'users', label: 'Specific users (by id)' },
              ]}
            />
          </Form.Item>

          {targetChoice === 'plan' && (
            <Form.Item
              name="planId"
              label="Plan"
              rules={[{ required: true, message: 'Pick a plan' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select a Connect plan"
                options={connectPlans.map((p) => ({
                  value: p._id,
                  label: `${p.name} (${p.tier})`,
                }))}
              />
            </Form.Item>
          )}

          {targetChoice === 'users' && (
            <Form.Item
              name="userIds"
              label={
                <span>
                  User ids{' '}
                  <Tooltip title="Paste the Connect user ids to credit. A search-by-name picker is a later enhancement.">
                    <QuestionCircleOutlined className="text-faint" />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: 'Add at least one user id' }]}
            >
              <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="Paste user ids" />
            </Form.Item>
          )}

          <Form.Item
            name="expiresAt"
            label={
              <span>
                Credits expire on{' '}
                <Tooltip title="Leave blank for credits that never expire. A date makes the granted credits expire then (unspent credits are cleared).">
                  <QuestionCircleOutlined className="text-faint" />
                </Tooltip>
              </span>
            }
          >
            <DatePicker className="w-full" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
        </Form>
      </Modal>

      <CouponEditor
        open={editorOpen}
        coupon={editing}
        defaultPlanIds={connectPlanIds}
        onCancel={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          void refreshCoupons();
        }}
      />
    </div>
  );
}
