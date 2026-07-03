'use client';
// Shared filter bar (date range + optional party/account/godown + Run) for finance
// report pages. i18n via finance.reports.common.* (filter placeholders + runReport).
// Cross-link: paired with ReportToolbar + ReportEmptyState on every report page.
import { useEffect, useRef, useState } from 'react';
import { DatePicker, Select, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';

interface FilterConfig {
  showParty?: boolean;
  showAccount?: boolean;
  showGodown?: boolean;
  requireParty?: boolean;
  showFyPicker?: boolean;
}

interface ReportFilterBarProps {
  onRun: (params: {
    dateFrom: string;
    dateTo: string;
    partyId?: string;
    accountCode?: string;
    godownId?: string;
  }) => void;
  loading?: boolean;
  parties?: Array<{ _id: string; name: string }>;
  accounts?: Array<{ code: string; name: string }>;
  godowns?: Array<{ _id: string; name: string }>;
  config?: FilterConfig;
  // Preselect the party/account when arriving via a deep-link (e.g. the Chart of
  // Accounts "View ledger" button passes ?accountCode). Seeds the Select value so
  // the picker is not blank on load.
  initialPartyId?: string;
  initialAccountCode?: string;
  // When this key becomes defined, the report is run once automatically so a
  // deep-link lands on data instead of an empty filter form. Encode the readiness
  // signal in it (e.g. `${workspaceId}:${accountCode}`) so the run only fires after
  // the workspace store has hydrated. Cross-link: set by the account-ledger page.
  autoRunKey?: string;
}

function getCurrentFyBounds(): [Dayjs, Dayjs] {
  const now = dayjs();
  // April = month index 3 (0-indexed)
  const fyStartYear = now.month() >= 3 ? now.year() : now.year() - 1;
  const start = dayjs(`${fyStartYear}-04-01`);
  return [start, now];
}

export function ReportFilterBar({
  onRun,
  loading,
  parties = [],
  accounts = [],
  godowns = [],
  config = {},
  initialPartyId,
  initialAccountCode,
  autoRunKey,
}: ReportFilterBarProps) {
  const t = useTranslations('finance.reports');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(getCurrentFyBounds());
  // Seed party/account from the deep-link target so the picker is pre-filled.
  const [partyId, setPartyId] = useState<string | undefined>(initialPartyId);
  const [accountCode, setAccountCode] = useState<string | undefined>(initialAccountCode);
  const [godownId, setGodownId] = useState<string | undefined>();

  const handleRun = () => {
    if (config.requireParty && !partyId) return;
    onRun({
      dateFrom: dateRange[0].toISOString(),
      dateTo: dateRange[1].endOf('day').toISOString(),
      partyId,
      accountCode,
      godownId,
    });
  };

  const canRun = !config.requireParty || !!partyId;

  // Deep-link auto-run: fire the report once when autoRunKey first becomes defined.
  // Gating on the key (not bare mount) avoids running before the workspace store
  // hydrates; the ref dedupes so manual filter changes never re-trigger it.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRunKey && !autoRanRef.current) {
      autoRanRef.current = true;
      handleRun();
    }
    // handleRun reads current filter state (initial date range + preselected target).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunKey]);

  return (
    <DsCard style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(vals) => {
            if (vals?.[0] && vals[1]) setDateRange([vals[0], vals[1]]);
          }}
          allowClear={false}
          style={{ minWidth: 240 }}
        />
        {config.showParty && (
          <Select
            aria-label={t('common.filterParty')}
            showSearch
            placeholder={t('common.selectParty')}
            style={{ minWidth: 200 }}
            allowClear
            value={partyId}
            onChange={setPartyId}
            optionFilterProp="label"
            options={parties.map((p) => ({ value: p._id, label: p.name }))}
          />
        )}
        {config.showAccount && (
          <Select
            aria-label={t('common.filterAccount')}
            showSearch
            placeholder={t('common.selectAccount')}
            style={{ minWidth: 200 }}
            allowClear
            value={accountCode}
            onChange={setAccountCode}
            optionFilterProp="label"
            options={accounts.map((a) => ({ value: a.code, label: `${a.code} - ${a.name}` }))}
          />
        )}
        {config.showGodown && (
          <Select
            aria-label={t('common.filterGodown')}
            showSearch
            placeholder={t('common.allGodowns')}
            style={{ minWidth: 160 }}
            allowClear
            value={godownId}
            onChange={setGodownId}
            options={godowns.map((g) => ({ value: g._id, label: g.name }))}
          />
        )}
        <Tooltip title={!canRun ? t('common.selectPartyFirst') : undefined}>
          <span>
            <DsButton
              dsVariant="primary"
              onClick={handleRun}
              disabled={!canRun}
              loading={loading}
              aria-busy={loading}
            >
              {t('common.runReport')}
            </DsButton>
          </span>
        </Tooltip>
      </div>
    </DsCard>
  );
}
