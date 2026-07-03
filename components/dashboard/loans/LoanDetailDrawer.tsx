 
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusCircleOutlined,
  StepBackwardOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { salaryApi } from '@/lib/api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import type { EmployerLoan, LoanInstallment, LoanInstallmentStatus, LoanStatus } from '@/types';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Status / color helpers
// ---------------------------------------------------------------------------

const INSTALLMENT_STATUS_COLOR: Record<LoanInstallmentStatus, string> = {
  scheduled: 'default',
  applied: 'success',
  reversed: 'error',
  skipped: 'warning',
  carried: 'processing',
};

const LOAN_STATUS_COLOR: Record<LoanStatus, string> = {
  draft: 'default',
  pending_approval: 'warning',
  active: 'processing',
  paused: 'orange',
  completed: 'success',
  written_off: 'error',
  reversed: 'error',
};

function formatMonthYear(month: number, year: number): string {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LoanDetailDrawerProps {
  open: boolean;
  loanId: string | null;
  workspaceId: string;
  memberName?: string;
  onClose: () => void;
  onMutated?: () => void;
}

// ---------------------------------------------------------------------------
// Action modals -- local sub-components kept inline for cohesion
// ---------------------------------------------------------------------------

interface ApproveModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function ApproveModal({ open, workspaceId, loanId, onDone, onCancel }: ApproveModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const handleApprove = async () => {
    setSaving(true);
    try {
      const updated = await salaryApi.approveLoan(workspaceId, loanId, { decision: 'approve' });
      message.success(t('actionApproveSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionApproveTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={saving}
            onClick={() => void handleApprove()}
          >
            {t('actionApproveBtn')}
          </Button>
        </Space>
      }
    >
      <p className="m-0 text-sm text-body">{t('actionApproveConfirm')}</p>
    </Modal>
  );
}

interface RejectModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function RejectModal({ open, workspaceId, loanId, onDone, onCancel }: RejectModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [form] = Form.useForm<{ comment: string }>();
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await salaryApi.rejectLoan(workspaceId, loanId, values.comment);
      message.success(t('actionRejectSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionRejectTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Button
            danger
            icon={<CloseOutlined />}
            loading={saving}
            onClick={() => void handleReject()}
          >
            {t('actionRejectBtn')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="comment"
          label={t('actionRejectReasonLabel')}
          rules={[{ required: true, message: t('actionRejectReasonRequired') }]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface SkipInstallmentModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  installments: LoanInstallment[];
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function SkipInstallmentModal({
  open,
  workspaceId,
  loanId,
  installments,
  onDone,
  onCancel,
}: SkipInstallmentModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [form] = Form.useForm<{
    installmentIndex: number;
    knockOnChoice: 'extend_tenor' | 'raise_emi';
    skipReason: string;
  }>();
  const [saving, setSaving] = useState(false);

  const skippableInstallments = installments.filter((i) => i.status === 'scheduled');

  const handleSkip = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await salaryApi.skipLoanInstallment(workspaceId, loanId, {
        installmentIndex: values.installmentIndex,
        knockOnChoice: values.knockOnChoice,
        skipReason: values.skipReason,
      });
      message.success(t('actionSkipSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionSkipTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Button
            type="primary"
            icon={<StepBackwardOutlined />}
            loading={saving}
            onClick={() => void handleSkip()}
          >
            {t('actionSkipBtn')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="installmentIndex"
          label={t('actionSkipInstallmentLabel')}
          rules={[{ required: true, message: t('actionSkipInstallmentRequired') }]}
        >
          <Select
            options={skippableInstallments.map((i) => ({
              value: i.index,
              label: `#${i.index + 1} - ${formatMonthYear(i.month, i.year)} (${formatCurrencyFull(i.emiPlanned)})`,
            }))}
            placeholder={t('actionSkipInstallmentPlaceholder')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          name="knockOnChoice"
          label={t('actionSkipKnockOnLabel')}
          rules={[{ required: true, message: t('actionSkipKnockOnRequired') }]}
        >
          <Radio.Group>
            <Radio value="extend_tenor">{t('knockOnExtendTenor')}</Radio>
            <Radio value="raise_emi">{t('knockOnRaiseEmi')}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="skipReason"
          label={t('actionSkipReasonLabel')}
          rules={[{ required: true, message: t('actionSkipReasonRequired') }]}
        >
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface PauseLoanModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function PauseLoanModal({ open, workspaceId, loanId, onDone, onCancel }: PauseLoanModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [form] = Form.useForm<{ pauseResumeDate?: dayjs.Dayjs; reason?: string }>();
  const [saving, setSaving] = useState(false);

  const handlePause = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await salaryApi.pauseLoan(workspaceId, loanId, {
        action: 'pause',
        pauseResumeDate: values.pauseResumeDate
          ? values.pauseResumeDate.startOf('month').toISOString()
          : undefined,
        reason: values.reason,
      });
      message.success(t('actionPauseSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionPauseTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Button
            type="primary"
            icon={<PauseCircleOutlined />}
            loading={saving}
            onClick={() => void handlePause()}
          >
            {t('actionPauseBtn')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="pauseResumeDate" label={t('actionPauseResumeDateLabel')}>
          <DatePicker picker="month" style={{ width: '100%' }} format="MMM YYYY" />
        </Form.Item>
        <Form.Item name="reason" label={t('actionPauseReasonLabel')}>
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>
        <Alert
          type="info"
          showIcon
          title={t('actionPauseHintTitle')}
          description={t('actionPauseHintDesc')}
        />
      </Form>
    </Modal>
  );
}

interface ResumeLoanModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function ResumeLoanModal({ open, workspaceId, loanId, onDone, onCancel }: ResumeLoanModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const handleResume = async () => {
    setSaving(true);
    try {
      const updated = await salaryApi.resumeLoan(workspaceId, loanId, { action: 'resume' });
      message.success(t('actionResumeSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionResumeTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={saving}
            onClick={() => void handleResume()}
          >
            {t('actionResumeBtn')}
          </Button>
        </Space>
      }
    >
      <p className="m-0 text-sm text-body">{t('actionResumeConfirm')}</p>
    </Modal>
  );
}

interface EarlyPayoffModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  remainingAmount: number;
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function EarlyPayoffModal({
  open,
  workspaceId,
  loanId,
  remainingAmount,
  onDone,
  onCancel,
}: EarlyPayoffModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [form] = Form.useForm<{ payoffAmount: number; reason: string }>();
  const [saving, setSaving] = useState(false);

  const handlePayoff = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await salaryApi.earlyPayoffLoan(workspaceId, loanId, {
        payoffAmount: values.payoffAmount,
        reason: values.reason,
      });
      message.success(t('actionEarlyPayoffSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionEarlyPayoffTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Button
            type="primary"
            icon={<RupeeOutlined />}
            loading={saving}
            onClick={() => void handlePayoff()}
          >
            {t('actionEarlyPayoffBtn')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ payoffAmount: remainingAmount }}>
        <Form.Item
          name="payoffAmount"
          label={t('actionEarlyPayoffAmountLabel')}
          extra={`${t('actionEarlyPayoffOutstanding')} ${formatCurrencyFull(remainingAmount)}`}
          rules={[
            { required: true, message: t('actionEarlyPayoffAmountRequired') },
            {
              type: 'number',
              min: 0.01,
              message: t('actionEarlyPayoffAmountMin'),
            },
          ]}
        >
          <InputNumber min={0.01} precision={2} prefix="Rs." style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="reason"
          label={t('actionEarlyPayoffReasonLabel')}
          rules={[{ required: true, message: t('actionEarlyPayoffReasonRequired') }]}
        >
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>
        <Alert
          type="warning"
          showIcon
          title={t('actionEarlyPayoffHintTitle')}
          description={t('actionEarlyPayoffHintDesc')}
        />
      </Form>
    </Modal>
  );
}

interface TopUpModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  currentTenor: number;
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function TopUpModal({
  open,
  workspaceId,
  loanId,
  currentTenor,
  onDone,
  onCancel,
}: TopUpModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [form] = Form.useForm<{
    additionalAmount: number;
    disbursementDate: dayjs.Dayjs;
    disbursedOutsideApp: boolean;
    newTenorMonths?: number;
    reason: string;
  }>();
  const [saving, setSaving] = useState(false);

  const handleTopUp = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await salaryApi.topUpLoan(workspaceId, loanId, {
        additionalAmount: values.additionalAmount,
        disbursementDate: values.disbursementDate.toISOString(),
        disbursedOutsideApp: values.disbursedOutsideApp,
        newTenorMonths: values.newTenorMonths,
        reason: values.reason,
      });
      message.success(t('actionTopUpSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionTopUpTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Button
            type="primary"
            icon={<PlusCircleOutlined />}
            loading={saving}
            onClick={() => void handleTopUp()}
          >
            {t('actionTopUpBtn')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ disbursedOutsideApp: true }}>
        <Form.Item
          name="additionalAmount"
          label={t('actionTopUpAmountLabel')}
          rules={[
            { required: true, message: t('actionTopUpAmountRequired') },
            { type: 'number', min: 1, message: t('actionTopUpAmountMin') },
          ]}
        >
          <InputNumber min={1} precision={0} prefix="Rs." style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="disbursementDate"
          label={t('actionTopUpDisbDateLabel')}
          rules={[{ required: true, message: t('actionTopUpDisbDateRequired') }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>
        <Form.Item
          name="newTenorMonths"
          label={t('actionTopUpNewTenorLabel')}
          extra={`${t('actionTopUpCurrentTenor')} ${currentTenor} ${t('monthsSuffix')}`}
        >
          <InputNumber
            min={1}
            max={120}
            precision={0}
            suffix={t('monthsSuffix')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          name="reason"
          label={t('actionTopUpReasonLabel')}
          rules={[{ required: true, message: t('actionTopUpReasonRequired') }]}
        >
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface WriteOffModalProps {
  open: boolean;
  workspaceId: string;
  loanId: string;
  remainingAmount: number;
  onDone: (updated: EmployerLoan) => void;
  onCancel: () => void;
}

function WriteOffModal({
  open,
  workspaceId,
  loanId,
  remainingAmount,
  onDone,
  onCancel,
}: WriteOffModalProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [form] = Form.useForm<{ writeOffAmount: number; reason: string }>();
  const [saving, setSaving] = useState(false);

  const handleWriteOff = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await salaryApi.writeOffLoan(workspaceId, loanId, {
        writeOffAmount: values.writeOffAmount,
        reason: values.reason,
      });
      message.success(t('actionWriteOffSuccess'));
      onDone(updated);
    } catch (e) {
      message.error(parseApiError(e) || t('actionError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('actionWriteOffTitle')}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('cancelBtn')}</Button>
          <Popconfirm
            title={t('actionWriteOffConfirmTitle')}
            description={t('actionWriteOffConfirmDesc')}
            onConfirm={() => void handleWriteOff()}
            okText={t('actionWriteOffConfirmOk')}
            okButtonProps={{ danger: true }}
            cancelText={t('cancelBtn')}
          >
            <Button danger icon={<StopOutlined />} loading={saving}>
              {t('actionWriteOffBtn')}
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ writeOffAmount: remainingAmount }}>
        <Form.Item
          name="writeOffAmount"
          label={t('actionWriteOffAmountLabel')}
          extra={`${t('actionWriteOffOutstanding')} ${formatCurrencyFull(remainingAmount)}`}
          rules={[
            { required: true, message: t('actionWriteOffAmountRequired') },
            { type: 'number', min: 0.01, message: t('actionWriteOffAmountMin') },
          ]}
        >
          <InputNumber min={0.01} precision={2} prefix="Rs." style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="reason"
          label={t('actionWriteOffReasonLabel')}
          rules={[{ required: true, message: t('actionWriteOffReasonRequired') }]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
        <Alert
          type="error"
          showIcon
          title={t('actionWriteOffWarningTitle')}
          description={t('actionWriteOffWarningDesc')}
        />
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

type ActiveModal =
  | 'approve'
  | 'reject'
  | 'skip'
  | 'pause'
  | 'resume'
  | 'earlyPayoff'
  | 'topUp'
  | 'writeOff'
  | null;

export function LoanDetailDrawer({
  open,
  loanId,
  workspaceId,
  memberName,
  onClose,
  onMutated,
}: LoanDetailDrawerProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();

  const [loan, setLoan] = useState<EmployerLoan | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const loadLoan = useCallback(async () => {
    if (!loanId || !workspaceId) return;
    setLoading(true);
    try {
      const data = await salaryApi.getLoan(workspaceId, loanId);
      setLoan(data);
    } catch (e) {
      message.error(parseApiError(e) || t('detailLoadError'));
    } finally {
      setLoading(false);
    }
  }, [loanId, workspaceId, message, t]);

  useEffect(() => {
    if (open && loanId) {
      void loadLoan();
    } else if (!open) {
      setLoan(null);
      setActiveModal(null);
    }
  }, [open, loanId, loadLoan]);

  const handleMutationDone = (updated: EmployerLoan) => {
    setLoan(updated);
    setActiveModal(null);
    onMutated?.();
  };

  // State machine: which actions are legal in each status
  const canApprove = loan?.status === 'pending_approval';
  const canReject = loan?.status === 'pending_approval';
  const canSkip = loan?.status === 'active';
  const canPause = loan?.status === 'active';
  const canResume = loan?.status === 'paused';
  const canEarlyPayoff = loan?.status === 'active' || loan?.status === 'paused';
  const canTopUp = loan?.status === 'active';
  const canWriteOff = loan?.status === 'active' || loan?.status === 'paused';

  // Installment table columns
  const installmentColumns: ColumnsType<LoanInstallment> = [
    {
      title: '#',
      key: 'idx',
      width: 36,
      render: (_: unknown, r: LoanInstallment) => (
        <span className="text-[12px] text-faint tabular-nums">{r.index + 1}</span>
      ),
    },
    {
      title: t('detailColMonth'),
      key: 'month',
      render: (_: unknown, r: LoanInstallment) => (
        <span className="text-[13px]">{formatMonthYear(r.month, r.year)}</span>
      ),
    },
    {
      title: t('detailColEmi'),
      dataIndex: 'emiPlanned',
      key: 'emiPlanned',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] font-medium tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('detailColPrincipal'),
      dataIndex: 'principalPlanned',
      key: 'principalPlanned',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] text-subtle tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('detailColInterest'),
      dataIndex: 'interestPlanned',
      key: 'interestPlanned',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] text-subtle tabular-nums">
          {v > 0 ? formatCurrencyFull(v) : '-'}
        </span>
      ),
    },
    {
      title: t('detailColApplied'),
      dataIndex: 'appliedAmount',
      key: 'appliedAmount',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] tabular-nums">{v > 0 ? formatCurrencyFull(v) : '-'}</span>
      ),
    },
    {
      title: t('detailColInstStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: LoanInstallmentStatus) => (
        <Tag color={INSTALLMENT_STATUS_COLOR[s] ?? 'default'}>{t(`installmentStatus.${s}`)}</Tag>
      ),
    },
  ];

  const interestLabel =
    loan?.interestType === 'zero'
      ? t('interestType.zero')
      : loan?.interestType === 'flat'
        ? `${t('interestType.flat')} ${loan?.annualInterestRate}% p.a.`
        : `${t('interestType.reducing_balance')} ${loan?.annualInterestRate}% p.a.`;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={
          <div>
            <p className="m-0 text-[15px] font-semibold text-heading">{t('detailDrawerTitle')}</p>
            {memberName && <p className="m-0 text-[12px] text-subtle">{memberName}</p>}
          </div>
        }
        size={760}
        styles={{ body: { padding: '16px 20px' } }}
      >
        {loading && <Skeleton active paragraph={{ rows: 8 }} />}

        {!loading && !loan && <Alert type="error" title={t('detailLoadError')} showIcon />}

        {!loading && loan && (
          <div className="flex flex-col gap-5">
            {/* Summary */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="m-0 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {t('detailSummarySection')}
                </p>
                <Tag color={LOAN_STATUS_COLOR[loan.status] ?? 'default'} className="text-[12px]">
                  {t(`loanStatus.${loan.status}`)}
                </Tag>
              </div>

              <Descriptions
                size="small"
                column={{ xs: 1, sm: 2, md: 3 }}
                bordered
                className="rounded-xl"
              >
                <Descriptions.Item label={t('detailLoanType')}>
                  {t(`loanType.${loan.loanType}`)}
                </Descriptions.Item>
                <Descriptions.Item label={t('detailPrincipal')}>
                  <Text strong className="tabular-nums">
                    {formatCurrencyFull(loan.principalAmount)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('detailInterest')}>{interestLabel}</Descriptions.Item>
                <Descriptions.Item label={t('detailEmi')}>
                  <Text strong className="tabular-nums">
                    {formatCurrencyFull(loan.emiAmount)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('detailTenor')}>
                  {`${loan.tenorMonths} ${t('monthsSuffix')}`}
                </Descriptions.Item>
                <Descriptions.Item label={t('detailStartDate')}>
                  {formatMonthYear(loan.startMonth, loan.startYear)}
                </Descriptions.Item>
                <Descriptions.Item label={t('detailDisbursementDate')}>
                  {dayjs(loan.disbursementDate).format('DD MMM YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label={t('detailDisbursedOutsideApp')}>
                  {loan.disbursedOutsideApp ? t('yes') : t('no')}
                </Descriptions.Item>
                {loan.disbursementReferenceNo && (
                  <Descriptions.Item label={t('detailDisbRef')}>
                    {loan.disbursementReferenceNo}
                  </Descriptions.Item>
                )}
                {loan.medicalLoanExempt && (
                  <Descriptions.Item label={t('detailPerqNote')}>
                    <Tag color="green">{t('detailPerqExempt')}</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>

            {/* Recovery progress */}
            <div>
              <p className="m-0 mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
                {t('detailRecoverySection')}
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: t('detailRecovered'), value: loan.recoveredAmount, emphasis: false },
                  { label: t('detailRemaining'), value: loan.remainingAmount, emphasis: true },
                  {
                    label: t('detailRemainingPrincipal'),
                    value: loan.remainingPrincipal,
                    emphasis: false,
                  },
                  {
                    label: t('detailInterestPaid'),
                    value: loan.interestPaidToDate,
                    emphasis: false,
                  },
                ].map(({ label, value, emphasis }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3"
                    style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                  >
                    <p className="m-0 text-[10px] font-semibold tracking-wider text-faint uppercase">
                      {label}
                    </p>
                    <p
                      className={`m-0 mt-1 text-[15px] font-bold tabular-nums ${emphasis ? 'text-heading' : 'text-body'}`}
                    >
                      {formatCurrencyFull(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Approval chain */}
            {loan.approvalChain.length > 0 && (
              <div>
                <p className="m-0 mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {t('detailApprovalSection')}
                </p>
                <div className="flex flex-col gap-1.5">
                  {loan.approvalChain.map((step) => (
                    <div
                      key={step.stepIndex}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                    >
                      <div>
                        <span className="text-[13px] font-medium text-heading">
                          {step.approverName}
                        </span>
                        {step.comment && (
                          <span className="ml-2 text-[12px] text-subtle">
                            &quot;{step.comment}&quot;
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {step.decidedAt && (
                          <span className="text-[11px] text-faint">
                            {dayjs(step.decidedAt).format('DD MMM YYYY')}
                          </span>
                        )}
                        <Tag
                          color={
                            step.status === 'approved'
                              ? 'success'
                              : step.status === 'rejected'
                                ? 'error'
                                : 'warning'
                          }
                        >
                          {step.status}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lifecycle actions */}
            {(canApprove ||
              canReject ||
              canSkip ||
              canPause ||
              canResume ||
              canEarlyPayoff ||
              canTopUp ||
              canWriteOff) && (
              <div>
                <p className="m-0 mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {t('detailActionsSection')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canApprove && (
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => setActiveModal('approve')}
                    >
                      {t('actionApproveBtn')}
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => setActiveModal('reject')}
                    >
                      {t('actionRejectBtn')}
                    </Button>
                  )}
                  {canSkip && (
                    <Button icon={<StepBackwardOutlined />} onClick={() => setActiveModal('skip')}>
                      {t('actionSkipBtn')}
                    </Button>
                  )}
                  {canPause && (
                    <Button icon={<PauseCircleOutlined />} onClick={() => setActiveModal('pause')}>
                      {t('actionPauseBtn')}
                    </Button>
                  )}
                  {canResume && (
                    <Button
                      icon={<PlayCircleOutlined />}
                      type="primary"
                      onClick={() => setActiveModal('resume')}
                    >
                      {t('actionResumeBtn')}
                    </Button>
                  )}
                  {canEarlyPayoff && (
                    <Button icon={<RupeeOutlined />} onClick={() => setActiveModal('earlyPayoff')}>
                      {t('actionEarlyPayoffBtn')}
                    </Button>
                  )}
                  {canTopUp && (
                    <Button icon={<PlusCircleOutlined />} onClick={() => setActiveModal('topUp')}>
                      {t('actionTopUpBtn')}
                    </Button>
                  )}
                  {canWriteOff && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => setActiveModal('writeOff')}
                    >
                      {t('actionWriteOffBtn')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Installment schedule */}
            <div>
              <p className="m-0 mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
                {t('detailScheduleSection')}
              </p>
              <div
                className="overflow-hidden rounded-xl"
                style={{ border: '1px solid var(--cr-border)' }}
              >
                <Table<LoanInstallment>
                  rowKey={(r) => `${r.year}-${r.month}-${r.index}`}
                  size="small"
                  columns={installmentColumns}
                  dataSource={loan.installments}
                  pagination={
                    loan.installments.length > 12
                      ? { pageSize: 12, size: 'small', showSizeChanger: false }
                      : false
                  }
                  locale={{ emptyText: t('detailScheduleEmpty') }}
                  scroll={{ x: 'max-content' }}
                  rowClassName={(r) => (r.status === 'skipped' ? 'opacity-50' : '')}
                />
              </div>
            </div>

            {/* Perquisite note */}
            {!loan.medicalLoanExempt && loan.status === 'active' && (
              <Alert
                type="info"
                showIcon
                title={t('detailPerqNoteTitle')}
                description={t('detailPerqNoteDesc')}
              />
            )}

            {/* Pause info */}
            {loan.status === 'paused' && loan.pauseResumeDate && (
              <Alert
                type="warning"
                showIcon
                title={t('detailPausedTitle')}
                description={`${t('detailPausedAutoResume')} ${dayjs(loan.pauseResumeDate).format('MMM YYYY')}`}
              />
            )}
          </div>
        )}
      </Drawer>

      {/* Action modals */}
      {loanId && loan && (
        <>
          <ApproveModal
            open={activeModal === 'approve'}
            workspaceId={workspaceId}
            loanId={loanId}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
          <RejectModal
            open={activeModal === 'reject'}
            workspaceId={workspaceId}
            loanId={loanId}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
          <SkipInstallmentModal
            open={activeModal === 'skip'}
            workspaceId={workspaceId}
            loanId={loanId}
            installments={loan.installments}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
          <PauseLoanModal
            open={activeModal === 'pause'}
            workspaceId={workspaceId}
            loanId={loanId}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
          <ResumeLoanModal
            open={activeModal === 'resume'}
            workspaceId={workspaceId}
            loanId={loanId}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
          <EarlyPayoffModal
            open={activeModal === 'earlyPayoff'}
            workspaceId={workspaceId}
            loanId={loanId}
            remainingAmount={loan.remainingAmount}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
          <TopUpModal
            open={activeModal === 'topUp'}
            workspaceId={workspaceId}
            loanId={loanId}
            currentTenor={loan.tenorMonths}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
          <WriteOffModal
            open={activeModal === 'writeOff'}
            workspaceId={workspaceId}
            loanId={loanId}
            remainingAmount={loan.remainingAmount}
            onDone={handleMutationDone}
            onCancel={() => setActiveModal(null)}
          />
        </>
      )}
    </>
  );
}
