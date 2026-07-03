/* eslint-disable react-hooks/set-state-in-effect -- debounced preview fetch triggered from effect */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  InputNumber,
  Radio,
  Row,
  Select,
  Skeleton,
  Switch,
  Table,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { ColumnsType } from 'antd/es/table';
import { DsDrawer } from '@/components/ui';
import { salaryApi } from '@/lib/api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import type {
  EmployerLoan,
  LoanSchedulePreviewRow,
  LoanSchedulePreviewResponse,
  LoanType,
  InterestType,
} from '@/types';

const LOAN_TYPES: LoanType[] = ['personal', 'medical', 'housing', 'vehicle', 'education', 'other'];
const INTEREST_TYPES: InterestType[] = ['zero', 'flat', 'reducing_balance'];
const DEBOUNCE_MS = 600;

interface FormValues {
  teamMemberId: string;
  loanType: LoanType;
  principalAmount: number | null;
  interestType: InterestType;
  annualInterestRate: number | null;
  tenorMonths: number | null;
  disbursementDate: dayjs.Dayjs | null;
  disbursedOutsideApp: boolean;
  medicalLoanExempt: boolean;
  startMonth: number | null;
  startYear: number | null;
  note: string | undefined;
}

interface CreateLoanDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** Pass a pre-selected member ID to skip member select (single-member entry point). */
  preSelectedMemberId?: string;
  /** Roster of team members for the member selector. */
  members: Array<{ id: string; name: string; designation?: string }>;
  onCreated?: (loan: EmployerLoan) => void;
}

function formatMonthLabel(month: number, year: number): string {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY');
}

export function CreateLoanDrawer({
  open,
  onClose,
  workspaceId,
  preSelectedMemberId,
  members,
  onCreated,
}: CreateLoanDrawerProps) {
  const t = useTranslations('salary.loans');
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<LoanSchedulePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const watchedInterestType = Form.useWatch('interestType', form) as InterestType | undefined;

  const resetDrawer = useCallback(() => {
    form.resetFields();
    setPreview(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setPendingApproval(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, [form]);

  useEffect(() => {
    if (!open) {
      resetDrawer();
    } else if (preSelectedMemberId) {
      form.setFieldValue('teamMemberId', preSelectedMemberId);
    }
  }, [open, preSelectedMemberId, form, resetDrawer]);

  const triggerPreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const values = form.getFieldsValue();
        const {
          loanType,
          principalAmount,
          interestType,
          annualInterestRate,
          tenorMonths,
          startMonth,
          startYear,
        } = values;
        if (
          !loanType ||
          !principalAmount ||
          principalAmount <= 0 ||
          !interestType ||
          !tenorMonths ||
          tenorMonths < 1 ||
          !startMonth ||
          !startYear ||
          (interestType !== 'zero' && (annualInterestRate == null || annualInterestRate < 0))
        ) {
          setPreview(null);
          return;
        }
        setPreviewLoading(true);
        setPreviewError(null);
        try {
          const result = await salaryApi.previewLoanSchedule(workspaceId, {
            loanType,
            principalAmount,
            interestType,
            annualInterestRate: interestType === 'zero' ? 0 : (annualInterestRate ?? 0),
            tenorMonths,
            startMonth,
            startYear,
          });
          setPreview(result);
        } catch (e) {
          setPreviewError(parseApiError(e) || t('previewError'));
          setPreview(null);
        } finally {
          setPreviewLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
  }, [form, workspaceId, t]);

  const handleValuesChange = useCallback(() => {
    triggerPreview();
  }, [triggerPreview]);

  const handleSubmit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    if (
      !values.teamMemberId ||
      !values.principalAmount ||
      !values.tenorMonths ||
      !values.disbursementDate ||
      !values.startMonth ||
      !values.startYear
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const loan = await salaryApi.createLoan(workspaceId, {
        teamMemberId: values.teamMemberId,
        loanType: values.loanType,
        principalAmount: values.principalAmount,
        disbursedOutsideApp: values.disbursedOutsideApp,
        disbursementDate: values.disbursementDate.toISOString(),
        interestType: values.interestType,
        annualInterestRate: values.interestType === 'zero' ? 0 : (values.annualInterestRate ?? 0),
        tenorMonths: values.tenorMonths,
        startMonth: values.startMonth,
        startYear: values.startYear,
        medicalLoanExempt: values.medicalLoanExempt,
        note: values.note,
      });

      if (loan.status === 'pending_approval') {
        setPendingApproval(true);
      } else {
        message.success(t('createSuccess'));
        onCreated?.(loan);
        onClose();
        resetDrawer();
      }
    } catch (e) {
      message.error(parseApiError(e) || t('createError'));
    } finally {
      setSubmitting(false);
    }
  };

  const previewColumns: ColumnsType<LoanSchedulePreviewRow> = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 36,
      render: (v: number) => <span className="text-[12px] text-faint tabular-nums">{v + 1}</span>,
    },
    {
      title: t('previewColMonth'),
      key: 'month',
      render: (_: unknown, row: LoanSchedulePreviewRow) => (
        <span className="text-[13px]">{formatMonthLabel(row.month, row.year)}</span>
      ),
    },
    {
      title: t('previewColEmi'),
      dataIndex: 'emiAmount',
      key: 'emiAmount',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] font-medium tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('previewColPrincipal'),
      dataIndex: 'principalPart',
      key: 'principalPart',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] text-muted tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('previewColInterest'),
      dataIndex: 'interestPart',
      key: 'interestPart',
      align: 'right',
      render: (v: number) => (
        <span className="text-[13px] text-muted tabular-nums">
          {v > 0 ? formatCurrencyFull(v) : '-'}
        </span>
      ),
    },
    {
      title: t('previewColOutstanding'),
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      align: 'right',
      render: (v: number) => (
        <span className="text-[12px] text-subtle tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
  ];

  const showRateField = watchedInterestType && watchedInterestType !== 'zero';

  return (
    <DsDrawer
      open={open}
      onClose={onClose}
      title={t('drawerTitle')}
      subtitle={t('drawerSubtitle')}
      footer={
        pendingApproval ? (
          <Button type="primary" onClick={onClose}>
            {t('closeBtn')}
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            {t('submitBtn')}
          </Button>
        )
      }
    >
      <div className="px-5 py-4">
        {pendingApproval ? (
          <Alert
            type="info"
            showIcon
            title={t('pendingApprovalTitle')}
            description={t('pendingApprovalDescription')}
          />
        ) : (
          <Form<FormValues>
            form={form}
            layout="vertical"
            onValuesChange={handleValuesChange}
            initialValues={{
              loanType: 'personal',
              interestType: 'zero',
              annualInterestRate: 0,
              disbursedOutsideApp: false,
              medicalLoanExempt: false,
            }}
          >
            {/* Member */}
            {!preSelectedMemberId && (
              <Form.Item
                name="teamMemberId"
                label={t('fieldMember')}
                rules={[{ required: true, message: t('fieldMemberRequired') }]}
              >
                <Select
                  showSearch
                  placeholder={t('fieldMemberPlaceholder')}
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={members.map((m) => ({
                    value: m.id,
                    label: m.designation ? `${m.name} - ${m.designation}` : m.name,
                  }))}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}

            {/* Loan Type */}
            <Form.Item name="loanType" label={t('fieldLoanType')} rules={[{ required: true }]}>
              <Select
                options={LOAN_TYPES.map((lt) => ({
                  value: lt,
                  label: t(`loanType.${lt}`),
                }))}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Row gutter={16}>
              {/* Principal */}
              <Col span={12}>
                <Form.Item
                  name="principalAmount"
                  label={t('fieldPrincipal')}
                  rules={[
                    { required: true, message: t('fieldPrincipalRequired') },
                    { type: 'number', min: 1, message: t('fieldPrincipalMin') },
                  ]}
                >
                  <InputNumber
                    min={1}
                    precision={0}
                    prefix="₹"
                    placeholder="e.g. 50000"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>

              {/* Tenor */}
              <Col span={12}>
                <Form.Item
                  name="tenorMonths"
                  label={t('fieldTenor')}
                  rules={[
                    { required: true, message: t('fieldTenorRequired') },
                    { type: 'number', min: 1, max: 120, message: t('fieldTenorRange') },
                  ]}
                >
                  <InputNumber
                    min={1}
                    max={120}
                    precision={0}
                    suffix={t('monthsSuffix')}
                    placeholder="e.g. 12"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Interest Type */}
            <Form.Item
              name="interestType"
              label={t('fieldInterestType')}
              rules={[{ required: true }]}
            >
              <Radio.Group>
                {INTEREST_TYPES.map((it) => (
                  <Radio key={it} value={it}>
                    {t(`interestType.${it}`)}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>

            {/* Annual Interest Rate (only when non-zero) */}
            {showRateField && (
              <Form.Item
                name="annualInterestRate"
                label={t('fieldAnnualRate')}
                rules={[
                  { required: true, message: t('fieldAnnualRateRequired') },
                  { type: 'number', min: 0.01, message: t('fieldAnnualRateMin') },
                ]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  precision={2}
                  suffix="% p.a."
                  placeholder="e.g. 12"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}

            <Row gutter={16}>
              {/* Start Month */}
              <Col span={12}>
                <Form.Item
                  name="startMonth"
                  label={t('fieldStartMonth')}
                  rules={[{ required: true, message: t('fieldStartMonthRequired') }]}
                >
                  <Select
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: i + 1,
                      label: dayjs().month(i).format('MMMM'),
                    }))}
                    placeholder={t('fieldStartMonthPlaceholder')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>

              {/* Start Year */}
              <Col span={12}>
                <Form.Item
                  name="startYear"
                  label={t('fieldStartYear')}
                  rules={[{ required: true, message: t('fieldStartYearRequired') }]}
                >
                  <Select
                    options={Array.from({ length: 5 }, (_, i) => {
                      const yr = dayjs().year() + i - 1;
                      return { value: yr, label: String(yr) };
                    })}
                    placeholder={t('fieldStartYearPlaceholder')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Disbursement Date */}
            <Form.Item
              name="disbursementDate"
              label={t('fieldDisbursementDate')}
              rules={[{ required: true, message: t('fieldDisbursementDateRequired') }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
            </Form.Item>

            <Row gutter={16}>
              {/* Disbursed outside app */}
              <Col span={12}>
                <Form.Item
                  name="disbursedOutsideApp"
                  label={t('fieldDisbursedOutsideApp')}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>

              {/* Medical loan exempt */}
              <Col span={12}>
                <Form.Item
                  name="medicalLoanExempt"
                  label={t('fieldMedicalLoanExempt')}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            {/* EMI Preview */}
            <Divider style={{ margin: '8px 0 16px' }} />
            <p className="m-0 mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
              {t('previewTitle')}
            </p>

            {previewLoading && <Skeleton active paragraph={{ rows: 4 }} />}

            {!previewLoading && previewError && (
              <Alert type="warning" title={t('previewError')} showIcon />
            )}

            {!previewLoading && preview && (
              <>
                {/* Totals row */}
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div
                    className="rounded-xl p-2.5"
                    style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                  >
                    <p className="m-0 text-[10px] font-semibold tracking-wider text-faint uppercase">
                      {t('previewEmi')}
                    </p>
                    <p className="m-0 mt-1 text-[15px] font-bold text-heading tabular-nums">
                      {formatCurrencyFull(preview.emiAmount)}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-2.5"
                    style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                  >
                    <p className="m-0 text-[10px] font-semibold tracking-wider text-faint uppercase">
                      {t('previewTotalInterest')}
                    </p>
                    <p className="m-0 mt-1 text-[15px] font-bold text-heading tabular-nums">
                      {formatCurrencyFull(preview.totalInterest)}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-2.5"
                    style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-border)' }}
                  >
                    <p className="m-0 text-[10px] font-semibold tracking-wider text-faint uppercase">
                      {t('previewTotalRepayable')}
                    </p>
                    <p className="m-0 mt-1 text-[15px] font-bold text-heading tabular-nums">
                      {formatCurrencyFull(preview.totalRepayable)}
                    </p>
                  </div>
                </div>

                {/* Schedule table */}
                <div
                  className="overflow-hidden rounded-xl"
                  style={{ border: '1px solid var(--cr-border)' }}
                >
                  <Table<LoanSchedulePreviewRow>
                    rowKey={(row) => `${row.year}-${row.month}-${row.index}`}
                    size="small"
                    columns={previewColumns}
                    dataSource={preview.installments}
                    pagination={
                      preview.installments.length > 12
                        ? { pageSize: 12, size: 'small', showSizeChanger: false }
                        : false
                    }
                    locale={{ emptyText: t('previewEmpty') }}
                    scroll={{ x: 'max-content' }}
                  />
                </div>

                <p className="m-0 mt-2 text-[11px] text-subtle">{t('previewNote')}</p>
              </>
            )}

            {!previewLoading && !preview && !previewError && (
              <div
                className="rounded-xl px-4 py-6 text-center text-[13px] text-subtle"
                style={{ border: '1px dashed var(--cr-border)' }}
              >
                {t('previewHint')}
              </div>
            )}
          </Form>
        )}
      </div>
    </DsDrawer>
  );
}
