'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Input,
  Button,
  Tag,
  Avatar,
  Space,
  Popconfirm,
  message,
  Tooltip,
  Modal,
  Form,
  Alert,
  Drawer,
  Descriptions,
  Checkbox,
  Divider,
  Dropdown,
  Collapse,
  Segmented,
  App,
} from 'antd';
import {
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  CrownOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  getAdminUsers,
  updateUserStatus,
  deleteAdminUser,
  eraseAdminUser,
  restoreAdminUser,
  createAdminUser,
  getAdminPlans,
  adminCancelSubscription,
  adminRevokeSubscription,
  getAdminUserDetails,
  getAdminUserSubscription,
  getUserSubscriptionHistory,
  getTiers,
  getAddOnDefinitions,
  adminAssignAddOn,
  adminAssignDefaultPlan,
  adminAssignDefaultPlanToMissing,
} from '@/lib/actions';
import { getInitials, avatarColor, parseApiError, fmt } from '@/lib/utils';
import { DsCardTitle } from '@/components/ui';
import {
  getTierColor,
  SUBSCRIPTION_STATUS_COLORS,
  isTierAtOrAbove,
} from '@/lib/utils/subscription.utils';
import {
  RevokeSubscriptionModal,
  type RevokeSubscriptionParams,
} from '@/components/admin/revoke-subscription-modal';
import { EntitlementsDisplay } from '@/components/admin/entitlements-display';
import { ManagePlansDrawer } from '@/features/admin/users/ManagePlansDrawer';
import type {
  AdminUserWithSubscription,
  Plan,
  Tier,
  AdminUserDetails,
  Subscription,
} from '@/types';
import { UserSessionsSection } from '@/components/admin/user-sessions-section';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserWithSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  // Mirror of includeDeleted for seeded demo/sample accounts (BE User.isDemo).
  // Off by default so demo rows stay hidden; toggling re-fetches with includeDemo.
  const [includeDemo, setIncludeDemo] = useState(false);
  // Product-line filter for the table (All / ERP / Connect / Both). Passed to
  // getAdminUsers; resets to page 1 on change so the count stays consistent.
  const [product, setProduct] = useState<'all' | 'erp' | 'connect' | 'both'>('all');
  const [msgApi, ctx] = message.useMessage();
  // Context-aware modal instance (App.useApp) so confirm dialogs inherit the
  // dynamic theme. The static Modal.confirm cannot read theme context and warns.
  const { modal } = App.useApp();
  // Unified Manage Plans drawer (ERP + Connect for one person).
  const [managePlansOpen, setManagePlansOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserWithSubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<AdminUserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [subHistory, setSubHistory] = useState<Subscription[]>([]);
  const [loadingSubHistory, setLoadingSubHistory] = useState(false);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [createUserSaving, setCreateUserSaving] = useState(false);
  // Bulk "assign default plan to everyone without a plan" backfill in flight.
  const [assignDefaultAllLoading, setAssignDefaultAllLoading] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Force Cancel state
  const [forceCancelOpen, setForceCancelOpen] = useState(false);
  const [forceCancelSubId, setForceCancelSubId] = useState<string | null>(null);

  // Deactivation modal state
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<AdminUserWithSubscription | null>(null);
  const [deactivationNote, setDeactivationNote] = useState('');

  // Add-ons state
  const [availableAddOns, setAvailableAddOns] = useState<any[]>([]);
  const [addOnModalOpen, setAddOnModalOpen] = useState(false);
  const [selectedAddOn, setSelectedAddOn] = useState<any>(null);
  const [assigningAddOn, setAssigningAddOn] = useState(false);
  const [deactivationLoading, setDeactivationLoading] = useState(false);

  const openDeactivateModal = (user: AdminUserWithSubscription) => {
    setDeactivatingUser(user);
    setDeactivationNote('');
    setDeactivateModalOpen(true);
  };

  const handleDeactivate = async () => {
    if (!deactivatingUser) return;
    if (deactivationNote.length < 10) {
      msgApi.error('Please provide a reason (minimum 10 characters)');
      return;
    }
    setDeactivationLoading(true);
    try {
      await updateUserStatus(deactivatingUser._id, { isActive: false, note: deactivationNote });
      msgApi.success('User deactivated');
      setDeactivateModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setDeactivationLoading(false);
    }
  };

  const openCancel = async (u: AdminUserWithSubscription) => {
    setCancelNote('');
    setCancelModalOpen(true);
    try {
      const sub = await getAdminUserSubscription(u._id);
      setCancelSubId(sub?._id ?? null);
      if (!sub) {
        msgApi.warning('User has no active subscription');
        setCancelModalOpen(false);
      }
    } catch {
      setCancelModalOpen(false);
      msgApi.error('Failed to fetch subscription');
    }
  };

  const handleCancel = async () => {
    if (!cancelSubId) return;
    setCancelLoading(true);
    try {
      const res = await adminCancelSubscription(cancelSubId, {
        note: cancelNote || undefined,
      });
      msgApi.success(res.message);
      setCancelModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setCancelLoading(false);
    }
  };

  const openForceCancel = async (u: AdminUserWithSubscription) => {
    setForceCancelOpen(true);
    try {
      const sub = await getAdminUserSubscription(u._id);
      setForceCancelSubId(sub?._id ?? null);
      if (!sub) {
        msgApi.warning('User has no active subscription');
        setForceCancelOpen(false);
      }
    } catch {
      setForceCancelOpen(false);
      msgApi.error('Failed to fetch subscription');
    }
    try {
      const p = await getAdminPlans();
      setPlans(p.filter((pl: Plan) => pl.isActive));
    } catch {}
  };

  const handleForceCancel = async (params: RevokeSubscriptionParams) => {
    if (!forceCancelSubId) return;
    try {
      const res = await adminRevokeSubscription(forceCancelSubId, params);
      msgApi.success(res.message);
      setForceCancelOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminUsers({
        page,
        limit: 20,
        search: search || undefined,
        includeDeleted,
        includeDemo,
        product,
      });
      setUsers(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [page, search, includeDeleted, includeDemo, product, msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPlans = useCallback(async () => {
    try {
      const [plansRes, tiersRes] = await Promise.all([getAdminPlans(), getTiers()]);
      setPlans(Array.isArray(plansRes) ? plansRes : []);
      setTiers(Array.isArray(tiersRes) ? tiersRes : []);
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  }, [msgApi]);

  const toggleActive = async (id: string, isActive: boolean) => {
    if (isActive) {
      const user = users.find((u) => u._id === id);
      if (user) openDeactivateModal(user);
    } else {
      try {
        await updateUserStatus(id, { isActive: true });
        msgApi.success('User activated');
        load();
      } catch (e) {
        msgApi.error(parseApiError(e));
      }
    }
  };

  const handleDelete = async (id: string, permanent: boolean = false) => {
    try {
      await deleteAdminUser(id, permanent);
      msgApi.success(permanent ? 'User permanently deleted' : 'User soft deleted');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  // Complete, irreversible DPDP erase (Connect purge + identity scrub + vendor
  // file delete; statutory records retained). Replaces the legacy permanent
  // hard-delete, which left most data orphaned.
  const handleErase = async (id: string) => {
    try {
      await eraseAdminUser(id);
      msgApi.success("User's data erased");
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreAdminUser(id);
      msgApi.success('User restored');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  // Assign the configured default ERP plan to ONE user with no ERP plan
  // (row action). Idempotent server-side; a user who already has a plan returns
  // assigned:false, surfaced as an info message. Calls adminAssignDefaultPlan.
  const handleAssignDefaultPlan = async (u: AdminUserWithSubscription) => {
    try {
      const res = await adminAssignDefaultPlan(u._id);
      if (res.assigned) {
        msgApi.success(
          res.planName ? `Assigned default plan: ${res.planName}` : 'Default plan assigned',
        );
      } else {
        msgApi.info('User already has an active plan — nothing to assign');
      }
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  // Bulk backfill: assign the default ERP plan to every user without an active
  // plan. Confirmed via the App.useApp modal. Calls adminAssignDefaultPlanToMissing and
  // reports assigned/skipped/failed/total. The backfill isolates per-user errors,
  // so `failed` can be > 0 even on a successful pass; surface it when it is.
  // Safe to re-run.
  const handleAssignDefaultToAll = () => {
    modal.confirm({
      title: 'Assign default plan to all users without a plan?',
      content:
        'This assigns the configured default ERP plan to every user who currently has no active plan. Users who already have a plan are left unchanged. This is safe to re-run.',
      okText: 'Assign to all',
      cancelText: 'Cancel',
      onOk: async () => {
        setAssignDefaultAllLoading(true);
        try {
          const res = await adminAssignDefaultPlanToMissing();
          const failedNote = res.failed > 0 ? `, failed ${res.failed}` : '';
          msgApi.success(
            `Done — assigned ${res.assigned}, skipped ${res.skipped}${failedNote} of ${res.total} user(s)`,
          );
          load();
        } catch (e) {
          msgApi.error(parseApiError(e));
        } finally {
          setAssignDefaultAllLoading(false);
        }
      },
    });
  };

  const handleCreateUser = async (values: {
    name: string;
    email?: string;
    mobile?: string;
    password: string;
    isActive: boolean;
    isAdmin: boolean;
    isEmailVerified: boolean;
    workspaceName: string;
    workspaceBusinessType?: string;
  }) => {
    try {
      setCreateUserSaving(true);
      await createAdminUser({
        ...values,
        createWorkspace: true,
      });
      msgApi.success('User created successfully');
      setCreateUserModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setCreateUserSaving(false);
    }
  };

  // Open the unified Manage Plans drawer for a person. Loads plans + tiers once
  // (the drawer needs both lists for the ERP + Connect package pickers).
  const openManagePlans = async (user: AdminUserWithSubscription) => {
    setSelectedUser(user);
    await loadPlans();
    setManagePlansOpen(true);
  };

  const openDetailsDrawer = async (user: AdminUserWithSubscription) => {
    setDetailsDrawerOpen(true);
    setLoadingDetails(true);
    setLoadingSubHistory(true);
    try {
      const [details, history] = await Promise.all([
        getAdminUserDetails(user._id),
        getUserSubscriptionHistory(user._id),
      ]);
      setUserDetails(details);
      setSubHistory(history || []);
    } catch (e) {
      msgApi.error(parseApiError(e));
      setDetailsDrawerOpen(false);
    } finally {
      setLoadingDetails(false);
      setLoadingSubHistory(false);
    }
  };

  const columns: ColumnsType<AdminUserWithSubscription> = [
    {
      title: 'User',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 220,
      render: (name, u) => (
        <div className="flex items-center gap-2.5">
          <Avatar size={34} className="text-xs font-bold" style={{ background: avatarColor(name) }}>
            {getInitials(name)}
          </Avatar>
          <div>
            <p className="m-0 text-[13px] font-semibold">
              {name} {u.deletedAt && <Tag color="red">Deleted</Tag>}
              {u.isDemo && <Tag color="purple">Demo</Tag>}
            </p>
            <p className="m-0 text-[11px] text-subtle">{u.email ?? u.mobile ?? '-'}</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Workspaces',
      dataIndex: 'workspaceCount',
      key: 'ws',
      width: 120,
      align: 'center',
      render: (count, u) => {
        if (u.deletedAt) return <Tag color="default">-</Tag>;
        const workspaceCount = count as number;
        if (!workspaceCount || workspaceCount === 0)
          return <Tag color="default">No workspaces</Tag>;
        return (
          <Tag color="blue">
            {workspaceCount} {workspaceCount === 1 ? 'workspace' : 'workspaces'}
          </Tag>
        );
      },
    },
    {
      // Which product lines this person is in (ERP = workspace plan, Connect =
      // person-centric network). A person may be in both at once.
      title: 'Products',
      key: 'products',
      width: 140,
      align: 'center',
      render: (_, u) => {
        if (u.deletedAt) return <Tag color="default">-</Tag>;
        if (!u.isErpUser && !u.isConnectUser) return <Tag color="default">None</Tag>;
        return (
          <Space size={4}>
            {u.isErpUser && <Tag color="blue">ERP</Tag>}
            {u.isConnectUser && <Tag color="geekblue">Connect</Tag>}
          </Space>
        );
      },
    },
    {
      // ERP (business / workspace) plan summary.
      title: 'ERP plan',
      key: 'erpPlan',
      width: 130,
      align: 'center',
      render: (_, u) => {
        if (u.deletedAt) return <Tag color="default">-</Tag>;
        const sub = u.erpSubscription;
        if (!sub || !sub.planName) return <span className="text-subtle">—</span>;
        const tier = sub.planTier || 'free';
        // Premium-mid+ check via dynamic tier.displayOrder (admin-defined hierarchy).
        const isProOrAbove = isTierAtOrAbove(tiers, tier, 'growth');
        const isStarter = isTierAtOrAbove(tiers, tier, 'starter') && !isProOrAbove;
        // Opt-in trial users sit on the Free/default plan with status:'trial',
        // so the plan name alone reads as "Free" with no hint they are trialing.
        // Surface a "Trial" tag + end date (from the BE summary) so the owner
        // can spot them at a glance. trialEndsAt is null when not on a trial.
        const isTrial = sub.status === 'trial';
        return (
          <div className="flex flex-col items-center gap-0.5">
            <Space size={4}>
              <Tag color={isProOrAbove ? 'gold' : isStarter ? 'blue' : 'default'}>
                {sub.planName}
              </Tag>
              {isTrial && <Tag color="gold">Trial</Tag>}
            </Space>
            {isTrial && sub.trialEndsAt && (
              <span className="text-[10px] text-subtle">
                ends {new Date(sub.trialEndsAt).toLocaleDateString()}
              </span>
            )}
          </div>
        );
      },
    },
    {
      // Connect plan summary. A Connect user with no paid Connect plan is on the
      // free tier; everyone else with no Connect membership shows a dash.
      title: 'Connect',
      key: 'connectPlan',
      width: 130,
      align: 'center',
      render: (_, u) => {
        if (u.deletedAt) return <Tag color="default">-</Tag>;
        const sub = u.connectSubscription;
        if (sub && sub.planName) {
          const isBundle = sub.product === 'bundle';
          return <Tag color={isBundle ? 'gold' : 'geekblue'}>{sub.planName}</Tag>;
        }
        if (u.isConnectUser) return <Tag color="default">Free</Tag>;
        return <span className="text-subtle">—</span>;
      },
    },
    {
      title: 'Email Verified',
      dataIndex: 'isEmailVerified',
      key: 'ev',
      width: 130,
      align: 'center',
      render: (v, u) => {
        if (u.deletedAt) return <Tag color="default">-</Tag>;
        return <Tag color={v ? 'success' : 'warning'}>{v ? '✓ Verified' : 'Unverified'}</Tag>;
      },
    },
    {
      title: 'Sign-in',
      key: 'signin',
      width: 100,
      render: (_, u) => {
        if (u.deletedAt) return <Tag color="default">-</Tag>;
        return (
          <Tag color={u.googleId ? 'blue' : 'default'}>{u.googleId ? 'Google' : 'Password'}</Tag>
        );
      },
    },
    {
      title: 'Admin',
      dataIndex: 'isAdmin',
      key: 'admin',
      width: 80,
      align: 'center',
      render: (v, u) => {
        if (u.deletedAt) return null;
        return v ? <Tag color="gold">Admin</Tag> : null;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'active',
      width: 90,
      align: 'center',
      render: (v, u) => (
        <Tag color={u.deletedAt ? 'red' : v ? 'success' : 'error'}>
          {u.deletedAt ? 'Deleted' : v ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'joined',
      width: 110,
      render: (v, u) => {
        if (u.deletedAt) return <Tag color="default">-</Tag>;
        return fmt(v);
      },
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_, u) => {
        if (u.deletedAt) {
          return (
            <Space size={4}>
              <Tooltip title="Restore">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined className="text-success" />}
                  onClick={() => handleRestore(u._id)}
                />
              </Tooltip>
              <Popconfirm
                title="Erase this user's data?"
                description={
                  <span className="block max-w-[280px] text-[13px]">
                    Permanently removes their profile, posts, messages and files, and anonymizes the
                    account. Statutory pay/attendance records are kept for the legal period. This
                    cannot be undone.
                  </span>
                }
                onConfirm={() => handleErase(u._id)}
                okText="Erase data"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Erase data">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </Space>
          );
        }

        const menuItems: MenuProps['items'] = [
          {
            key: 'view',
            label: 'View Details',
            icon: <EyeOutlined />,
            onClick: () => openDetailsDrawer(u),
          },
          {
            key: 'manage-plan',
            label: 'Manage Plans',
            icon: <CrownOutlined />,
            onClick: () => openManagePlans(u),
          },
        ];

        // Add-ons + cancel/force-cancel act on the ERP (workspace) subscription
        // stack (openCancel/openForceCancel resolve the ERP subscription), so
        // gate them on the ERP plan summary.
        const erpSub = u.erpSubscription;

        // Only offer "Assign default plan" when the user has NO ERP plan — this
        // is the admin-side counterpart to signup auto-assign (gated on
        // !erpSubscription, mirrors the BE skip-if-already-has-plan guard).
        if (!erpSub) {
          menuItems.push({
            key: 'assign-default-plan',
            label: 'Assign default plan',
            icon: <CrownOutlined />,
            onClick: () => handleAssignDefaultPlan(u),
          });
        }

        // Add "Assign Add-On" option for users with active/trial ERP subscription
        if (erpSub && (erpSub.status === 'active' || erpSub.status === 'trial')) {
          menuItems.push({
            key: 'assign-addon',
            label: 'Assign Add-On',
            icon: <PlusOutlined />,
            onClick: async () => {
              setSelectedUser(u);
              try {
                const addons = await getAddOnDefinitions();
                setAvailableAddOns(addons as any);
                setAddOnModalOpen(true);
              } catch (e) {
                msgApi.error('Failed to load add-ons');
              }
            },
          });
        }

        if (erpSub) {
          menuItems.push(
            {
              type: 'divider',
            },
            {
              key: 'cancel',
              label: 'Cancel Subscription',
              icon: <StopOutlined />,
              onClick: () => openCancel(u),
            },
            {
              key: 'force-cancel',
              label: 'Force Cancel Plan',
              icon: <StopOutlined />,
              danger: true,
              onClick: () => openForceCancel(u),
            },
          );
        }

        menuItems.push(
          {
            type: 'divider',
          },
          {
            key: 'toggle-status',
            label: u.isActive ? 'Deactivate User' : 'Activate User',
            icon: u.isActive ? <StopOutlined /> : <CheckCircleOutlined />,
            onClick: () => toggleActive(u._id, u.isActive),
          },
          {
            key: 'delete',
            label: 'Delete User',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDelete(u._id, false),
          },
        );

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <>
      {ctx}
      <Card
        title={<DsCardTitle>All Users</DsCardTitle>}
        extra={
          <Space wrap>
            {/* Product-line filter: All / ERP / Connect / Both. Resets to page 1
                so the total count matches the visible rows. */}
            <Segmented<'all' | 'erp' | 'connect' | 'both'>
              aria-label="Filter by product"
              value={product}
              onChange={(val) => {
                setProduct(val);
                setPage(1);
              }}
              options={[
                { label: 'All', value: 'all' },
                { label: 'ERP', value: 'erp' },
                { label: 'Connect', value: 'connect' },
                { label: 'Both', value: 'both' },
              ]}
            />
            <Checkbox
              checked={includeDeleted}
              onChange={(e) => {
                setIncludeDeleted(e.target.checked);
                setPage(1);
              }}
            >
              Show deleted
            </Checkbox>
            {/* Mirror of "Show deleted": lists seeded demo/sample accounts
                (BE User.isDemo). Off by default; re-fetches with includeDemo. */}
            <Checkbox
              checked={includeDemo}
              onChange={(e) => {
                setIncludeDemo(e.target.checked);
                setPage(1);
              }}
            >
              Show demo accounts
            </Checkbox>
            {/* Bulk backfill: assign the default ERP plan to everyone without an
                active plan (admin-side counterpart to signup auto-assign).
                Confirmed via the App.useApp modal; calls adminAssignDefaultPlanToMissing. */}
            <Button
              icon={<CrownOutlined />}
              loading={assignDefaultAllLoading}
              onClick={handleAssignDefaultToAll}
            >
              Assign default to all without a plan
            </Button>
            <Button type="primary" onClick={() => setCreateUserModalOpen(true)}>
              Create User
            </Button>
            <Input.Search
              aria-label="Search users"
              placeholder="Search users…"
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => {
                setPage(1);
                load();
              }}
              className="w-60"
            />
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1330 }}
          size="middle"
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} users`,
            showSizeChanger: false,
          }}
        />
      </Card>

      <ManagePlansDrawer
        open={managePlansOpen}
        onClose={() => setManagePlansOpen(false)}
        user={selectedUser}
        plans={plans}
        tiers={tiers}
        onRefetch={load}
      />

      <Drawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        title={<span className="font-display font-bold">User Details</span>}
        size="large"
      >
        {loadingDetails ? (
          <div className="flex h-64 items-center justify-center">
            <span>Loading...</span>
          </div>
        ) : userDetails ? (
          <div className="space-y-6">
            {/* User Header */}
            <div className="flex items-center gap-4 border-b pb-4">
              <Avatar
                size={64}
                className="text-xl font-bold"
                style={{ background: avatarColor(userDetails.user.name) }}
              >
                {getInitials(userDetails.user.name)}
              </Avatar>
              <div className="flex-1">
                <h3 className="m-0 text-lg font-semibold">{userDetails.user.name}</h3>
                <p className="m-0 text-sm text-gray-700">
                  {userDetails.user.email || userDetails.user.mobile || '-'}
                </p>
                <Space size={4} className="mt-2">
                  <Tag color={userDetails.user.isActive ? 'success' : 'error'}>
                    {userDetails.user.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                  {userDetails.user.isAdmin && <Tag color="gold">Admin</Tag>}
                  {userDetails.user.googleId && <Tag color="blue">Google</Tag>}
                </Space>
              </div>
            </div>

            {/* Basic Information */}
            <div>
              <h4 className="mb-3 font-semibold">📋 Basic Information</h4>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Email">
                  {userDetails.user.email || '-'}
                  {userDetails.user.email && (
                    <Tag
                      color={userDetails.user.isEmailVerified ? 'success' : 'warning'}
                      className="ml-2"
                    >
                      {userDetails.user.isEmailVerified ? 'Verified' : 'Unverified'}
                    </Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Mobile">
                  {userDetails.user.mobile || '-'}
                  {userDetails.user.mobile && (
                    <Tag
                      color={userDetails.user.isMobileVerified ? 'success' : 'warning'}
                      className="ml-2"
                    >
                      {userDetails.user.isMobileVerified ? 'Verified' : 'Unverified'}
                    </Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Sign-in Method">
                  {userDetails.user.googleId ? 'Google OAuth' : 'Password'}
                </Descriptions.Item>
                <Descriptions.Item label="User ID">
                  <code className="text-xs">{userDetails.user._id}</code>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Workspaces */}
            <div>
              <h4 className="mb-3 font-semibold">🏢 Workspaces ({userDetails.workspaceCount})</h4>
              {userDetails.workspaces.length === 0 ? (
                <Alert title="No workspaces" type="info" showIcon />
              ) : (
                <div className="space-y-2">
                  {userDetails.workspaces.map((ws) => (
                    <Card key={ws._id} size="small" className="bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{ws.name}</span>
                          {ws.role === 'owner' && (
                            <Tag color="gold" className="ml-2">
                              Owner
                            </Tag>
                          )}
                          {ws.role !== 'owner' && <Tag className="ml-2">{ws.role}</Tag>}
                        </div>
                        <Tag color={ws.isActive ? 'success' : 'default'}>
                          {ws.isActive ? 'Active' : 'Inactive'}
                        </Tag>
                      </div>
                      {ws.joinedAt && (
                        <p className="m-0 mt-1 text-xs text-gray-700">Joined: {fmt(ws.joinedAt)}</p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription */}
            <div>
              <h4 className="mb-3 font-semibold">👑 Subscription</h4>
              {!userDetails.subscription ? (
                <Alert title="No active subscription" type="info" showIcon />
              ) : (
                <>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Plan">
                      <Tag color={getTierColor(tiers, userDetails.subscription.planTier)}>
                        {userDetails.subscription.planTier}
                      </Tag>
                      <span className="ml-2">{userDetails.subscription.planName}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag
                        color={userDetails.subscription.status === 'active' ? 'success' : 'warning'}
                      >
                        {userDetails.subscription.status}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Billing Cycle">
                      {userDetails.subscription.billingCycle === 'yearly'
                        ? 'Yearly'
                        : userDetails.subscription.billingCycle === 'lifetime'
                          ? 'Lifetime'
                          : 'Monthly'}
                    </Descriptions.Item>
                    {userDetails.subscription.currentPeriodStart && (
                      <Descriptions.Item label="Period">
                        {fmt(userDetails.subscription.currentPeriodStart)} -{' '}
                        {fmt(userDetails.subscription.currentPeriodEnd)}
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Source">
                      {userDetails.subscription.source === 'admin'
                        ? 'Admin Assigned'
                        : 'Self Purchased'}
                    </Descriptions.Item>
                    {userDetails.subscription.assignedBy && (
                      <Descriptions.Item label="Assigned By">
                        {userDetails.subscription.assignedBy.name}
                        {userDetails.subscription.assignedBy.email && (
                          <span className="ml-1 text-xs text-gray-700">
                            ({userDetails.subscription.assignedBy.email})
                          </span>
                        )}
                      </Descriptions.Item>
                    )}
                    {userDetails.subscription.assignmentNote && (
                      <Descriptions.Item label="Note">
                        {userDetails.subscription.assignmentNote}
                      </Descriptions.Item>
                    )}
                  </Descriptions>

                  {userDetails.subscription.appliedEntitlements && (
                    <Collapse
                      size="small"
                      className="mt-3"
                      items={[
                        {
                          key: 'entitlements',
                          label: 'Entitlements (what this subscription grants)',
                          children: (() => {
                            const ent = userDetails.subscription!.appliedEntitlements!;
                            const purchased = userDetails.subscription!.purchasedEntitlements;
                            const FEATURE_LABELS: Record<string, string> = {
                              export: 'Export',
                              apiAccess: 'API Access',
                              advancedRbac: 'Advanced RBAC',
                              customRoles: 'Custom Roles',
                              shifts: 'Shifts',
                              bills: 'Bills',
                            };
                            const PLATFORM_LABELS: Record<string, string> = {
                              mobile: 'Mobile Only',
                              web: 'Web Only',
                              both: 'Mobile + Web',
                            };
                            const ACCESS_COLORS: Record<string, string> = {
                              full: 'success',
                              limited: 'warning',
                              locked: 'default',
                            };
                            return (
                              <div className="space-y-4">
                                {/* Limits */}
                                <div>
                                  <div className="mb-2 text-xs font-semibold text-gray-700 uppercase">
                                    Limits
                                  </div>
                                  <EntitlementsDisplay
                                    entitlements={ent}
                                    layout="descriptions"
                                    purchased={purchased}
                                  />
                                </div>

                                {/* Platform Access */}
                                {ent.platformAccess && (
                                  <div>
                                    <div className="mb-2 text-xs font-semibold text-gray-700 uppercase">
                                      Platform Access
                                    </div>
                                    <Tag color={ent.platformAccess === 'both' ? 'blue' : 'orange'}>
                                      {PLATFORM_LABELS[ent.platformAccess] ?? ent.platformAccess}
                                    </Tag>
                                  </div>
                                )}

                                {/* Features */}
                                {ent.features && (
                                  <div>
                                    <div className="mb-2 text-xs font-semibold text-gray-700 uppercase">
                                      Features
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(ent.features).map(([key, enabled]) => (
                                        <Tag key={key} color={enabled ? 'success' : 'default'}>
                                          {enabled ? '✓' : '✗'} {FEATURE_LABELS[key] ?? key}
                                        </Tag>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Modules */}
                                {ent.modules && ent.modules.length > 0 && (
                                  <div>
                                    <div className="mb-2 text-xs font-semibold text-gray-700 uppercase">
                                      Enabled Modules
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {ent.modules.map((mod) => (
                                        <Tag key={mod} color="processing">
                                          {mod}
                                        </Tag>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Module-level access */}
                                {ent.moduleAccess && ent.moduleAccess.length > 0 && (
                                  <div>
                                    <div className="mb-2 text-xs font-semibold text-gray-700 uppercase">
                                      Module Access Levels
                                    </div>
                                    <Table
                                      size="small"
                                      pagination={false}
                                      dataSource={ent.moduleAccess}
                                      rowKey={(r) => r.module}
                                      columns={[
                                        {
                                          title: 'Module',
                                          dataIndex: 'module',
                                          key: 'module',
                                          render: (mod: string) => (
                                            <span className="font-medium capitalize">{mod}</span>
                                          ),
                                        },
                                        {
                                          title: 'Enabled',
                                          dataIndex: 'enabled',
                                          key: 'enabled',
                                          render: (enabled: boolean) => (
                                            <Tag color={enabled ? 'success' : 'default'}>
                                              {enabled ? 'Yes' : 'No'}
                                            </Tag>
                                          ),
                                        },
                                        {
                                          title: 'Sub-feature Access',
                                          dataIndex: 'subFeatures',
                                          key: 'subFeatures',
                                          render: (
                                            subFeatures:
                                              | {
                                                  key: string;
                                                  access: string;
                                                }[]
                                              | undefined,
                                          ) =>
                                            subFeatures && subFeatures.length > 0 ? (
                                              <div className="flex flex-wrap gap-1">
                                                {subFeatures.map((sf) => (
                                                  <Tag
                                                    key={sf.key}
                                                    color={ACCESS_COLORS[sf.access] ?? 'default'}
                                                    className="text-xs"
                                                  >
                                                    {sf.key}: {sf.access}
                                                  </Tag>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-xs text-faint">-</span>
                                            ),
                                        },
                                      ]}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })(),
                        },
                      ]}
                    />
                  )}

                  {/* Add Add-ons Button for active/trial subscriptions */}
                  {userDetails.subscription &&
                    ['active', 'trial'].includes(userDetails.subscription.status) && (
                      <div className="mt-4">
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={async () => {
                            try {
                              const addons = await getAddOnDefinitions();
                              setAvailableAddOns(addons as any);
                              setAddOnModalOpen(true);
                            } catch (e) {
                              msgApi.error('Failed to load add-ons');
                            }
                          }}
                        >
                          Assign Add-On
                        </Button>
                      </div>
                    )}
                </>
              )}
            </div>

            {/* Subscription History */}
            <div className="mt-4">
              <h4 className="mb-3 font-semibold">📜 Subscription History</h4>
              {subHistory.length === 0 ? (
                <Alert title="No subscription history" type="info" showIcon />
              ) : (
                <Table
                  dataSource={subHistory}
                  loading={loadingSubHistory}
                  size="small"
                  pagination={{ pageSize: 5 }}
                  rowKey="_id"
                  columns={[
                    {
                      title: 'Plan',
                      dataIndex: ['planId', 'name'],
                      render: (val, record) => val || (record.planId ? 'Custom' : 'None'),
                    },
                    {
                      title: 'Tier',
                      dataIndex: ['planId', 'tier'],
                      render: (val) => (val ? <Tag>{val}</Tag> : '-'),
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      render: (status: string) => (
                        <Tag color={SUBSCRIPTION_STATUS_COLORS[status]}>{status}</Tag>
                      ),
                    },
                    {
                      title: 'Start',
                      dataIndex: 'currentPeriodStart',
                      render: (d: string) => (d ? fmt(d) : '-'),
                    },
                    {
                      title: 'End',
                      dataIndex: 'currentPeriodEnd',
                      render: (d: string) => (d ? fmt(d) : '-'),
                    },
                    {
                      title: 'Source',
                      dataIndex: 'source',
                      render: (src: string) =>
                        src === 'admin' ? <Tag color="blue">Admin</Tag> : 'Self',
                    },
                  ]}
                />
              )}
            </div>

            {/* Activity */}
            <div>
              <h4 className="mb-3 font-semibold">📊 Activity</h4>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Joined">
                  {fmt(userDetails.user.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Admin Status">
                  {userDetails.user.isAdmin ? (
                    <Tag color="gold">Admin User</Tag>
                  ) : (
                    <Tag>Regular User</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Account Status">
                  {userDetails.user.isActive ? (
                    <Tag color="success">Active</Tag>
                  ) : (
                    <Tag color="error">Inactive</Tag>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Active Sessions */}
            <div>
              <h4 className="mb-3 font-semibold">📱 Active Sessions</h4>
              <UserSessionsSection
                userId={userDetails.user._id}
                currentLimitOverride={userDetails.user.sessionLimitOverride}
              />
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={createUserModalOpen}
        onCancel={() => setCreateUserModalOpen(false)}
        title={<span className="font-display font-bold">Create New User</span>}
        footer={null}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          onFinish={handleCreateUser}
          initialValues={{
            isActive: true,
            isAdmin: false,
            isEmailVerified: false,
          }}
        >
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter full name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Please enter a valid email' }]}
          >
            <Input placeholder="Enter email (optional)" />
          </Form.Item>

          <Form.Item name="mobile" label="Mobile">
            <Input placeholder="Enter mobile (optional)" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password placeholder="Enter password" />
          </Form.Item>

          <Form.Item name="isActive" valuePropName="checked">
            <Checkbox>Active</Checkbox>
          </Form.Item>

          <Form.Item name="isAdmin" valuePropName="checked">
            <Checkbox>Admin User</Checkbox>
          </Form.Item>

          <Form.Item name="isEmailVerified" valuePropName="checked">
            <Checkbox>Email Verified</Checkbox>
          </Form.Item>

          <Divider>Workspace</Divider>

          <Form.Item
            name="workspaceName"
            label="Workspace Name"
            rules={[{ required: true, message: 'Please enter workspace name' }]}
          >
            <Input placeholder="Enter workspace name" />
          </Form.Item>

          <Form.Item name="workspaceBusinessType" label="Business Type">
            <Input placeholder="Enter business type (optional)" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={createUserSaving}>
              Create User
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Cancel Subscription Modal (Graceful) */}
      <Modal
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        title={<span className="font-display font-bold">Cancel Subscription</span>}
        okText="Cancel Subscription"
        okButtonProps={{ danger: true, loading: cancelLoading }}
        onOk={handleCancel}
        width={520}
      >
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          title="User will retain access until their current billing period ends."
        />
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Reason for cancellation (optional)</p>
          <Input.TextArea
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
            placeholder="e.g. User requested cancellation, switching to competitor..."
            rows={3}
          />
        </div>
      </Modal>

      {/* Force Cancel Subscription Modal */}
      <RevokeSubscriptionModal
        open={forceCancelOpen}
        onCancel={() => setForceCancelOpen(false)}
        onConfirm={handleForceCancel}
        plans={plans}
        title="Force Cancel Subscription"
        okText="Confirm"
      />

      <Modal
        open={deactivateModalOpen}
        onCancel={() => setDeactivateModalOpen(false)}
        title={<span className="font-display font-bold">Deactivate User</span>}
        okText="Deactivate"
        okButtonProps={{ danger: true, loading: deactivationLoading }}
        onOk={handleDeactivate}
        width={520}
      >
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          title="This will block the user from logging in. All their workspace members will lose access to their workspaces."
        />
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Reason for deactivation</p>
          <Input.TextArea
            value={deactivationNote}
            onChange={(e) => setDeactivationNote(e.target.value)}
            placeholder="Provide a reason (minimum 10 characters)..."
            rows={4}
          />
        </div>
      </Modal>

      {/* Assign Add-On Modal */}
      <Modal
        open={addOnModalOpen}
        onCancel={() => {
          setAddOnModalOpen(false);
          setSelectedAddOn(null);
        }}
        title={<span className="font-display font-bold">Assign Add-On</span>}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {availableAddOns.length === 0 ? (
          <Alert type="info" title="No add-ons available" showIcon />
        ) : (
          <div className="space-y-3">
            <p className="mb-4 text-sm text-gray-700">
              Select an add-on to assign to this user. The add-on will be available immediately.
            </p>
            {availableAddOns.map((addon) => (
              <Card
                key={addon._id}
                size="small"
                hoverable
                onClick={() => setSelectedAddOn(addon)}
                style={{
                  borderColor: selectedAddOn?._id === addon._id ? 'var(--cr-primary)' : undefined,
                  background: selectedAddOn?._id === addon._id ? 'var(--cr-indigo-50)' : undefined,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="m-0 font-medium">{addon.name}</p>
                    <p className="m-0 mt-1 text-sm text-gray-700">{addon.description}</p>
                    <div className="mt-2 flex gap-2">
                      <Tag color="blue">{addon.type}</Tag>
                      {addon.entitlements?.maxTotalMembers > 0 && (
                        <Tag>+{addon.entitlements.maxTotalMembers} Members</Tag>
                      )}
                      {addon.entitlements?.maxWorkspaces > 0 && (
                        <Tag>+{addon.entitlements.maxWorkspaces} Workspaces</Tag>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="m-0 font-semibold">₹{addon.price}</p>
                    <p className="m-0 text-xs text-gray-700">
                      {addon.billingCycle === 'monthly'
                        ? '/month'
                        : addon.billingCycle === 'yearly'
                          ? '/year'
                          : addon.billingCycle === 'lifetime'
                            ? '(lifetime)'
                            : '/unit'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
            <Button
              type="primary"
              block
              loading={assigningAddOn}
              disabled={!selectedAddOn}
              onClick={async () => {
                if (!selectedAddOn || !selectedUser) return;
                setAssigningAddOn(true);
                try {
                  await adminAssignAddOn({
                    userId: selectedUser._id,
                    addOnDefinitionId: selectedAddOn._id,
                  });
                  msgApi.success('Add-on assigned successfully');
                  setAddOnModalOpen(false);
                  setSelectedAddOn(null);
                  openDetailsDrawer(selectedUser);
                } catch (e) {
                  msgApi.error(parseApiError(e));
                } finally {
                  setAssigningAddOn(false);
                }
              }}
            >
              Assign Selected Add-On
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
