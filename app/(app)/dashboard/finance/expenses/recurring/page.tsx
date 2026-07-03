'use client';

// 4a: Recurring expense templates management (rent / electricity / maintenance).
// Lists templates and supports create / edit / pause / resume / trigger-now /
// delete. The backend engine + daily cron generate the actual expense vouchers.
// Polish slot: i18n via finance.purchases.recurring; the backend engine + cron are
// unchanged. Links to the expenses module (generated vouchers land there).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  App,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  DatePicker,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import {
  listFirms,
  listAccounts,
  listParties,
  listRecurringExpenses,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  recurringExpenseAction,
} from '@/lib/actions/finance.actions';
import { fmtPaise } from '@/lib/utils';
import { DsPageHeader } from '@/components/ui';
import type { Account, Party, RecurringExpenseTemplate } from '@/types';

type ScheduleMode = 'monthly' | 'quarterly' | 'yearly' | 'every_n_days';

interface LineFormValue {
  expenseAccountId?: string;
  description?: string;
  amountRupees?: number;
  gstRate?: number;
  itcEligibility?: 'full' | 'blocked' | 'nil_rated';
}

interface TemplateFormValues {
  templateName?: string;
  partyId?: string;
  paymentMode?: 'cash' | 'bank' | 'cheque' | 'upi';
  narration?: string;
  isIntraState?: boolean;
  autoPostOnGenerate?: boolean;
  scheduleMode?: ScheduleMode;
  dayOfMonth?: number;
  everyNDays?: number;
  startDate?: dayjs.Dayjs;
  endDate?: dayjs.Dayjs;
  lineItems?: LineFormValue[];
}

export default function RecurringExpensesPage() {
  const { message } = App.useApp();
  const t = useTranslations('finance.purchases.recurring');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const SCHEDULE_LABELS: Record<ScheduleMode, string> = {
    monthly: t('schedule.monthly'),
    quarterly: t('schedule.quarterly'),
    yearly: t('schedule.yearly'),
    every_n_days: t('schedule.everyNDays'),
  };

  const scheduleSummary = useCallback(
    (tpl: RecurringExpenseTemplate): string => {
      const s = tpl.schedule;
      if (s.mode === 'every_n_days') return t('schedule.everyDays', { n: s.everyNDays ?? '?' });
      if (s.dayOfMonth)
        return t('schedule.dayOf', { label: SCHEDULE_LABELS[s.mode], day: s.dayOfMonth });
      return SCHEDULE_LABELS[s.mode];
    },
    [t, SCHEDULE_LABELS],
  );

  const [firmId, setFirmId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [rows, setRows] = useState<RecurringExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<TemplateFormValues>();

  const expenseAccounts = useMemo(() => accounts.filter((a) => a.type === 'expense'), [accounts]);

  const refresh = useCallback(
    async (fId: string) => {
      const data = await listRecurringExpenses(wsId, fId);
      setRows(Array.isArray(data) ? data : []);
    },
    [wsId],
  );

  useEffect(() => {
    if (!wsId) return;
    let active = true;
    (async () => {
      try {
        const firms = await listFirms(wsId);
        const fId = firms?.[0]?._id ?? '';
        if (!active) return;
        setFirmId(fId);
        if (!fId) return;
        const [accts, partyRes] = await Promise.all([
          listAccounts(wsId, fId),
          listParties(wsId, fId),
        ]);
        if (!active) return;
        setAccounts(accts ?? []);
        setParties((partyRes as { items?: Party[] })?.items ?? []);
        await refresh(fId);
      } catch {
        if (active) message.error(t('loadFailed'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [wsId, refresh, message, t]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      paymentMode: 'bank',
      isIntraState: true,
      autoPostOnGenerate: false,
      scheduleMode: 'monthly',
      startDate: dayjs(),
      lineItems: [{ itcEligibility: 'full' }],
    });
    setDrawerOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (tpl: RecurringExpenseTemplate) => {
      setEditingId(tpl._id);
      form.setFieldsValue({
        templateName: tpl.templateName,
        partyId: tpl.partyId,
        paymentMode: tpl.paymentMode,
        narration: tpl.narration,
        isIntraState: tpl.isIntraState,
        autoPostOnGenerate: tpl.autoPostOnGenerate,
        scheduleMode: tpl.schedule.mode,
        dayOfMonth: tpl.schedule.dayOfMonth,
        everyNDays: tpl.schedule.everyNDays,
        startDate: tpl.schedule.startDate ? dayjs(tpl.schedule.startDate) : undefined,
        endDate: tpl.schedule.endDate ? dayjs(tpl.schedule.endDate) : undefined,
        lineItems: (tpl.lineItems ?? []).map((l) => ({
          expenseAccountId: l.expenseAccountId,
          description: l.description,
          amountRupees: l.amountPaise / 100,
          gstRate: l.gstRate,
          itcEligibility: l.itcEligibility,
        })),
      });
      setDrawerOpen(true);
    },
    [form],
  );

  const handleSave = useCallback(async () => {
    let values: TemplateFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload = {
      templateName: values.templateName,
      partyId: values.partyId || undefined,
      paymentMode: values.paymentMode,
      narration: values.narration ?? '',
      isIntraState: values.isIntraState ?? true,
      autoPostOnGenerate: values.autoPostOnGenerate ?? false,
      schedule: {
        mode: values.scheduleMode as ScheduleMode,
        dayOfMonth: values.dayOfMonth,
        everyNDays: values.everyNDays,
        startDate: (values.startDate ?? dayjs()).toISOString(),
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
      },
      lineItems: (values.lineItems ?? [])
        .filter((l) => l.expenseAccountId && l.amountRupees)
        .map((l) => ({
          expenseAccountId: l.expenseAccountId as string,
          description: l.description,
          amountPaise: Math.round((l.amountRupees ?? 0) * 100),
          gstRate: l.gstRate,
          itcEligibility: l.itcEligibility ?? 'full',
        })),
    };
    if (!payload.lineItems.length) {
      message.error(t('lines.needOneLine'));
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateRecurringExpense(wsId, firmId, editingId, payload as never);
        message.success(t('updated'));
      } else {
        await createRecurringExpense(wsId, firmId, payload as never);
        message.success(t('saved'));
      }
      setDrawerOpen(false);
      await refresh(firmId);
    } catch {
      message.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, wsId, firmId, refresh, message, t]);

  const doAction = useCallback(
    async (id: string, action: 'pause' | 'resume' | 'trigger') => {
      try {
        await recurringExpenseAction(wsId, firmId, id, action);
        message.success(
          action === 'trigger' ? t('generated') : action === 'pause' ? t('paused') : t('resumed'),
        );
        await refresh(firmId);
      } catch {
        message.error(t('actionFailed'));
      }
    },
    [wsId, firmId, refresh, message, t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteRecurringExpense(wsId, firmId, id);
        message.success(t('deleted'));
        await refresh(firmId);
      } catch {
        message.error(t('deleteFailed'));
      }
    },
    [wsId, firmId, refresh, message, t],
  );

  const scheduleMode = Form.useWatch('scheduleMode', form);

  const columns = [
    { title: t('col.template'), dataIndex: 'templateName', key: 'name' },
    {
      title: t('col.schedule'),
      key: 'schedule',
      render: (_: unknown, tpl: RecurringExpenseTemplate) => scheduleSummary(tpl),
    },
    {
      title: t('col.amount'),
      key: 'amount',
      align: 'right' as const,
      render: (_: unknown, tpl: RecurringExpenseTemplate) =>
        fmtPaise((tpl.lineItems ?? []).reduce((s, l) => s + (l.amountPaise ?? 0), 0)),
    },
    {
      title: t('col.nextRun'),
      dataIndex: 'nextRunAt',
      key: 'next',
      render: (v?: string) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
    },
    {
      title: t('col.runs'),
      dataIndex: 'runCount',
      key: 'runs',
      align: 'right' as const,
      width: 70,
    },
    {
      title: t('col.status'),
      key: 'status',
      render: (_: unknown, tpl: RecurringExpenseTemplate) =>
        tpl.isActive ? (
          <Tag color="green">{t('statusActive')}</Tag>
        ) : (
          <Tag>{t('statusPaused')}</Tag>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_: unknown, tpl: RecurringExpenseTemplate) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<ThunderboltOutlined />}
            title={t('action.generateNow')}
            onClick={() => doAction(tpl._id, 'trigger')}
          />
          {tpl.isActive ? (
            <Button
              type="text"
              size="small"
              icon={<PauseCircleOutlined />}
              title={t('action.pause')}
              onClick={() => doAction(tpl._id, 'pause')}
            />
          ) : (
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              title={t('action.resume')}
              onClick={() => doAction(tpl._id, 'resume')}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            title={t('action.edit')}
            onClick={() => openEdit(tpl)}
          />
          <Popconfirm title={t('deleteConfirm')} onConfirm={() => handleDelete(tpl._id)}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              title={t('action.delete')}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', marginTop: 48 }} />;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <DsPageHeader
        title={t('title')}
        sub={t('subtitle')}
        icon={<ReloadOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!firmId}>
            {t('new')}
          </Button>
        }
      />

      {rows.length === 0 ? (
        <Empty description={t('empty')} style={{ marginTop: 48 }} />
      ) : (
        <Table dataSource={rows} columns={columns} rowKey="_id" size="middle" pagination={false} />
      )}

      <Drawer
        title={editingId ? t('drawerEditTitle') : t('drawerNewTitle')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {t('save')}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('field.templateName')}
            name="templateName"
            rules={[{ required: true, message: t('field.templateNameRequired') }]}
          >
            <Input placeholder={t('field.templateNamePlaceholder')} />
          </Form.Item>

          <Space wrap size={16} style={{ width: '100%' }}>
            <Form.Item
              label={t('field.frequency')}
              name="scheduleMode"
              rules={[{ required: true }]}
              style={{ minWidth: 180 }}
            >
              <Select
                options={(Object.entries(SCHEDULE_LABELS) as [ScheduleMode, string][]).map(
                  ([value, label]) => ({
                    value,
                    label,
                  }),
                )}
              />
            </Form.Item>
            {scheduleMode === 'every_n_days' ? (
              <Form.Item
                label={t('field.everyNDays')}
                name="everyNDays"
                rules={[{ required: true, message: t('field.required') }]}
                style={{ minWidth: 140 }}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            ) : (
              <Form.Item label={t('field.dayOfMonth')} name="dayOfMonth" style={{ minWidth: 140 }}>
                <InputNumber
                  min={1}
                  max={31}
                  style={{ width: '100%' }}
                  placeholder={t('field.dayOfMonthPlaceholder')}
                />
              </Form.Item>
            )}
            <Form.Item
              label={t('field.startDate')}
              name="startDate"
              rules={[{ required: true, message: t('field.required') }]}
              style={{ minWidth: 160 }}
            >
              <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('field.endDate')} name="endDate" style={{ minWidth: 160 }}>
              <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space wrap size={16} style={{ width: '100%' }}>
            <Form.Item
              label={t('field.paymentMode')}
              name="paymentMode"
              rules={[{ required: true }]}
              style={{ minWidth: 160 }}
            >
              <Select
                options={[
                  { value: 'cash', label: t('paymentMode.cash') },
                  { value: 'bank', label: t('paymentMode.bank') },
                  { value: 'cheque', label: t('paymentMode.cheque') },
                  { value: 'upi', label: t('paymentMode.upi') },
                ]}
              />
            </Form.Item>
            <Form.Item label={t('field.vendorParty')} name="partyId" style={{ minWidth: 240 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={t('field.selectVendor')}
                options={parties.map((p) => ({ value: p._id, label: p.name }))}
              />
            </Form.Item>
            <Form.Item
              label={t('field.autoPost')}
              name="autoPostOnGenerate"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item label={t('field.narration')} name="narration">
            <Input placeholder={t('field.narrationPlaceholder')} />
          </Form.Item>

          <div style={{ fontWeight: 600, margin: '8px 0' }}>{t('lines.heading')}</div>
          <Form.List name="lineItems">
            {(fields, { add, remove }) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" wrap>
                    <Form.Item
                      {...rest}
                      name={[name, 'expenseAccountId']}
                      rules={[{ required: true, message: t('lines.accountRequired') }]}
                      style={{ minWidth: 240 }}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder={t('lines.account')}
                        options={expenseAccounts.map((a) => ({
                          value: a._id,
                          label: `${a.code} ${a.name}`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, 'amountRupees']}
                      rules={[{ required: true, message: t('lines.amountRequired') }]}
                      style={{ minWidth: 140 }}
                    >
                      <InputNumber
                        min={0}
                        prefix="₹"
                        style={{ width: '100%' }}
                        placeholder={t('lines.amount')}
                      />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'gstRate']} style={{ minWidth: 100 }}>
                      <Select
                        allowClear
                        placeholder={t('lines.gstPercent')}
                        options={[0, 5, 12, 18, 28].map((v) => ({ value: v, label: `${v}%` }))}
                      />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'itcEligibility']} style={{ minWidth: 140 }}>
                      <Select
                        options={[
                          { value: 'full', label: t('lines.itcFull') },
                          { value: 'blocked', label: t('lines.itcBlocked') },
                          { value: 'nil_rated', label: t('lines.itcNilRated') },
                        ]}
                      />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                      aria-label={t('lines.removeLine')}
                    />
                  </Space>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ itcEligibility: 'full' })}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {t('lines.addLine')}
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </div>
  );
}
