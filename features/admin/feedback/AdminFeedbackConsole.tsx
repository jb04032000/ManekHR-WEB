'use client';

// Admin feedback console (English/AntD only — admin surfaces are not i18n'd).
// Lists feedback, filters by status/scope/search, opens a detail Drawer with the
// context block + signed photo URLs, and updates status + admin notes. Backed by
// admin/feedback (feedback-admin.controller.ts) via feedback.actions.ts.
// Double-gated: client redirect in AdminLayout + IsAdminGuard on the BE.
import { useCallback, useState } from 'react';
import { Table, Tag, Drawer, Select, Input, Button, Image, Space, message } from 'antd';
import type { TableProps } from 'antd';
import { listFeedback, getFeedback, updateFeedbackStatus } from './feedback.actions';
import type { AdminFeedbackRow, AdminFeedbackDetail, FeedbackStatus } from './feedback.types';

const STATUSES: FeedbackStatus[] = ['new', 'reviewed', 'in_progress', 'resolved', 'wont_fix'];
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  new: 'blue',
  reviewed: 'cyan',
  in_progress: 'gold',
  resolved: 'green',
  wont_fix: 'default',
};

export default function AdminFeedbackConsole({
  initial,
}: {
  initial: { items: AdminFeedbackRow[]; total: number };
}) {
  const [rows, setRows] = useState<AdminFeedbackRow[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<AdminFeedbackDetail | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  const reload = useCallback(
    async (page = 1) => {
      setLoading(true);
      const res = await listFeedback({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter,
        scope: scopeFilter,
      });
      setLoading(false);
      if (res.ok) {
        setRows(res.data.items);
        setTotal(res.data.total);
      } else {
        msgApi.error(res.error);
      }
    },
    [search, statusFilter, scopeFilter, msgApi],
  );

  const openDetail = useCallback(
    async (id: string) => {
      const res = await getFeedback(id);
      if (res.ok) setDetail(res.data);
      else msgApi.error(res.error);
    },
    [msgApi],
  );

  const setStatus = useCallback(
    async (status: FeedbackStatus) => {
      if (!detail) return;
      setSavingStatus(true);
      const res = await updateFeedbackStatus(detail._id, status, detail.adminNotes ?? undefined);
      setSavingStatus(false);
      if (res.ok) {
        msgApi.success('Status updated.');
        setDetail(res.data);
        setRows((prev) => prev.map((r) => (r._id === res.data._id ? { ...r, status } : r)));
      } else {
        msgApi.error(res.error);
      }
    },
    [detail, msgApi],
  );

  const columns: TableProps<AdminFeedbackRow>['columns'] = [
    { title: 'Date', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: 'Module', dataIndex: 'module' },
    { title: 'Scope', dataIndex: 'scope' },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Rating', dataIndex: 'rating', render: (v: number | null) => v ?? '—' },
    { title: 'Photos', dataIndex: 'attachmentCount' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: FeedbackStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: '',
      key: 'open',
      render: (_, row) => (
        <Button size="small" onClick={() => openDetail(row._id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Search message / module"
          allowClear
          onSearch={(v) => {
            setSearch(v);
            void reload(1);
          }}
          style={{ width: 260 }}
        />
        <Select
          placeholder="Status"
          allowClear
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            void reload(1);
          }}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Select
          placeholder="Scope"
          allowClear
          style={{ width: 140 }}
          value={scopeFilter}
          onChange={(v) => {
            setScopeFilter(v);
            void reload(1);
          }}
          options={[
            { value: 'page', label: 'This page' },
            { value: 'general', label: 'General' },
          ]}
        />
      </Space>

      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ total, pageSize: 20, onChange: (p) => void reload(p) }}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        size="large"
        destroyOnHidden
        title="Feedback detail"
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Tag color={STATUS_COLOR[detail.status]}>{detail.status}</Tag>
              <span style={{ marginLeft: 8 }}>
                {detail.module} · {detail.scope} · {detail.category}
                {detail.rating != null ? ` · ${detail.rating}/5` : ''}
              </span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.message}</p>

            {detail.attachments.length > 0 && (
              <Image.PreviewGroup>
                <Space wrap>
                  {detail.attachments.map((url, i) => (
                    <Image
                      key={i}
                      src={url}
                      alt={`Feedback attachment ${i + 1}`}
                      width={84}
                      height={84}
                      style={{ objectFit: 'cover' }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            )}

            {detail.context && (
              <div style={{ fontSize: 12, color: 'var(--cr-text-3)', lineHeight: 1.7 }}>
                <div>Page: {detail.context.path}</div>
                <div>Locale: {detail.context.locale}</div>
                <div>Viewport: {detail.context.viewport}</div>
                <div style={{ wordBreak: 'break-all' }}>Device: {detail.context.userAgent}</div>
              </div>
            )}

            <Input.TextArea
              rows={3}
              placeholder="Admin notes"
              value={detail.adminNotes ?? ''}
              onChange={(e) => setDetail({ ...detail, adminNotes: e.target.value })}
            />
            <Space wrap>
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  type={detail.status === s ? 'primary' : 'default'}
                  loading={savingStatus && detail.status !== s}
                  onClick={() => void setStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </Space>
          </div>
        )}
      </Drawer>
    </>
  );
}
