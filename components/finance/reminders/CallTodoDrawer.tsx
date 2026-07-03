'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  Button,
  Descriptions,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  message,
} from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  completeCallTodo,
  snoozeCallTodo,
  updateCallTodo,
} from '@/lib/actions/finance-call-todos.actions';
import type { CallTodo, CallTodoStatus, CallTodoPriority } from '@/types';

const { TextArea } = Input;

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

interface Props {
  wsId: string;
  firmId: string;
  todo: CallTodo;
  open: boolean;
  onClose: () => void;
  onUpdated: (updated: CallTodo) => void;
}

export function CallTodoDrawer({ wsId, firmId, todo, open, onClose, onUpdated }: Props) {
  const t = useTranslations('finance.misc');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reassignVisible, setReassignVisible] = useState(false);
  const [reassignId, setReassignId] = useState('');
  const [reassignError, setReassignError] = useState('');
  const [completeForm] = Form.useForm();
  const [snoozeForm] = Form.useForm();

  const handleComplete = async (vals: { completionNote?: string }) => {
    setSaving(true);
    try {
      const updated = await completeCallTodo(wsId, firmId, todo._id, vals.completionNote);
      message.success(t('callTodos.markedDone'));
      onUpdated(updated);
      setCompleteOpen(false);
      completeForm.resetFields();
    } catch {
      message.error(t('callTodos.completeFailedTask'));
    } finally {
      setSaving(false);
    }
  };

  const handleSnooze = async (vals: { days: number }) => {
    setSaving(true);
    try {
      const updated = await snoozeCallTodo(wsId, firmId, todo._id, vals.days);
      message.success(t('callTodos.snoozedDays', { days: vals.days }));
      onUpdated(updated);
      setSnoozeOpen(false);
      snoozeForm.resetFields();
    } catch {
      message.error(t('callTodos.snoozeFailedTask'));
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async (assignedTo: string) => {
    if (!assignedTo.trim()) return;
    setSaving(true);
    try {
      const updated = await updateCallTodo(wsId, firmId, todo._id, { assignedTo });
      message.success(t('callTodos.reassigned'));
      onUpdated(updated);
    } catch {
      message.error(t('callTodos.reassignFailed'));
    } finally {
      setSaving(false);
    }
  };

  const overdueAmount = todo.totalOverdueAmountPaise
    ? `₹${(todo.totalOverdueAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '-';

  const isDuePast = todo.dueDate && dayjs(todo.dueDate).isBefore(dayjs());

  const isValidObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

  return (
    <>
      <Drawer
        title={
          <span>
            {todo.title}
            <Tag color={PRIORITY_COLOR[todo.priority]} style={{ marginLeft: 8 }}>
              {todo.priority}
            </Tag>
          </span>
        }
        open={open}
        onClose={onClose}
        width={480}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={todo.status === 'done' || todo.status === 'cancelled'}
              onClick={() => setCompleteOpen(true)}
            >
              {t('callTodos.markDone')}
            </Button>
            <Button
              icon={<ClockCircleOutlined />}
              disabled={todo.status === 'done' || todo.status === 'cancelled'}
              onClick={() => setSnoozeOpen(true)}
            >
              {t('callTodos.snooze')}
            </Button>
            <Button
              icon={<SwapOutlined />}
              onClick={() => {
                setReassignVisible(true);
                setReassignId('');
                setReassignError('');
              }}
            >
              {t('callTodos.reassign')}
            </Button>
          </Space>
        }
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t('callTodos.colStatus')}>
            <Tag color={STATUS_COLOR[todo.status]}>{todo.status.replace('_', ' ')}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('callTodos.colPriority')}>
            <Tag color={PRIORITY_COLOR[todo.priority]}>{todo.priority}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('callTodos.colTotalOverdue')}>
            {overdueAmount}
          </Descriptions.Item>
          <Descriptions.Item label={t('callTodos.colContactPhone')}>
            {todo.contactPhone ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('callTodos.colContactName')}>
            {todo.contactName ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('callTodos.colAssignedTo')}>
            {todo.assignedTo}
          </Descriptions.Item>
          <Descriptions.Item label={t('callTodos.colDueDate')}>
            {todo.dueDate ? (
              <span style={{ color: isDuePast ? 'var(--cr-danger-700)' : undefined }}>
                {dayjs(todo.dueDate).format('DD MMM YYYY')}
                {isDuePast && ` ${t('callTodos.overdueSuffix')}`}
              </span>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('callTodos.colNotes')}>{todo.notes ?? '-'}</Descriptions.Item>
          {todo.completedAt && (
            <Descriptions.Item label={t('callTodos.colCompletedAt')}>
              {dayjs(todo.completedAt).format('DD MMM YYYY HH:mm')}
            </Descriptions.Item>
          )}
          {todo.completionNote && (
            <Descriptions.Item label={t('callTodos.colCompletionNote')}>
              {todo.completionNote}
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('callTodos.colCreatedAt')}>
            {dayjs(todo.createdAt).format('DD MMM YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Drawer>

      {/* Complete modal */}
      <Modal
        title={t('callTodos.markDoneTitle')}
        open={completeOpen}
        onCancel={() => {
          setCompleteOpen(false);
          completeForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
          <Form.Item name="completionNote" label={t('callTodos.completionNoteLabel')}>
            <TextArea rows={3} placeholder={t('callTodos.completionNotePlaceholderLong')} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<CheckCircleOutlined />}
              >
                {t('callTodos.confirmDone')}
              </Button>
              <Button
                onClick={() => {
                  setCompleteOpen(false);
                  completeForm.resetFields();
                }}
              >
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Snooze modal */}
      <Modal
        title={t('callTodos.snoozeTitle')}
        open={snoozeOpen}
        onCancel={() => {
          setSnoozeOpen(false);
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
            rules={[
              {
                required: true,
                type: 'number',
                min: 1,
                max: 30,
                message: t('callTodos.snoozeDaysError'),
              },
            ]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<ClockCircleOutlined />}
              >
                {t('callTodos.snooze')}
              </Button>
              <Button
                onClick={() => {
                  setSnoozeOpen(false);
                  snoozeForm.resetFields();
                }}
              >
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reassign modal */}
      <Modal
        title={t('callTodos.reassignTitle')}
        open={reassignVisible}
        onCancel={() => {
          setReassignVisible(false);
          setReassignId('');
          setReassignError('');
        }}
        onOk={async () => {
          if (!isValidObjectId(reassignId.trim())) {
            setReassignError(t('callTodos.reassignInvalid'));
            return;
          }
          await handleReassign(reassignId.trim());
          setReassignVisible(false);
          setReassignId('');
          setReassignError('');
        }}
        okText={t('callTodos.reassign')}
        okButtonProps={{ loading: saving }}
        destroyOnHidden
      >
        <Input
          placeholder={t('callTodos.reassignPlaceholder')}
          value={reassignId}
          onChange={(e) => {
            setReassignId(e.target.value);
            setReassignError('');
          }}
          maxLength={24}
          autoFocus
        />
        {reassignError && (
          <div style={{ color: 'var(--cr-danger-500)', marginTop: 4, fontSize: 12 }}>
            {reassignError}
          </div>
        )}
      </Modal>
    </>
  );
}
