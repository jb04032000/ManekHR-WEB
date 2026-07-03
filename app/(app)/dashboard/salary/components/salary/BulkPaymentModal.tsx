'use client';

import { useEffect, useMemo, useState, startTransition } from 'react';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { BulkPaymentResult } from '@/types';
import type { SalaryRecord, TeamMember } from '../../types/salary-page.types';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { DsModal } from '@/components/ui';
import { AdvanceTargetSelector } from './AdvanceTargetSelector';

const { Option } = Select;

interface SelectedEmployee {
  salaryId: string;
  memberId: string;
  memberName: string;
  netSalary: number;
  paidAmount: number;
  remaining: number;
  payAmount: number;
  commission: number;
  commissionTitle: string;
  commissionNote: string;
}

interface BulkPaymentPayload {
  payments: Array<{
    salaryId: string;
    teamMemberId: string;
    month: number;
    year: number;
    amount: number;
    paymentMode: string;
    paymentDate: string;
    note?: string;
    referenceNo?: string;
    paymentFrom?: string;
    paidBy?: string;
    advanceTarget?: 'next_month' | 'this_month';
    commission?: number;
    commissionTitle?: string;
    commissionNote?: string;
  }>;
}

interface BulkPaymentModalProps {
  open: boolean;
  records: (SalaryRecord & { teamMember?: TeamMember })[];
  month: number;
  year: number;
  onClose: () => void;
  onSubmit: (payload: BulkPaymentPayload) => Promise<BulkPaymentResult | null>;
  canAdvance?: boolean;
  showCommission?: boolean;
}

interface BulkPaymentFormValues {
  paymentMode: string;
  paymentDate: dayjs.Dayjs;
  note?: string;
  referenceNo?: string;
  paymentFrom?: string;
  paidBy?: string;
}

export function BulkPaymentModal({
  open,
  records,
  month,
  year,
  onClose,
  onSubmit,
  canAdvance,
  showCommission,
}: BulkPaymentModalProps) {
  const t = useTranslations('salary.bulkPaymentModal');
  const [form] = Form.useForm<BulkPaymentFormValues>();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BulkPaymentResult | null>(null);
  const [employees, setEmployees] = useState<SelectedEmployee[]>([]);
  const [lockedCount, setLockedCount] = useState(0);
  const [advanceTarget, setAdvanceTarget] = useState<'next_month' | 'this_month'>('this_month');
  const currencyFmt = useCurrencyFormatter();
  const formatInr = currencyFmt.full;

  useEffect(() => {
    if (!open) {
      return;
    }

    const locked = records.filter((r) => r.isLocked);
    startTransition(() => {
      setLockedCount(locked.length);
      setAdvanceTarget('this_month');

      setEmployees(
        records
          .filter((record) => !record.isLocked)
          .map((record) => {
            const netSalary = record.netSalary ?? 0;
            const paidAmount = record.paidAmount ?? 0;
            const remaining = Math.max(0, netSalary - paidAmount);
            const memberId =
              typeof record.teamMemberId === 'string'
                ? record.teamMemberId
                : record.teamMemberId?._id || record.teamMember?.id || '';

            return {
              salaryId: record._id || '',
              memberId,
              memberName: record.teamMember?.name || 'Unknown',
              netSalary,
              paidAmount,
              remaining,
              payAmount: remaining > 0 ? remaining : 0,
              commission: 0,
              commissionTitle: '',
              commissionNote: '',
            };
          }),
      );
      setResult(null);
    });
    form.setFieldsValue({
      paymentMode: 'bank_transfer',
      paymentDate: dayjs(),
      note: undefined,
      referenceNo: undefined,
      paymentFrom: undefined,
      paidBy: undefined,
    });
  }, [form, open, records]);

  const allFullyPaid = employees.length > 0 && employees.every((e) => e.remaining === 0);
  const someFullyPaid = employees.some((e) => e.remaining === 0);

  const totalPayAmount = useMemo(
    () => employees.reduce((sum, e) => sum + (e.payAmount || 0) + (e.commission || 0), 0),
    [employees],
  );

  const hasCommissionTitleError = useMemo(
    () => employees.some((e) => e.commission > 0 && !e.commissionTitle.trim()),
    [employees],
  );

  const handleAmountChange = (index: number, value: number | null) => {
    setEmployees((prev) =>
      prev.map((employee, i) => (i === index ? { ...employee, payAmount: value || 0 } : employee)),
    );
  };

  const handleCommissionChange = (
    index: number,
    field: 'commission' | 'commissionTitle' | 'commissionNote',
    value: number | string | null,
  ) => {
    setEmployees((prev) =>
      prev.map((employee, i) =>
        i === index
          ? { ...employee, [field]: value ?? (field === 'commission' ? 0 : '') }
          : employee,
      ),
    );
  };

  const handlePayAll = () => {
    setEmployees((prev) =>
      prev.map((employee) => ({ ...employee, payAmount: employee.remaining })),
    );
  };

  const handleClearAll = () => {
    setEmployees((prev) => prev.map((employee) => ({ ...employee, payAmount: 0 })));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payableEmployees = employees.filter((e) => e.payAmount > 0);

      if (payableEmployees.length === 0) {
        return;
      }

      setSaving(true);

      const response = await onSubmit({
        payments: payableEmployees.map((employee) => {
          const isFullyPaid = employee.remaining === 0;
          return {
            salaryId: employee.salaryId,
            teamMemberId: employee.memberId,
            month,
            year,
            amount: employee.payAmount,
            paymentMode: values.paymentMode,
            paymentDate: values.paymentDate
              ? values.paymentDate.toISOString()
              : new Date().toISOString(),
            note: values.note || undefined,
            referenceNo: values.referenceNo || undefined,
            paymentFrom: values.paymentFrom || undefined,
            paidBy: values.paidBy || undefined,
            ...(isFullyPaid && someFullyPaid ? { advanceTarget } : {}),
            ...(employee.commission > 0
              ? {
                  commission: employee.commission,
                  commissionTitle: employee.commissionTitle || undefined,
                  commissionNote: employee.commissionNote || undefined,
                }
              : {}),
          };
        }),
      });

      if (response) {
        setResult(response);
      }
    } catch {
      // Validation errors are surfaced inline by the form.
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setEmployees([]);
    form.resetFields();
    onClose();
  };

  const okButtonLabel = allFullyPaid
    ? t('okButtonPayAdvance', { amount: formatInr(totalPayAmount) })
    : someFullyPaid
      ? t('okButtonPayMixed', { amount: formatInr(totalPayAmount) })
      : t('okButtonPay', { amount: formatInr(totalPayAmount) });

  const modalWidth = showCommission ? 1040 : 780;

  const employeeColumns: ColumnsType<SelectedEmployee> = [
    {
      title: t('columns.employee'),
      dataIndex: 'memberName',
      key: 'name',
      width: 180,
      render: (name: string) => <span className="text-sm font-medium">{name}</span>,
    },
    {
      title: t('columns.netSalary'),
      dataIndex: 'netSalary',
      key: 'net',
      width: 110,
      render: (value: number) => <span className="text-sm">{formatInr(value)}</span>,
    },
    {
      title: t('columns.alreadyPaid'),
      dataIndex: 'paidAmount',
      key: 'paid',
      width: 120,
      render: (value: number) => <span className="text-sm text-green-700">{formatInr(value)}</span>,
    },
    {
      title: t('columns.remaining'),
      dataIndex: 'remaining',
      key: 'remaining',
      width: 120,
      render: (value: number) => (
        <span className={`text-sm font-semibold ${value === 0 ? 'text-faint' : 'text-amber-700'}`}>
          {value === 0 ? '-' : formatInr(value)}
        </span>
      ),
    },
    {
      title: t('columns.payAmount'),
      key: 'payAmount',
      width: 150,
      render: (_value, record, index) => (
        <InputNumber
          size="small"
          min={0}
          max={record.remaining > 0 ? record.remaining * 2 : undefined}
          value={record.payAmount}
          onChange={(value) => handleAmountChange(index, value)}
          prefix={currencyFmt.symbol}
          className="w-full"
          style={{ minWidth: 110 }}
        />
      ),
    },
    ...(showCommission
      ? ([
          {
            title: t('columns.commission'),
            key: 'commission',
            width: 130,
            render: (_value: unknown, record: SelectedEmployee, index: number) => (
              <InputNumber
                size="small"
                min={0}
                value={record.commission}
                onChange={(value) => handleCommissionChange(index, 'commission', value)}
                prefix={currencyFmt.symbol}
                className="w-full"
                style={{ minWidth: 100 }}
              />
            ),
          },
          {
            title: t('columns.forReason'),
            key: 'commissionTitle',
            width: 160,
            render: (_value: unknown, record: SelectedEmployee, index: number) => (
              <div>
                <Input
                  size="small"
                  value={record.commissionTitle}
                  onChange={(e) => handleCommissionChange(index, 'commissionTitle', e.target.value)}
                  placeholder={t('commissionPlaceholder')}
                  status={
                    record.commission > 0 && !record.commissionTitle.trim() ? 'error' : undefined
                  }
                />
                {record.commission > 0 && !record.commissionTitle.trim() && (
                  <span className="text-[11px] text-red-700">{t('commissionTitleRequired')}</span>
                )}
              </div>
            ),
          },
          {
            title: t('columns.note'),
            key: 'commissionNote',
            width: 160,
            render: (_value: unknown, record: SelectedEmployee, index: number) => (
              <Input
                size="small"
                value={record.commissionNote}
                onChange={(e) => handleCommissionChange(index, 'commissionNote', e.target.value)}
                placeholder={t('commissionNotePlaceholder')}
              />
            ),
          },
        ] as ColumnsType<SelectedEmployee>)
      : []),
  ];

  const resultColumns: ColumnsType<NonNullable<BulkPaymentResult['results']>[number]> = [
    {
      title: t('columns.employee'),
      key: 'name',
      render: (_value, row) => {
        const employee = employees.find(
          (item) => item.salaryId === row.salaryId || item.memberId === row.teamMemberId,
        );
        return (
          <span className="text-sm">
            {employee?.memberName || row.teamMemberId || row.salaryId || 'Unknown'}
          </span>
        );
      },
    },
    {
      title: t('columns.status'),
      key: 'status',
      render: (_value, row) =>
        row.success ? (
          <Tag color="success">{t('resultPaid')}</Tag>
        ) : (
          // LOW-2: prefer a localized message for a structured deny code (e.g. a
          // removed member), falling back to the raw server message then a generic
          // label. Backend: SalaryService.recordBulkPayment surfaces `row.code`.
          <Tag color="error">
            {row.code === 'MEMBER_OFFBOARDED'
              ? t('resultMemberOffboarded')
              : row.error || t('resultFailed')}
          </Tag>
        ),
    },
  ];

  return (
    <DsModal
      open={open}
      onCancel={handleClose}
      title={
        result
          ? t('titleResults')
          : t('titlePay', {
              count: employees.length,
              plural: employees.length !== 1 ? 's' : '',
            })
      }
      width={modalWidth}
      footer={
        result
          ? [
              <Button key="close" type="primary" onClick={handleClose}>
                {t('doneButton')}
              </Button>,
            ]
          : undefined
      }
      onOk={result ? undefined : handleSubmit}
      confirmLoading={saving}
      okText={okButtonLabel}
      okButtonProps={{
        disabled:
          totalPayAmount <= 0 ||
          employees.length === 0 ||
          (someFullyPaid && canAdvance === false) ||
          hasCommissionTitleError,
      }}
      destroyOnHidden
    >
      {result ? (
        <div>
          <Alert
            type={result.failed === 0 ? 'success' : result.succeeded === 0 ? 'error' : 'warning'}
            title={
              result.failed === 0
                ? t('resultAlertAllSuccess', { count: result.succeeded ?? 0 })
                : result.succeeded === 0
                  ? t('resultAlertAllFailed', { count: result.failed ?? 0 })
                  : t('resultAlertPartial', {
                      succeeded: result.succeeded ?? 0,
                      failed: result.failed ?? 0,
                    })
            }
            className="mb-4"
            showIcon
          />
          <Table
            dataSource={result.results}
            columns={resultColumns}
            size="small"
            pagination={false}
            rowKey="index"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {lockedCount > 0 && (
            <Alert type="warning" showIcon title={t('lockedAlert', { count: lockedCount })} />
          )}

          {someFullyPaid && (
            <AdvanceTargetSelector
              payModal={{ month, year }}
              advanceTarget={advanceTarget}
              setAdvanceTarget={setAdvanceTarget}
              canAdvance={canAdvance}
            />
          )}

          {someFullyPaid && !allFullyPaid && (
            <Alert type="warning" showIcon title={t('mixedAdvanceAlert')} />
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {t('employeePaymentsLabel')}
              </span>
              <div className="flex gap-2">
                <Button size="small" type="link" onClick={handlePayAll}>
                  {t('payAllRemaining')}
                </Button>
                <Button size="small" type="link" onClick={handleClearAll}>
                  {t('clearAll')}
                </Button>
              </div>
            </div>
            {employees.length === 0 ? (
              <Alert type="info" showIcon title={t('allPaidAlert')} />
            ) : (
              <Table
                dataSource={employees}
                columns={employeeColumns}
                size="small"
                pagination={false}
                rowKey="salaryId"
                scroll={{ x: 'max-content' }}
              />
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
            <span className="text-sm font-medium text-blue-700">{t('totalPayment')}</span>
            <span className="text-lg font-bold text-blue-700">{formatInr(totalPayAmount)}</span>
          </div>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{
              paymentMode: 'bank_transfer',
              paymentDate: dayjs(),
            }}
          >
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item
                name="paymentMode"
                label={t('form.paymentMethodLabel')}
                rules={[{ required: true, message: t('form.paymentMethodRequired') }]}
              >
                <Select>
                  <Option value="cash">{t('form.cash')}</Option>
                  <Option value="bank_transfer">{t('form.bankTransfer')}</Option>
                  <Option value="upi">{t('form.upi')}</Option>
                  <Option value="cheque">{t('form.cheque')}</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="paymentDate"
                label={t('form.paymentDateLabel')}
                rules={[{ required: true, message: t('form.paymentDateRequired') }]}
              >
                <DatePicker className="w-full" />
              </Form.Item>

              <Form.Item name="referenceNo" label={t('form.referenceNoLabel')}>
                <Input placeholder={t('form.referencePlaceholder')} />
              </Form.Item>

              <Form.Item name="paymentFrom" label={t('form.paymentFromLabel')}>
                <Input placeholder={t('form.paymentFromPlaceholder')} />
              </Form.Item>
            </div>

            <Form.Item name="paidBy" label={t('form.paidByLabel')}>
              <Input placeholder={t('form.paidByPlaceholder')} />
            </Form.Item>

            <Form.Item name="note" label={t('form.noteLabel')}>
              <Input.TextArea rows={2} placeholder={t('form.notePlaceholder')} />
            </Form.Item>
          </Form>
        </div>
      )}
    </DsModal>
  );
}
