'use client';

import { startTransition, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Tag,
  Select,
  Skeleton,
  Table,
  Button,
  Modal,
  Form,
  InputNumber,
  message,
  Space,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, PhoneOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import {
  listCallTodos,
  completeCallTodo,
  snoozeCallTodo,
} from '@/lib/actions/finance-call-todos.actions';
import { CallTodoDrawer } from '@/components/finance/reminders/CallTodoDrawer';
import type { CallTodo, CallTodoStatus, CallTodoPriority } from '@/types';

const { Option } = Select;

const PRIORITY_COLOR: Record<CallTodoPriority, string> = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
};

const STATUS_COLOR: Record<CallTodoStatus, string> = {
  pending: 'blue',
  in_progress: 'processing',
  done: 'success',
  snoozed: 'warning',
  cancelled: 'default',
};

const STATUS_OPTIONS: CallTodoStatus[] = ['pending', 'in_progress', 'done', 'snoozed', 'cancelled'];

const formatPaise = (v: number | undefined) =>
  v != null ? `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

export default function CallTodosPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.misc');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [items, setItems] = useState<CallTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [drawerTodo, setDrawerTodo] = useState<CallTodo | null>(null);

  // Inline snooze modal
  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);
  const [snoozeForm] = Form.useForm();
  const [snoozeSaving, setSnoozeSaving] = useState(false);

  // Inline complete modal
  const [completeTarget, setCompleteTarget] = useState<string | null>(null);
  const [completeForm] = Form.useForm();
  const [completeSaving, setCompleteSaving] = useState(false);

  const load = useCallback(() => {
    if (!workspaceId || !isHydrated || !firmId) return;
    startTransition(() => {
      setLoading(true);
    });
    listCallTodos(workspaceId, firmId, { status: statusFilter || undefined, limit: 100 })
      .then(setItems)
      .catch(() => message.error(t('callTodos.loadFailed')))
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, statusFilter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleComplete = async (vals: { completionNote?: string }) => {
    if (!workspaceId || !completeTarget) return;
    setCompleteSaving(true);
    try {
      const updated = await completeCallTodo(
        workspaceId,
        firmId,
        completeTarget,
        vals.completionNote,
      );
      setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
      message.success(t('callTodos.markedDone'));
      setCompleteTarget(null);
      completeForm.resetFields();
    } catch {
      message.error(t('callTodos.completeFailed'));
    } finally {
      setCompleteSaving(false);
    }
  };

  const handleSnooze = async (vals: { days: number }) => {
    if (!workspaceId || !snoozeTarget) return;
    setSnoozeSaving(true);
    try {
      const updated = await snoozeCallTodo(workspaceId, firmId, snoozeTarget, vals.days);
      setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
      message.success(t('callTodos.snoozedDays', { days: vals.days }));
      setSnoozeTarget(null);
      snoozeForm.resetFields();
    } catch {
      message.error(t('callTodos.snoozeFailed'));
    } finally {
      setSnoozeSaving(false);
    }
  };

  const columns: ColumnsType<CallTodo> = [
    {
      title: t('callTodos.colTitle'),
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 500,
            color: 'var(--cr-primary)',
            padding: 0,
          }}
          onClick={() => setDrawerTodo(record)}
        >
          {title}
        </button>
      ),
    },
    {
      title: t('callTodos.colParty'),
      dataIndex: 'partyId',
      key: 'partyId',
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(-8)}</span>
      ),
      width: 100,
    },
    {
      title: t('callTodos.colTotalOverdue'),
      dataIndex: 'totalOverdueAmountPaise',
      key: 'totalOverdueAmountPaise',
      render: (v: number | undefined) => formatPaise(v),
      width: 130,
    },
    {
      title: t('callTodos.colContact'),
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      render: (v: string | undefined) => v ?? '-',
      width: 130,
    },
    {
      title: t('callTodos.colPriority'),
      dataIndex: 'priority',
      key: 'priority',
      render: (p: CallTodoPriority) => <Tag color={PRIORITY_COLOR[p]}>{p}</Tag>,
      width: 90,
    },
    {
      title: t('callTodos.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: CallTodoStatus) => <Tag color={STATUS_COLOR[s]}>{s.replace('_', ' ')}</Tag>,
      width: 110,
    },
    {
      title: t('callTodos.colAssignedTo'),
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(-8)}</span>
      ),
      width: 100,
    },
    {
      title: t('callTodos.colDueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (v: string | undefined) => {
        if (!v) return '-';
        const isPast = dayjs(v).isBefore(dayjs());
        return (
          <span style={{ color: isPast ? 'var(--cr-danger-700)' : undefined }}>
            {dayjs(v).format('DD MMM YYYY')}
          </span>
        );
      },
      width: 120,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            ghost
            disabled={record.status === 'done' || record.status === 'cancelled'}
            onClick={() => setCompleteTarget(record._id)}
          >
            {t('callTodos.markDone')}
          </Button>
          <Button
            size="small"
            disabled={record.status === 'done' || record.status === 'cancelled'}
            onClick={() => setSnoozeTarget(record._id)}
          >
            {t('callTodos.snooze')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('callTodos.title')}
        sub={t('callTodos.subtitle')}
        icon={<PhoneOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <Button icon={<ReloadOutlined />} onClick={load}>
            {t('callTodos.refresh')}
          </Button>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Select
            aria-label={t('callTodos.filterStatus')}
            value={statusFilter}
            style={{ width: '100%' }}
            onChange={(v) => setStatusFilter(v)}
            placeholder={t('callTodos.filterStatus')}
            allowClear
          >
            {STATUS_OPTIONS.map((s) => (
              <Option key={s} value={s}>
                {s.replace('_', ' ')}
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Table
          dataSource={items}
          columns={columns}
          rowKey="_id"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 50 }}
          locale={{ emptyText: t('callTodos.empty') }}
        />
      )}

      {/* Detail Drawer */}
      {drawerTodo && workspaceId && (
        <CallTodoDrawer
          wsId={workspaceId}
          firmId={firmId}
          todo={drawerTodo}
          open={Boolean(drawerTodo)}
          onClose={() => setDrawerTodo(null)}
          onUpdated={(updated) => {
            setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
            setDrawerTodo(updated);
          }}
        />
      )}

      {/* Complete Modal */}
      <Modal
        title={t('callTodos.markDoneTitle')}
        open={Boolean(completeTarget)}
        onCancel={() => {
          setCompleteTarget(null);
          completeForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
          <Form.Item name="completionNote" label={t('callTodos.completionNoteLabel')}>
            <input
              style={{
                width: '100%',
                padding: '4px 8px',
                border: '1px solid var(--cr-neutral-300)',
                borderRadius: 6,
              }}
              placeholder={t('callTodos.completionNotePlaceholder')}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={completeSaving}>
              {t('callTodos.confirmDone')}
            </Button>
            <Button
              onClick={() => {
                setCompleteTarget(null);
                completeForm.resetFields();
              }}
            >
              {t('common.cancel')}
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* Snooze Modal */}
      <Modal
        title={t('callTodos.snoozeTitle')}
        open={Boolean(snoozeTarget)}
        onCancel={() => {
          setSnoozeTarget(null);
          snoozeForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={snoozeForm}
          layout="vertical"
          onFinish={handleSnooze}
          initialValues={{ days: 3 }}
        >
          <Form.Item
            name="days"
            label={t('callTodos.snoozeDaysLabel')}
            rules={[{ required: true, type: 'number', min: 1, max: 30 }]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={snoozeSaving}>
              {t('callTodos.snooze')}
            </Button>
            <Button
              onClick={() => {
                setSnoozeTarget(null);
                snoozeForm.resetFields();
              }}
            >
              {t('common.cancel')}
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
