'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Select, DatePicker, Tag, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { HistoryOutlined } from '@ant-design/icons';
import { DsPageHeader, DsTable, DsAvatar, DsEmptyState } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { getTeamActivity } from '@/lib/actions/team.actions';
import { parseApiError } from '@/lib/utils';
import type { ActivityEvent } from '@/types';
import {
  activityActionDef,
  activityMetaGroups,
  TEAM_ACTIVITY_ACTION_KEYS,
} from '@/components/activity/activity-labels';

const { RangePicker } = DatePicker;

export default function TeamActivityPage() {
  const t = useTranslations();
  const { currentWorkspaceId } = useWorkspaceStore();
  const { canPath, data: myPerms } = useMyPermissions();
  const canView = !!myPerms?.isOwner || canPath('team.appAccess.manage', 'all');

  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const limit = 25;

  const load = useCallback(() => {
    if (!currentWorkspaceId || !canView) return;
    // setState only in the async resolution (never synchronously inside the
    // effect) to satisfy the no-cascading-render rule. Re-fetch spinners are
    // driven from the user event handlers below (allowed) + initial loading.
    getTeamActivity(currentWorkspaceId, {
      action,
      dateFrom: range?.[0]?.startOf('day').toISOString(),
      dateTo: range?.[1]?.endOf('day').toISOString(),
      page,
      limit,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [currentWorkspaceId, canView, action, range, page]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo<ColumnsType<ActivityEvent>>(
    () => [
      {
        title: t('activity.columns.when'),
        key: 'when',
        width: 180,
        render: (_, e) =>
          new Date(e.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
      },
      {
        title: t('activity.columns.actor'),
        key: 'actor',
        render: (_, e) => (
          <div className="flex items-center gap-2">
            <DsAvatar name={e.actor.name} size={28} />
            <span className="font-medium">{e.actor.name}</span>
          </div>
        ),
      },
      {
        title: t('activity.columns.action'),
        key: 'action',
        render: (_, e) => {
          const def = activityActionDef(e.action);
          const groups = activityMetaGroups(e);
          return (
            <div className="flex flex-wrap items-center gap-1">
              <Tag color={def.tone} className="m-0">
                {t(def.labelKey as Parameters<typeof t>[0])}
              </Tag>
              {groups.map((g) => (
                <Tag key={g} className="m-0 text-[11px]">
                  {t(`activity.group.${g}` as Parameters<typeof t>[0])}
                </Tag>
              ))}
            </div>
          );
        },
      },
      {
        title: t('activity.columns.target'),
        key: 'target',
        render: (_, e) => e.target?.name ?? '-',
      },
    ],
    [t],
  );

  if (!canView) {
    return (
      <div className="p-6">
        <DsEmptyState title={t('activity.noAccessTitle')} sub={t('activity.noAccessBody')} />
      </div>
    );
  }

  const actionOptions = [
    { value: '', label: t('activity.filterAllActions') },
    ...TEAM_ACTIVITY_ACTION_KEYS.map((k) => ({
      value: k,
      label: t(activityActionDef(k).labelKey as Parameters<typeof t>[0]),
    })),
  ];

  return (
    <div className="p-4 md:p-6">
      <DsPageHeader
        icon={<HistoryOutlined />}
        title={t('activity.pageTitle')}
        sub={t('activity.pageSubtitle')}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          allowClear
          placeholder={t('activity.filterAction')}
          style={{ minWidth: 220 }}
          value={action ?? ''}
          options={actionOptions}
          onChange={(v) => {
            setLoading(true);
            setAction(v || undefined);
            setPage(1);
          }}
        />
        <RangePicker
          value={range}
          onChange={(v) => {
            setLoading(true);
            setRange(v as [Dayjs, Dayjs] | null);
            setPage(1);
          }}
          disabledDate={(d) => d && d > dayjs().endOf('day')}
        />
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : error ? (
        <DsEmptyState title={t('activity.errorTitle')} sub={error} />
      ) : (
        <DsTable<ActivityEvent>
          rowKey="id"
          columns={columns}
          dataSource={items}
          locale={{ emptyText: t('activity.emptyWorkspace') }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            onChange: (p) => {
              setLoading(true);
              setPage(p);
            },
          }}
        />
      )}
    </div>
  );
}
