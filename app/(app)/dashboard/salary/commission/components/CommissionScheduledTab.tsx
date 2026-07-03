'use client';

import { useState } from 'react';
import {
  App,
  Button,
  Drawer,
  Form,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { salaryApi } from '@/lib/api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import type {
  CommissionFrequency,
  CommissionSchedule,
  CommissionScheduleStatus,
  CommissionType,
  CreateCommissionSchedulePayload,
  TeamMember,
  UpdateCommissionSchedulePayload,
} from '@/types';

const COMMISSION_TYPES: CommissionType[] = [
  'sales',
  'production_piece',
  'attendance',
  'referral',
  'other',
];

const COMMISSION_CALC_BASES = ['flat', 'percent_of_revenue', 'per_unit', 'formula_result'] as const;

const FREQUENCIES: CommissionFrequency[] = ['monthly', 'quarterly', 'annual'];

const STATUS_COLOR: Record<CommissionScheduleStatus, string> = {
  active: 'success',
  paused: 'warning',
  completed: 'default',
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: dayjs().month(i).format('MMMM'),
}));

const CURRENT_YEAR = dayjs().year();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: CURRENT_YEAR - i,
  label: String(CURRENT_YEAR - i),
}));

interface Props {
  schedules: CommissionSchedule[];
  loading: boolean;
  memberMap: Map<string, TeamMember>;
  workspaceId: string;
  onRefresh: () => void;
}

interface ScheduleFormValues {
  teamMemberId: string;
  commissionType: CommissionType;
  calcBasis: (typeof COMMISSION_CALC_BASES)[number];
  amount: number;
  frequency: CommissionFrequency;
  startMonth: number;
  startYear: number;
  endMonth?: number;
  endYear?: number;
  note?: string;
}

export function CommissionScheduledTab({
  schedules,
  loading,
  memberMap,
  workspaceId,
  onRefresh,
}: Props) {
  const t = useTranslations('salary.commission');
  const { message } = App.useApp();
  const [form] = Form.useForm<ScheduleFormValues>();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CommissionSchedule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Disburse modal state
  const [disburseScheduleId, setDisburseScheduleId] = useState<string | null>(null);
  const [disburseMonth, setDisburseMonth] = useState<number>(dayjs().month() + 1);
  const [disburseYear, setDisburseYear] = useState<number>(dayjs().year());
  const [disburseLoading, setDisburseLoading] = useState(false);

  const memberOptions = Array.from(memberMap.values()).map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const openCreate = () => {
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldsValue({
      startMonth: dayjs().month() + 1,
      startYear: dayjs().year(),
      commissionType: 'other',
      calcBasis: 'flat',
      frequency: 'monthly',
    });
    setDrawerOpen(true);
  };

  const openEdit = (schedule: CommissionSchedule) => {
    setEditingSchedule(schedule);
    form.setFieldsValue({
      teamMemberId: schedule.teamMemberId,
      commissionType: schedule.commissionType,
      calcBasis: schedule.calcBasis,
      amount: schedule.amount,
      frequency: schedule.frequency,
      startMonth: schedule.startMonth,
      startYear: schedule.startYear,
      endMonth: schedule.endMonth,
      endYear: schedule.endYear,
      note: schedule.note,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    let values: ScheduleFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      if (editingSchedule) {
        const patch: UpdateCommissionSchedulePayload = {
          amount: values.amount,
          commissionType: values.commissionType,
          endMonth: values.endMonth,
          endYear: values.endYear,
          note: values.note,
        };
        await salaryApi.updateCommissionSchedule(workspaceId, editingSchedule._id, patch);
        message.success(t('scheduleUpdateSuccess'));
      } else {
        const payload: CreateCommissionSchedulePayload = {
          teamMemberId: values.teamMemberId,
          commissionType: values.commissionType,
          calcBasis: values.calcBasis,
          amount: values.amount,
          frequency: values.frequency,
          startMonth: values.startMonth,
          startYear: values.startYear,
          endMonth: values.endMonth,
          endYear: values.endYear,
          note: values.note,
        };
        await salaryApi.createCommissionSchedule(workspaceId, payload);
        message.success(t('scheduleCreateSuccess'));
      }
      setDrawerOpen(false);
      onRefresh();
    } catch (e) {
      message.error(parseApiError(e) || t('scheduleError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await salaryApi.deleteCommissionSchedule(workspaceId, scheduleId);
      message.success(t('scheduleDeleteSuccess'));
      onRefresh();
    } catch (e) {
      message.error(parseApiError(e) || t('scheduleError'));
    }
  };

  const handlePauseResume = async (schedule: CommissionSchedule) => {
    try {
      const newStatus = schedule.status === 'active' ? 'paused' : 'active';
      await salaryApi.updateCommissionSchedule(workspaceId, schedule._id, {
        status: newStatus,
      });
      message.success(newStatus === 'paused' ? t('schedulePaused') : t('scheduleResumed'));
      onRefresh();
    } catch (e) {
      message.error(parseApiError(e) || t('scheduleError'));
    }
  };

  const handleDisburse = async () => {
    if (!disburseScheduleId) return;
    setDisburseLoading(true);
    try {
      const result = await salaryApi.disburseCommissionSchedule(workspaceId, disburseScheduleId, {
        month: disburseMonth,
        year: disburseYear,
      });
      if (result.wasAlreadyDisbursed) {
        message.info(t('disburseAlreadyDone'));
      } else {
        message.success(t('disburseSuccess'));
      }
      setDisburseScheduleId(null);
      onRefresh();
    } catch (e) {
      message.error(parseApiError(e) || t('disburseError'));
    } finally {
      setDisburseLoading(false);
    }
  };

  const columns: ColumnsType<CommissionSchedule> = [
    {
      title: t('colEmployee'),
      key: 'employee',
      render: (_: unknown, row: CommissionSchedule) => {
        const member = memberMap.get(row.teamMemberId);
        return (
          <div>
            <p className="m-0 text-[14px] font-medium text-heading">
              {member?.name ?? row.teamMemberId}
            </p>
            {member?.designation && (
              <p className="m-0 text-[12px] text-subtle">{member.designation}</p>
            )}
          </div>
        );
      },
    },
    {
      title: t('colType'),
      dataIndex: 'commissionType',
      key: 'commissionType',
      render: (ct: CommissionType) => t(`commissionType.${ct}`),
    },
    {
      title: t('colFrequency'),
      dataIndex: 'frequency',
      key: 'frequency',
      render: (f: CommissionFrequency) => t(`frequency.${f}`),
    },
    {
      title: t('colAmount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => (
        <span className="font-medium tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('colNextDue'),
      key: 'nextDue',
      render: (_: unknown, row: CommissionSchedule) =>
        `${dayjs()
          .month(row.nextDueMonth - 1)
          .format('MMM')} ${row.nextDueYear}`,
    },
    {
      title: t('colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: CommissionScheduleStatus) => (
        <Tag color={STATUS_COLOR[s] ?? 'default'}>{t(`scheduleStatus.${s}`)}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      render: (_: unknown, row: CommissionSchedule) => (
        <Space size="small">
          <Button size="small" onClick={() => openEdit(row)}>
            {t('editBtn')}
          </Button>
          {row.status !== 'completed' && (
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                setDisburseScheduleId(row._id);
                setDisburseMonth(row.nextDueMonth);
                setDisburseYear(row.nextDueYear);
              }}
            >
              {t('disburseBtn')}
            </Button>
          )}
          {row.status !== 'completed' && (
            <Button size="small" onClick={() => void handlePauseResume(row)}>
              {row.status === 'active' ? t('pauseBtn') : t('resumeBtn')}
            </Button>
          )}
          <Popconfirm
            title={t('deleteConfirmTitle')}
            description={t('deleteConfirmDesc')}
            onConfirm={() => void handleDelete(row._id)}
            okText={t('deleteConfirmOk')}
            cancelText={t('cancelBtn')}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="py-4">
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t('addScheduleBtn')}
        </Button>
      </div>

      <Table<CommissionSchedule>
        rowKey="_id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={schedules}
        pagination={{
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total) => t('paginationTotal', { total }),
        }}
        locale={{ emptyText: t('emptySchedules') }}
        scroll={{ x: 'max-content' }}
      />

      {/* Create / Edit schedule drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingSchedule ? t('editScheduleTitle') : t('createScheduleTitle')}
        size={480}
        destroyOnHidden
        extra={
          <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
            {editingSchedule ? t('saveBtn') : t('createBtn')}
          </Button>
        }
      >
        <Form form={form} layout="vertical" autoComplete="off">
          {!editingSchedule && (
            <Form.Item
              name="teamMemberId"
              label={t('fieldMember')}
              rules={[{ required: true, message: t('fieldMemberRequired') }]}
            >
              <Select
                showSearch
                placeholder={t('fieldMemberPlaceholder')}
                optionFilterProp="label"
                options={memberOptions}
              />
            </Form.Item>
          )}
          <Form.Item
            name="commissionType"
            label={t('fieldCommissionType')}
            rules={[{ required: true }]}
          >
            <Select
              options={COMMISSION_TYPES.map((ct) => ({
                value: ct,
                label: t(`commissionType.${ct}`),
              }))}
            />
          </Form.Item>
          {!editingSchedule && (
            <Form.Item name="calcBasis" label={t('fieldCalcBasis')} rules={[{ required: true }]}>
              <Select
                options={COMMISSION_CALC_BASES.map((b) => ({
                  value: b,
                  label: t(`calcBasis.${b}`),
                }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="amount"
            label={t('fieldAmount')}
            rules={[{ required: true, type: 'number', min: 0.01 }]}
          >
            <InputNumber prefix="Rs" min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          {!editingSchedule && (
            <Form.Item name="frequency" label={t('fieldFrequency')} rules={[{ required: true }]}>
              <Select
                options={FREQUENCIES.map((f) => ({
                  value: f,
                  label: t(`frequency.${f}`),
                }))}
              />
            </Form.Item>
          )}
          {!editingSchedule && (
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="startMonth"
                label={t('fieldStartMonth')}
                rules={[{ required: true }]}
              >
                <Select options={MONTH_OPTIONS} />
              </Form.Item>
              <Form.Item name="startYear" label={t('fieldStartYear')} rules={[{ required: true }]}>
                <Select options={YEAR_OPTIONS} />
              </Form.Item>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="endMonth" label={t('fieldEndMonth')}>
              <Select
                allowClear
                options={MONTH_OPTIONS}
                placeholder={t('fieldEndMonthPlaceholder')}
              />
            </Form.Item>
            <Form.Item name="endYear" label={t('fieldEndYear')}>
              <Select
                allowClear
                options={YEAR_OPTIONS}
                placeholder={t('fieldEndYearPlaceholder')}
              />
            </Form.Item>
          </div>
          <Form.Item name="note" label={t('fieldNote')}>
            <Select
              mode="tags"
              maxCount={1}
              placeholder={t('fieldNotePlaceholder')}
              options={[]}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Disburse now drawer */}
      <Drawer
        open={disburseScheduleId !== null}
        onClose={() => setDisburseScheduleId(null)}
        title={t('disburseDrawerTitle')}
        size={360}
        destroyOnHidden
        extra={
          <Button type="primary" loading={disburseLoading} onClick={() => void handleDisburse()}>
            {t('disburseConfirmBtn')}
          </Button>
        }
      >
        <p className="mb-4 text-[13px] text-subtle">{t('disburseDrawerDesc')}</p>
        <Form layout="vertical">
          <Form.Item label={t('fieldMonth')}>
            <Select
              style={{ width: '100%' }}
              value={disburseMonth}
              onChange={setDisburseMonth}
              options={MONTH_OPTIONS}
            />
          </Form.Item>
          <Form.Item label={t('fieldYear')}>
            <Select
              style={{ width: '100%' }}
              value={disburseYear}
              onChange={setDisburseYear}
              options={YEAR_OPTIONS}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
