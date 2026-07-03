 
'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import { GiftOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Skeleton, Tabs, Tooltip, Alert } from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { DsPageHeader, StatTile } from '@/components/ui';
import { salaryApi } from '@/lib/api';
import { teamApi } from '@/lib/api/modules/team.api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/store';
import type {
  BonusConfig,
  BonusPreviewResult,
  BonusRun,
  BonusSummaryResult,
  TeamMember,
  UpdateBonusConfigPayload,
} from '@/types';
import { BonusConfigTab } from './components/BonusConfigTab';
import { BonusSummaryTab } from './components/BonusSummaryTab';
import { FestivalBonusTab } from './components/FestivalBonusTab';
import { StatutoryBonusTab } from './components/StatutoryBonusTab';

/** Info icon tooltip for the statutory vs festival distinction. */
function BonusInfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip title={content} placement="bottomLeft" styles={{ root: { maxWidth: 360 } }}>
      <InfoCircleOutlined
        className="ml-1 text-[13px] text-subtle"
        aria-label="About bonus"
        style={{ cursor: 'help' }}
      />
    </Tooltip>
  );
}

export default function BonusPage() {
  const t = useTranslations('salary.bonus');
  const { message } = App.useApp();

  const { currentWorkspaceId, isHydrated } = useWorkspaceStore(
    useShallow((s) => ({
      currentWorkspaceId: s.currentWorkspaceId,
      isHydrated: s.isHydrated,
    })),
  );

  const currentFy = dayjs().month() >= 3 ? dayjs().year() : dayjs().year() - 1;

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [bonusConfig, setBonusConfig] = useState<BonusConfig | null>(null);
  const [previewResult, setPreviewResult] = useState<BonusPreviewResult | null>(null);
  const [summary, setSummary] = useState<BonusSummaryResult | null>(null);
  const [runs, setRuns] = useState<BonusRun[]>([]);
  const [summaryFy, setSummaryFy] = useState<number>(currentFy);
  const [activeTab, setActiveTab] = useState('statutory');
  const [loading, setLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------

  const loadMembers = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const membersData = await teamApi.list(currentWorkspaceId, { limit: 1000 });
      const list: TeamMember[] = Array.isArray(membersData)
        ? membersData
        : ((membersData as { data: TeamMember[] }).data ?? []);
      startTransition(() => setMembers(list));
    } catch (e) {
      message.error(parseApiError(e) || t('loadError'));
    }
  }, [currentWorkspaceId, message, t]);

  const loadConfig = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const cfg = await salaryApi.getBonusConfig(currentWorkspaceId);
      startTransition(() => setBonusConfig(cfg));
    } catch (e) {
      message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, message, t]);

  const loadSummaryAndRuns = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [summaryData, runsData] = await Promise.all([
        salaryApi.getBonusSummary(currentWorkspaceId, { financialYear: summaryFy }),
        salaryApi.listBonusRuns(currentWorkspaceId, { financialYear: summaryFy }),
      ]);
      startTransition(() => {
        setSummary(summaryData);
        setRuns(runsData);
      });
    } catch (e) {
      message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, summaryFy, message, t]);

  // Initial load
  useEffect(() => {
    if (!isHydrated || !currentWorkspaceId) return;
    void loadMembers();
  }, [isHydrated, currentWorkspaceId, loadMembers]);

  useEffect(() => {
    if (!isHydrated || !currentWorkspaceId) return;
    if (activeTab === 'config') void loadConfig();
    else if (activeTab === 'summary') void loadSummaryAndRuns();
  }, [isHydrated, currentWorkspaceId, activeTab, loadConfig, loadSummaryAndRuns]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handlePreview = async (opts: {
    financialYear: number;
    percent: number;
    disbursedMonth: number;
    disbursedYear: number;
  }) => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const result = await salaryApi.previewBonus(currentWorkspaceId, {
        financialYear: opts.financialYear,
        disbursedMonth: opts.disbursedMonth,
        disbursedYear: opts.disbursedYear,
      });
      startTransition(() => setPreviewResult(result));
    } catch (e) {
      message.error(parseApiError(e) || t('previewError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async (opts: {
    financialYear: number;
    disbursedMonth: number;
    disbursedYear: number;
    note?: string;
  }) => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const result = await salaryApi.runBonus(currentWorkspaceId, {
        financialYear: opts.financialYear,
        disbursedMonth: opts.disbursedMonth,
        disbursedYear: opts.disbursedYear,
        note: opts.note,
      });
      message.success(t('runSuccess', { created: result.created, skipped: result.skipped }));
      // Refresh preview to reflect the new state
      void handlePreview({
        financialYear: opts.financialYear,
        percent: 8.33,
        disbursedMonth: opts.disbursedMonth,
        disbursedYear: opts.disbursedYear,
      });
    } catch (e) {
      message.error(parseApiError(e) || t('runError'));
    } finally {
      setLoading(false);
    }
  };

  const handleFestival = async (opts: {
    subType: string;
    financialYear: number;
    disbursedMonth: number;
    disbursedYear: number;
    countsAsStatutory: boolean;
    entries: Array<{ teamMemberId: string; amount: number; note?: string }>;
    note?: string;
  }) => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const result = await salaryApi.recordFestivalBonus(currentWorkspaceId, {
        subType: opts.subType,
        financialYear: opts.financialYear,
        disbursedMonth: opts.disbursedMonth,
        disbursedYear: opts.disbursedYear,
        countsAsStatutory: opts.countsAsStatutory,
        entries: opts.entries,
        note: opts.note,
      });
      message.success(t('festivalSuccess', { count: result.created }));
    } catch (e) {
      message.error(parseApiError(e) || t('festivalError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (payload: UpdateBonusConfigPayload) => {
    if (!currentWorkspaceId) return;
    setConfigSaving(true);
    try {
      const updated = await salaryApi.updateBonusConfig(currentWorkspaceId, payload);
      startTransition(() => setBonusConfig(updated));
      message.success(t('configSaveSuccess'));
    } catch (e) {
      message.error(parseApiError(e) || t('configSaveError'));
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'config') void loadConfig();
    else if (activeTab === 'summary') void loadSummaryAndRuns();
  };

  // ---------------------------------------------------------------------------
  // Derived KPIs
  // ---------------------------------------------------------------------------

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const totalStatutory = summary?.workspaceStatutory ?? 0;
  const totalDiscretionary = summary?.workspaceDiscretionary ?? 0;
  const totalBonus = summary?.workspaceTotal ?? 0;
  const totalRuns = runs.length;

  if (!isHydrated) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  const clarityTooltip = t('infoTooltip');

  const tabItems = [
    {
      key: 'statutory',
      label: t('tabStatutory'),
      children: (
        <StatutoryBonusTab
          loading={loading}
          previewRows={previewResult?.rows ?? []}
          previewFy={previewResult?.financialYear ?? null}
          memberMap={memberMap}
          onPreview={handlePreview}
          onRun={handleRun}
        />
      ),
    },
    {
      key: 'festival',
      label: t('tabFestival'),
      children: <FestivalBonusTab loading={loading} members={members} onSubmit={handleFestival} />,
    },
    {
      key: 'summary',
      label: t('tabSummary'),
      children: (
        <BonusSummaryTab
          loading={loading}
          summaryRows={summary?.rows ?? []}
          summaryStatutory={totalStatutory}
          summaryDiscretionary={totalDiscretionary}
          summaryTotal={totalBonus}
          runs={runs}
          memberMap={memberMap}
          fy={summaryFy}
          onFyChange={(fy) => {
            setSummaryFy(fy);
          }}
        />
      ),
    },
    {
      key: 'config',
      label: t('tabConfig'),
      children: (
        <BonusConfigTab
          config={bonusConfig}
          loading={loading}
          saving={configSaving}
          onSave={handleSaveConfig}
        />
      ),
    },
  ];

  return (
    <div className="p-6">
      <DsPageHeader
        title={t('pageTitle')}
        titleAside={<BonusInfoTooltip content={clarityTooltip} />}
        sub={t('pageSubtitle')}
        icon={<GiftOutlined />}
        right={
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            aria-label={t('refreshBtn')}
          />
        }
      />

      {/* Single-ledger clarity notice */}
      <Alert
        title={t('singleLedgerTitle')}
        description={t('singleLedgerDesc')}
        type="info"
        showIcon
        className="mb-5"
        style={{ borderRadius: 10 }}
      />

      {/* KPI tiles (driven by summary for current FY) */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t('statStatutory')}
          value={formatCurrencyFull(totalStatutory)}
          hint={t('statStatutoryHint')}
          emphasis
        />
        <StatTile
          label={t('statDiscretionary')}
          value={formatCurrencyFull(totalDiscretionary)}
          hint={t('statDiscretionaryHint')}
        />
        <StatTile
          label={t('statTotal')}
          value={formatCurrencyFull(totalBonus)}
          hint={t('statTotalHint')}
        />
        <StatTile label={t('statRuns')} value={String(totalRuns)} hint={t('statRunsHint')} />
      </div>

      {/* Tabs */}
      <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--cr-border)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={tabItems}
          className="bonus-tabs"
          style={{ padding: '0 16px' }}
        />
      </div>
    </div>
  );
}
