 
'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import { Alert, App, Button, Select, Skeleton, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  InfoCircleOutlined,
  OrderedListOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { DsPageHeader, StatTile } from '@/components/ui';
import { salaryApi } from '@/lib/api';
import { teamApi } from '@/lib/api/modules/team.api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/store';
import type { TeamMember, WorkspaceBalanceRow } from '@/types';
import { MemberLedgerDrawer } from './components/MemberLedgerDrawer';
import { RecordEntriesDrawer } from './components/RecordEntriesDrawer';
import { SettleModal } from './components/SettleModal';

const { Text } = Typography;

/** Info tooltip explaining baki/udhaar -- the clarity standard per phase-3-clarity-and-overview.md */
function LedgerInfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip title={content} placement="bottomLeft" styles={{ root: { maxWidth: 380 } }}>
      <InfoCircleOutlined
        className="ml-1 text-[13px] text-subtle"
        aria-label="About daily wages ledger"
        style={{ cursor: 'help' }}
      />
    </Tooltip>
  );
}

function BalanceTag({ balance }: { balance: number }) {
  const t = useTranslations('salary.ledger');
  if (balance > 0) {
    return (
      <Tag color="success" style={{ fontWeight: 600 }}>
        {t('bakiLabel')}: {formatCurrencyFull(balance)}
      </Tag>
    );
  }
  if (balance < 0) {
    return (
      <Tag color="error" style={{ fontWeight: 600 }}>
        {t('udhaarLabel')}: {formatCurrencyFull(Math.abs(balance))}
      </Tag>
    );
  }
  return <Tag color="default">{t('balanceClear')}</Tag>;
}

export default function LedgerPage() {
  const t = useTranslations('salary.ledger');
  const { message } = App.useApp();

  const { currentWorkspaceId, isHydrated } = useWorkspaceStore(
    useShallow((s) => ({
      currentWorkspaceId: s.currentWorkspaceId,
      isHydrated: s.isHydrated,
    })),
  );

  const [balanceRows, setBalanceRows] = useState<WorkspaceBalanceRow[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'nonzero' | 'all'>('nonzero');

  // Drawer / modal state
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordPreselect, setRecordPreselect] = useState<string | undefined>(undefined);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [memberDrawerId, setMemberDrawerId] = useState('');
  const [memberDrawerName, setMemberDrawerName] = useState('');

  // Multi-select settle
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkSettleOpen, setBulkSettleOpen] = useState(false);

  // Single-row settle shortcut
  const [singleSettleOpen, setSingleSettleOpen] = useState(false);
  const [singleSettleMemberId, setSingleSettleMemberId] = useState('');

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [balancesData, membersData] = await Promise.all([
        salaryApi.getWorkspaceLedgerBalances(currentWorkspaceId, { filter }),
        teamApi.list(currentWorkspaceId, { limit: 1000 }),
      ]);
      const memberList: TeamMember[] = Array.isArray(membersData)
        ? membersData
        : ((membersData as { data: TeamMember[] }).data ?? []);
      startTransition(() => {
        setBalanceRows(balancesData.rows);
        setMembers(memberList);
      });
    } catch (e) {
      void message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, filter, message, t]);

  useEffect(() => {
    if (!isHydrated || !currentWorkspaceId) return;
    void load();
  }, [isHydrated, currentWorkspaceId, load]);

  // KPI calculations
  const totalBaki = balanceRows
    .filter((r) => r.currentBalance > 0)
    .reduce((s, r) => s + r.currentBalance, 0);
  const totalUdhaar = balanceRows
    .filter((r) => r.currentBalance < 0)
    .reduce((s, r) => s + Math.abs(r.currentBalance), 0);
  const workerCount = balanceRows.length;

  const openMemberDrawer = (memberId: string) => {
    const m = memberMap.get(memberId);
    setMemberDrawerId(memberId);
    setMemberDrawerName(m?.name ?? memberId);
    setMemberDrawerOpen(true);
  };

  const openRecordForMember = (memberId: string) => {
    setRecordPreselect(memberId);
    setRecordOpen(true);
  };

  const handleSingleSettle = (memberId: string) => {
    setSingleSettleMemberId(memberId);
    setSingleSettleOpen(true);
  };

  const memberNamesMap: Record<string, string> = Object.fromEntries(
    members.map((m) => [m.id, m.name]),
  );

  const columns: ColumnsType<WorkspaceBalanceRow> = [
    {
      title: t('colEmployee'),
      dataIndex: 'teamMemberId',
      render: (id: string) => {
        const m = memberMap.get(id);
        return (
          <div>
            <Text strong>{m?.name ?? id}</Text>
            {m?.designation && (
              <Text type="secondary" className="ml-1 text-xs">
                {m.designation}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: t('colBalance'),
      dataIndex: 'currentBalance',
      width: 200,
      sorter: (a, b) => a.currentBalance - b.currentBalance,
      render: (balance: number) => <BalanceTag balance={balance} />,
    },
    {
      title: t('colLastEntry'),
      dataIndex: 'lastEntryDate',
      width: 130,
      render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
      sorter: (a, b) => {
        const da = a.lastEntryDate ? dayjs(a.lastEntryDate).unix() : 0;
        const db = b.lastEntryDate ? dayjs(b.lastEntryDate).unix() : 0;
        return da - db;
      },
    },
    {
      title: t('colOpenEarnings'),
      dataIndex: 'openEarnings',
      width: 130,
      align: 'right',
      render: (v: number) => <Text type="success">{formatCurrencyFull(v)}</Text>,
    },
    {
      title: t('colOpenDraws'),
      dataIndex: 'openDraws',
      width: 120,
      align: 'right',
      render: (v: number) => <Text type="danger">{formatCurrencyFull(v)}</Text>,
    },
    {
      title: '',
      width: 210,
      render: (_: unknown, row) => (
        <div className="flex gap-1">
          <Button size="small" onClick={() => openMemberDrawer(row.teamMemberId)}>
            {t('viewBtn')}
          </Button>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openRecordForMember(row.teamMemberId)}
          >
            {t('recordBtn')}
          </Button>
          <Button
            size="small"
            type="primary"
            disabled={row.currentBalance <= 0}
            onClick={() => handleSingleSettle(row.teamMemberId)}
          >
            {t('settleBtn')}
          </Button>
        </div>
      ),
    },
  ];

  if (!isHydrated) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  const clarityTooltip = t('infoTooltip');

  return (
    <div className="p-6">
      <DsPageHeader
        title={t('pageTitle')}
        titleAside={<LedgerInfoTooltip content={clarityTooltip} />}
        sub={t('pageSubtitle')}
        icon={<OrderedListOutlined />}
        right={
          <div className="flex items-center gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={load}
              loading={loading}
              aria-label={t('refreshBtn')}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setRecordPreselect(undefined);
                setRecordOpen(true);
              }}
            >
              {t('recordBtn')}
            </Button>
          </div>
        }
      />

      {/* Clarity notice */}
      <Alert
        type="info"
        showIcon
        title={t('clarityTitle')}
        description={t('clarityDesc')}
        className="mb-5"
        style={{ borderRadius: 10 }}
      />

      {/* KPI tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile
          label={t('statTotalBaki')}
          value={formatCurrencyFull(totalBaki)}
          hint={t('statTotalBakiHint')}
          emphasis
        />
        <StatTile
          label={t('statTotalUdhaar')}
          value={formatCurrencyFull(totalUdhaar)}
          hint={t('statTotalUdhaarHint')}
        />
        <StatTile
          label={t('statWorkerCount')}
          value={String(workerCount)}
          hint={t('statWorkerCountHint')}
        />
      </div>

      {/* Filter + bulk settle bar */}
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={filter}
          onChange={(v) => setFilter(v)}
          options={[
            { value: 'nonzero', label: t('filterNonzero') },
            { value: 'all', label: t('filterAll') },
          ]}
          style={{ width: 180 }}
        />
        {selectedRowKeys.length > 1 && (
          <Button type="default" onClick={() => setBulkSettleOpen(true)}>
            {t('bulkSettleBtn', { count: selectedRowKeys.length })}
          </Button>
        )}
      </div>

      {/* Balance board table */}
      <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--cr-border)' }}>
        <Table<WorkspaceBalanceRow>
          columns={columns}
          dataSource={balanceRows}
          rowKey="teamMemberId"
          loading={loading}
          size="middle"
          pagination={{
            pageSize: 50,
            showSizeChanger: false,
            showTotal: (total) => t('paginationTotal', { total }),
          }}
          locale={{ emptyText: t('emptyBoard') }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
            getCheckboxProps: (row) => ({ disabled: row.currentBalance <= 0 }),
          }}
          onRow={(row) => ({
            style: { cursor: 'default' },
            onDoubleClick: () => openMemberDrawer(row.teamMemberId),
          })}
        />
      </div>

      {/* Record Entries Drawer */}
      {currentWorkspaceId && (
        <RecordEntriesDrawer
          open={recordOpen}
          onClose={() => setRecordOpen(false)}
          workspaceId={currentWorkspaceId}
          members={members.map((m) => ({ id: m.id, name: m.name, designation: m.designation }))}
          preselectedMemberId={recordPreselect}
          onCreated={() => {
            setRecordOpen(false);
            void load();
          }}
        />
      )}

      {/* Member Ledger Drawer */}
      {currentWorkspaceId && memberDrawerOpen && (
        <MemberLedgerDrawer
          open={memberDrawerOpen}
          onClose={() => setMemberDrawerOpen(false)}
          workspaceId={currentWorkspaceId}
          memberId={memberDrawerId}
          memberName={memberDrawerName}
          onSettled={() => void load()}
        />
      )}

      {/* Single-row Settle Modal */}
      {currentWorkspaceId && singleSettleOpen && (
        <SettleModal
          open={singleSettleOpen}
          onClose={() => setSingleSettleOpen(false)}
          workspaceId={currentWorkspaceId}
          memberIds={[singleSettleMemberId]}
          memberNames={memberNamesMap}
          onSettled={() => {
            setSingleSettleOpen(false);
            void load();
          }}
        />
      )}

      {/* Bulk Settle Modal */}
      {currentWorkspaceId && bulkSettleOpen && (
        <SettleModal
          open={bulkSettleOpen}
          onClose={() => setBulkSettleOpen(false)}
          workspaceId={currentWorkspaceId}
          memberIds={selectedRowKeys}
          memberNames={memberNamesMap}
          onSettled={() => {
            setBulkSettleOpen(false);
            setSelectedRowKeys([]);
            void load();
          }}
        />
      )}
    </div>
  );
}
