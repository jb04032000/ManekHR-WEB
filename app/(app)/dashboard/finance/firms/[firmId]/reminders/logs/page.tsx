'use client';

import { startTransition, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Select, DatePicker, Skeleton, Spin, Tooltip, message, Row, Col } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { listReminderLogs } from '@/lib/actions/finance-reminders.actions';
import type { ReminderLog, ReminderChannel, ReminderStatus } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const { RangePicker } = DatePicker;
const { Option } = Select;

const CHANNEL_COLOR: Record<ReminderChannel, string> = {
  in_app: 'blue',
  email: 'green',
  sms: 'orange',
  push: 'purple',
  whatsapp: 'cyan',
};

const STATUS_COLOR: Record<ReminderStatus, string> = {
  sent: 'success',
  failed: 'error',
  skipped_cooldown: 'warning',
  skipped_optout: 'warning',
  skipped_no_contact: 'warning',
};

// Maps each ReminderStatus to its finance.reminders.logs.status i18n key.
const STATUS_I18N: Record<ReminderStatus, string> = {
  sent: 'sent',
  failed: 'failed',
  skipped_cooldown: 'skippedCooldown',
  skipped_optout: 'skippedOptout',
  skipped_no_contact: 'skippedNoContact',
};

const CHANNEL_OPTIONS: ReminderChannel[] = ['in_app', 'email', 'sms', 'push', 'whatsapp'];
const STATUS_OPTIONS: ReminderStatus[] = [
  'sent',
  'failed',
  'skipped_cooldown',
  'skipped_optout',
  'skipped_no_contact',
];

const PAGE_SIZE = 50;

export default function ReminderLogsPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.reminders');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const remindersAccess = useFeatureAccess('reminders');

  // Localised status label resolved from the channel/status i18n maps.
  const statusLabel = (s: ReminderStatus) =>
    t(`logs.status.${STATUS_I18N[s]}` as Parameters<typeof t>[0]);

  const [items, setItems] = useState<ReminderLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);

  // Persist the primary channel filter per firm (survives navigation / reload).
  const [channelFilter, setChannelFilter] = usePersistedState<string | undefined>(
    `finance:reminderLogs:channel:${firmId || 'global'}`,
    undefined,
  );
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const load = useCallback(() => {
    if (!workspaceId || !isHydrated || !firmId || remindersAccess.isLocked) return;
    // reloadKey is a dep so the Retry button (which bumps it) re-runs this fetch.
    void reloadKey;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listReminderLogs(workspaceId, firmId, {
      channel: channelFilter,
      status: statusFilter,
      fromDate: dateRange?.[0]?.format('YYYY-MM-DD'),
      toDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      page,
      pageSize: PAGE_SIZE,
    })
      .then((r) => {
        setItems(r.items ?? []);
        setTotal(r.total ?? 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
        setError(true);
        message.error(t('logs.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [
    workspaceId,
    isHydrated,
    firmId,
    channelFilter,
    statusFilter,
    dateRange,
    page,
    remindersAccess.isLocked,
    reloadKey,
    t,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<ReminderLog> = [
    {
      title: t('logs.colCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
      width: 160,
    },
    {
      title: t('logs.colChannel'),
      dataIndex: 'channel',
      key: 'channel',
      render: (c: ReminderChannel) => (
        <Tag color={CHANNEL_COLOR[c] ?? 'default'} style={{ textTransform: 'capitalize' }}>
          {c}
        </Tag>
      ),
      width: 100,
    },
    {
      title: t('logs.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: ReminderStatus) => (
        <Tag color={STATUS_COLOR[s] ?? 'default'}>{STATUS_I18N[s] ? statusLabel(s) : s}</Tag>
      ),
      width: 180,
    },
    {
      title: t('logs.colRecipient'),
      dataIndex: 'recipient',
      key: 'recipient',
      render: (v: string | undefined) => v ?? '-',
      width: 160,
    },
    {
      title: t('logs.colRule'),
      dataIndex: 'ruleId',
      key: 'ruleId',
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(-8)}</span>
        </Tooltip>
      ),
      width: 100,
    },
    {
      title: t('logs.colParty'),
      dataIndex: 'partyId',
      key: 'partyId',
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(-8)}</span>
        </Tooltip>
      ),
      width: 100,
    },
    {
      title: t('logs.colInvoice'),
      dataIndex: 'invoiceId',
      key: 'invoiceId',
      render: (v: string | undefined) =>
        v ? (
          <a
            href={`/dashboard/finance/firms/${firmId}/sales/invoices/${v}`}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          >
            {v.slice(-8)}
          </a>
        ) : (
          '-'
        ),
      width: 100,
    },
    {
      title: t('logs.colError'),
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      render: (v: string | undefined) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ color: 'var(--cr-danger-700)', cursor: 'pointer' }}>
              {v.length > 60 ? v.slice(0, 60) + '…' : v}
            </span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
  ];

  if (remindersAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (remindersAccess.isLocked) {
    return <ModuleLockedPage module="reminders" />;
  }

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('logs.title')}
        sub={t('logs.subtitle')}
        icon={<FileTextOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={10}>
          <RangePicker
            style={{ width: '100%' }}
            onChange={(dates) => {
              setPage(1);
              setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null);
            }}
          />
        </Col>
        <Col xs={12} sm={7}>
          <Select
            aria-label={t('logs.filterChannel')}
            placeholder={t('logs.filterChannel')}
            allowClear
            style={{ width: '100%' }}
            value={channelFilter}
            onChange={(v) => {
              setPage(1);
              setChannelFilter(v);
            }}
          >
            {CHANNEL_OPTIONS.map((c) => (
              <Option key={c} value={c}>
                {c}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={12} sm={7}>
          <Select
            aria-label={t('logs.filterStatus')}
            placeholder={t('logs.filterStatus')}
            allowClear
            style={{ width: '100%' }}
            onChange={(v) => {
              setPage(1);
              setStatusFilter(v);
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <Option key={s} value={s}>
                {statusLabel(s)}
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <DsTable
          dataSource={items}
          columns={columns}
          rowKey="_id"
          scrollX={1000}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
          }}
          locale={{ emptyText: t('logs.empty') }}
        />
      )}
    </div>
  );
}
