'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import { RiseOutlined, InfoCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Select, Skeleton, Tabs, Tooltip, Tag, Alert } from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { DsPageHeader, StatTile } from '@/components/ui';
import { salaryApi } from '@/lib/api';
import { teamApi } from '@/lib/api/modules/team.api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/store';
import type { CommissionEntry, CommissionSchedule, CommissionYtdResult, TeamMember } from '@/types';
import { CommissionEntriesTab } from './components/CommissionEntriesTab';
import { CommissionScheduledTab } from './components/CommissionScheduledTab';
import { CommissionYtdTab } from './components/CommissionYtdTab';
import { RecordCommissionDrawer } from './components/RecordCommissionDrawer';

/** Plain-text info icon tooltip content explaining commission vs salary and the single-ledger guarantee. */
function CommissionInfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip title={content} placement="bottomLeft" styles={{ root: { maxWidth: 340 } }}>
      <InfoCircleOutlined
        className="ml-1 text-[13px] text-subtle"
        aria-label="About commission"
        style={{ cursor: 'help' }}
      />
    </Tooltip>
  );
}

export default function CommissionPage() {
  const t = useTranslations('salary.commission');
  const { message } = App.useApp();

  const { currentWorkspaceId, isHydrated } = useWorkspaceStore(
    useShallow((s) => ({
      currentWorkspaceId: s.currentWorkspaceId,
      isHydrated: s.isHydrated,
    })),
  );

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [schedules, setSchedules] = useState<CommissionSchedule[]>([]);
  const [ytd, setYtd] = useState<CommissionYtdResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('entries');

  // Filter state for entries tab
  const [filterMonth, setFilterMonth] = useState<number | undefined>(undefined);
  const [filterYear, setFilterYear] = useState<number | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<'commission' | 'incentive' | undefined>(
    undefined,
  );

  // YTD FY picker
  const [ytdFy, setYtdFy] = useState<number>(
    dayjs().month() >= 3 ? dayjs().year() : dayjs().year() - 1,
  );

  const loadEntries = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [entriesData, membersData] = await Promise.all([
        salaryApi.listCommissionEntries(currentWorkspaceId, {
          month: filterMonth,
          year: filterYear,
          category: filterCategory,
        }),
        teamApi.list(currentWorkspaceId, { limit: 1000 }),
      ]);
      const memberList: TeamMember[] = Array.isArray(membersData)
        ? membersData
        : ((membersData as { data: TeamMember[] }).data ?? []);
      startTransition(() => {
        setEntries(entriesData);
        setMembers(memberList);
      });
    } catch (e) {
      message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, filterMonth, filterYear, filterCategory, message, t]);

  const loadSchedules = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [schedulesData, membersData] = await Promise.all([
        salaryApi.listCommissionSchedules(currentWorkspaceId),
        teamApi.list(currentWorkspaceId, { limit: 1000 }),
      ]);
      const memberList: TeamMember[] = Array.isArray(membersData)
        ? membersData
        : ((membersData as { data: TeamMember[] }).data ?? []);
      startTransition(() => {
        setSchedules(schedulesData);
        setMembers(memberList);
      });
    } catch (e) {
      message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, message, t]);

  const loadYtd = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const data = await salaryApi.getCommissionYtd(currentWorkspaceId, { fyStartYear: ytdFy });
      startTransition(() => {
        setYtd(data);
      });
    } catch (e) {
      message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, ytdFy, message, t]);

  useEffect(() => {
    if (!isHydrated || !currentWorkspaceId) return;
    if (activeTab === 'entries') void loadEntries();
    else if (activeTab === 'scheduled') void loadSchedules();
    else if (activeTab === 'ytd') void loadYtd();
  }, [isHydrated, currentWorkspaceId, activeTab, loadEntries, loadSchedules, loadYtd]);

  const memberMap = new Map(members.map((m) => [m.id, m]));

  // KPI summary derived from entries
  const totalCommission = entries
    .filter((e) => e.category === 'commission')
    .reduce((s, e) => s + e.amount, 0);
  const totalIncentive = entries
    .filter((e) => e.category === 'incentive')
    .reduce((s, e) => s + e.amount, 0);
  const activeSchedules = schedules.filter((s) => s.status === 'active').length;

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  const handleRefresh = () => {
    if (activeTab === 'entries') void loadEntries();
    else if (activeTab === 'scheduled') void loadSchedules();
    else void loadYtd();
  };

  if (!isHydrated) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  const clarityTooltip = t('infoTooltip');

  const tabItems = [
    {
      key: 'entries',
      label: t('tabEntries'),
      children: (
        <CommissionEntriesTab
          entries={entries}
          loading={loading}
          memberMap={memberMap}
          filterMonth={filterMonth}
          filterYear={filterYear}
          filterCategory={filterCategory}
          onFilterMonth={setFilterMonth}
          onFilterYear={setFilterYear}
          onFilterCategory={setFilterCategory}
          onRefresh={loadEntries}
        />
      ),
    },
    {
      key: 'scheduled',
      label: t('tabScheduled'),
      children: (
        <CommissionScheduledTab
          schedules={schedules}
          loading={loading}
          memberMap={memberMap}
          workspaceId={currentWorkspaceId ?? ''}
          onRefresh={loadSchedules}
        />
      ),
    },
    {
      key: 'ytd',
      label: t('tabYtd'),
      children: (
        <CommissionYtdTab
          ytd={ytd}
          loading={loading}
          memberMap={memberMap}
          fyStartYear={ytdFy}
          onFyChange={(fy) => {
            setYtdFy(fy);
          }}
        />
      ),
    },
  ];

  return (
    // No own padding - the salary layout + dashboard shell already provide the
    // page gutter (matches Payments / Run Payroll). The old `p-6` doubled the
    // left/right gutter. Vertical rhythm comes from the children's own margins.
    <div>
      <DsPageHeader
        title={t('pageTitle')}
        titleAside={<CommissionInfoTooltip content={clarityTooltip} />}
        sub={t('pageSubtitle')}
        icon={<RiseOutlined />}
        right={
          <div className="flex items-center gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              aria-label={t('refreshBtn')}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setRecordOpen(true)}>
              {t('recordBtn')}
            </Button>
          </div>
        }
      />

      {/* Clarity notice - single ledger, no double count (compact, dismissible) */}
      <Alert
        description={
          <span className="text-[13px]">
            <span className="font-medium">{t('singleLedgerTitle')}.</span> {t('singleLedgerDesc')}
          </span>
        }
        type="info"
        showIcon
        closable
        className="rounded-xl"
        style={{ marginBottom: 20 }}
      />

      {/* KPI tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t('statTotalCommission')}
          value={formatCurrencyFull(totalCommission)}
          hint={t('statTotalCommissionHint')}
          emphasis
        />
        <StatTile
          label={t('statTotalIncentive')}
          value={formatCurrencyFull(totalIncentive)}
          hint={t('statTotalIncentiveHint')}
        />
        <StatTile
          label={t('statActiveSchedules')}
          value={String(activeSchedules)}
          hint={t('statActiveSchedulesHint')}
        />
        <StatTile
          label={t('statTotalEntries')}
          value={String(entries.length)}
          hint={t('statTotalEntriesHint')}
        />
      </div>

      {/* Tabs */}
      <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--cr-border)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          className="commission-tabs"
          style={{ padding: '0 16px' }}
        />
      </div>

      {/* Record Commission Drawer */}
      {currentWorkspaceId && (
        <RecordCommissionDrawer
          open={recordOpen}
          onClose={() => setRecordOpen(false)}
          workspaceId={currentWorkspaceId}
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            designation: m.designation,
          }))}
          onCreated={() => {
            setRecordOpen(false);
            void loadEntries();
          }}
        />
      )}
    </div>
  );
}
