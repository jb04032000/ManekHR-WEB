'use client';

// Chart of Accounts - grouped outline (Tally-style group -> sub-group -> ledger)
// with codes, search, type filter, stat tiles, add/edit/archive, and a drill-down
// that deep-links to the existing Account Ledger report. Reuses the finance admin
// pattern (DsPageHeader + StatTile + cr- tokens). Data + mutations go through
// lib/actions/finance.actions (server recomputes tenant scope + keeps code/type
// authoritative; system accounts are archive-locked server-side). Cross-links:
// account ledger report at reports/party-ledger/account-ledger; seed templates in
// crewroster-backend ledger/seeds.
import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Table,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Tag,
  Tooltip,
  Popconfirm,
  Empty,
  message,
  InputNumber,
  DatePicker,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
  LockOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { StatTile } from '@/components/ui/StatTile';
import {
  listAccounts,
  createAccount,
  updateAccount,
  archiveAccount,
  setAccountOpeningBalance,
} from '@/lib/actions/finance.actions';
import type { Account } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  asset: 'blue',
  liability: 'red',
  capital: 'purple',
  income: 'green',
  expense: 'orange',
};

const ACCOUNT_TYPE_VALUES = ['asset', 'liability', 'capital', 'income', 'expense'] as const;
type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];

// Opening balances default to the natural side of the account: asset/expense are
// debit-nature, liability/capital/income are credit-nature.
function defaultDrOrCr(type: string): 'debit' | 'credit' {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
}

// A node in the rendered outline. Group/sub rows are structural; leaf rows wrap an Account.
type TreeNode = {
  key: string;
  kind: 'group' | 'sub' | 'leaf';
  label: string;
  count?: number;
  account?: Account;
  children?: TreeNode[];
};

export default function AccountsPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const { firmId } = use(params);
  const router = useRouter();
  const t = useTranslations('finance.misc');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');

  // Drawer doubles as add + edit; `editing` null => add mode.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadAccounts = () => {
    if (!wsId) return;
    setLoading(true);
    listAccounts(wsId, firmId)
      .then((a) => setAccounts(a ?? []))
      .catch(() => message.error(t('accounts.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, firmId]);

  // ── Filter (search + type) then build the group -> sub-group -> ledger outline ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.group ?? '').toLowerCase().includes(q)
      );
    });
  }, [accounts, search, typeFilter]);

  const tree = useMemo<TreeNode[]>(() => {
    const groups = new Map<string, Map<string, Account[]>>();
    for (const a of filtered) {
      const g = a.group?.trim() || t('accounts.ungrouped');
      const s = a.subGroup?.trim() || t('accounts.ungrouped');
      if (!groups.has(g)) groups.set(g, new Map());
      const subs = groups.get(g)!;
      if (!subs.has(s)) subs.set(s, []);
      subs.get(s)!.push(a);
    }
    const sortStr = (x: string, y: string) => x.localeCompare(y);
    return [...groups.entries()]
      .sort((a, b) => sortStr(a[0], b[0]))
      .map(([group, subs]) => {
        const subNodes: TreeNode[] = [...subs.entries()]
          .sort((a, b) => sortStr(a[0], b[0]))
          .map(([sub, accs]) => ({
            key: `g:${group}:s:${sub}`,
            kind: 'sub' as const,
            label: sub,
            count: accs.length,
            children: accs
              .slice()
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((acc) => ({
                key: acc._id,
                kind: 'leaf' as const,
                label: acc.name,
                account: acc,
              })),
          }));
        const count = subNodes.reduce((n, s) => n + (s.count ?? 0), 0);
        return {
          key: `g:${group}`,
          kind: 'group' as const,
          label: group,
          count,
          children: subNodes,
        };
      });
  }, [filtered, t]);

  // Keep every group + sub-group expanded so the outline reads like a real CoA.
  const expandedKeys = useMemo(() => {
    const keys: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.kind !== 'leaf') {
          keys.push(n.key);
          if (n.children) walk(n.children);
        }
      }
    };
    walk(tree);
    return keys;
  }, [tree]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = accounts.length;
    const custom = accounts.filter((a) => !a.isFromTemplate).length;
    const system = accounts.filter((a) => a.isSystem).length;
    const groups = new Set(accounts.map((a) => a.group?.trim() || '-')).size;
    return { total, custom, system, groups };
  }, [accounts]);

  // ── Drawer open helpers ──
  function openAdd() {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  }
  function openEdit(acc: Account) {
    setEditing(acc);
    form.setFieldsValue({
      name: acc.name,
      code: acc.code,
      type: acc.type,
      group: acc.group,
      subGroup: acc.subGroup,
      openingAmount: acc.openingBalance ? acc.openingBalance.amountPaise / 100 : undefined,
      openingDrOrCr: acc.openingBalance?.drOrCr ?? defaultDrOrCr(acc.type),
      openingAsOfDate: acc.openingBalance ? dayjs(acc.openingBalance.asOfDate) : dayjs(),
    });
    setDrawerOpen(true);
  }

  async function handleSave(values: Record<string, unknown>) {
    setSaving(true);
    try {
      if (editing) {
        // Edit: only name/group/subGroup are mutable; code/type stay authoritative.
        await updateAccount(wsId, firmId, editing._id, {
          name: values.name as string,
          group: values.group as string,
          subGroup: values.subGroup as string,
        });
        // Opening balance is a separate posting endpoint; send it when an amount
        // is present (0 clears it). Side/date fall back to sensible defaults.
        const amt = values.openingAmount;
        if (amt !== undefined && amt !== null && amt !== '') {
          await setAccountOpeningBalance(wsId, firmId, editing._id, {
            amountPaise: Math.round(Number(amt) * 100),
            drOrCr: (values.openingDrOrCr as 'debit' | 'credit') ?? 'debit',
            asOfDate:
              (values.openingAsOfDate as Dayjs | undefined)?.toISOString() ??
              new Date().toISOString(),
          });
        }
        message.success(t('accounts.updated'));
      } else {
        await createAccount(wsId, firmId, values as Partial<Account>);
        message.success(t('accounts.created'));
      }
      setDrawerOpen(false);
      form.resetFields();
      setEditing(null);
      loadAccounts();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(
        err?.message ?? (editing ? t('accounts.updateFailed') : t('accounts.createFailed')),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(acc: Account) {
    try {
      await archiveAccount(wsId, firmId, acc._id);
      message.success(t('accounts.archived'));
      loadAccounts();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('accounts.archiveFailed'));
    }
  }

  function openLedger(acc: Account) {
    router.push(
      `/dashboard/finance/firms/${firmId}/reports/party-ledger/account-ledger?accountCode=${encodeURIComponent(acc.code)}`,
    );
  }

  const typeLabel = (ty: string) =>
    ACCOUNT_TYPE_VALUES.includes(ty as AccountType)
      ? t(`accounts.type.${ty}` as Parameters<typeof t>[0])
      : ty;

  const columns = [
    {
      title: t('accounts.colName'),
      dataIndex: 'label',
      key: 'label',
      render: (_: unknown, node: TreeNode) => {
        if (node.kind === 'leaf') {
          const acc = node.account!;
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {acc.name}
              {acc.isSystem && (
                <Tooltip title={t('accounts.systemLocked')}>
                  <LockOutlined style={{ color: 'var(--cr-text-4)', fontSize: 12 }} />
                </Tooltip>
              )}
            </span>
          );
        }
        return (
          <span style={{ fontWeight: node.kind === 'group' ? 600 : 500 }}>
            {node.label}
            <span style={{ color: 'var(--cr-text-4)', fontWeight: 400, marginLeft: 8 }}>
              {node.count}
            </span>
          </span>
        );
      },
    },
    {
      title: t('accounts.colCode'),
      key: 'code',
      width: 100,
      render: (_: unknown, node: TreeNode) =>
        node.kind === 'leaf' ? (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--cr-text-3)' }}>
            {node.account!.code}
          </span>
        ) : null,
    },
    {
      title: t('accounts.colType'),
      key: 'type',
      width: 120,
      render: (_: unknown, node: TreeNode) =>
        node.kind === 'leaf' ? (
          <Tag color={TYPE_COLORS[node.account!.type] ?? 'default'}>
            {typeLabel(node.account!.type)}
          </Tag>
        ) : null,
    },
    {
      title: t('accounts.colOpening'),
      key: 'opening',
      width: 130,
      render: (_: unknown, node: TreeNode) => {
        if (node.kind !== 'leaf') return null;
        const ob = node.account!.openingBalance;
        if (!ob || !ob.amountPaise) return null;
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--cr-text-3)' }}>
            {'₹'}
            {(ob.amountPaise / 100).toLocaleString('en-IN')} {ob.drOrCr === 'debit' ? 'Dr' : 'Cr'}
          </span>
        );
      },
    },
    {
      title: <span className="sr-only">{t('common.actions')}</span>,
      key: 'actions',
      width: 130,
      render: (_: unknown, node: TreeNode) => {
        if (node.kind !== 'leaf') return null;
        const acc = node.account!;
        return (
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <Tooltip title={t('accounts.viewLedger')}>
              <Button
                size="small"
                type="text"
                icon={<FileSearchOutlined />}
                onClick={() => openLedger(acc)}
                aria-label={t('accounts.viewLedgerAria', { name: acc.name })}
              />
            </Tooltip>
            <Tooltip title={t('accounts.edit')}>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => openEdit(acc)}
                aria-label={t('accounts.editAria', { name: acc.name })}
              />
            </Tooltip>
            {!acc.isSystem && (
              <Popconfirm
                title={t('accounts.archiveConfirm')}
                okText={t('accounts.archive')}
                okButtonProps={{ danger: true }}
                cancelText={t('common.cancel')}
                onConfirm={() => handleArchive(acc)}
              >
                <Tooltip title={t('accounts.archive')}>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('accounts.archiveAria', { name: acc.name })}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('accounts.title')}
        icon={<BookOutlined />}
        style={{ marginBottom: 8 }}
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            {t('accounts.addAccount')}
          </Button>
        }
      />

      {/* Plain-language explainer: what a ledger / chart of accounts is. */}
      <p style={{ color: 'var(--cr-text-3)', fontSize: 13, margin: '0 0 16px', maxWidth: 720 }}>
        {t('accounts.explainer')}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatTile label={t('accounts.statTotal')} value={String(stats.total)} />
        <StatTile label={t('accounts.statGroups')} value={String(stats.groups)} />
        <StatTile label={t('accounts.statCustom')} value={String(stats.custom)} />
        <StatTile label={t('accounts.statSystem')} value={String(stats.system)} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          allowClear
          placeholder={t('accounts.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <Select<AccountType | 'all'>
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 180 }}
          options={[
            { value: 'all', label: t('accounts.filterAll') },
            ...ACCOUNT_TYPE_VALUES.map((v) => ({ value: v, label: typeLabel(v) })),
          ]}
        />
      </div>

      <Table<TreeNode>
        dataSource={tree}
        columns={columns}
        rowKey="key"
        size="small"
        pagination={false}
        loading={loading}
        expandable={{ expandedRowKeys: expandedKeys, expandIcon: () => null }}
        locale={{
          emptyText: (
            <Empty description={loading ? t('accounts.loadingText') : t('accounts.empty')}>
              {!loading && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                  {t('accounts.addAccount')}
                </Button>
              )}
            </Empty>
          ),
        }}
      />

      <Drawer
        title={editing ? t('accounts.editTitle') : t('accounts.addTitle')}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        size={480}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button
              onClick={() => {
                setDrawerOpen(false);
                setEditing(null);
              }}
              style={{ marginRight: 8 }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label={t('accounts.colName')} name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label={t('accounts.codeLabel')}
            name="code"
            rules={[{ required: true }]}
            // Code is the posting key - immutable once the ledger exists.
            extra={editing ? t('accounts.codeLockedHint') : undefined}
          >
            <Input placeholder={t('accounts.codePlaceholder')} disabled={!!editing} />
          </Form.Item>
          <Form.Item label={t('accounts.typeLabel')} name="type" rules={[{ required: true }]}>
            <Select
              disabled={!!editing}
              options={ACCOUNT_TYPE_VALUES.map((v) => ({ value: v, label: typeLabel(v) }))}
            />
          </Form.Item>
          <Form.Item label={t('accounts.groupLabel')} name="group">
            <Input placeholder={t('accounts.groupPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('accounts.subGroupLabel')} name="subGroup">
            <Input />
          </Form.Item>
          {editing && (
            <>
              <Divider style={{ margin: '8px 0 16px' }}>{t('accounts.openingSection')}</Divider>
              <Form.Item label={t('accounts.openingAmount')} name="openingAmount">
                <InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={t('accounts.openingSide')} name="openingDrOrCr">
                <Select
                  options={[
                    { value: 'debit', label: t('accounts.debit') },
                    { value: 'credit', label: t('accounts.credit') },
                  ]}
                />
              </Form.Item>
              <Form.Item label={t('accounts.openingAsOf')} name="openingAsOfDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <p style={{ color: 'var(--cr-text-4)', fontSize: 12, marginTop: -8 }}>
                {t('accounts.openingHint')}
              </p>
            </>
          )}
        </Form>
      </Drawer>
    </div>
  );
}
