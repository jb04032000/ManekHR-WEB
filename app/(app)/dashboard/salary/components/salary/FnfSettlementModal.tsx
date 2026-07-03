'use client';

import React, { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DownloadOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/store';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { generateFnfPdf } from '@/lib/export/generateFnfPdf';
import type { FnfOtherItem, FnfSettlement, InitiateFnfPayload, TeamMember } from '@/types';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  member: TeamMember;
}

interface FnfFormValues {
  lastWorkingDate?: Dayjs;
  noticePeriodDays?: number;
  noticeServedDays?: number;
  leaveBalanceDays?: number;
  resignationReason?: string;
  notes?: string;
  otherAdditions?: FnfOtherItem[];
  otherDeductions?: FnfOtherItem[];
}

type SummaryRow = {
  key: string;
  component: string;
  basis: string;
  amount: number;
  total?: boolean;
  protected?: boolean;
};

const DEFAULT_NOTICE_PERIOD_DAYS = 30;

function sanitizeLineItems(items: FnfOtherItem[] | undefined): FnfOtherItem[] {
  return (items || [])
    .map((item) => ({
      description: item.description?.trim() || '',
      amount: Number(item.amount || 0),
    }))
    .filter((item) => item.description || item.amount > 0);
}

function getInitialFormValues(
  member: TeamMember,
  settlement?: FnfSettlement | null,
): FnfFormValues {
  if (settlement) {
    return {
      lastWorkingDate: settlement.lastWorkingDate ? dayjs(settlement.lastWorkingDate) : undefined,
      noticePeriodDays: settlement.noticePeriodDays,
      noticeServedDays: settlement.noticeServedDays,
      leaveBalanceDays: settlement.leaveBalanceDays,
      resignationReason: settlement.resignationReason || '',
      notes: settlement.notes || '',
      otherAdditions:
        settlement.otherAdditions.length > 0
          ? settlement.otherAdditions
          : [{ description: '', amount: 0 }],
      otherDeductions:
        settlement.otherDeductions.length > 0
          ? settlement.otherDeductions
          : [{ description: '', amount: 0 }],
    };
  }

  return {
    lastWorkingDate: member.dateOfResignation ? dayjs(member.dateOfResignation) : dayjs(),
    noticePeriodDays: DEFAULT_NOTICE_PERIOD_DAYS,
    noticeServedDays: 0,
    leaveBalanceDays: 0,
    resignationReason: '',
    notes: '',
    otherAdditions: [{ description: '', amount: 0 }],
    otherDeductions: [{ description: '', amount: 0 }],
  };
}

export function FnfSettlementModal({ open, onClose, workspaceId, member }: Props) {
  const t = useTranslations('salary.fnfSettlementModal');
  const [form] = Form.useForm<FnfFormValues>();
  const [msgApi, contextHolder] = message.useMessage();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const currencyFmt = useCurrencyFormatter();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [finalising, setFinalising] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [settlement, setSettlement] = useState<FnfSettlement | null>(null);

  const leaveBalanceDays = Form.useWatch('leaveBalanceDays', form) ?? 0;
  const basicSalary = settlement?.lastBasicSalary ?? member.salaryAmount ?? 0;
  const encashmentPreview = useMemo(
    () => Math.round((Number(basicSalary || 0) / 26) * Number(leaveBalanceDays || 0)),
    [basicSalary, leaveBalanceDays],
  );

  const getStatusTag = useCallback(
    (status: FnfSettlement['status']) => {
      switch (status) {
        case 'finalised':
          return <Tag color="green">{t('statusFinalised')}</Tag>;
        case 'paid':
          return <Tag color="blue">{t('statusPaid')}</Tag>;
        default:
          return <Tag color="gold">{t('statusDraft')}</Tag>;
      }
    },
    [t],
  );

  const loadSettlement = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });

    try {
      const existing = await salaryApi.getFnfSettlement(workspaceId, member.id);
      startTransition(() => {
        setSettlement(existing);
      });
      form.setFieldsValue(getInitialFormValues(member, existing));
    } catch (error) {
      msgApi.error(parseApiError(error));
      form.setFieldsValue(getInitialFormValues(member, null));
      startTransition(() => {
        setSettlement(null);
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [form, member, msgApi, workspaceId]);

  useEffect(() => {
    if (!open) {
      startTransition(() => {
        setSettlement(null);
      });
      form.resetFields();
      return;
    }

    void loadSettlement();
  }, [form, loadSettlement, open]);

  const earningsRows = useMemo<SummaryRow[]>(() => {
    if (!settlement) return [];

    const monthLabel = dayjs(settlement.lastWorkingDate).format('MMM YYYY');

    return [
      {
        key: 'last-month-salary',
        component: t('rows.lastMonthSalary', { monthLabel }),
        basis: t('rows.lastMonthSalaryBasis', {
          date: dayjs(settlement.lastWorkingDate).format('DD MMM YYYY'),
        }),
        amount: settlement.lastMonthNetSalary || 0,
      },
      {
        key: 'gratuity',
        component: settlement.gratuityEligible
          ? t('rows.gratuityEligible', { years: settlement.completedYears })
          : t('rows.gratuityLabel'),
        basis: settlement.gratuityEligible
          ? t('rows.gratuityEligibleBasis')
          : t('rows.gratuityIneligibleBasis'),
        amount: settlement.gratuityAmount || 0,
        protected: true,
      },
      {
        key: 'leave-encashment',
        component: t('rows.leaveEncashment', { days: settlement.leaveBalanceDays ?? 0 }),
        basis: t('rows.leaveEncashmentBasis', {
          days: settlement.leaveBalanceDays ?? 0,
          basic: currencyFmt.inline(settlement.lastBasicSalary || 0),
        }),
        amount: settlement.leaveEncashmentAmount || 0,
      },
      ...settlement.otherAdditions.map((item, index) => ({
        key: `earning-${index}`,
        component: item.description || t('rows.otherEarning'),
        basis: t('rows.manualAdjustment'),
        amount: item.amount || 0,
      })),
      {
        key: 'earn-total',
        component: t('rows.totalEarnings'),
        basis: '',
        amount: settlement.totalEarnings || 0,
        total: true,
      },
    ];
  }, [currencyFmt, settlement, t]);

  const deductionRows = useMemo<SummaryRow[]>(() => {
    if (!settlement) return [];

    const rows: SummaryRow[] = [];

    if ((settlement.noticeShortfallDays || 0) > 0) {
      rows.push({
        key: 'notice-recovery',
        component: t('rows.noticeRecovery', { days: settlement.noticeShortfallDays ?? 0 }),
        basis: t('rows.noticeRecoveryBasis', {
          days: settlement.noticeShortfallDays ?? 0,
          basic: currencyFmt.inline(settlement.lastBasicSalary || 0),
        }),
        amount: settlement.noticeRecoveryAmount || 0,
      });
    }

    const recoverableAmount =
      settlement.advanceRecoverableFromDues ?? settlement.outstandingAdvanceAmount ?? 0;
    if (recoverableAmount > 0) {
      rows.push({
        key: 'advance-recovery',
        component: t('rows.advanceRecovery'),
        basis: t('rows.advanceRecoveryBasis'),
        amount: recoverableAmount,
      });
    }

    settlement.otherDeductions.forEach((item, index) => {
      rows.push({
        key: `deduction-${index}`,
        component: item.description || t('rows.otherDeduction'),
        basis: t('rows.manualAdjustment'),
        amount: item.amount || 0,
      });
    });

    rows.push({
      key: 'deduction-total',
      component: t('rows.totalDeductions'),
      basis: '',
      amount: settlement.totalDeductions || 0,
      total: true,
    });

    return rows;
  }, [currencyFmt, settlement, t]);

  const summaryColumns = useMemo<ColumnsType<SummaryRow>>(
    () => [
      {
        title: t('summary.colComponent'),
        dataIndex: 'component',
        key: 'component',
        render: (value: string, row) => {
          if (row.total) return <Text strong>{value}</Text>;
          if (row.protected) {
            return (
              <Space size={4}>
                <span>{value}</span>
                <Tooltip title={t('rows.gratuityProtectedTooltip')}>
                  <LockOutlined
                    aria-label={t('rows.gratuityProtectedTooltip')}
                    style={{ color: 'var(--ant-color-success)', fontSize: 12 }}
                  />
                </Tooltip>
              </Space>
            );
          }
          return value;
        },
      },
      {
        title: t('summary.colCalculationBasis'),
        dataIndex: 'basis',
        key: 'basis',
        render: (value: string) => <Text type="secondary">{value || '-'}</Text>,
      },
      {
        title: t('summary.colAmount'),
        dataIndex: 'amount',
        key: 'amount',
        align: 'right',
        render: (value: number, row) =>
          row.total ? (
            <Text strong>{currencyFmt.currency(value || 0)}</Text>
          ) : (
            currencyFmt.currency(value || 0)
          ),
      },
    ],
    [currencyFmt, t],
  );

  const handleCalculate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const payload: InitiateFnfPayload = {
        lastWorkingDate:
          values.lastWorkingDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        noticePeriodDays: Number(values.noticePeriodDays || 0),
        noticeServedDays: Number(values.noticeServedDays || 0),
        leaveBalanceDays: Number(values.leaveBalanceDays || 0),
        otherAdditions: sanitizeLineItems(values.otherAdditions),
        otherDeductions: sanitizeLineItems(values.otherDeductions),
        notes: values.notes?.trim() || '',
        resignationReason: values.resignationReason?.trim() || '',
      };

      setCalculating(true);
      const result = await salaryApi.initiateFnf(workspaceId, member.id, payload);
      setSettlement(result);
      form.setFieldsValue(getInitialFormValues(member, result));
      msgApi.success(t('toasts.calculated'));
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return;
      }
      msgApi.error(parseApiError(error));
    } finally {
      setCalculating(false);
    }
  }, [form, member, msgApi, t, workspaceId]);

  const handleFinalise = useCallback(() => {
    if (!settlement) {
      msgApi.warning(t('toasts.calculateFirst'));
      return;
    }

    Modal.confirm({
      title: t('confirm.finaliseTitle'),
      content: t('confirm.finaliseContent'),
      okText: t('confirm.finaliseOkText'),
      cancelText: t('confirm.finaliseCancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setFinalising(true);
          const result = await salaryApi.finaliseFnf(workspaceId, member.id);
          setSettlement(result);
          form.setFieldsValue(getInitialFormValues(member, result));
          msgApi.success(t('toasts.finalised'));
        } catch (error) {
          msgApi.error(parseApiError(error));
        } finally {
          setFinalising(false);
        }
      },
    });
  }, [form, member, msgApi, settlement, t, workspaceId]);

  const handleDownload = useCallback(async () => {
    if (!settlement) {
      msgApi.warning(t('toasts.downloadFirst'));
      return;
    }

    try {
      setDownloading(true);
      await generateFnfPdf(
        settlement,
        member.name,
        currentWorkspace?.name || 'Your Company',
        currencyFmt.symbol,
      );
    } catch (error) {
      msgApi.error(parseApiError(error));
    } finally {
      setDownloading(false);
    }
  }, [currencyFmt.symbol, currentWorkspace, member.name, msgApi, settlement, t]);

  const footer =
    settlement?.status === 'finalised'
      ? [
          <Button key="close" onClick={onClose}>
            {t('footer.close')}
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => void handleDownload()}
            loading={downloading}
          >
            {t('footer.downloadStatement')}
          </Button>,
        ]
      : [
          <Button key="close" onClick={onClose}>
            {t('footer.cancel')}
          </Button>,
          <Button
            key="calculate"
            type="primary"
            onClick={() => void handleCalculate()}
            loading={calculating}
          >
            {settlement ? t('footer.recalculate') : t('footer.calculate')}
          </Button>,
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={() => void handleDownload()}
            disabled={!settlement}
            loading={downloading}
          >
            {t('footer.downloadStatement')}
          </Button>,
          <Button
            key="finalise"
            danger
            onClick={handleFinalise}
            disabled={!settlement}
            loading={finalising}
          >
            {t('footer.finalise')}
          </Button>,
        ];

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        onCancel={onClose}
        title={t('title', { memberName: member.name })}
        width={1200}
        destroyOnHidden
        footer={footer}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <Card
              title={t('inputs.cardTitle')}
              extra={settlement?.status ? getStatusTag(settlement.status) : null}
            >
              {loading ? (
                <Skeleton active paragraph={{ rows: 12 }} />
              ) : (
                <Form form={form} layout="vertical" disabled={settlement?.status === 'finalised'}>
                  <Title level={5} className="!mb-3">
                    {t('inputs.exitDetailsTitle')}
                  </Title>
                  <Form.Item
                    label={t('inputs.lastWorkingDateLabel')}
                    name="lastWorkingDate"
                    rules={[
                      {
                        required: true,
                        message: t('inputs.lastWorkingDateRequired'),
                      },
                    ]}
                  >
                    <DatePicker className="w-full" format="DD/MM/YYYY" />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label={t('inputs.noticePeriodLabel')} name="noticePeriodDays">
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label={t('inputs.noticeServedLabel')} name="noticeServedDays">
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label={t('inputs.resignationReasonLabel')} name="resignationReason">
                    <TextArea rows={3} placeholder={t('inputs.resignationReasonPlaceholder')} />
                  </Form.Item>

                  <Title level={5} className="!mt-6 !mb-3">
                    {t('inputs.leaveEncashmentTitle')}
                  </Title>
                  <Form.Item label={t('inputs.leaveBalanceLabel')} name="leaveBalanceDays">
                    <InputNumber className="w-full" min={0} />
                  </Form.Item>
                  <Text type="secondary">{t('inputs.leaveEncashmentFormula')}</Text>
                  <Alert
                    className="!mt-3 !mb-3"
                    type="warning"
                    showIcon
                    title={t('inputs.leaveBalanceAlert')}
                  />
                  <Card
                    size="small"
                    style={{
                      background: 'var(--cr-warning-50)',
                      borderColor: 'var(--cr-warning-50)',
                    }}
                  >
                    <Text strong>
                      {t('inputs.encashmentPreviewLabel', {
                        amount: currencyFmt.currency(encashmentPreview),
                      })}
                    </Text>
                  </Card>

                  <Title level={5} className="!mt-6 !mb-3">
                    {t('inputs.otherEarningsTitle')}
                  </Title>
                  <Form.List name="otherAdditions">
                    {(fields, { add, remove }) => (
                      <Space orientation="vertical" className="w-full" size={8}>
                        {fields.map((field) => (
                          <Row gutter={8} key={field.key} align="middle">
                            <Col flex="auto">
                              <Form.Item
                                {...field}
                                name={[field.name, 'description']}
                                className="!mb-0"
                              >
                                <Input placeholder={t('inputs.descriptionPlaceholder')} />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item {...field} name={[field.name, 'amount']} className="!mb-0">
                                <InputNumber className="w-full" min={0} />
                              </Form.Item>
                            </Col>
                            <Col>
                              <Button onClick={() => remove(field.name)}>
                                {t('inputs.removeButton')}
                              </Button>
                            </Col>
                          </Row>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({ description: '', amount: 0 })}
                        >
                          {t('inputs.addOtherEarnings')}
                        </Button>
                      </Space>
                    )}
                  </Form.List>

                  <Title level={5} className="!mt-6 !mb-3">
                    {t('inputs.otherDeductionsTitle')}
                  </Title>
                  <Form.List name="otherDeductions">
                    {(fields, { add, remove }) => (
                      <Space orientation="vertical" className="w-full" size={8}>
                        {fields.map((field) => (
                          <Row gutter={8} key={field.key} align="middle">
                            <Col flex="auto">
                              <Form.Item
                                {...field}
                                name={[field.name, 'description']}
                                className="!mb-0"
                              >
                                <Input placeholder={t('inputs.descriptionPlaceholder')} />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item {...field} name={[field.name, 'amount']} className="!mb-0">
                                <InputNumber className="w-full" min={0} />
                              </Form.Item>
                            </Col>
                            <Col>
                              <Button onClick={() => remove(field.name)}>
                                {t('inputs.removeButton')}
                              </Button>
                            </Col>
                          </Row>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({ description: '', amount: 0 })}
                        >
                          {t('inputs.addOtherDeductions')}
                        </Button>
                      </Space>
                    )}
                  </Form.List>

                  <Title level={5} className="!mt-6 !mb-3">
                    {t('inputs.notesTitle')}
                  </Title>
                  <Form.Item label={t('inputs.notesLabel')} name="notes">
                    <TextArea rows={4} placeholder={t('inputs.notesPlaceholder')} />
                  </Form.Item>
                </Form>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={14}>
            <Card>
              {loading ? (
                <Skeleton active paragraph={{ rows: 12 }} />
              ) : settlement ? (
                <Space orientation="vertical" size={16} className="w-full">
                  <Space align="center" wrap>
                    <Title level={4} className="!mb-0">
                      {t('summary.cardTitle')}
                    </Title>
                    {getStatusTag(settlement.status)}
                  </Space>
                  <Text type="secondary">
                    {t('summary.serviceLabel', {
                      name: member.name,
                      years: settlement.completedYears,
                      months: settlement.completedMonths,
                    })}
                  </Text>

                  <Card size="small" style={{ background: 'var(--cr-bg)' }}>
                    <Title level={5} className="!mb-3">
                      {t('summary.earningsTitle')}
                    </Title>
                    <Table<SummaryRow>
                      size="small"
                      pagination={false}
                      columns={summaryColumns}
                      dataSource={earningsRows}
                      rowKey="key"
                    />
                  </Card>

                  <Card size="small" style={{ background: 'var(--cr-warning-50)' }}>
                    <Title level={5} className="!mb-3">
                      {t('summary.deductionsTitle')}
                    </Title>
                    <Table<SummaryRow>
                      size="small"
                      pagination={false}
                      columns={summaryColumns}
                      dataSource={deductionRows}
                      rowKey="key"
                    />
                  </Card>

                  {(settlement.advanceResidualUnrecovered ?? 0) > 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      title={t('summary.advanceResidualTitle')}
                      description={t('summary.advanceResidualDescription', {
                        amount: currencyFmt.currency(settlement.advanceResidualUnrecovered),
                      })}
                    />
                  )}

                  <Card
                    size="small"
                    style={{
                      background: 'var(--cr-info-50)',
                      borderColor: 'var(--cr-info-50)',
                    }}
                  >
                    <Text type="secondary">{t('summary.netFnfPayableLabel')}</Text>
                    <Title level={2} className="!mt-1 !mb-0">
                      {currencyFmt.currency(settlement.netFnfPayable || 0)}
                    </Title>
                  </Card>

                  {settlement.status === 'finalised' && settlement.finalisedAt && (
                    <Alert
                      type="success"
                      showIcon
                      title={t('summary.finalisedAlert', {
                        date: dayjs(settlement.finalisedAt).format('DD MMM YYYY'),
                      })}
                    />
                  )}
                </Space>
              ) : (
                <Empty description={t('summary.emptyDescription')} />
              )}
            </Card>
          </Col>
        </Row>
      </Modal>
    </>
  );
}
