'use client';
import { useEffect, useState, useCallback, startTransition } from 'react';
import {
  Card,
  Table,
  Tag,
  Avatar,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  Space,
  message,
  Input,
  Dropdown,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import {
  EditOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  FileAddOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  getAdminSubscriptions,
  adminUpdateSubscription,
  adminRevokeSubscription,
  getAdminPlans,
  getTiers,
  adminPauseSubscription,
  adminResumeSubscription,
  adminForceCancelSubscription,
} from '@/lib/actions';
import type { Subscription, Plan, Tier, PlanEntitlements, User } from '@/types';
import { getInitials, avatarColor, fmt, parseApiError } from '@/lib/utils';
import {
  ModuleAccessEditor,
  getDefaultModuleAccessEntries,
} from '@/components/admin/module-access-editor';
import { getTierColor, SUBSCRIPTION_STATUS_COLORS } from '@/lib/utils/subscription.utils';
import {
  RevokeSubscriptionModal,
  type RevokeSubscriptionParams,
} from '@/components/admin/revoke-subscription-modal';
import { EntitlementsFormFields } from '@/components/admin/entitlements-form-fields';
import { DsCardTitle } from '@/components/ui';
import { GrantSubscriptionModal } from '@/components/admin/billing/GrantSubscriptionModal';
import { ExtendPeriodModal } from '@/components/admin/billing/ExtendPeriodModal';
import { EntitlementsOverrideModal } from '@/components/admin/billing/EntitlementsOverrideModal';
import { ManualPaymentModal } from '@/components/admin/billing/ManualPaymentModal';
import { MandateAdminPanel } from '@/components/admin/billing/MandateAdminPanel';
import { Drawer } from 'antd';

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [msgApi, ctx] = message.useMessage();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    getTiers()
      .then(setTiers)
      .catch(() => {});
  }, []);
  const [moduleAccess, setModuleAccess] = useState(getDefaultModuleAccessEntries());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await getAdminSubscriptions({ page, limit: 20 });
      let data = res.data ?? [];
      if (statusFilter) {
        data = data.filter((s: Subscription) => s.status === statusFilter);
      }
      if (sourceFilter) {
        data = data.filter((s: Subscription) => s.source === sourceFilter);
      }
      setSubs(data);
      setTotal(res.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sourceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    const currentEntitlements = sub.appliedEntitlements || {
      maxWorkspaces: 1,
      maxMembersPerWorkspace: 5,
      maxTotalMembers: 5,
      modules: [],
      features: {},
      moduleAccess: getDefaultModuleAccessEntries(),
    };
    form.setFieldsValue({
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd ? dayjs(sub.currentPeriodEnd) : null,
      maxWorkspaces: currentEntitlements.maxWorkspaces,
      maxMembersPerWorkspace: currentEntitlements.maxMembersPerWorkspace,
      maxTotalMembers: currentEntitlements.maxTotalMembers,
      note: sub.assignmentNote || '',
    });
    setModuleAccess(currentEntitlements.moduleAccess || getDefaultModuleAccessEntries());
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingSub) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const entitlements: PlanEntitlements = {
        maxWorkspaces: values.maxWorkspaces,
        maxMembersPerWorkspace: values.maxMembersPerWorkspace,
        maxTotalMembers: values.maxTotalMembers,
        modules: [],
        features: {
          export: false,
          apiAccess: false,
          advancedRbac: false,
          customRoles: false,
          shifts: false,
          bills: false,
        },
        moduleAccess,
      };
      await adminUpdateSubscription(editingSub._id, {
        status: values.status,
        currentPeriodEnd: values.currentPeriodEnd?.toISOString(),
        entitlements,
        note: values.note,
      });
      msgApi.success('Subscription updated');
      setEditModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeSubId, setRevokeSubId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  // D3 - admin billing modals
  const [grantOpen, setGrantOpen] = useState(false);
  const [extendSub, setExtendSub] = useState<Subscription | null>(null);
  const [overrideSub, setOverrideSub] = useState<Subscription | null>(null);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [mandateDrawerSub, setMandateDrawerSub] = useState<Subscription | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const handlePause = async (sub: Subscription) => {
    setActionBusy(sub._id);
    try {
      await adminPauseSubscription(sub._id);
      msgApi.success('Subscription paused');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setActionBusy(null);
    }
  };

  const handleResume = async (sub: Subscription) => {
    setActionBusy(sub._id);
    try {
      await adminResumeSubscription(sub._id);
      msgApi.success('Subscription resumed');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setActionBusy(null);
    }
  };

  const handleForceCancel = async (sub: Subscription, immediate: boolean) => {
    setActionBusy(sub._id);
    try {
      await adminForceCancelSubscription(sub._id, {
        reason: immediate ? 'Admin force-cancel (immediate)' : 'Admin force-cancel (at cycle end)',
        immediate,
      });
      msgApi.success(immediate ? 'Subscription cancelled immediately' : 'Cancellation scheduled');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setActionBusy(null);
    }
  };

  const openRevokeModal = async (id: string) => {
    setRevokeSubId(id);
    setRevokeModalOpen(true);
    try {
      const p = await getAdminPlans();
      setPlans(p.filter((pl: Plan) => pl.isActive));
    } catch {}
  };

  const handleRevoke = async (params: RevokeSubscriptionParams) => {
    if (!revokeSubId) return;
    try {
      const res = await adminRevokeSubscription(revokeSubId, params);
      msgApi.success(res.message);
      setRevokeModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const columns: ColumnsType<Subscription> = [
    {
      title: 'User',
      key: 'user',
      width: 220,
      render: (_, s) => {
        const u = typeof s.userId === 'object' ? (s.userId as User) : null;
        const name = u?.name ?? 'Unknown';
        return (
          <div className="flex items-center gap-2.5">
            <Avatar
              size={32}
              className="text-[11px] font-bold"
              style={{ background: avatarColor(name) }}
            >
              {getInitials(name)}
            </Avatar>
            <div>
              <p className="m-0 text-[13px] font-semibold">{name}</p>
              <p className="m-0 text-[11px] text-subtle">{u?.email ?? '-'}</p>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Plan',
      key: 'plan',
      width: 120,
      render: (_, s) => {
        const plan = s.planId;
        const name = typeof plan === 'object' ? plan?.name : plan;
        const tier = typeof plan === 'object' ? plan?.tier : '';
        return <Tag color={getTierColor(tiers, tier)}>{name ?? '-'}</Tag>;
      },
    },
    {
      title: 'Source',
      key: 'source',
      width: 90,
      render: (_, s) => (
        <Tag color={s.source === 'admin' ? 'gold' : 'blue'}>{s.source || 'self'}</Tag>
      ),
    },
    {
      title: 'Assigned By',
      key: 'assignedBy',
      width: 120,
      render: (_, s) =>
        s.assignedBy ? (typeof s.assignedBy === 'object' ? s.assignedBy.name : 'Admin') : '-',
    },
    {
      title: 'Billing',
      dataIndex: 'billingCycle',
      key: 'billing',
      width: 90,
      render: (v) => (
        <Tag color="blue" className="capitalize">
          {v}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => (
        <Tag color={SUBSCRIPTION_STATUS_COLORS[v] ?? 'default'} className="capitalize">
          {v}
        </Tag>
      ),
    },
    {
      title: 'Starts',
      dataIndex: 'currentPeriodStart',
      key: 'start',
      width: 110,
      render: (v) => fmt(v),
    },
    {
      title: 'Expires',
      dataIndex: 'currentPeriodEnd',
      key: 'end',
      width: 110,
      render: (v) => fmt(v),
    },
    {
      title: 'Cancelled',
      dataIndex: 'cancelledAt',
      key: 'cancelled',
      width: 110,
      render: (v) => (v ? fmt(v) : '-'),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, s: Subscription) => {
        const isPaused = s.status === 'paused' || s.isPaused;
        const isCancelled = s.status === 'cancelled' || s.status === 'expired';
        const hasMandate = !!s.razorpaySubscriptionId;
        const items: MenuProps['items'] = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Edit (legacy)',
            onClick: () => openEditModal(s),
          },
          {
            key: 'extend',
            icon: <ClockCircleOutlined />,
            label: 'Extend period…',
            onClick: () => setExtendSub(s),
            disabled: isCancelled,
          },
          {
            key: 'override',
            icon: <ApiOutlined />,
            label: 'Override entitlements…',
            onClick: () => setOverrideSub(s),
          },
          { type: 'divider' as const },
          isPaused
            ? {
                key: 'resume',
                icon: <PlayCircleOutlined />,
                label: 'Resume',
                onClick: () => handleResume(s),
                disabled: isCancelled,
              }
            : {
                key: 'pause',
                icon: <PauseCircleOutlined />,
                label: 'Pause',
                onClick: () => handlePause(s),
                disabled: isCancelled,
              },
          ...(hasMandate
            ? [
                {
                  key: 'mandate',
                  icon: <ThunderboltOutlined />,
                  label: 'Mandate controls…',
                  onClick: () => setMandateDrawerSub(s),
                },
              ]
            : []),
          { type: 'divider' as const },
          {
            key: 'forceCancelEnd',
            icon: <StopOutlined />,
            label: 'Force cancel (cycle end)',
            disabled: isCancelled,
            onClick: () => handleForceCancel(s, false),
          },
          {
            key: 'forceCancelNow',
            icon: <StopOutlined />,
            label: 'Force cancel NOW',
            danger: true,
            disabled: isCancelled,
            onClick: () => handleForceCancel(s, true),
          },
          {
            key: 'revoke',
            icon: <StopOutlined />,
            label: 'Revoke (with replacement)…',
            onClick: () => openRevokeModal(s._id),
          },
        ];
        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreOutlined />} loading={actionBusy === s._id}>
              Actions
            </Button>
          </Dropdown>
        );
      },
    },
  ];

  return (
    <>
      {ctx}
      <Card
        title={<DsCardTitle>All Subscriptions</DsCardTitle>}
        extra={
          <Space>
            <Select
              aria-label="Filter by status"
              placeholder="Filter by status"
              allowClear
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              className="w-36"
            >
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
              <Select.Option value="expired">Expired</Select.Option>
              <Select.Option value="trial">Trial</Select.Option>
              <Select.Option value="paused">Paused</Select.Option>
              <Select.Option value="grace_period">Grace period</Select.Option>
              <Select.Option value="past_due">Past due</Select.Option>
              <Select.Option value="superseded">Superseded</Select.Option>
            </Select>
            <Select
              aria-label="Filter by source"
              placeholder="Filter by source"
              allowClear
              value={sourceFilter}
              onChange={(v) => {
                setSourceFilter(v);
                setPage(1);
              }}
              className="w-32"
            >
              <Select.Option value="self">Self</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="manual_payment">Manual</Select.Option>
              <Select.Option value="paid_link">Paid link</Select.Option>
              <Select.Option value="trial">Trial</Select.Option>
            </Select>
            <Button icon={<FileAddOutlined />} onClick={() => setManualPaymentOpen(true)}>
              Manual Payment
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setGrantOpen(true)}>
              Grant Subscription
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={subs}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1100 }}
          size="middle"
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} subscriptions`,
            showSizeChanger: false,
          }}
        />
      </Card>

      <Modal
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        title={<span className="font-display font-bold">Edit Subscription</span>}
        onOk={handleEditSubmit}
        confirmLoading={saving}
        width={680}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="status" label="Status">
              <Select>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="cancelled">Cancelled</Select.Option>
                <Select.Option value="expired">Expired</Select.Option>
                <Select.Option value="trial">Trial</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="currentPeriodEnd" label="End Date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <EntitlementsFormFields mode="select" />

          <div className="mb-4">
            <p className="mb-2 font-semibold">Module Access:</p>
            <ModuleAccessEditor moduleAccess={moduleAccess} onChange={setModuleAccess} />
          </div>

          <Form.Item name="note" label="Admin Note">
            <Input.TextArea rows={2} placeholder="Reason for update..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Revoke Subscription Modal */}
      <RevokeSubscriptionModal
        open={revokeModalOpen}
        onCancel={() => setRevokeModalOpen(false)}
        onConfirm={handleRevoke}
        plans={plans}
        title="Force Cancel Subscription"
        okText="Confirm Revoke"
      />

      {/* D3 - billing admin modals */}
      <GrantSubscriptionModal
        open={grantOpen}
        onCancel={() => setGrantOpen(false)}
        onGranted={() => {
          setGrantOpen(false);
          load();
        }}
      />
      <ExtendPeriodModal
        open={!!extendSub}
        subscription={extendSub}
        onCancel={() => setExtendSub(null)}
        onExtended={() => {
          setExtendSub(null);
          load();
        }}
      />
      <EntitlementsOverrideModal
        open={!!overrideSub}
        subscription={overrideSub}
        onCancel={() => setOverrideSub(null)}
        onSaved={() => {
          setOverrideSub(null);
          load();
        }}
      />
      <ManualPaymentModal
        open={manualPaymentOpen}
        onCancel={() => setManualPaymentOpen(false)}
        onRecorded={() => {
          setManualPaymentOpen(false);
          load();
        }}
      />
      <Drawer
        open={!!mandateDrawerSub}
        onClose={() => setMandateDrawerSub(null)}
        title="Mandate Controls"
        width={480}
      >
        {mandateDrawerSub && (
          <MandateAdminPanel
            userId={
              typeof mandateDrawerSub.userId === 'string'
                ? mandateDrawerSub.userId
                : (mandateDrawerSub.userId as { _id: string })._id
            }
            subscription={mandateDrawerSub}
            onChanged={() => {
              setMandateDrawerSub(null);
              load();
            }}
          />
        )}
      </Drawer>
    </>
  );
}
