'use client';

import { startTransition, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Tag, Switch, Popconfirm, Skeleton, Spin, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import {
  listReminderRules,
  updateReminderRule,
  deleteReminderRule,
} from '@/lib/actions/finance-reminders.actions';
import type { ReminderRule } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const TRIGGER_COLOR: Record<string, string> = {
  invoice_overdue: 'blue',
  invoice_due_soon: 'green',
  service_maintenance: 'gold',
};

// finance.reminders.rules.trigger i18n key for each trigger type.
const TRIGGER_I18N: Record<string, string> = {
  invoice_overdue: 'invoiceOverdue',
  invoice_due_soon: 'dueSoon',
  service_maintenance: 'maintenance',
};

const ESCALATION_COLOR: Record<number, string> = { 1: 'blue', 2: 'orange', 3: 'red' };
// finance.reminders.rules.escalationLabel i18n key per escalation level.
const ESCALATION_I18N: Record<number, string> = { 1: 'gentle', 2: 'firm', 3: 'final' };

// Channel flag -> finance.reminders.rules.channelShort i18n key.
const CHANNELS = [
  { key: 'channelInApp', i18n: 'app' },
  { key: 'channelEmail', i18n: 'email' },
  { key: 'channelSms', i18n: 'sms' },
  { key: 'channelPush', i18n: 'push' },
  { key: 'channelWhatsApp', i18n: 'whatsapp' },
] as const;

export default function ReminderRulesPage() {
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.reminders');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const remindersAccess = useFeatureAccess('reminders');

  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!workspaceId || !isHydrated || !firmId || remindersAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listReminderRules(workspaceId, firmId)
      .then(setRules)
      .catch(() => {
        setRules([]);
        setError(true);
        message.error(t('rules.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, remindersAccess.isLocked, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (rule: ReminderRule, checked: boolean) => {
    if (!workspaceId) return;
    setTogglingId(rule._id);
    try {
      const updated = await updateReminderRule(workspaceId, firmId, rule._id, {
        isActive: checked,
      });
      setRules((prev) => prev.map((r) => (r._id === rule._id ? updated : r)));
    } catch {
      message.error(t('rules.updateFailed'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!workspaceId) return;
    try {
      await deleteReminderRule(workspaceId, firmId, ruleId);
      setRules((prev) => prev.filter((r) => r._id !== ruleId));
      message.success(t('rules.deleted'));
    } catch {
      message.error(t('rules.deleteFailed'));
    }
  };

  const columns: ColumnsType<ReminderRule> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: t('rules.colTriggerType'),
      dataIndex: 'triggerType',
      key: 'triggerType',
      render: (tt: string) => (
        <Tag color={TRIGGER_COLOR[tt] ?? 'default'}>
          {TRIGGER_I18N[tt]
            ? t(`rules.trigger.${TRIGGER_I18N[tt]}` as Parameters<typeof t>[0])
            : tt}
        </Tag>
      ),
    },
    {
      title: t('rules.colDaysOffset'),
      dataIndex: 'daysOffset',
      key: 'daysOffset',
      render: (d: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {d > 0 ? `+${d}` : d}{' '}
          {d < 0
            ? t('rules.daysOffsetBefore', { days: Math.abs(d) })
            : d > 0
              ? t('rules.daysOffsetAfter', { days: d })
              : t('rules.daysOffsetOnDay')}
        </span>
      ),
    },
    {
      title: t('rules.colEscalation'),
      dataIndex: 'escalationLevel',
      key: 'escalationLevel',
      render: (l: number) => (
        <Tag color={ESCALATION_COLOR[l] ?? 'default'}>
          L{l}{' '}
          {ESCALATION_I18N[l]
            ? t(`rules.escalationLabel.${ESCALATION_I18N[l]}` as Parameters<typeof t>[0])
            : ''}
        </Tag>
      ),
    },
    {
      title: t('rules.colChannels'),
      key: 'channels',
      render: (_, rule) => (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CHANNELS.filter((c) => rule[c.key]).map((c) => (
            <Tag key={c.key} style={{ margin: 0 }}>
              {t(`rules.channelShort.${c.i18n}` as Parameters<typeof t>[0])}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      title: t('common.party'),
      key: 'party',
      render: (_, rule) => (
        <span
          style={{
            color: rule.partyId ? undefined : 'var(--cr-text-3)',
            fontStyle: rule.partyId ? undefined : 'italic',
          }}
        >
          {rule.partyId ? rule.partyId : t('common.global')}
        </span>
      ),
    },
    {
      title: t('common.active'),
      key: 'isActive',
      render: (_, rule) => (
        <Switch
          checked={rule.isActive}
          loading={togglingId === rule._id}
          onChange={(checked) => handleToggle(rule, checked)}
          size="small"
        />
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, rule) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/reminders/rules/${rule._id}/edit`)
            }
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('rules.deleteTitle')}
            description={t('rules.deleteDescription')}
            onConfirm={() => handleDelete(rule._id)}
            okText={t('common.delete')}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </span>
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
        title={t('rules.title')}
        sub={t('rules.subtitle')}
        icon={<UnorderedListOutlined />}
        style={{ marginBottom: 24 }}
        right={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push(`/dashboard/finance/firms/${firmId}/reminders/rules/new`)}
          >
            {t('rules.createRule')}
          </Button>
        }
      />

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={load}
        />
      ) : loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <DsTable
          dataSource={rules}
          columns={columns}
          rowKey="_id"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: t('rules.empty') }}
        />
      )}
    </div>
  );
}
