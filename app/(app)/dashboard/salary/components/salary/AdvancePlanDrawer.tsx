 
'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Skeleton,
  Space,
  Table,
  Tag,
} from 'antd';
import {
  CheckCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { DsDrawer } from '@/components/ui';
import { salaryApi } from '@/lib/api/modules/salary.api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import type { AdvanceInstallmentRow, AdvanceRecoveryPlan } from '@/types';

interface AdvancePlanDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  planId: string | null;
  onChanged?: () => void;
}

const INSTALLMENT_STATUS_COLOR: Record<AdvanceInstallmentRow['status'], string> = {
  scheduled: 'default',
  applied: 'success',
  reversed: 'error',
  carried: 'warning',
};

const PLAN_STATUS_COLOR: Record<AdvanceRecoveryPlan['status'], string> = {
  active: 'processing',
  paused: 'warning',
  completed: 'success',
  reversed: 'error',
};

function formatMonthLabel(month: number, year: number): string {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY');
}

export function AdvancePlanDrawer({
  open,
  onClose,
  workspaceId,
  planId,
  onChanged,
}: AdvancePlanDrawerProps) {
  const t = useTranslations('salary.advancePlan');
  const { message } = App.useApp();

  const [plan, setPlan] = useState<AdvanceRecoveryPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Change installment amount state
  const [newInstallmentAmount, setNewInstallmentAmount] = useState<number | null>(null);

  // Early payoff modal state
  const [earlyPayoffOpen, setEarlyPayoffOpen] = useState(false);
  const [earlyPayoffReason, setEarlyPayoffReason] = useState('');
  const [earlyPayoffSubmitting, setEarlyPayoffSubmitting] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!planId || !workspaceId) return;
    setLoading(true);
    try {
      const result = await salaryApi.getAdvanceRecoveryPlanDetail(workspaceId, planId);
      setPlan(result);
      setNewInstallmentAmount(null);
    } catch (e) {
      message.error(parseApiError(e) || t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [planId, workspaceId, message, t]);

  useEffect(() => {
    if (open && planId) {
      void loadPlan();
    } else {
      startTransition(() => {
        setPlan(null);
        setNewInstallmentAmount(null);
      });
    }
  }, [open, planId, loadPlan]);

  const isCompleted = plan?.status === 'completed' || plan?.status === 'reversed';

  const handleSaveInstallment = async () => {
    if (!planId || newInstallmentAmount == null || newInstallmentAmount <= 0) return;
    setActionLoading(true);
    try {
      await salaryApi.editAdvanceRecoveryPlan(workspaceId, planId, {
        installmentAmount: newInstallmentAmount,
      });
      message.success(t('saveSuccess'));
      onChanged?.();
      await loadPlan();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseResume = async () => {
    if (!planId || !plan) return;
    const action = plan.status === 'paused' ? 'resume' : 'pause';
    setActionLoading(true);
    try {
      await salaryApi.editAdvanceRecoveryPlan(workspaceId, planId, { action });
      message.success(action === 'pause' ? t('pauseSuccess') : t('resumeSuccess'));
      onChanged?.();
      await loadPlan();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEarlyPayoffSubmit = async () => {
    if (!planId || !earlyPayoffReason.trim()) return;
    setEarlyPayoffSubmitting(true);
    try {
      await salaryApi.earlyPayoffAdvancePlan(workspaceId, planId, {
        reason: earlyPayoffReason.trim(),
      });
      message.success(t('earlyPayoffSuccess'));
      setEarlyPayoffOpen(false);
      setEarlyPayoffReason('');
      onChanged?.();
      await loadPlan();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setEarlyPayoffSubmitting(false);
    }
  };

  const columns: ColumnsType<AdvanceInstallmentRow> = [
    {
      title: t('colIndex'),
      dataIndex: 'index',
      key: 'index',
      width: 44,
      render: (v: number) => <span className="text-faint tabular-nums">{v}</span>,
    },
    {
      title: t('colMonthLabel'),
      key: 'month',
      render: (_: unknown, row: AdvanceInstallmentRow) => formatMonthLabel(row.month, row.year),
      width: 110,
    },
    {
      title: t('colPlanned'),
      dataIndex: 'plannedAmount',
      key: 'plannedAmount',
      align: 'right',
      render: (v: number) => (
        <span className="font-medium tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('colApplied'),
      dataIndex: 'appliedAmount',
      key: 'appliedAmount',
      align: 'right',
      render: (v: number) => (
        <span className="text-muted tabular-nums">{v > 0 ? formatCurrencyFull(v) : '-'}</span>
      ),
    },
    {
      title: t('colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: AdvanceInstallmentRow['status']) => (
        <Tag color={INSTALLMENT_STATUS_COLOR[s] ?? 'default'}>{t(`installmentStatus.${s}`)}</Tag>
      ),
    },
  ];

  return (
    <>
      <DsDrawer
        open={open}
        onClose={onClose}
        title={t('drawerTitle')}
        subtitle={t('drawerSubtitle')}
      >
        <div className="px-5 py-4">
          {loading && (
            <div className="flex flex-col gap-4">
              <Skeleton active paragraph={{ rows: 3 }} />
              <Skeleton active paragraph={{ rows: 6 }} />
            </div>
          )}

          {!loading && plan && (
            <>
              {/* Summary header */}
              <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div
                  className="rounded-xl p-2.5"
                  style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                >
                  <p className="m-0 text-[10px] font-semibold tracking-wider text-faint uppercase">
                    {t('totalAdvanced')}
                  </p>
                  <p className="m-0 mt-1 text-[15px] font-bold text-heading tabular-nums">
                    {formatCurrencyFull(plan.totalAmount)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-2.5"
                  style={{
                    background: 'var(--cr-success-50)',
                    border: '1px solid var(--cr-success-50)',
                  }}
                >
                  <p className="m-0 text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                    {t('recovered')}
                  </p>
                  <p className="m-0 mt-1 text-[15px] font-bold text-green-700 tabular-nums">
                    {formatCurrencyFull(plan.recoveredAmount)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-2.5"
                  style={{
                    background: 'var(--cr-danger-50)',
                    border: '1px solid var(--cr-danger-50)',
                  }}
                >
                  <p className="m-0 text-[10px] font-semibold tracking-wider text-red-700 uppercase">
                    {t('remaining')}
                  </p>
                  <p className="m-0 mt-1 text-[15px] font-bold text-red-700 tabular-nums">
                    {formatCurrencyFull(plan.remainingAmount)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-2.5"
                  style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                >
                  <p className="m-0 text-[10px] font-semibold tracking-wider text-faint uppercase">
                    {t('statusLabel')}
                  </p>
                  <div className="mt-1">
                    <Tag color={PLAN_STATUS_COLOR[plan.status] ?? 'default'}>
                      {t(`status.${plan.status}`)}
                    </Tag>
                  </div>
                </div>
              </div>

              {/* Installment schedule */}
              <div
                className="mb-4 overflow-hidden rounded-xl"
                style={{ border: '1px solid var(--cr-border)' }}
              >
                <Table<AdvanceInstallmentRow>
                  rowKey={(row) => `${row.year}-${row.month}-${row.index}`}
                  size="small"
                  columns={columns}
                  dataSource={plan.installments}
                  pagination={false}
                  locale={{ emptyText: t('emptySchedule') }}
                />
              </div>

              {/* Actions section */}
              {!isCompleted && (
                <>
                  <Divider style={{ margin: '12px 0' }} />

                  {/* Change installment amount */}
                  <div className="mb-4">
                    <p className="m-0 mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
                      {t('changeInstallment')}
                    </p>
                    <Space.Compact className="w-full">
                      <InputNumber
                        className="flex-1"
                        min={1}
                        precision={0}
                        prefix="₹"
                        placeholder={String(plan.installmentAmount)}
                        value={newInstallmentAmount}
                        onChange={(v) => setNewInstallmentAmount(v)}
                        disabled={actionLoading}
                        style={{ width: '100%' }}
                      />
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        loading={actionLoading}
                        disabled={newInstallmentAmount == null || newInstallmentAmount <= 0}
                        onClick={() => void handleSaveInstallment()}
                      >
                        {t('changeInstallmentSave')}
                      </Button>
                    </Space.Compact>
                  </div>

                  {/* Pause / Resume */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button
                      icon={
                        plan.status === 'paused' ? <PlayCircleOutlined /> : <PauseCircleOutlined />
                      }
                      loading={actionLoading}
                      onClick={() => void handlePauseResume()}
                    >
                      {plan.status === 'paused' ? t('resumeAction') : t('pauseAction')}
                    </Button>

                    {/* Early payoff */}
                    <Button
                      danger
                      icon={<ThunderboltOutlined />}
                      loading={actionLoading}
                      onClick={() => setEarlyPayoffOpen(true)}
                    >
                      {t('earlyPayoffAction')}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {!loading && !plan && planId && (
            <p className="text-[13px] text-subtle">{t('loadFailed')}</p>
          )}
        </div>
      </DsDrawer>

      {/* Early payoff confirmation modal */}
      <Modal
        open={earlyPayoffOpen}
        title={t('earlyPayoffConfirmTitle')}
        okText={t('earlyPayoffConfirmOk')}
        cancelText={t('earlyPayoffConfirmCancel')}
        okButtonProps={{ danger: true, loading: earlyPayoffSubmitting }}
        onCancel={() => {
          setEarlyPayoffOpen(false);
          setEarlyPayoffReason('');
        }}
        onOk={() => void handleEarlyPayoffSubmit()}
        destroyOnHidden
      >
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            label={t('earlyPayoffReasonLabel')}
            required
            help={
              earlyPayoffSubmitting && !earlyPayoffReason.trim()
                ? t('earlyPayoffReasonRequired')
                : undefined
            }
          >
            <Input.TextArea
              rows={3}
              placeholder={t('earlyPayoffReasonPlaceholder')}
              value={earlyPayoffReason}
              onChange={(e) => setEarlyPayoffReason(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
