'use client';

import { useCallback, useState } from 'react';
import { Table, Tag, Select, Segmented, Typography, message, Button, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  listCustomPlanRequests,
  updateCustomPlanRequest,
  type CustomPlanRequestRow,
  type CustomPlanRequestStatus,
  type CustomPlanRequestKind,
} from './custom-plan-requests.actions';

/**
 * Admin console for plan leads (/admin/custom-plan-requests). Lists BOTH kinds in
 * one queue: 'custom' (the tailored-plan request form) and 'plan' (a Subscribe
 * click on a predefined paid plan while online payments are off). The Type column
 * flags which is which; a kind filter narrows to one. Status triages inline
 * (new -> contacted -> closed). Backed by admin/custom-plan-requests
 * (AdminCustomPlanRequestsController). Desktop-first; the table scrolls
 * horizontally on narrow widths.
 */
const STATUS_META: Record<CustomPlanRequestStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'gold' },
  contacted: { label: 'Contacted', color: 'blue' },
  closed: { label: 'Closed', color: 'default' },
};

const STATUS_OPTIONS = (['new', 'contacted', 'closed'] as const).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
}));

// Lead-kind flag shown in the Type column + the kind filter. Legacy rows have no
// `kind` (BE defaults to 'custom'), so undefined is treated as 'custom'.
const KIND_META: Record<CustomPlanRequestKind, { label: string; color: string }> = {
  custom: { label: 'Custom', color: 'purple' },
  plan: { label: 'Plan', color: 'geekblue' },
};

type FilterValue = 'all' | CustomPlanRequestStatus;
type KindFilterValue = 'all' | CustomPlanRequestKind;

export default function AdminCustomPlanConsole({
  initial,
}: {
  initial: { items: CustomPlanRequestRow[]; total: number };
}) {
  const [rows, setRows] = useState<CustomPlanRequestRow[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [kindFilter, setKindFilter] = useState<KindFilterValue>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [msgApi, ctx] = message.useMessage();

  // Reload with the current status + kind filters (both passed explicitly so the
  // segmented onChange handlers don't race the state update).
  const load = useCallback(
    async (nextStatus: FilterValue, nextKind: KindFilterValue) => {
      setLoading(true);
      const res = await listCustomPlanRequests({
        status: nextStatus === 'all' ? undefined : nextStatus,
        kind: nextKind === 'all' ? undefined : nextKind,
        limit: 100,
        offset: 0,
      });
      setLoading(false);
      if (!res.ok) {
        msgApi.error(res.error || 'Could not load requests');
        return;
      }
      setRows(res.data.items);
      setTotal(res.data.total);
    },
    [msgApi],
  );

  const onFilter = (value: FilterValue) => {
    setFilter(value);
    void load(value, kindFilter);
  };

  const onKindFilter = (value: KindFilterValue) => {
    setKindFilter(value);
    void load(filter, value);
  };

  const onStatusChange = async (id: string, status: CustomPlanRequestStatus) => {
    setUpdatingId(id);
    const res = await updateCustomPlanRequest(id, { status });
    setUpdatingId(null);
    if (!res.ok) {
      msgApi.error(res.error || 'Could not update status');
      return;
    }
    // Optimistically reflect the new status in place.
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, status } : r)));
    msgApi.success('Status updated');
  };

  const columns: ColumnsType<CustomPlanRequestRow> = [
    {
      title: 'Received',
      dataIndex: 'createdAt',
      width: 120,
      render: (v: string) => (
        <span style={{ whiteSpace: 'nowrap' }}>{v ? dayjs(v).format('DD MMM YYYY') : '-'}</span>
      ),
    },
    {
      // Flag: which surface produced the lead. 'plan' rows also show the plan name
      // the user clicked Subscribe on; 'custom' (or legacy undefined) = the form.
      title: 'Type',
      dataIndex: 'kind',
      width: 130,
      render: (_: unknown, r) => {
        const kind: CustomPlanRequestKind = r.kind === 'plan' ? 'plan' : 'custom';
        const meta = KIND_META[kind];
        return (
          <div>
            <Tag color={meta.color}>{meta.label}</Tag>
            {kind === 'plan' && r.planName ? (
              <div style={{ marginTop: 2, fontSize: 12, color: 'var(--cr-text-3)' }}>
                {r.planName}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: 'Requester',
      dataIndex: 'userName',
      width: 200,
      render: (_: string, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.userName || 'Unknown user'}</div>
          {r.userEmail ? (
            <div style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>{r.userEmail}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Team',
      dataIndex: 'teamMembers',
      width: 80,
      align: 'right',
      // Optional now: plan-interest leads may omit team size -> show a dash.
      render: (v?: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v != null ? v : '-'}</span>
      ),
    },
    {
      title: 'Cos / Factories',
      dataIndex: 'companiesOrFactories',
      width: 120,
      align: 'right',
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v || '-'}</span>,
    },
    {
      title: 'Mobile',
      dataIndex: 'mobile',
      width: 150,
      render: (v: string) =>
        v ? (
          <a href={`tel:${v}`} style={{ whiteSpace: 'nowrap' }}>
            {v}
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: 'Note',
      dataIndex: 'note',
      render: (v: string) =>
        v ? (
          <Tooltip title={v}>
            <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, maxWidth: 320 }}>
              {v}
            </Typography.Paragraph>
          </Tooltip>
        ) : (
          <span style={{ color: 'var(--cr-text-3)' }}>-</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (status: CustomPlanRequestStatus, r) => (
        <Select<CustomPlanRequestStatus>
          value={status}
          options={STATUS_OPTIONS}
          loading={updatingId === r._id}
          disabled={updatingId === r._id}
          style={{ width: 130 }}
          onChange={(next) => onStatusChange(r._id, next)}
          // Coloured tag preview keeps the at-a-glance status legible.
          optionRender={(opt) => (
            <Tag color={STATUS_META[opt.value as CustomPlanRequestStatus].color}>{opt.label}</Tag>
          )}
        />
      ),
    },
  ];

  return (
    <div>
      {ctx}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 'var(--cr-space-md)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Segmented<FilterValue>
            value={filter}
            onChange={(v) => onFilter(v as FilterValue)}
            options={[
              { label: 'All', value: 'all' },
              { label: 'New', value: 'new' },
              { label: 'Contacted', value: 'contacted' },
              { label: 'Closed', value: 'closed' },
            ]}
          />
          {/* Lead-kind filter: All / Custom (form) / Plan (predefined-plan click). */}
          <Segmented<KindFilterValue>
            value={kindFilter}
            onChange={(v) => onKindFilter(v as KindFilterValue)}
            options={[
              { label: 'All types', value: 'all' },
              { label: 'Custom', value: 'custom' },
              { label: 'Plan', value: 'plan' },
            ]}
          />
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => load(filter, kindFilter)}
          loading={loading}
        >
          Refresh
        </Button>
      </div>
      <Table<CustomPlanRequestRow>
        rowKey="_id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: () => `${total} request${total === 1 ? '' : 's'}` }}
        scroll={{ x: 1080 }}
        locale={{ emptyText: 'No plan requests yet.' }}
      />
    </div>
  );
}
