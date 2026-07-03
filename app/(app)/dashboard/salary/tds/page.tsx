'use client';

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Collapse,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AuditOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { salaryApi } from '@/lib/api';
import { useWorkspaceStore } from '@/lib/store';
import { parseApiError } from '@/lib/utils';
import { searchBsrCodes, type BsrEntry } from '@/lib/constants/bsr-codes';
import { downloadForm24Q } from '@/lib/export/generateForm24Q';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import type {
  CreateChallanPayload,
  PayrollConfigDeductor,
  TdsChallan,
  TdsLiabilityResponse,
  TdsQuarterlySummary,
} from '@/types';
import { DsPageHeader } from '@/components/ui';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const QUARTER_ITEMS = [
  { key: '1', label: 'Q1' },
  { key: '2', label: 'Q2' },
  { key: '3', label: 'Q3' },
  { key: '4', label: 'Q4' },
];

const INDIAN_STATE_OPTIONS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
].map((state) => ({ label: state, value: state }));

const DEFAULT_DEDUCTOR_VALUES: PayrollConfigDeductor = {
  tan: '',
  pan: '',
  branchDivision: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  responsiblePersonName: '',
  responsiblePersonPan: '',
  responsiblePersonDesignation: '',
};

const DEDUCTOR_REQUIRED_FIELDS: Array<keyof PayrollConfigDeductor> = [
  'tan',
  'pan',
  'address1',
  'city',
  'state',
  'pincode',
  'phone',
  'email',
  'responsiblePersonName',
  'responsiblePersonPan',
  'responsiblePersonDesignation',
];

type ChallanFormValues = {
  month: number;
  bsrCode: string;
  bankName?: string;
  branchName?: string;
  challanSerialNo: string;
  depositDate: Dayjs | null;
  tdsTotalDeposited: number;
  interestAmount?: number;
  feeAmount?: number;
  remarks?: string;
};

type DeductorFormValues = PayrollConfigDeductor;

function hasTextValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDeductorComplete(values: Partial<PayrollConfigDeductor> | null | undefined) {
  return DEDUCTOR_REQUIRED_FIELDS.every((field) => hasTextValue(values?.[field]));
}

function normalizeDeductorValues(values: DeductorFormValues): PayrollConfigDeductor {
  return {
    tan: values.tan.trim().toUpperCase(),
    pan: values.pan.trim().toUpperCase(),
    branchDivision: values.branchDivision.trim(),
    address1: values.address1.trim(),
    address2: values.address2.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    pincode: values.pincode.trim(),
    phone: values.phone.trim(),
    email: values.email.trim(),
    responsiblePersonName: values.responsiblePersonName.trim(),
    responsiblePersonPan: values.responsiblePersonPan.trim().toUpperCase(),
    responsiblePersonDesignation: values.responsiblePersonDesignation.trim(),
  };
}

function getFinancialYear(month: number, year: number, fyStartMonth = 4) {
  return month >= fyStartMonth ? year : year - 1;
}

function getQuarter(month: number, fyStartMonth = 4) {
  const offset = (month - fyStartMonth + 12) % 12;
  return Math.floor(offset / 3) + 1;
}

function getCalendarYearForFyMonth(financialYear: number, month: number, fyStartMonth = 4) {
  return month >= fyStartMonth ? financialYear : financialYear + 1;
}

function getFyLabel(financialYear: number) {
  return `${financialYear}-${String(financialYear + 1).slice(2)}`;
}

function getDifferenceTag(
  difference: number,
  formatCurrency: (value: number) => string,
  labels: { balanced: string; underpaid: string; overpaid: string },
) {
  if (difference === 0) {
    return <Tag color="green">{labels.balanced}</Tag>;
  }

  if (difference > 0) {
    return (
      <Tag color="gold">{labels.underpaid.replace('{amount}', formatCurrency(difference))}</Tag>
    );
  }

  return (
    <Tag color="blue">
      {labels.overpaid.replace('{amount}', formatCurrency(Math.abs(difference)))}
    </Tag>
  );
}

function formatMonthYear(month: number, year: number) {
  return `${MONTH_SHORT_NAMES[month - 1]} ${year}`;
}

export default function SalaryTdsManagementPage() {
  const { currentWorkspaceId, currentWorkspace, isHydrated } = useWorkspaceStore(
    useShallow((state) => ({
      currentWorkspaceId: state.currentWorkspaceId,
      currentWorkspace: state.currentWorkspace,
      isHydrated: state.isHydrated,
    })),
  );
  const {
    config: payrollConfig,
    fetchConfig: fetchPayrollConfig,
    updateConfig: updatePayrollConfig,
  } = usePayrollConfigStore(
    useShallow((state) => ({
      config: state.config,
      fetchConfig: state.fetchConfig,
      updateConfig: state.updateConfig,
    })),
  );
  const t = useTranslations();
  const features = useSalaryFeatures();
  const currencyFmt = useCurrencyFormatter();
  const [msgApi, messageContext] = message.useMessage();
  const [deductorForm] = Form.useForm<DeductorFormValues>();
  const [form] = Form.useForm<ChallanFormValues>();
  const [liability, setLiability] = useState<TdsLiabilityResponse | null>(null);
  const [quarterSummary, setQuarterSummary] = useState<TdsQuarterlySummary | null>(null);
  const [allChallans, setAllChallans] = useState<TdsChallan[]>([]);
  const [quarterChallans, setQuarterChallans] = useState<TdsChallan[]>([]);
  const [loadingLiability, setLoadingLiability] = useState(false);
  const [loadingQuarter, setLoadingQuarter] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChallan, setEditingChallan] = useState<TdsChallan | null>(null);
  const [savingChallan, setSavingChallan] = useState(false);
  const [savingDeductor, setSavingDeductor] = useState(false);
  const [generatingForm24Q, setGeneratingForm24Q] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [bsrQuery, setBsrQuery] = useState('');
  const [deductorPanelKeys, setDeductorPanelKeys] = useState<string[]>([]);

  const currentMonth = dayjs().month() + 1;
  const currentYear = dayjs().year();
  const fyStartMonth = currentWorkspace?.fiscalYearStartMonth || 4;
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(() =>
    getFinancialYear(currentMonth, currentYear, fyStartMonth),
  );
  const [selectedQuarter, setSelectedQuarter] = useState(() =>
    getQuarter(currentMonth, fyStartMonth),
  );

  useEffect(() => {
    startTransition(() => {
      setSelectedFinancialYear(getFinancialYear(currentMonth, currentYear, fyStartMonth));
      setSelectedQuarter(getQuarter(currentMonth, fyStartMonth));
    });
  }, [currentMonth, currentYear, fyStartMonth]);

  const watchedMonth = Form.useWatch('month', form);
  const watchedTdsAmount = Form.useWatch('tdsTotalDeposited', form) || 0;
  const watchedInterest = Form.useWatch('interestAmount', form) || 0;
  const watchedFee = Form.useWatch('feeAmount', form) || 0;
  const totalChallanAmount = watchedTdsAmount + watchedInterest + watchedFee;
  const currentMonthLabel = MONTH_NAMES[currentMonth - 1];
  const deductorConfig = payrollConfig?.deductor ?? DEFAULT_DEDUCTOR_VALUES;
  const isDeductorFullyConfigured = isDeductorComplete(deductorConfig);
  const hasTanConfigured = hasTextValue(deductorConfig.tan);
  const hasEmployerPanConfigured = hasTextValue(deductorConfig.pan);
  const missingPanCount = quarterSummary
    ? quarterSummary.employeeSummary.filter((employee) => !hasTextValue(employee.pan)).length
    : 0;
  const hasQuarterChallans = quarterChallans.length > 0;
  const generationBlockers = [
    !hasTanConfigured ? t('salary.tds.form24q.blockerTan') : null,
    !hasEmployerPanConfigured ? t('salary.tds.form24q.blockerPan') : null,
    !hasQuarterChallans ? t('salary.tds.form24q.blockerChallan') : null,
  ].filter(Boolean) as string[];
  const canGenerateForm24Q = generationBlockers.length === 0 && !loadingQuarter;
  const generationBlockerMessage = loadingQuarter
    ? t('salary.tds.form24q.blockerLoading')
    : generationBlockers.join(' ');
  const fyOptions = useMemo(() => {
    const baseFinancialYear = getFinancialYear(currentMonth, currentYear, fyStartMonth);
    return Array.from({ length: 5 }, (_, index) => {
      const financialYear = baseFinancialYear - index;
      return {
        label: `FY ${getFyLabel(financialYear)}`,
        value: financialYear,
      };
    });
  }, [currentMonth, currentYear, fyStartMonth]);

  const loadLiability = useCallback(async () => {
    if (!currentWorkspaceId) return;

    startTransition(() => {
      setLoadingLiability(true);
    });
    try {
      const response = await salaryApi.getTdsLiability(
        currentWorkspaceId,
        currentMonth,
        currentYear,
      );
      startTransition(() => {
        setLiability(response);
      });
    } catch (error) {
      msgApi.error(parseApiError(error));
    } finally {
      startTransition(() => {
        setLoadingLiability(false);
      });
    }
  }, [currentMonth, currentWorkspaceId, currentYear, msgApi]);

  const loadQuarterData = useCallback(async () => {
    if (!currentWorkspaceId) return;

    startTransition(() => {
      setLoadingQuarter(true);
    });
    try {
      const [fyChallans, quarterRecords, quarterSummaryResponse] = await Promise.all([
        salaryApi.getTdsChallans(currentWorkspaceId, selectedFinancialYear),
        salaryApi.getTdsChallansForQuarter(
          currentWorkspaceId,
          selectedFinancialYear,
          selectedQuarter,
        ),
        salaryApi.getTdsQuarterlySummary(
          currentWorkspaceId,
          selectedFinancialYear,
          selectedQuarter,
        ),
      ]);

      startTransition(() => {
        setAllChallans(fyChallans);
        setQuarterChallans(quarterRecords);
        setQuarterSummary(quarterSummaryResponse);
      });
    } catch (error) {
      msgApi.error(parseApiError(error));
    } finally {
      startTransition(() => {
        setLoadingQuarter(false);
      });
    }
  }, [currentWorkspaceId, msgApi, selectedFinancialYear, selectedQuarter]);

  useEffect(() => {
    if (!currentWorkspaceId || !isHydrated || !features.tdsManagement.enabled) {
      return;
    }

    void fetchPayrollConfig(currentWorkspaceId);
    void loadLiability();
    void loadQuarterData();
  }, [
    currentWorkspaceId,
    fetchPayrollConfig,
    features.tdsManagement.enabled,
    isHydrated,
    loadLiability,
    loadQuarterData,
  ]);

  useEffect(() => {
    const nextDeductor = payrollConfig?.deductor ?? DEFAULT_DEDUCTOR_VALUES;
    deductorForm.setFieldsValue(nextDeductor);
    startTransition(() => {
      setDeductorPanelKeys(isDeductorComplete(nextDeductor) ? [] : ['deductor']);
    });
  }, [deductorForm, payrollConfig?.deductor]);

  useEffect(() => {
    if (!modalOpen || editingChallan || !currentWorkspaceId || !watchedMonth) {
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setPrefillLoading(true);
    });

    void salaryApi
      .getTdsLiability(
        currentWorkspaceId,
        watchedMonth,
        getCalendarYearForFyMonth(selectedFinancialYear, watchedMonth, fyStartMonth),
      )
      .then((response) => {
        if (!cancelled) {
          form.setFieldValue('tdsTotalDeposited', response.totalTdsDeducted);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          msgApi.error(parseApiError(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPrefillLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspaceId,
    editingChallan,
    form,
    fyStartMonth,
    modalOpen,
    msgApi,
    selectedFinancialYear,
    watchedMonth,
  ]);

  const bsrOptions = useMemo(
    () =>
      searchBsrCodes(bsrQuery).map((entry) => ({
        value: entry.bsrCode,
        label: `BSR: ${entry.bsrCode} | ${entry.bankName} - ${entry.branchName}, ${entry.city}`,
        entry,
      })),
    [bsrQuery],
  );

  const handleSelectBsr = (_value: string, option: { entry?: BsrEntry }) => {
    if (!option.entry) return;
    form.setFieldsValue({
      bsrCode: option.entry.bsrCode,
      bankName: option.entry.bankName,
      branchName: option.entry.branchName,
    });
  };

  const openCreateModal = () => {
    setEditingChallan(null);
    setBsrQuery('');
    form.resetFields();
    form.setFieldsValue({
      month: currentMonth,
      depositDate: dayjs(),
      tdsTotalDeposited: liability?.totalTdsDeducted || 0,
      interestAmount: 0,
      feeAmount: 0,
    });
    setModalOpen(true);
  };

  const openEditModal = (challan: TdsChallan) => {
    setEditingChallan(challan);
    setBsrQuery(challan.bsrCode);
    form.setFieldsValue({
      month: challan.month,
      bsrCode: challan.bsrCode,
      bankName: challan.bankName,
      branchName: challan.branchName,
      challanSerialNo: challan.challanSerialNo,
      depositDate: dayjs(challan.depositDate),
      tdsTotalDeposited: challan.tdsTotalDeposited,
      interestAmount: challan.interestAmount,
      feeAmount: challan.feeAmount,
      remarks: challan.remarks,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingChallan(null);
    setBsrQuery('');
    form.resetFields();
  };

  const handleSaveChallan = async () => {
    if (!currentWorkspaceId) return;

    const values = await form.validateFields();
    const payload: CreateChallanPayload = {
      month: values.month,
      year: getCalendarYearForFyMonth(selectedFinancialYear, values.month, fyStartMonth),
      bsrCode: values.bsrCode.trim(),
      bankName: values.bankName?.trim(),
      branchName: values.branchName?.trim(),
      challanSerialNo: values.challanSerialNo.trim(),
      depositDate: values.depositDate?.toISOString() || dayjs().toISOString(),
      tdsTotalDeposited: values.tdsTotalDeposited || 0,
      interestAmount: values.interestAmount || 0,
      feeAmount: values.feeAmount || 0,
      remarks: values.remarks?.trim(),
    };

    setSavingChallan(true);
    try {
      if (editingChallan) {
        await salaryApi.updateTdsChallan(currentWorkspaceId, editingChallan._id, payload);
        msgApi.success(t('salary.tds.challan.updatedToast'));
      } else {
        await salaryApi.createTdsChallan(currentWorkspaceId, payload);
        msgApi.success(t('salary.tds.challan.recordedToast'));
      }
      closeModal();
      await Promise.all([loadQuarterData(), loadLiability()]);
    } catch (error) {
      msgApi.error(parseApiError(error));
    } finally {
      setSavingChallan(false);
    }
  };

  const handleDeleteChallan = async (challanId: string) => {
    if (!currentWorkspaceId) return;
    try {
      await salaryApi.deleteTdsChallan(currentWorkspaceId, challanId);
      msgApi.success(t('salary.tds.challan.deletedToast'));
      await loadQuarterData();
    } catch (error) {
      msgApi.error(parseApiError(error));
    }
  };

  const handleSaveDeductor = async () => {
    if (!currentWorkspaceId) return;
    try {
      const values = await deductorForm.validateFields();
      const payload = normalizeDeductorValues(values);

      setSavingDeductor(true);
      await updatePayrollConfig(currentWorkspaceId, {
        deductor: payload,
      });
      msgApi.success(t('salary.tds.deductor.savedToast'));
      setDeductorPanelKeys(isDeductorComplete(payload) ? [] : ['deductor']);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      msgApi.error(parseApiError(error));
    } finally {
      setSavingDeductor(false);
    }
  };

  const handleGenerateForm24Q = async () => {
    if (!currentWorkspaceId || !canGenerateForm24Q) {
      return;
    }

    setGeneratingForm24Q(true);
    try {
      const data = await salaryApi.getForm24QData(
        currentWorkspaceId,
        selectedFinancialYear,
        selectedQuarter,
      );
      await downloadForm24Q(data);
      msgApi.success(t('salary.tds.form24q.generatedToast'));
    } catch (error) {
      msgApi.error(parseApiError(error));
    } finally {
      setGeneratingForm24Q(false);
    }
  };

  const handleDownloadQuarterExcel = async () => {
    if (!quarterSummary) return;

    const XLSX = await import('xlsx');
    const rows = [
      [
        t('salary.tds.summary.colEmployeeName'),
        t('salary.tds.summary.colPan'),
        t('salary.tds.summary.colGrossSalary'),
        t('salary.tds.summary.colTdsDeducted'),
      ],
      ...quarterSummary.employeeSummary.map((entry) => [
        entry.employeeName,
        entry.pan || t('salary.tds.challan.notProvided'),
        entry.grossSalary,
        entry.tdsDeducted,
      ]),
      [
        t('salary.tds.summary.rowTotal'),
        '',
        quarterSummary.employeeSummary.reduce((sum, entry) => sum + entry.grossSalary, 0),
        quarterSummary.employeeSummary.reduce((sum, entry) => sum + entry.tdsDeducted, 0),
      ],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Q${selectedQuarter}`);
    XLSX.writeFile(workbook, `TDS_Summary_Q${selectedQuarter}_FY${quarterSummary.fyLabel}.xlsx`);
  };

  const liabilityColumns: ColumnsType<TdsLiabilityResponse['breakdown'][number]> = [
    {
      title: t('salary.tds.liability.colEmployeeName'),
      dataIndex: 'employeeName',
      key: 'employeeName',
    },
    { title: t('salary.tds.liability.colPan'), dataIndex: 'pan', key: 'pan' },
    {
      title: t('salary.tds.liability.colTdsAmount'),
      dataIndex: 'tdsAmount',
      key: 'tdsAmount',
      align: 'right',
      render: (value: number) => currencyFmt.full(value),
    },
  ];

  const challanColumns: ColumnsType<TdsChallan> = [
    {
      title: t('salary.tds.challan.colMonth'),
      key: 'month',
      render: (_, row) => formatMonthYear(row.month, row.year),
    },
    { title: t('salary.tds.challan.colBsrCode'), dataIndex: 'bsrCode', key: 'bsrCode' },
    {
      title: t('salary.tds.challan.colBank'),
      key: 'bank',
      render: (_, row) => row.bankName || row.branchName || '--',
    },
    {
      title: t('salary.tds.challan.colSerialNo'),
      dataIndex: 'challanSerialNo',
      key: 'challanSerialNo',
    },
    {
      title: t('salary.tds.challan.colDepositDate'),
      key: 'depositDate',
      render: (_, row) => dayjs(row.depositDate).format('DD MMM YYYY'),
    },
    {
      title: t('salary.tds.challan.colTdsDeposited'),
      dataIndex: 'tdsTotalDeposited',
      key: 'tdsTotalDeposited',
      align: 'right',
      render: (value: number) => currencyFmt.full(value),
    },
    {
      title: t('salary.tds.challan.colInterest'),
      dataIndex: 'interestAmount',
      key: 'interestAmount',
      align: 'right',
      render: (value: number) => currencyFmt.full(value),
    },
    {
      title: t('salary.tds.challan.colFee'),
      dataIndex: 'feeAmount',
      key: 'feeAmount',
      align: 'right',
      render: (value: number) => currencyFmt.full(value),
    },
    {
      title: t('salary.tds.challan.colTotal'),
      dataIndex: 'totalChallanAmount',
      key: 'totalChallanAmount',
      align: 'right',
      render: (value: number) => currencyFmt.full(value),
    },
    {
      title: t('salary.tds.challan.colActions'),
      key: 'actions',
      render: (_, row) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(row)}>
            {t('salary.tds.challan.editButton')}
          </Button>
          <Popconfirm
            title={t('salary.tds.challan.deleteConfirm')}
            onConfirm={() => void handleDeleteChallan(row._id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              {t('salary.tds.challan.deleteButton')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const summaryColumns: ColumnsType<TdsQuarterlySummary['employeeSummary'][number]> = [
    {
      title: t('salary.tds.summary.colEmployeeName'),
      dataIndex: 'employeeName',
      key: 'employeeName',
    },
    {
      title: t('salary.tds.summary.colPan'),
      dataIndex: 'pan',
      key: 'pan',
      render: (value: string) => value || t('salary.tds.challan.notProvided'),
    },
    {
      title: t('salary.tds.summary.colGrossSalary'),
      dataIndex: 'grossSalary',
      key: 'grossSalary',
      align: 'right',
      render: (value: number) => currencyFmt.full(value),
    },
    {
      title: t('salary.tds.summary.colTdsDeducted'),
      dataIndex: 'tdsDeducted',
      key: 'tdsDeducted',
      align: 'right',
      render: (value: number) => currencyFmt.full(value),
    },
  ];

  if (!isHydrated) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-subtle">
        {t('salary.tds.loading')}
      </div>
    );
  }

  if (!features.tdsManagement.enabled) {
    return (
      <Card className="rounded-[24px]">
        <Empty description={t('salary.tds.notAvailable')} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {messageContext}
      <DsPageHeader title={t('salary.tds.pageTitle')} sub={t('salary.tds.pageSubtitle')} />

      <Card className="rounded-[24px]" styles={{ body: { padding: 0 } }}>
        <Collapse
          ghost
          activeKey={deductorPanelKeys}
          onChange={(keys) =>
            setDeductorPanelKeys(
              Array.isArray(keys) ? keys.map(String) : keys ? [String(keys)] : [],
            )
          }
          items={[
            {
              key: 'deductor',
              // Mount this pane eagerly so the deductorForm effect (setFieldsValue on
              // config load) always has a connected <Form>; otherwise AntD warns when
              // the pane is lazily mounted on first activation.
              forceRender: true,
              label: (
                <div>
                  <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-primary,var(--cr-info-500))] uppercase">
                    {t('salary.tds.deductor.sectionLabel')}
                  </p>
                  <p className="m-0 mt-1 text-sm text-muted">{t('salary.tds.deductor.subtitle')}</p>
                </div>
              ),
              children: (
                <div className="px-6 pb-6">
                  {!hasTanConfigured && (
                    <Alert
                      className="mb-5"
                      type="warning"
                      showIcon
                      title={t('salary.tds.deductor.warningAlert')}
                    />
                  )}

                  <Form form={deductorForm} layout="vertical">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Form.Item
                        name="tan"
                        label={t('salary.tds.deductor.tanLabel')}
                        rules={[
                          { required: true, message: t('salary.tds.deductor.tanRequired') },
                          { len: 10, message: t('salary.tds.deductor.tanLength') },
                        ]}
                      >
                        <Input
                          maxLength={10}
                          placeholder={t('salary.tds.deductor.tanPlaceholder')}
                        />
                      </Form.Item>
                      <Form.Item
                        name="pan"
                        label={t('salary.tds.deductor.employerPanLabel')}
                        rules={[
                          {
                            required: true,
                            message: t('salary.tds.deductor.employerPanRequired'),
                          },
                          { len: 10, message: t('salary.tds.deductor.panLength') },
                        ]}
                      >
                        <Input
                          maxLength={10}
                          placeholder={t('salary.tds.deductor.panPlaceholder')}
                        />
                      </Form.Item>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Form.Item
                        name="branchDivision"
                        label={t('salary.tds.deductor.branchDivisionLabel')}
                      >
                        <Input placeholder={t('salary.tds.deductor.branchDivisionPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        name="responsiblePersonName"
                        label={t('salary.tds.deductor.responsiblePersonNameLabel')}
                        rules={[
                          {
                            required: true,
                            message: t('salary.tds.deductor.responsiblePersonNameRequired'),
                          },
                        ]}
                      >
                        <Input
                          placeholder={t('salary.tds.deductor.responsiblePersonNamePlaceholder')}
                        />
                      </Form.Item>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Form.Item
                        name="responsiblePersonPan"
                        label={t('salary.tds.deductor.responsiblePersonPanLabel')}
                        rules={[
                          {
                            required: true,
                            message: t('salary.tds.deductor.responsiblePersonPanRequired'),
                          },
                          { len: 10, message: t('salary.tds.deductor.panLength') },
                        ]}
                      >
                        <Input
                          maxLength={10}
                          placeholder={t('salary.tds.deductor.panPlaceholder')}
                        />
                      </Form.Item>
                      <Form.Item
                        name="responsiblePersonDesignation"
                        label={t('salary.tds.deductor.responsiblePersonDesignationLabel')}
                        rules={[
                          {
                            required: true,
                            message: t('salary.tds.deductor.responsiblePersonDesignationRequired'),
                          },
                        ]}
                      >
                        <Input
                          placeholder={t(
                            'salary.tds.deductor.responsiblePersonDesignationPlaceholder',
                          )}
                        />
                      </Form.Item>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Form.Item
                        name="address1"
                        label={t('salary.tds.deductor.address1Label')}
                        rules={[
                          {
                            required: true,
                            message: t('salary.tds.deductor.address1Required'),
                          },
                        ]}
                      >
                        <Input placeholder={t('salary.tds.deductor.address1Placeholder')} />
                      </Form.Item>
                      <Form.Item name="address2" label={t('salary.tds.deductor.address2Label')}>
                        <Input placeholder={t('salary.tds.deductor.address2Placeholder')} />
                      </Form.Item>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Form.Item
                        name="city"
                        label={t('salary.tds.deductor.cityLabel')}
                        rules={[{ required: true, message: t('salary.tds.deductor.cityRequired') }]}
                      >
                        <Input placeholder={t('salary.tds.deductor.cityPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        name="state"
                        label={t('salary.tds.deductor.stateLabel')}
                        rules={[
                          { required: true, message: t('salary.tds.deductor.stateRequired') },
                        ]}
                      >
                        <Select
                          showSearch
                          options={INDIAN_STATE_OPTIONS}
                          optionFilterProp="label"
                          placeholder={t('salary.tds.deductor.statePlaceholder')}
                        />
                      </Form.Item>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Form.Item
                        name="pincode"
                        label={t('salary.tds.deductor.pincodeLabel')}
                        rules={[
                          { required: true, message: t('salary.tds.deductor.pincodeRequired') },
                        ]}
                      >
                        <Input
                          maxLength={10}
                          placeholder={t('salary.tds.deductor.pincodePlaceholder')}
                        />
                      </Form.Item>
                      <Form.Item
                        name="phone"
                        label={t('salary.tds.deductor.phoneLabel')}
                        rules={[
                          { required: true, message: t('salary.tds.deductor.phoneRequired') },
                        ]}
                      >
                        <Input
                          maxLength={20}
                          placeholder={t('salary.tds.deductor.phonePlaceholder')}
                        />
                      </Form.Item>
                    </div>

                    <Form.Item
                      name="email"
                      label={t('salary.tds.deductor.emailLabel')}
                      rules={[
                        { required: true, message: t('salary.tds.deductor.emailRequired') },
                        {
                          type: 'email',
                          message: t('salary.tds.deductor.emailInvalid'),
                        },
                      ]}
                    >
                      <Input placeholder={t('salary.tds.deductor.emailPlaceholder')} />
                    </Form.Item>

                    <div className="flex justify-end">
                      <Button
                        type="primary"
                        onClick={() => void handleSaveDeductor()}
                        loading={savingDeductor}
                      >
                        {t('salary.tds.deductor.saveButton')}
                      </Button>
                    </div>
                  </Form>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card className="!mt-8 rounded-[24px]" styles={{ body: { padding: 24 } }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-primary,var(--cr-info-500))] uppercase">
              {t('salary.tds.liability.sectionLabel')}
            </p>
            <h1 className="m-0 mt-1 text-[28px] font-bold text-heading">
              {t('salary.tds.liability.heading')}
            </h1>
            <p className="m-0 mt-2 text-[14px] leading-6 text-muted">
              {t('salary.tds.liability.subtitle', { month: currentMonthLabel, year: currentYear })}
            </p>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void loadLiability()}
            loading={loadingLiability}
          >
            {t('salary.tds.liability.refreshButton')}
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card size="small" className="rounded-[20px]">
            <Statistic
              title={t('salary.tds.liability.totalTdsToDeposit')}
              value={liability?.totalTdsDeducted || 0}
              formatter={(value) => currencyFmt.full(Number(value || 0))}
              loading={loadingLiability}
              prefix={<AuditOutlined />}
            />
          </Card>
          <Card size="small" className="rounded-[20px]">
            <Statistic
              title={t('salary.tds.liability.employeesWithTds')}
              value={liability?.employeeCount || 0}
              loading={loadingLiability}
            />
          </Card>
        </div>

        <Alert
          className="mt-5"
          type="info"
          showIcon
          title={t('salary.tds.liability.depositInfoAlert')}
        />

        <div className="mt-5 overflow-hidden rounded-[20px] border border-[var(--cr-border,var(--cr-border))]">
          <Table
            rowKey={(row) => `${row.employeeName}-${row.pan}-${row.tdsAmount}`}
            columns={liabilityColumns}
            dataSource={liability?.breakdown || []}
            pagination={false}
            loading={loadingLiability}
            scroll={{ x: 720 }}
          />
        </div>
      </Card>

      <Card className="!mt-8 rounded-[24px]" styles={{ body: { padding: 24 } }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
              {t('salary.tds.challan.sectionLabel')}
            </p>
            <h2 className="m-0 mt-1 text-[24px] font-bold text-heading">
              {t('salary.tds.challan.heading')}
            </h2>
            <p className="m-0 mt-2 text-[14px] leading-6 text-muted">
              {t('salary.tds.challan.fyRecordCount', {
                fy: getFyLabel(selectedFinancialYear),
                count: allChallans.length,
              })}
            </p>
          </div>
          <Space wrap>
            <Select
              value={selectedFinancialYear}
              options={fyOptions}
              onChange={setSelectedFinancialYear}
              style={{ minWidth: 180 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('salary.tds.challan.addButton')}
            </Button>
          </Space>
        </div>

        <Tabs
          className="mt-5"
          activeKey={String(selectedQuarter)}
          items={QUARTER_ITEMS}
          onChange={(activeKey) => setSelectedQuarter(Number(activeKey))}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-[var(--cr-border,var(--cr-border))] bg-[var(--cr-surface-2,var(--cr-bg))] px-4 py-3">
          <span className="text-[13px] font-medium text-heading">
            {t('salary.tds.challan.recordCount', { count: quarterChallans.length })}
          </span>
          <span className="text-[13px] text-muted">
            {t('salary.tds.challan.totalDeposited', {
              amount: currencyFmt.full(quarterSummary?.totalChallanDeposited ?? 0),
            })}
          </span>
          <span className="text-[13px] text-muted">
            {t('salary.tds.challan.tdsDeducted', {
              amount: currencyFmt.full(quarterSummary?.totalTdsDeducted ?? 0),
            })}
          </span>
          {getDifferenceTag(quarterSummary?.difference ?? 0, currencyFmt.full, {
            balanced: t('salary.tds.challan.tagBalanced'),
            // t.raw returns the literal template (e.g. "Underpaid {amount}") so
            // getDifferenceTag can substitute the formatted amount itself. Using t()
            // here throws FORMATTING_ERROR because the {amount} arg is not provided.
            underpaid: t.raw('salary.tds.challan.tagUnderpaid') as string,
            overpaid: t.raw('salary.tds.challan.tagOverpaid') as string,
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--cr-border,var(--cr-border))]">
          <Table
            rowKey="_id"
            columns={challanColumns}
            dataSource={quarterChallans}
            pagination={false}
            loading={loadingQuarter}
            locale={{
              emptyText: t('salary.tds.challan.tableEmpty'),
            }}
            scroll={{ x: 1200 }}
          />
        </div>

        <div className="mt-6 rounded-[20px] border border-[var(--cr-border,var(--cr-border))] bg-[var(--cr-surface-2,var(--cr-bg))] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="m-0 text-[20px] font-semibold text-heading">
                {t('salary.tds.form24q.heading')}
              </h3>
              <p className="m-0 mt-1 text-[13px] leading-6 text-muted">
                {t('salary.tds.form24q.subtitle')}
              </p>
            </div>
            <Tooltip title={canGenerateForm24Q ? '' : generationBlockerMessage}>
              <span>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => void handleGenerateForm24Q()}
                  loading={generatingForm24Q}
                  disabled={!canGenerateForm24Q}
                >
                  {t('salary.tds.form24q.generateButton')}
                </Button>
              </span>
            </Tooltip>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 text-sm text-heading">
              {hasTanConfigured ? (
                <CheckCircleTwoTone twoToneColor="var(--cr-success-500)" />
              ) : (
                <CloseCircleTwoTone twoToneColor="var(--cr-danger-500)" />
              )}
              <span>{t('salary.tds.form24q.checkTan')}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-heading">
              {hasEmployerPanConfigured ? (
                <CheckCircleTwoTone twoToneColor="var(--cr-success-500)" />
              ) : (
                <CloseCircleTwoTone twoToneColor="var(--cr-danger-500)" />
              )}
              <span>{t('salary.tds.form24q.checkPan')}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-heading">
              {hasQuarterChallans ? (
                <CheckCircleTwoTone twoToneColor="var(--cr-success-500)" />
              ) : (
                <CloseCircleTwoTone twoToneColor="var(--cr-danger-500)" />
              )}
              <span>{t('salary.tds.form24q.checkChallan')}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-heading">
              {missingPanCount === 0 ? (
                <CheckCircleTwoTone twoToneColor="var(--cr-success-500)" />
              ) : (
                <ExclamationCircleOutlined className="text-[var(--cr-warning,var(--cr-warning-500))]" />
              )}
              <span>
                {missingPanCount === 0
                  ? t('salary.tds.form24q.allPanPresent')
                  : t('salary.tds.form24q.missingPan', { count: missingPanCount })}
              </span>
            </div>
          </div>

          {selectedQuarter === 4 && (
            <Alert className="mt-4" type="info" showIcon title={t('salary.tds.form24q.q4Alert')} />
          )}

          {missingPanCount > 0 && (
            <Alert
              className="mt-4"
              type="warning"
              showIcon
              title={t('salary.tds.form24q.missingPanAlert', { count: missingPanCount })}
            />
          )}

          <Alert
            className="mt-4"
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            title={t('salary.tds.form24q.uploadAlert')}
          />
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="m-0 text-[20px] font-semibold text-heading">
              {t('salary.tds.summary.heading')}
              {quarterSummary ? ` - ${quarterSummary.quarterLabel}` : ''}
            </h3>
            <p className="m-0 mt-1 text-[13px] text-muted">{t('salary.tds.summary.subtitle')}</p>
          </div>
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => void handleDownloadQuarterExcel()}
            disabled={!quarterSummary || quarterSummary.employeeSummary.length === 0}
          >
            {t('salary.tds.summary.downloadExcel')}
          </Button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--cr-border,var(--cr-border))]">
          <Table
            rowKey="teamMemberId"
            columns={summaryColumns}
            dataSource={quarterSummary?.employeeSummary || []}
            pagination={false}
            loading={loadingQuarter}
            locale={{ emptyText: t('salary.tds.summary.tableEmpty') }}
            scroll={{ x: 720 }}
            summary={() =>
              quarterSummary ? (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>{t('salary.tds.summary.rowTotal')}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} align="right">
                    <strong>
                      {currencyFmt.full(
                        quarterSummary.employeeSummary.reduce(
                          (sum, row) => sum + row.grossSalary,
                          0,
                        ),
                      )}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <strong>{currencyFmt.full(quarterSummary.totalTdsDeducted)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              ) : null
            }
          />
        </div>
      </Card>

      <Modal
        title={editingChallan ? t('salary.tds.modal.titleEdit') : t('salary.tds.modal.titleAdd')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSaveChallan()}
        okText={editingChallan ? t('salary.tds.modal.okTextEdit') : t('salary.tds.modal.okTextAdd')}
        confirmLoading={savingChallan}
        destroyOnHidden
        width={760}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="month"
            label={t('salary.tds.modal.monthLabel')}
            rules={[{ required: true, message: t('salary.tds.modal.monthRequired') }]}
          >
            <Select
              options={MONTH_NAMES.map((label, index) => ({
                label,
                value: index + 1,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="bsrCode"
            label={t('salary.tds.modal.bsrCodeLabel')}
            rules={[
              { required: true, message: t('salary.tds.modal.bsrCodeRequired') },
              { pattern: /^\d{7}$/, message: t('salary.tds.modal.bsrCodeLength') },
            ]}
            extra={t('salary.tds.modal.bsrCodeExtra')}
          >
            <AutoComplete
              options={bsrOptions}
              onSearch={setBsrQuery}
              onSelect={handleSelectBsr}
              filterOption={false}
            >
              <Input placeholder={t('salary.tds.modal.bsrCodePlaceholder')} />
            </AutoComplete>
          </Form.Item>

          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item name="bankName" label={t('salary.tds.modal.bankNameLabel')}>
              <Input placeholder={t('salary.tds.modal.bankNamePlaceholder')} />
            </Form.Item>
            <Form.Item name="branchName" label={t('salary.tds.modal.branchNameLabel')}>
              <Input placeholder={t('salary.tds.modal.branchNamePlaceholder')} />
            </Form.Item>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              name="challanSerialNo"
              label={t('salary.tds.modal.challanSerialLabel')}
              rules={[
                {
                  required: true,
                  message: t('salary.tds.modal.challanSerialRequired'),
                },
              ]}
              extra={t('salary.tds.modal.challanSerialExtra')}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="depositDate"
              label={t('salary.tds.modal.depositDateLabel')}
              rules={[{ required: true, message: t('salary.tds.modal.depositDateRequired') }]}
            >
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Form.Item
              name="tdsTotalDeposited"
              label={t('salary.tds.modal.tdsAmountLabel')}
              extra={
                prefillLoading
                  ? t('salary.tds.modal.tdsAmountExtraLoading')
                  : t('salary.tds.modal.tdsAmountExtra')
              }
              rules={[{ required: true, message: t('salary.tds.modal.tdsAmountRequired') }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item
              name="interestAmount"
              label={t('salary.tds.modal.interestLabel')}
              extra={t('salary.tds.modal.interestExtra')}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item
              name="feeAmount"
              label={t('salary.tds.modal.feeLabel')}
              extra={t('salary.tds.modal.feeExtra')}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>

          <Card size="small" className="mb-4 rounded-[16px] bg-[var(--cr-surface-2,var(--cr-bg))]">
            <Statistic
              title={t('salary.tds.modal.totalChallanAmount')}
              value={totalChallanAmount}
              formatter={(value) => currencyFmt.full(Number(value || 0))}
            />
            <Typography.Text type="secondary">
              {t('salary.tds.modal.calendarYearNote', { fy: getFyLabel(selectedFinancialYear) })}
            </Typography.Text>
          </Card>

          <Form.Item name="remarks" label={t('salary.tds.modal.remarksLabel')}>
            <Input.TextArea rows={3} placeholder={t('salary.tds.modal.remarksPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
