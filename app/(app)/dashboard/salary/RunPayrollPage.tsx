'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  message,
  Modal,
  Form,
  InputNumber,
  Input,
  Row,
  Col,
  Tooltip,
  Badge,
  DatePicker,
  Segmented,
  Drawer,
  Checkbox,
  Dropdown,
  Popover,
  Tag,
} from 'antd';
import { useTranslations } from 'next-intl';
import { env } from '@/lib/env';
import { PieceRatePreviewDrawer } from '@/components/salary/PieceRatePreviewDrawer';
import type { MessageInstance } from 'antd/es/message/interface';
import type { FormInstance } from 'antd';
import {
  ReloadOutlined,
  HistoryOutlined,
  SearchOutlined,
  SettingOutlined,
  WalletOutlined,
  BankOutlined,
  MobileOutlined,
  InboxOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  AppstoreOutlined,
  CloseOutlined,
  LeftOutlined,
  RightOutlined,
  UpOutlined,
  DownOutlined,
  PlusOutlined,
  LockOutlined,
  BulbOutlined,
  UnlockOutlined,
  RiseOutlined,
  AuditOutlined,
  MoreOutlined,
  FilePdfOutlined,
  MailOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import type {
  SalaryRecord,
  TeamMember,
  LedgerTransaction,
  ViewMode,
  LedgerMonth,
  BankAccount,
  CreateSalaryAdjustmentPayload,
  ReverseSalaryAdjustmentPayload,
  SalaryAdjustment,
  AdvanceComplianceBreach,
} from './types/salary-page.types';
import { resolveEffectiveMonthlySalary, calculateAttendanceNetSalary } from '@/lib/salary';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
// OQ-S1: compliance exports are HR+Owner only on the backend; gate the FE
// trigger on salary.sensitive_view so a Manager never sees a 403-bound button.
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useComponentTemplateStore } from '@/features/salary/store/useComponentTemplateStore';
import { calculateComponents } from '@/features/salary/utils/component-calculator';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import {
  updateWorkspace,
  getSalaryAdjustments,
  getSalaryPayments,
  ensureSalaryRecord,
  lockSalaryRecord,
  unlockSalaryRecord,
} from '@/lib/actions';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import { downloadSinglePayslip } from '@/lib/export/generatePayslipPdf';
import type { PayslipData, PayslipBranding } from '@/lib/export/generatePayslipPdf';
import {
  DsAvatar,
  DsPageHeader,
  DsTag,
  STATUS_COLORS,
  FileUpload,
  DsModal,
  DsDrawer,
  SegmentedToggle,
} from '@/components/ui';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import dayjs from 'dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SalaryIncrementModal } from '@/components/dashboard/SalaryIncrementModal';
import { createLedgerExportRows } from '@/lib/exportFields/ledgerFields';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

import { useSalaryPageStore } from './store/useSalaryPageStore';
import { useSalaryData } from './hooks/useSalaryData';
import { usePaymentActions } from './hooks/usePaymentActions';
import { usePayslipActions } from './hooks/usePayslipActions';
import { useAdjustmentActions } from './hooks/useAdjustmentActions';
import { useLedgerData } from './hooks/useLedgerData';
import { useSetSalaryActions } from './hooks/useSetSalaryActions';
import { SetSalaryModal } from './components/salary/SetSalaryModal';
import type { CalculatedComponent, SalaryComponentTemplate } from '@/types';
import { TransactionDetailModal } from './components/salary/TransactionDetailModal';
import { ReverseAdjustmentModal } from './components/salary/ReverseAdjustmentModal';
import { ReversePaymentModal } from './components/salary/ReversePaymentModal';
import { AdjustmentDrawer } from './components/salary/AdjustmentDrawer';
import { MonthTransactionsModal } from './components/salary/MonthTransactionsModal';
import { MonthDetailDrawer } from './components/salary/MonthDetailDrawer';
import { FullHistoryDrawer } from './components/salary/FullHistoryDrawer';
import { PayDrawer } from './components/salary/PayDrawer';
import { AdvancePlanDrawer } from './components/salary/AdvancePlanDrawer';
import { ComplianceExportModal } from './components/salary/ComplianceExportModal';
import { TaxDeclarationModal } from './components/salary/TaxDeclarationModal';
import { FnfSettlementModal } from './components/salary/FnfSettlementModal';
import { BulkPaymentModal } from './components/salary/BulkPaymentModal';
import { BulkEmailProgressModal } from './components/salary/BulkEmailProgressModal';
import { SalaryPageHeader } from './components/salary/SalaryPageHeader';
import { SalarySummaryCards } from './components/salary/SalarySummaryCards';
import { UpcomingJoinersHint } from './components/salary/UpcomingJoinersHint';
import { CreateBankAccountModal } from './components/salary/CreateBankAccountModal';
import { PayslipEmailsDrawer } from '@/components/dashboard/PayslipEmailsDrawer';
import { LockedRecordsDrawer } from '@/components/dashboard/LockedRecordsDrawer';
import { MemberCapNotice } from '@/components/dashboard/MemberCapNotice';
// Phase 26 Plan 07: advance request drawer (employee) + approval queue (owner).

import type { StatusFilter } from './types/salary-page.types';
import type { BulkPaymentResult, MonthlyTaskStatusResponse } from '@/types';
import {
  HISTORY_DATE_RANGE_LABELS,
  ADDITION_CATEGORY_OPTIONS,
  DEDUCTION_CATEGORY_OPTIONS,
} from './constants/salary-page.constants';
import {
  formatAdjustmentCategory,
  getAdjustmentActorName,
  slugifyFilenamePart,
  formatPayrollDayValue,
} from './utils/salary-page.utils';

const { Option } = Select;
const PAYSLIP_DATA_BATCH_SIZE = 50;

function getBulkSortParams(sortKey: string): {
  sortBy?: 'name' | 'netSalary' | 'paidAmount' | 'status';
  sortOrder?: 'asc' | 'desc';
} {
  switch (sortKey) {
    case 'name_asc':
      return { sortBy: 'name', sortOrder: 'asc' };
    case 'name_desc':
      return { sortBy: 'name', sortOrder: 'desc' };
    case 'amount_asc':
      return { sortBy: 'netSalary', sortOrder: 'asc' };
    case 'amount_desc':
      return { sortBy: 'netSalary', sortOrder: 'desc' };
    case 'status':
      return { sortBy: 'status', sortOrder: 'asc' };
    default:
      return {};
  }
}

function getBulkStatusParam(statusFilter: StatusFilter): string | undefined {
  if (statusFilter === 'all' || statusFilter === 'missing_method') {
    return undefined;
  }

  return statusFilter;
}

function AdvanceTargetSelector({
  payModal,
  advanceTarget,
  setAdvanceTarget,
  canAdvance = true,
}: {
  payModal: { month?: number; year?: number } | null;
  advanceTarget: 'next_month' | 'this_month';
  setAdvanceTarget: (v: 'next_month' | 'this_month') => void;
  canAdvance?: boolean;
}) {
  if (!canAdvance) {
    return (
      <div
        className="mb-4 overflow-hidden rounded-xl"
        style={{ border: '1px solid var(--cr-warning-50)', background: 'var(--cr-warning-50)' }}
      >
        <div className="flex items-center gap-2 px-3.5 py-3">
          <LockOutlined className="text-[13px] text-amber-700" />
          <p className="m-0 text-[12px] font-semibold text-amber-700">
            Advance payments require a higher plan
          </p>
        </div>
      </div>
    );
  }

  const base = dayjs(`${payModal?.year}-${String(payModal?.month ?? 1).padStart(2, '0')}-01`);
  const nextMonth = base.add(1, 'month').format('MMMM YYYY');
  const thisMonth = base.format('MMMM YYYY');

  const options: { value: 'next_month' | 'this_month'; label: string; sub: string }[] = [
    {
      value: 'next_month',
      label: 'Advance for next month',
      sub: `Payment stays on ${thisMonth}. Auto-recovery deduction will be applied to ${nextMonth} payroll.`,
    },
    {
      value: 'this_month',
      label: 'Extra payment (bonus/overtime)',
      sub: `Added on top of ${thisMonth} pay. Net payable will increase to match.`,
    },
  ];

  return (
    <div
      className="mb-4 overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--cr-indigo-100)' }}
    >
      <div
        className="flex items-center gap-2 px-3.5 py-2"
        style={{ background: 'var(--cr-indigo-50)' }}
      >
        <BulbOutlined className="text-[13px] text-purple-700" />
        <p className="m-0 text-[12px] font-semibold text-purple-700">
          Salary fully paid, where should this extra amount go?
        </p>
      </div>
      <div
        className="flex flex-col gap-2 px-3.5 py-3"
        style={{ background: 'var(--cr-indigo-50)' }}
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-2.5"
            onClick={() => setAdvanceTarget(opt.value)}
          >
            <div
              className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2"
              style={{
                borderColor:
                  advanceTarget === opt.value ? 'var(--cr-indigo-400)' : 'var(--cr-neutral-300)',
                background:
                  advanceTarget === opt.value ? 'var(--cr-indigo-400)' : 'var(--cr-surface, #fff)',
              }}
            >
              {advanceTarget === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <p className="m-0 text-[13px] font-semibold text-heading">{opt.label}</p>
              <p className="m-0 text-[11px] text-muted">{opt.sub}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SalaryPage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Phase 23 plan 23-11: Piece-rate preview drawer state
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    teamMemberId?: string;
    memberName?: string;
    month?: number;
    year?: number;
  }>({ open: false });
  const { currentWorkspaceId, isHydrated, currentWorkspace } = useWorkspaceStore(
    useShallow((s) => ({
      currentWorkspaceId: s.currentWorkspaceId,
      isHydrated: s.isHydrated,
      currentWorkspace: s.currentWorkspace,
    })),
  );
  const payrollDisplay = usePayrollConfigStore((s) => s.config?.display);
  const currencyFmt = useCurrencyFormatter();
  const formatCurrencyFull = currencyFmt.full;
  const currencyConfig = useMemo(
    () => ({
      symbol: payrollDisplay?.currencySymbol || '₹',
      locale: payrollDisplay?.currencyLocale || 'en-IN',
      code: payrollDisplay?.currencyCode || 'INR',
    }),
    [payrollDisplay?.currencyCode, payrollDisplay?.currencyLocale, payrollDisplay?.currencySymbol],
  );
  const focusedTeamMemberId = searchParams.get('teamMemberId')?.trim() || '';

  // View controls - grouped with useShallow
  const { month, year, search, sortKey, statusFilter, viewMode } = useSalaryPageStore(
    useShallow((s) => ({
      month: s.month,
      year: s.year,
      search: s.search,
      sortKey: s.sortKey,
      statusFilter: s.statusFilter,
      viewMode: s.viewMode,
    })),
  );

  // View control setters
  const { setMonth, setYear, setSearch, setSortKey, setStatusFilter, setViewMode } =
    useSalaryPageStore(
      useShallow((s) => ({
        setMonth: s.setMonth,
        setYear: s.setYear,
        setSearch: s.setSearch,
        setSortKey: s.setSortKey,
        setStatusFilter: s.setStatusFilter,
        setViewMode: s.setViewMode,
      })),
    );

  const { selectedRowKeys, setSelectedRowKeys, clearSelection } = useSalaryPageStore(
    useShallow((s) => ({
      selectedRowKeys: s.selectedRowKeys,
      setSelectedRowKeys: s.setSelectedRowKeys,
      clearSelection: s.clearSelection,
    })),
  );

  // Modal state
  const {
    payModal,
    setSalaryModal,
    complianceModal,
    fnfModal,
    tdsModal,
    adjustmentDrawerRecord,
    monthTransactionsModal,
    incrementModalOpen,
    selectedMemberForIncrement,
  } = useSalaryPageStore(
    useShallow((s) => ({
      payModal: s.payModal,
      setSalaryModal: s.setSalaryModal,
      complianceModal: s.complianceModal,
      fnfModal: s.fnfModal,
      tdsModal: s.tdsModal,
      adjustmentDrawerRecord: s.adjustmentDrawerRecord,
      monthTransactionsModal: s.monthTransactionsModal,
      incrementModalOpen: s.incrementModalOpen,
      selectedMemberForIncrement: s.selectedMemberForIncrement,
    })),
  );

  // Modal setters
  const {
    setPayModal,
    setSetSalaryModal,
    openComplianceModal,
    closeComplianceModal,
    openFnfModal,
    closeFnfModal,
    openTdsModal,
    closeTdsModal,
    setAdjustmentDrawerRecord,
    setMonthTransactionsModal,
    setIncrementModalOpen,
    setSelectedMemberForIncrement,
    patchRecord,
  } = useSalaryPageStore(
    useShallow((s) => ({
      setPayModal: s.setPayModal,
      setSetSalaryModal: s.setSetSalaryModal,
      openComplianceModal: s.openComplianceModal,
      closeComplianceModal: s.closeComplianceModal,
      openFnfModal: s.openFnfModal,
      closeFnfModal: s.closeFnfModal,
      openTdsModal: s.openTdsModal,
      closeTdsModal: s.closeTdsModal,
      setAdjustmentDrawerRecord: s.setAdjustmentDrawerRecord,
      setMonthTransactionsModal: s.setMonthTransactionsModal,
      setIncrementModalOpen: s.setIncrementModalOpen,
      setSelectedMemberForIncrement: s.setSelectedMemberForIncrement,
      patchRecord: s.patchRecord,
    })),
  );

  // Data state - individual selectors
  const loading = useSalaryPageStore((s) => s.loading);
  // Over-plan-limit notice from the paginated register response. Drives
  // <MemberCapNotice> above the register; null unless the workspace is past its
  // plan cap (post-grace). -> useSalaryData -> PaginatedSalaryResponse.memberCap.
  const memberCap = useSalaryPageStore((s) => s.memberCap);
  const ledgerData = useSalaryPageStore((s) => s.ledgerData);
  const isLedgerLoading = useSalaryPageStore((s) => s.isLedgerLoading);
  const ledgerError = useSalaryPageStore((s) => s.ledgerError);
  const adjustmentHistory = useSalaryPageStore((s) => s.adjustmentHistory);
  const adjustmentsLoading = useSalaryPageStore((s) => s.adjustmentsLoading);

  const {
    load,
    loadShiftSummaries,
    filteredRecords,
    shiftSummaries,
    shiftSummariesLoading,
    shiftRowsByKey,
    shiftRowsLoadingByKey,
    shiftRowsLoadedByKey,
    shiftRowsErrorByKey,
    shiftPaginationByKey,
    loadShiftRows,
    statusCounts,
    totalPayable,
    totalPaid,
    totalPending,
    isOverpaidTotal,
    totalOverpaid,
    paidCount,
    pendingCount,
    upcomingJoinersCount,
    nextJoinerMonth,
    nextJoinerYear,
    getRecordStatus,
    getSettlementStatus,
    isFinanciallySettled,
    getExportData,
    getRecordMemberId,
    hydrateRecordWithMember,
    getPaymentCreditedAmount,
    page,
    pageSize,
    totalRecords,
    totalPages,
    setPage,
  } = useSalaryData();

  const updateRouteParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let shouldReplace = false;

    if (!params.get('month')) {
      params.set('month', String(month));
      shouldReplace = true;
    }
    if (!params.get('year')) {
      params.set('year', String(year));
      shouldReplace = true;
    }

    if (shouldReplace) {
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [month, pathname, router, searchParams, year]);

  useEffect(() => {
    // Sync URL → store on browser navigation (back/forward) and initial mount.
    // Read store via getState() and depend only on `searchParams` - otherwise
    // the effect re-fires whenever the store's search/filter values change and
    // overwrites freshly-typed input with the stale URL value, because
    // router.replace() updates searchParams asynchronously.
    const state = useSalaryPageStore.getState();
    const queryMonth = Number(searchParams.get('month'));
    const queryYear = Number(searchParams.get('year'));
    const queryView = searchParams.get('view');
    const queryStatus = searchParams.get('status');
    const querySearch = searchParams.get('search');
    const querySort = searchParams.get('sort');
    const nextView = queryView === 'shift' ? 'shift' : 'table';
    const nextStatus =
      queryStatus &&
      [
        'all',
        'pending',
        'partial',
        'paid',
        'missing_method',
        'salary_not_set',
        'advance',
        'not_generated',
      ].includes(queryStatus)
        ? (queryStatus as StatusFilter)
        : 'all';
    const nextSearch = querySearch ?? '';
    const nextSort = querySort ?? 'name_asc';

    if (
      Number.isInteger(queryMonth) &&
      queryMonth >= 1 &&
      queryMonth <= 12 &&
      queryMonth !== state.month
    ) {
      state.setMonth(queryMonth);
    }

    if (Number.isInteger(queryYear) && queryYear >= 2000 && queryYear !== state.year) {
      state.setYear(queryYear);
    }

    if (nextView !== state.viewMode) {
      state.setViewMode(nextView);
    }

    if (nextStatus !== state.statusFilter) {
      state.setStatusFilter(nextStatus);
    }

    if (nextSearch !== state.search) {
      state.setSearch(nextSearch);
    }

    if (nextSort !== state.sortKey) {
      state.setSortKey(nextSort);
    }
  }, [searchParams]);

  const handleClearFilters = useCallback(() => {
    // Atomic URL update: a single router.replace deletes search/status/sort
    // together. Calling the individual setSearch/setStatusFilter wrappers in
    // sequence would issue two router.replace calls that share the same
    // updateRouteParams closure baseline - the second call would overwrite the
    // first, leaving stale params in the URL. Then the URL→store sync effect
    // would re-read those stale params and revert the just-cleared store.
    updateRouteParams({ search: null, status: null, sort: null });
    setSearch('');
    setStatusFilter('all');
    setSortKey('name_asc');
  }, [updateRouteParams, setSearch, setStatusFilter, setSortKey]);

  // Reset filters on workspace switch
  const resetSalaryFilters = useSalaryPageStore((s) => s.reset);
  const prevWorkspaceIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevWorkspaceIdRef.current && prevWorkspaceIdRef.current !== currentWorkspaceId) {
      resetSalaryFilters();
    }
    prevWorkspaceIdRef.current = currentWorkspaceId ?? null;
  }, [currentWorkspaceId, resetSalaryFilters]);

  // Fetch PayrollConfig on mount
  const fetchPayrollConfig = usePayrollConfigStore((s) => s.fetchConfig);
  useEffect(() => {
    if (currentWorkspaceId && isHydrated) {
      fetchPayrollConfig(currentWorkspaceId);
    }
  }, [currentWorkspaceId, isHydrated]);

  const [monthlyTaskStatus, setMonthlyTaskStatus] = useState<MonthlyTaskStatusResponse | null>(
    null,
  );
  const [payslipEmailsDrawerOpen, setPayslipEmailsDrawerOpen] = useState(false);
  const [lockedRecordsDrawerOpen, setLockedRecordsDrawerOpen] = useState(false);

  const fetchMonthlyTaskStatus = useCallback(async () => {
    if (!currentWorkspaceId || !isHydrated) return;
    try {
      const status = await salaryApi.getMonthlyTaskStatus(currentWorkspaceId, month, year);
      startTransition(() => {
        setMonthlyTaskStatus(status);
      });
    } catch {
      /* non-critical */
    }
  }, [currentWorkspaceId, isHydrated, month, year]);

  useEffect(() => {
    void fetchMonthlyTaskStatus();
  }, [fetchMonthlyTaskStatus]);

  const [msgApi, msgCtx] = message.useMessage();
  const [modalApi, modalCtx] = Modal.useModal();
  const [payForm] = Form.useForm();
  const [setSalaryForm] = Form.useForm();
  const [adjustmentForm] = Form.useForm();
  const [reverseAdjustmentForm] = Form.useForm();
  const [reversePaymentForm] = Form.useForm();
  const [form16LoadingMemberId, setForm16LoadingMemberId] = useState<string | null>(null);
  const [emailPayslipLoadingId, setEmailPayslipLoadingId] = useState<string | null>(null);
  const [bulkPayslipEmailing, setBulkPayslipEmailing] = useState(false);
  const [bulkEmailJobId, setBulkEmailJobId] = useState<string | null>(null);
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);

  // Holds the breaches returned by a COMPLIANCE_BLOCKED backend error so that
  // the override modal inside PayDrawer can display them even for race conditions
  // where the backend rejected a non-override submit after a stale preview.
  const [pendingComplianceBreaches, setPendingComplianceBreaches] = useState<
    AdvanceComplianceBreach[] | null
  >(null);

  // D-10: COA cash/bank account selected in PayDrawer picker - forwarded to backend for ledger posting.
  // Set via onCoaAccountChange callback from PayDrawer; cleared when drawer closes. Plan 26-08.
  const [selectedCoaAccountId, setSelectedCoaAccountId] = useState<string | undefined>(undefined);

  const handleComplianceBlocked = useCallback(
    (breaches: AdvanceComplianceBreach[]) => {
      setPendingComplianceBreaches(breaches);
      msgApi.error(
        'Payment blocked: compliance requirements not met. Review breaches and override if authorised.',
      );
    },
    [msgApi],
  );

  const {
    handlePayment,
    handleReversePayment,
    saving,
    setSaving,
    reversePaymentSaving,
    setReversePaymentSaving,
  } = usePaymentActions({ load, msgApi, onComplianceBlocked: handleComplianceBlocked });

  const { generatePayslip, generating: payslipGenerating } = usePayslipActions({ msgApi });

  const adjustmentTeamMembers = useMemo(
    () => filteredRecords.map((r) => r.teamMember).filter((m): m is TeamMember => Boolean(m)),
    [filteredRecords],
  );

  const {
    openAdjustments,
    handleCreateAdjustment,
    handleReverseAdjustment,
    refreshAdjustmentContext,
    resetAdjustmentComposer,
    prepareAdjustmentCorrectionDraft,
    openReverseAdjustmentModal,
    adjustmentSaving,
    reverseSaving: adjReverseSaving,
    adjustmentProof,
    setAdjustmentProof,
    adjustmentCorrectionSource,
    setAdjustmentCorrectionSource,
    reverseAdjustmentTarget,
    setReverseAdjustmentTarget,
    reverseAdjustmentIntent,
    setReverseAdjustmentIntent,
  } = useAdjustmentActions({
    load,
    msgApi,
    adjustmentForm,
    reverseAdjustmentForm,
    teamMembers: adjustmentTeamMembers,
    canViewAdjustments: true,
    hydrateRecordWithMember,
    getRecordMemberId,
  });

  const { openLedger, loadFullLedger } = useLedgerData();

  const { handleSetSalary } = useSetSalaryActions({
    setSalaryModal,
    getRecordStatus,
    load,
    msgApi,
  });

  // Get store setters for adjustment/ledger state
  const setAdjustmentHistory = useSalaryPageStore((s) => s.setAdjustmentHistory);
  const setAdjustmentsLoading = useSalaryPageStore((s) => s.setAdjustmentsLoading);
  const setLedgerData = useSalaryPageStore((s) => s.setLedgerData);
  const setLedgerError = useSalaryPageStore((s) => s.setLedgerError);

  // Local state that needs to be added
  const [reversePaymentTarget, setReversePaymentTarget] = useState<LedgerTransaction | null>(null);
  const [reverseSaving, setReverseSaving] = useState(false);

  const [payPreferredMethod, setPayPreferredMethod] = useState<'BANK' | 'UPI' | undefined>(
    undefined,
  );
  const [ledgerModal, setLedgerModal] = useState<SalaryRecord | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<LedgerTransaction | null>(null);
  const [ledgerViewMonthKey, setLedgerViewMonthKey] = useState<string | null>(null);
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState<Set<string>>(new Set());
  const [historyDateRange, setHistoryDateRange] = useState<'all' | '3m' | '6m' | '1y'>('all');
  const [historyAccountFilter, setHistoryAccountFilter] = useState<Set<string>>(new Set());
  const [adjustmentProofLocal, setAdjustmentProofLocal] = useState<string | File | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<'next_month' | 'this_month'>('next_month');
  const [advanceInstallmentValue, setAdvanceInstallmentValue] = useState<
    import('./components/salary/AdvanceInstallmentConfigurator').AdvanceInstallmentValue | null
  >(null);
  const [outstandingAdvance, setOutstandingAdvance] = useState<{
    outstanding: number;
    totalAdvanced: number;
    totalRecovered: number;
  } | null>(null);
  const [advancePlanDrawerPlanId, setAdvancePlanDrawerPlanId] = useState<string | null>(null);
  const [advancePlanDrawerOpen, setAdvancePlanDrawerOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<'single' | 'split'>('single');
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<
    'cash' | 'upi' | 'bank_transfer' | 'cheque'
  >('bank_transfer');
  const [splits, setSplits] = useState<
    Array<{
      id: string;
      amount: number;
      method: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
      transactionId: string;
      voucherNo: string;
      referenceNo: string;
      paymentFrom: string;
      paidBy: string;
      payoutDate: string;
      proofFiles: File[];
      internalNotes: string;
    }>
  >([
    {
      id: '1',
      amount: 0,
      method: 'bank_transfer',
      transactionId: '',
      voucherNo: '',
      referenceNo: '',
      paymentFrom: '',
      paidBy: '',
      payoutDate: dayjs().toISOString(),
      proofFiles: [],
      internalNotes: '',
    },
    {
      id: '2',
      amount: 0,
      method: 'bank_transfer',
      transactionId: '',
      voucherNo: '',
      referenceNo: '',
      paymentFrom: '',
      paidBy: '',
      payoutDate: dayjs().toISOString(),
      proofFiles: [],
      internalNotes: '',
    },
  ]);
  const [sameDateForAll, setSameDateForAll] = useState(false);
  const [sameNotesForAll, setSameNotesForAll] = useState(false);
  const [samePaidByForAll, setSamePaidByForAll] = useState(false);
  const [proofImages, setProofImages] = useState<File[]>([]);
  const [salaryMode, setSalaryMode] = useState<'monthly' | 'hourly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK' | undefined>(undefined);
  const [passbookImage, setPassbookImage] = useState<string | File | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | File | null>(null);
  const [sameAsEmployeeName, setSameAsEmployeeName] = useState(false);
  const [createBankAccountOpen, setCreateBankAccountOpen] = useState(false);
  const [newBankAccountLabel, setNewBankAccountLabel] = useState('');
  const [creatingBankAccount, setCreatingBankAccount] = useState(false);
  const [addCommission, setAddCommission] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState<number>(0);
  const [commissionNote, setCommissionNote] = useState('');
  const [commissionTitle, setCommissionTitle] = useState('');
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);

  // Shared payment submit helper used by both the normal onSubmit path (no override)
  // and the onComplianceOverride path (with overrideCompliance + overrideReason).
  // Reads current form values from payForm so the override path does not need to
  // re-collect them; the form is still mounted and populated when the override modal
  // confirms.
  const submitPayment = useCallback(
    (extraOpts?: { overrideCompliance?: boolean; overrideReason?: string }) => {
      const vals = payForm.getFieldsValue();
      void handlePayment({
        vals,
        payModal: payModal!,
        splitMode,
        splits,
        proofImages,
        singlePaymentMethod,
        addCommission,
        commissionAmount,
        commissionNote,
        commissionTitle,
        advanceTarget,
        advanceInstallmentValue,
        // D-10: forward the COA account picked in PayDrawer to the backend for ledger posting.
        coaAccountId: selectedCoaAccountId,
        ...extraOpts,
      });
    },
    [
      payForm,
      handlePayment,
      payModal,
      splitMode,
      splits,
      proofImages,
      singlePaymentMethod,
      addCommission,
      commissionAmount,
      commissionNote,
      commissionTitle,
      advanceTarget,
      advanceInstallmentValue,
      selectedCoaAccountId,
    ],
  );

  const selectedAdjustmentType = Form.useWatch('type', adjustmentForm) ?? 'addition';

  // Unified feature access checks
  const features = useSalaryFeatures();
  // OQ-S1: owner OR salary.sensitive_view (HR preset) — gates the compliance
  // export trigger so it matches the HR-only backend gate.
  const { can: canPermission, data: myPermissions } = useMyPermissions();
  const canViewSensitiveSalary =
    !!myPermissions?.isOwner || canPermission('salary', 'sensitive_view', 'all');
  const canExport = features.exportData.enabled;
  const canAdvance = features.advancePayments.enabled;
  const canSplit = features.splitPayments.enabled;
  const canEditSalary = features.editSalary.enabled;
  const canViewAdjustments = features.adjustmentsView.enabled;
  const canCreateAdjustments = features.adjustmentsCreate.enabled;
  const canReverseAdjustments = features.adjustmentsReverse.enabled;
  // OQ-S1: compliance exports require the feature AND HR/Owner sensitivity grant.
  const canUseComplianceExports = features.complianceExports.enabled && canViewSensitiveSalary;
  const canManageFnfSettlements = features.fnfSettlement.enabled;
  const canManageTaxDeclarations = features.statutoryTds.enabled;
  const canGenerateForm16 = features.form16Generation.enabled;
  const canEmailPayslips = features.payslipEmail.enabled && features.payslipGeneration.enabled;
  const reversePaymentAccess = features.reversePayment;

  // Component templates for CTC breakdown display
  const { templates, fetchTemplates } = useComponentTemplateStore();

  useEffect(() => {
    if (features.salaryComponents.visible && currentWorkspaceId) {
      fetchTemplates(currentWorkspaceId);
    }
  }, [features.salaryComponents.visible, currentWorkspaceId, fetchTemplates]);

  const legacyHandleDownloadPayslip = useCallback(
    async (record: SalaryRow) => {
      const isGeneratedRecord = Boolean(record._id) && !String(record._id).startsWith('new-');
      if (!currentWorkspaceId || !isGeneratedRecord) {
        msgApi.warning('Salary record not generated yet - generate payroll first');
        return;
      }

      const memberId =
        typeof record.teamMemberId === 'string'
          ? record.teamMemberId
          : record.teamMemberId?._id || record.teamMember?.id;

      if (!memberId) {
        msgApi.error('Employee details are missing for this payslip');
        return;
      }

      msgApi.loading({ content: 'Generating payslip...', key: 'payslip', duration: 0 });

      try {
        const [adjustments, payments] = await Promise.all([
          getSalaryAdjustments(currentWorkspaceId, record._id!),
          getSalaryPayments(currentWorkspaceId, record._id!),
        ]);

        const member = record.teamMember;
        let componentTemplate = null;
        if (member?.ctcAmount && member?.componentTemplateId) {
          const { templates: storeTemplates } = useComponentTemplateStore.getState();
          componentTemplate =
            storeTemplates.find((template) => template._id === member.componentTemplateId) || null;
        }

        const workspace = useWorkspaceStore.getState().currentWorkspace;
        const branding: PayslipBranding = {
          includeHeaderLogo: workspace?.exportPreferences?.includeHeaderLogo ?? false,
          headerLogoUrl: workspace?.branding?.pdfHeaderLogo || workspace?.branding?.logo,
          includeWatermark: workspace?.exportPreferences?.includeWatermark ?? false,
          watermarkLogoUrl: workspace?.branding?.pdfWatermarkLogo,
          includeFooter: workspace?.exportPreferences?.includeFooter ?? false,
          footerText: workspace?.branding?.pdfFooterDetails,
          showExportDate: workspace?.exportPreferences?.showExportDate ?? true,
        };

        const payslipData: PayslipData = {
          record: record as PayslipData['record'],
          adjustments: adjustments || [],
          payments: payments || [],
          componentTemplate,
          workspaceName: workspace?.name || 'Company',
          branding,
          currencyConfig,
        };

        await downloadSinglePayslip(payslipData);
        msgApi.success({ content: 'Payslip downloaded', key: 'payslip' });
      } catch (err: unknown) {
        msgApi.error({ content: parseApiError(err), key: 'payslip' });
      }
    },
    [currencyConfig, currentWorkspaceId, msgApi],
  );

  const legacyHandleBulkPayslipDownload = useCallback(
    async (mode: 'combined' | 'zip') => {
      if (!currentWorkspaceId) return;

      msgApi.loading({
        content: 'Fetching all salary records...',
        key: 'bulk-payslip',
        duration: 0,
      });

      try {
        const allRecords: SalaryRow[] = [];
        let currentPageNumber = 1;
        let totalPageCount = 1;

        do {
          const response = await salaryApi.getRecordsPaginated(currentWorkspaceId, {
            month,
            year,
            page: currentPageNumber,
            limit: 100,
            search: search.trim() || undefined,
            status: getBulkStatusParam(statusFilter),
            teamMemberId: focusedTeamMemberId || undefined,
            ...getBulkSortParams(sortKey),
          });

          allRecords.push(...(response.records as SalaryRow[]));
          totalPageCount = response.pagination.pages;
          currentPageNumber += 1;
        } while (currentPageNumber <= totalPageCount);

        const eligibleRecords = allRecords.filter(
          (record) =>
            record._id && !String(record._id).startsWith('new-') && (record.baseSalary ?? 0) > 0,
        );

        if (eligibleRecords.length === 0) {
          msgApi.warning({ content: 'No generated salary records to export', key: 'bulk-payslip' });
          return;
        }

        msgApi.loading({
          content: `Generating ${eligibleRecords.length} payslips...`,
          key: 'bulk-payslip',
          duration: 0,
        });

        const workspace = useWorkspaceStore.getState().currentWorkspace;
        const branding: PayslipBranding = {
          includeHeaderLogo: workspace?.exportPreferences?.includeHeaderLogo ?? false,
          headerLogoUrl: workspace?.branding?.pdfHeaderLogo || workspace?.branding?.logo,
          includeWatermark: workspace?.exportPreferences?.includeWatermark ?? false,
          watermarkLogoUrl: workspace?.branding?.pdfWatermarkLogo,
          includeFooter: workspace?.exportPreferences?.includeFooter ?? false,
          footerText: workspace?.branding?.pdfFooterDetails,
          showExportDate: workspace?.exportPreferences?.showExportDate ?? true,
        };

        const { templates: storeTemplates } = useComponentTemplateStore.getState();
        const payslipsData: PayslipData[] = [];
        const BATCH_SIZE = 10;

        for (let i = 0; i < eligibleRecords.length; i += BATCH_SIZE) {
          const batch = eligibleRecords.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.all(
            batch.map(async (record) => {
              const [adjustments, payments] = await Promise.all([
                getSalaryAdjustments(currentWorkspaceId, record._id!),
                getSalaryPayments(currentWorkspaceId, record._id!),
              ]);

              const member = record.teamMember;
              let componentTemplate = null;
              if (member?.ctcAmount && member?.componentTemplateId) {
                componentTemplate =
                  storeTemplates.find((template) => template._id === member.componentTemplateId) ||
                  null;
              }

              return {
                record: record as PayslipData['record'],
                adjustments: adjustments || [],
                payments: payments || [],
                componentTemplate,
                workspaceName: workspace?.name || 'Company',
                branding,
                currencyConfig,
              } as PayslipData;
            }),
          );

          payslipsData.push(...batchResults);

          const completed = Math.min(i + batch.length, eligibleRecords.length);
          const progress = Math.min(100, Math.round((completed / eligibleRecords.length) * 100));
          msgApi.loading({
            content: `Fetching data... ${progress}% (${completed}/${eligibleRecords.length})`,
            key: 'bulk-payslip',
            duration: 0,
          });
        }

        msgApi.loading({
          content: 'Generating PDF...',
          key: 'bulk-payslip',
          duration: 0,
        });

        if (mode === 'combined') {
          const { generatePayslipPdf } = await import('@/lib/export/generatePayslipPdf');
          await generatePayslipPdf({
            payslips: payslipsData,
            mode: 'combined',
          });
        } else {
          const { generatePayslipPdf } = await import('@/lib/export/generatePayslipPdf');
          const { downloadAsZip } = await import('@/lib/export/zipDownload');
          const results = await generatePayslipPdf({
            payslips: payslipsData,
            mode: 'individual',
          });
          const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format(
            'MMM_YYYY',
          );
          await downloadAsZip(results, `Payslips_${monthLabel}.zip`);
        }

        msgApi.success({
          content: `${eligibleRecords.length} payslips downloaded`,
          key: 'bulk-payslip',
        });
      } catch (err: unknown) {
        msgApi.error({
          content: parseApiError(err),
          key: 'bulk-payslip',
        });
      }
    },
    [
      currencyConfig,
      currentWorkspaceId,
      month,
      year,
      search,
      sortKey,
      statusFilter,
      focusedTeamMemberId,
      msgApi,
    ],
  );

  const handleDownloadPayslip = useCallback(
    (record: SalaryRow) => {
      void generatePayslip([record], 'combined');
    },
    [generatePayslip],
  );

  const buildPayslipFilename = useCallback((record: SalaryRow) => {
    const employeeName = slugifyFilenamePart(record.teamMember?.name || 'Employee');
    const monthLabel = dayjs(`${record.year}-${String(record.month).padStart(2, '0')}-01`).format(
      'MMM',
    );

    return `Payslip_${employeeName}_${monthLabel}_${record.year}.pdf`;
  }, []);

  const buildPayslipPayloads = useCallback(
    async (salaryIds: string[]): Promise<PayslipData[]> => {
      if (!currentWorkspaceId || salaryIds.length === 0) {
        return [];
      }

      const chunks: string[][] = [];
      for (let index = 0; index < salaryIds.length; index += PAYSLIP_DATA_BATCH_SIZE) {
        chunks.push(salaryIds.slice(index, index + PAYSLIP_DATA_BATCH_SIZE));
      }

      const responses = await Promise.all(
        chunks.map((chunk) => salaryApi.getPayslipData(currentWorkspaceId, chunk)),
      );

      return responses.flat().map((data) => ({
        record: data.record,
        adjustments: data.adjustments,
        payments: data.payments,
        componentTemplate: data.componentTemplate,
        workspaceName: data.workspaceName,
        branding: data.branding as PayslipBranding | undefined,
        currencyConfig,
        advanceOutstanding: data.advanceOutstanding,
      }));
    },
    [currencyConfig, currentWorkspaceId],
  );

  const loadAllSalaryRowsForCurrentMonth = useCallback(async (): Promise<SalaryRow[]> => {
    if (!currentWorkspaceId) {
      return [];
    }

    const allRecords: SalaryRow[] = [];
    let currentPageNumber = 1;
    let totalPageCount = 1;

    do {
      const response = await salaryApi.getRecordsPaginated(currentWorkspaceId, {
        month,
        year,
        page: currentPageNumber,
        limit: 100,
        search: search.trim() || undefined,
        status: getBulkStatusParam(statusFilter),
        teamMemberId: focusedTeamMemberId || undefined,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      allRecords.push(...(response.records as SalaryRow[]));
      totalPageCount = response.pagination.pages;
      currentPageNumber += 1;
    } while (currentPageNumber <= totalPageCount);

    return allRecords;
  }, [currentWorkspaceId, month, year, search, statusFilter, focusedTeamMemberId]);

  const handleDownloadForm16 = useCallback(
    async (record: SalaryRow) => {
      if (!currentWorkspaceId) {
        msgApi.error('No workspace selected');
        return;
      }

      const memberId = getRecordMemberId(record);
      if (!memberId) {
        msgApi.error('Employee details are missing for this Form 16');
        return;
      }

      const fyStartMonth = currentWorkspace?.fiscalYearStartMonth || 4;
      const financialYear = month >= fyStartMonth ? year : year - 1;
      const messageKey = `form16-${memberId}`;

      setForm16LoadingMemberId(memberId);
      msgApi.loading({
        content: 'Preparing Form 16...',
        key: messageKey,
        duration: 0,
      });

      try {
        const data = await salaryApi.getForm16Data(currentWorkspaceId, memberId, financialYear);
        const { generateForm16Pdf } = await import('@/lib/export/generateForm16Pdf');
        await generateForm16Pdf(data);
        msgApi.success({
          content: `Form 16 ready for ${data.employeeName || 'employee'}`,
          key: messageKey,
        });
      } catch (error) {
        msgApi.error({
          content: parseApiError(error),
          key: messageKey,
        });
      } finally {
        setForm16LoadingMemberId((current) => (current === memberId ? null : current));
      }
    },
    [
      currentWorkspace?.fiscalYearStartMonth,
      currentWorkspaceId,
      getRecordMemberId,
      month,
      msgApi,
      year,
    ],
  );

  const handleEmailPayslip = useCallback(
    async (record: SalaryRow) => {
      if (!currentWorkspaceId) {
        msgApi.error('No workspace selected');
        return;
      }

      const salaryId = record._id;
      if (!salaryId || String(salaryId).startsWith('new-') || record.isPreview) {
        msgApi.warning('Salary record not generated yet. Generate payroll first.');
        return;
      }

      const memberEmail = record.teamMember?.email?.trim();
      if (!memberEmail) {
        msgApi.warning('Employee does not have an email address. Add it in the team profile.');
        return;
      }

      setEmailPayslipLoadingId(salaryId);

      try {
        const result = await salaryApi.sendPayslipEmail(currentWorkspaceId, {
          salaryId,
        });

        if (result.sent) {
          msgApi.success(`Payslip sent to ${memberEmail}`);
        } else {
          msgApi.warning(result.reason || 'Payslip email was not sent.');
        }
      } catch (error) {
        msgApi.error(parseApiError(error));
      } finally {
        setEmailPayslipLoadingId((current) => (current === salaryId ? null : current));
      }
    },
    [currentWorkspaceId, msgApi],
  );

  const handleBulkEmailPayslips = useCallback(async () => {
    if (!currentWorkspaceId) {
      msgApi.error('No workspace selected');
      return;
    }

    modalApi.confirm({
      title: 'Email all payslips?',
      content:
        'This will generate payslips and send emails to all employees with email addresses for the current payroll month. Employees without email will be skipped. You can track progress and cancel at any time.',
      okText: 'Send Payslips',
      cancelText: 'Cancel',
      onOk: async () => {
        setBulkPayslipEmailing(true);
        try {
          const { jobId } = await salaryApi.triggerBulkEmailPayslips(currentWorkspaceId, {
            month,
            year,
          });
          setBulkEmailJobId(jobId);
          setBulkEmailModalOpen(true);
        } catch (error) {
          msgApi.error(parseApiError(error));
        } finally {
          setBulkPayslipEmailing(false);
        }
      },
    });
  }, [currentWorkspaceId, modalApi, month, msgApi, year]);

  const handleBulkPayslipDownload = useCallback(
    async (mode: 'combined' | 'zip') => {
      if (!currentWorkspaceId) return;

      msgApi.loading({
        content: 'Fetching all salary records...',
        key: 'bulk-payslip',
        duration: 0,
      });

      try {
        const allRecords: SalaryRow[] = [];
        let currentPageNumber = 1;
        let totalPageCount = 1;

        do {
          const response = await salaryApi.getRecordsPaginated(currentWorkspaceId, {
            month,
            year,
            page: currentPageNumber,
            limit: 100,
            search: search.trim() || undefined,
            status: getBulkStatusParam(statusFilter),
            teamMemberId: focusedTeamMemberId || undefined,
            ...getBulkSortParams(sortKey),
          });

          allRecords.push(...(response.records as SalaryRow[]));
          totalPageCount = response.pagination.pages;
          currentPageNumber += 1;
        } while (currentPageNumber <= totalPageCount);

        const eligibleRecords = allRecords.filter(
          (record) => record._id && !String(record._id).startsWith('new-') && !record.isPreview,
        );

        if (eligibleRecords.length === 0) {
          msgApi.warning({
            content: 'No generated salary records to export',
            key: 'bulk-payslip',
          });
          return;
        }

        await generatePayslip(eligibleRecords, mode === 'zip' ? 'zip' : 'combined');
        msgApi.destroy('bulk-payslip');
      } catch (err: unknown) {
        msgApi.error({
          content: parseApiError(err),
          key: 'bulk-payslip',
        });
      }
    },
    [
      currentWorkspaceId,
      month,
      year,
      search,
      sortKey,
      statusFilter,
      focusedTeamMemberId,
      msgApi,
      generatePayslip,
    ],
  );
  void legacyHandleDownloadPayslip;
  void legacyHandleBulkPayslipDownload;

  const handleBulkPayment = useCallback(
    async (payload: {
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
    }): Promise<BulkPaymentResult | null> => {
      if (!currentWorkspaceId) {
        return null;
      }

      try {
        const result = await salaryApi.recordBulkPayment(currentWorkspaceId, payload);
        await load();
        return result;
      } catch (error: unknown) {
        msgApi.error(parseApiError(error));
        return null;
      }
    },
    [currentWorkspaceId, load, msgApi],
  );

  function getPayableAmount(record: SalaryRecord | null): number {
    if (!record) return 0;
    if (record.isPreview) {
      return record.effectiveSalary ?? record.baseSalary ?? 0;
    }

    return record.netSalary ?? 0;
  }

  // useEffects that remain local to the component
  useEffect(() => {
    if (payModal) {
      payForm.resetFields();
      const dueAmount = getPayableAmount(payModal) - (payModal.paidAmount ?? 0);
      const preferredMethod = payModal.teamMember?.preferredMethod;
      const defaultMethod = preferredMethod === 'UPI' ? 'upi' : 'bank_transfer';
      payForm.setFieldsValue({
        amount: dueAmount > 0 ? dueAmount : 0,
        paymentDate: dayjs(),
      });
      startTransition(() => {
        setSplitMode('single');
        setSplits([
          {
            id: '1',
            amount: 0,
            method: defaultMethod as 'cash' | 'upi' | 'bank_transfer' | 'cheque',
            transactionId: '',
            voucherNo: '',
            referenceNo: '',
            paymentFrom: '',
            paidBy: '',
            payoutDate: dayjs().toISOString(),
            proofFiles: [],
            internalNotes: '',
          },
          {
            id: '2',
            amount: 0,
            method: defaultMethod as 'cash' | 'upi' | 'bank_transfer' | 'cheque',
            transactionId: '',
            voucherNo: '',
            referenceNo: '',
            paymentFrom: '',
            paidBy: '',
            payoutDate: dayjs().toISOString(),
            proofFiles: [],
            internalNotes: '',
          },
        ]);
        setProofImages([]);
        setPayPreferredMethod(preferredMethod as 'BANK' | 'UPI' | undefined);
        setSinglePaymentMethod(defaultMethod);
        setSameDateForAll(false);
        setSameNotesForAll(false);
        setSamePaidByForAll(false);
        setAdvanceTarget('next_month');
      });
      const memberId =
        typeof payModal.teamMemberId === 'string'
          ? payModal.teamMemberId
          : payModal.teamMemberId?._id || payModal.teamMember?.id;

      if (memberId && currentWorkspaceId) {
        salaryApi
          .getOutstandingAdvances(currentWorkspaceId, memberId)
          .then((data) => setOutstandingAdvance(data))
          .catch(() => setOutstandingAdvance(null));

        // Fetch the active recovery plan ID for the "Manage plan" drawer trigger.
        // Only fetched when the record shows an advanceRecovery entry.
        if (payModal?.advanceRecovery?.amount) {
          salaryApi
            .getAdvanceRecoveryPlans(currentWorkspaceId, memberId)
            .then((plans) => {
              const active = plans.find((p) => p.status === 'active' || p.status === 'paused');
              setAdvancePlanDrawerPlanId(active?._id ?? null);
            })
            .catch(() => setAdvancePlanDrawerPlanId(null));
        } else {
          startTransition(() => setAdvancePlanDrawerPlanId(null));
        }
      } else {
        startTransition(() => {
          setOutstandingAdvance(null);
          setAdvancePlanDrawerPlanId(null);
        });
      }
    } else {
      startTransition(() => {
        setOutstandingAdvance(null);
        setAdvancePlanDrawerPlanId(null);
      });
    }
  }, [currentWorkspaceId, payForm, payModal]);

  useEffect(() => {
    const allowedCategories =
      selectedAdjustmentType === 'addition'
        ? ADDITION_CATEGORY_OPTIONS
        : DEDUCTION_CATEGORY_OPTIONS;
    const currentCategory = adjustmentForm.getFieldValue('category');

    if (!allowedCategories.includes(currentCategory)) {
      adjustmentForm.setFieldValue('category', allowedCategories[0]);
    }
  }, [adjustmentForm, selectedAdjustmentType]);

  // OLD DATA LOGIC REMOVED - now provided by useSalaryData() hook

  // Salary filter summary - using store values
  const salaryFilterSummary = (() => {
    const parts: string[] = [];
    parts.push(dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY'));
    if (statusFilter !== 'all') {
      parts.push(`Status: ${statusFilter === 'advance' ? 'overpaid' : statusFilter}`);
    }
    if (search) parts.push(`Search: "${search}"`);
    return parts.length > 0 ? parts.join(' | ') : undefined;
  })();

  // OLD PAYMENT LOGIC REMOVED - now provided by usePaymentActions() hook

  const filteredLedgerMonths = useMemo(() => {
    if (!ledgerData) return [];

    const q = historySearch.toLowerCase().trim();
    const cutoffKey: string | null =
      historyDateRange === 'all'
        ? null
        : historyDateRange === '3m'
          ? dayjs().subtract(3, 'month').format('YYYY-MM')
          : historyDateRange === '6m'
            ? dayjs().subtract(6, 'month').format('YYYY-MM')
            : dayjs().subtract(12, 'month').format('YYYY-MM');

    return ledgerData.months
      .filter((m) => !cutoffKey || m.monthKey >= cutoffKey)
      .map((m) => ({
        ...m,
        transactions: m.transactions.filter((t) => {
          const methodMatch = historyMethodFilter.size === 0 || historyMethodFilter.has(t.method);
          const searchMatch =
            !q ||
            String(t.amount).includes(q) ||
            t.referenceNo?.toLowerCase().includes(q) ||
            t.note?.toLowerCase().includes(q) ||
            t.paidBy?.toLowerCase().includes(q);
          const accountMatch =
            historyAccountFilter.size === 0 ||
            (!!t.paymentFrom && historyAccountFilter.has(t.paymentFrom)) ||
            (t.splitLines?.some(
              (sl) => !!sl.paymentFrom && historyAccountFilter.has(sl.paymentFrom),
            ) ??
              false);
          return methodMatch && searchMatch && accountMatch;
        }),
      }))
      .filter((m) => m.transactions.length > 0);
  }, [ledgerData, historySearch, historyMethodFilter, historyDateRange, historyAccountFilter]);

  const ledgerAccounts = useMemo(() => {
    if (!ledgerData) return [];

    return Array.from(
      new Set(
        ledgerData.months
          .flatMap((m) =>
            m.transactions.flatMap((t) => [
              t.paymentFrom,
              ...(t.splitLines?.map((sl) => sl.paymentFrom) ?? []),
            ]),
          )
          .filter((value): value is string => !!value),
      ),
    );
  }, [ledgerData]);

  const monthLedgerExportRows = useMemo(() => {
    if (!monthTransactionsModal?.monthData) return [];

    const { record, monthData } = monthTransactionsModal;
    return createLedgerExportRows({
      employee: {
        employeeName: record.teamMember?.name || 'Unknown',
        employeeCode: record.teamMember?.designation || '',
      },
      months: [monthData],
      currencyConfig,
    });
  }, [currencyConfig, monthTransactionsModal]);

  const getMonthLedgerExportData = useCallback(async () => {
    return monthLedgerExportRows;
  }, [monthLedgerExportRows]);

  const monthLedgerExportFilename = useMemo(() => {
    if (!monthTransactionsModal?.monthData) return 'manekhr_payment_ledger';

    const employeeName = slugifyFilenamePart(monthTransactionsModal.record.teamMember?.name);
    return `manekhr_payment_ledger_${employeeName}_${monthTransactionsModal.monthData.monthKey}`;
  }, [monthTransactionsModal]);

  const monthLedgerFilterSummary = useMemo(() => {
    if (!monthTransactionsModal?.monthData) return undefined;

    const employeeName = monthTransactionsModal.record.teamMember?.name || 'Unknown';
    return `Employee: ${employeeName} | Month: ${monthTransactionsModal.monthData.monthLabel}`;
  }, [monthTransactionsModal]);

  const fullLedgerExportRows = useMemo(() => {
    if (!ledgerData) return [];

    return createLedgerExportRows({
      employee: {
        employeeName: ledgerData.employeeName || 'Unknown',
        employeeCode: ledgerData.employeeCode || '',
      },
      months: filteredLedgerMonths,
      currencyConfig,
    });
  }, [currencyConfig, ledgerData, filteredLedgerMonths]);

  const fullLedgerPdfSections = useMemo(() => {
    if (!ledgerData) return [];

    return filteredLedgerMonths
      .map((monthData) => ({
        title: monthData.monthLabel,
        data: createLedgerExportRows({
          employee: {
            employeeName: ledgerData.employeeName || 'Unknown',
            employeeCode: ledgerData.employeeCode || '',
          },
          months: [monthData],
          currencyConfig,
        }),
      }))
      .filter((section) => section.data.length > 0);
  }, [currencyConfig, ledgerData, filteredLedgerMonths]);

  const getFullLedgerExportData = useCallback(async () => {
    return fullLedgerExportRows;
  }, [fullLedgerExportRows]);

  const fullLedgerExportFilename = useMemo(() => {
    const employeeName = slugifyFilenamePart(ledgerData?.employeeName);
    return `manekhr_payment_ledger_history_${employeeName}`;
  }, [ledgerData?.employeeName]);

  const fullLedgerFilterSummary = useMemo(() => {
    if (!ledgerData) return undefined;

    const parts = [
      `Employee: ${ledgerData.employeeName || 'Unknown'}`,
      `Range: ${HISTORY_DATE_RANGE_LABELS[historyDateRange]}`,
    ];

    if (historyMethodFilter.size > 0) {
      parts.push(
        `Methods: ${[...historyMethodFilter]
          .map((method) =>
            method === 'bank'
              ? 'Bank'
              : method === 'upi'
                ? 'UPI'
                : method.charAt(0).toUpperCase() + method.slice(1),
          )
          .join(', ')}`,
      );
    }

    if (historyAccountFilter.size > 0) {
      parts.push(`Accounts: ${[...historyAccountFilter].join(', ')}`);
    }

    if (historySearch.trim()) {
      parts.push(`Search: "${historySearch.trim()}"`);
    }

    parts.push(`Rows: ${fullLedgerExportRows.length}`);

    return parts.join(' | ');
  }, [
    ledgerData,
    historyDateRange,
    historyMethodFilter,
    historyAccountFilter,
    historySearch,
    fullLedgerExportRows,
  ]);

  // Totals - now provided by useSalaryData hook
  // Using hook values instead of recalculating

  const selectedMonthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format(
    'MMMM YYYY',
  );
  const selectedRecords = useMemo(
    () => filteredRecords.filter((record) => selectedRowKeys.includes(String(record._id))),
    [filteredRecords, selectedRowKeys],
  );

  const lockedSelectedCount = useMemo(
    () => selectedRecords.filter((r) => r.isLocked).length,
    [selectedRecords],
  );

  const payableSelectedCount = useMemo(
    () => selectedRecords.filter((r) => !r.isLocked && (r.baseSalary ?? 0) > 0).length,
    [selectedRecords],
  );

  const rawDueAmount = payModal ? getPayableAmount(payModal) - (payModal.paidAmount ?? 0) : 0;
  const dueAmount = Math.max(0, rawDueAmount);
  const advancePaidAmount = rawDueAmount < 0 ? Math.abs(rawDueAmount) : 0;
  const paymentDraftAmount = Number(Form.useWatch('amount', payForm) ?? 0);
  // Commission is NOT included in excess: it creates an adjustment that raises netSalary,
  // so it is not an overpayment. Only the salary amount drives the excess calculation.
  const projectedCurrentMonthExcess = Math.max(0, paymentDraftAmount - dueAmount);
  const adjustmentSummary = useMemo(() => {
    if (!adjustmentDrawerRecord) return null;

    const baseEarned = calculateAttendanceNetSalary({
      baseSalary: adjustmentDrawerRecord.baseSalary ?? 0,
      totalDays: adjustmentDrawerRecord.totalDays ?? 0,
      presentDays: adjustmentDrawerRecord.presentDays ?? 0,
    });
    const paidAmount = adjustmentDrawerRecord.paidAmount ?? 0;
    const netSalary = adjustmentDrawerRecord.netSalary ?? 0;
    const deductions = adjustmentDrawerRecord.deductions ?? 0;
    const remaining = netSalary - paidAmount;
    const isOverpaid = remaining < 0;
    const overpaidAmount = isOverpaid ? Math.abs(remaining) : 0;
    // Deduction-caused recovery: a deduction was posted against an already fully-paid
    // record, lowering net salary below what was paid. The excess is wholly explained by
    // active deductions (overpaid ≤ deductions). Anything beyond that is advance overpayment.
    const overpaidCause: 'deduction' | 'advance' =
      isOverpaid && deductions > 0 && overpaidAmount <= deductions ? 'deduction' : 'advance';

    return {
      baseSalary: adjustmentDrawerRecord.baseSalary ?? 0,
      baseEarned,
      additions: adjustmentDrawerRecord.additions ?? 0,
      deductions,
      netSalary,
      paidAmount,
      remaining: Math.max(0, remaining),
      overpaidAmount,
      overpaidCause,
      isOverpaid,
      creditedDays: adjustmentDrawerRecord.presentDays ?? 0,
      payableDays: adjustmentDrawerRecord.totalDays ?? 0,
    };
  }, [adjustmentDrawerRecord]);

  const handleFillDeductionForRemaining = useCallback(() => {
    if (!adjustmentSummary) return;
    adjustmentForm.setFieldsValue({
      type: 'deduction',
      category: DEDUCTION_CATEGORY_OPTIONS[0],
      amount: adjustmentSummary.remaining,
    });
  }, [adjustmentSummary, adjustmentForm]);

  const getSalaryBasisMeta = (member?: TeamMember | null) => {
    if (!member) return null;
    const defaultWorkingDays = Math.max(
      1,
      Math.min(31, Number(payrollDisplay?.defaultWorkingDays ?? 26) || 26),
    );
    const monthLength = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
    const basisDays =
      member.salaryDayBasis === 'calendar_month_days'
        ? monthLength
        : (member.fixedMonthDays ?? member.workingDays ?? defaultWorkingDays);
    const dayBasisLabel =
      member.salaryDayBasis === 'calendar_month_days'
        ? `calendar ${basisDays}-day basis`
        : `fixed ${basisDays}-day basis`;
    const attendanceLabel =
      member.attendancePayMode === 'enabled'
        ? 'attendance based'
        : member.attendancePayMode === 'disabled'
          ? 'attendance ignored'
          : 'workspace attendance default';

    if ((member.salaryType || 'monthly') !== 'hourly') {
      if (member.ctcAmount && member.componentTemplateId) {
        return {
          label: 'Monthly + Structure',
          detail: `Monthly compensation derived from CTC and a salary structure using ${dayBasisLabel} (${attendanceLabel})`,
        };
      }

      return {
        label: 'Monthly',
        detail: `Fixed monthly base pay using ${dayBasisLabel} (${attendanceLabel})`,
      };
    }

    const hourlyRate = formatCurrencyFull(member.salaryAmount ?? 0);
    const dailyHours = member.dailyHours ?? 0;

    if (member.finalMonthlyOverride !== undefined && member.finalMonthlyOverride !== null) {
      return {
        label: 'Hourly + Override',
        detail: `Time-based pay: ${hourlyRate}/hr x ${dailyHours} hrs x ${dayBasisLabel}, overridden to ${formatCurrencyFull(member.finalMonthlyOverride)} (${attendanceLabel})`,
      };
    }

    return {
      label: 'Time-based Pay',
      detail: `Time-based pay: ${hourlyRate}/hr x ${dailyHours} hrs x ${dayBasisLabel} (${attendanceLabel})`,
    };
  };

  const getSettlementMeta = useCallback((salary: number, paid: number) => {
    const remaining = salary - paid;

    if (remaining < 0) {
      return {
        statusColor: 'var(--cr-warning-700)',
        statusBg: 'var(--cr-warning-50)',
        statusLabel: 'Overpaid',
        balanceLabel: 'OVERPAID',
        balanceValue: Math.abs(remaining),
        balanceColor: 'var(--cr-warning-700)',
      };
    }

    if (paid >= salary && salary > 0) {
      return {
        statusColor: 'var(--cr-success)',
        statusBg: 'var(--cr-success-50)',
        statusLabel: 'Settled',
        balanceLabel: 'BALANCE DUE',
        balanceValue: 0,
        balanceColor: 'var(--cr-success)',
      };
    }

    if (paid > 0) {
      return {
        statusColor: 'var(--cr-warning)',
        statusBg: 'var(--cr-warning-50)',
        statusLabel: 'Partially Paid',
        balanceLabel: 'BALANCE DUE',
        balanceValue: remaining,
        balanceColor: 'var(--cr-warning)',
      };
    }

    return {
      statusColor: 'var(--cr-error)',
      statusBg: 'var(--cr-danger-50)',
      statusLabel: 'Pending',
      balanceLabel: 'BALANCE DUE',
      balanceValue: Math.max(0, remaining),
      balanceColor: 'var(--cr-error)',
    };
  }, []);

  const toggleSplit = (id: string) => {
    setExpandedSplits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateSplit = (idx: number, field: string, value: string | number | File[]) => {
    setSplits((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const updateAllSplits = (field: string, value: string | number | File[]) => {
    setSplits((prev) => prev.map((s) => ({ ...s, [field]: value })));
  };

  const handleCreateBankAccount = async () => {
    const trimmed = newBankAccountLabel.trim();
    if (!trimmed || !currentWorkspaceId || !currentWorkspace) return;

    const exists = currentWorkspace.bankAccounts?.some(
      (acc) => acc.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      msgApi.error('Bank account with this name already exists');
      return;
    }

    setCreatingBankAccount(true);
    try {
      const newAccount: BankAccount = {
        id: `bank_${Date.now()}`,
        label: trimmed,
      };
      const existingAccounts = (currentWorkspace.bankAccounts || []).map(({ id, label }) => ({
        id,
        label,
      }));
      const updatedAccounts = [...existingAccounts, newAccount];
      const res = await updateWorkspace(currentWorkspaceId, { bankAccounts: updatedAccounts });
      if (res.ok) {
        msgApi.success('Bank account created');

        // Update the workspace store with the new bank accounts
        const { setWorkspaces, workspaces } = useWorkspaceStore.getState();
        const updatedWorkspaces = workspaces.map((w) =>
          w._id === currentWorkspaceId ? { ...w, bankAccounts: updatedAccounts } : w,
        );
        setWorkspaces(updatedWorkspaces);

        setCreateBankAccountOpen(false);
        setNewBankAccountLabel('');

        // Set the newly created bank account in the form
        if (splitMode === 'single') {
          payForm.setFieldValue('paymentFrom', newAccount.id);
        }
      } else {
        msgApi.error(res.error || 'Failed to create bank account');
      }
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setCreatingBankAccount(false);
    }
  };

  const handlePayDrawerClose = () => {
    setPayModal(null);
    setProofImages([]);
    setSplits([
      {
        id: '1',
        amount: 0,
        method: 'bank_transfer',
        transactionId: '',
        voucherNo: '',
        referenceNo: '',
        paymentFrom: '',
        paidBy: '',
        payoutDate: dayjs().toISOString(),
        proofFiles: [],
        internalNotes: '',
      },
      {
        id: '2',
        amount: 0,
        method: 'bank_transfer',
        transactionId: '',
        voucherNo: '',
        referenceNo: '',
        paymentFrom: '',
        paidBy: '',
        payoutDate: dayjs().toISOString(),
        proofFiles: [],
        internalNotes: '',
      },
    ]);
    setSinglePaymentMethod('bank_transfer');
    setPayPreferredMethod(undefined);
    setSplitMode('single');
    setSameDateForAll(false);
    setSameNotesForAll(false);
    setSamePaidByForAll(false);
    setAddCommission(false);
    setCommissionAmount(0);
    setCommissionNote('');
    setCommissionTitle('');
    setAdvanceInstallmentValue(null);
    setPendingComplianceBreaches(null);
    // D-10: clear COA selection when drawer closes so stale account ID is not reused.
    setSelectedCoaAccountId(undefined);
    payForm.resetFields();
  };

  const totalSplitAmount = splits.reduce((s, sp) => s + (sp.amount || 0), 0);
  type SalaryRow = SalaryRecord & { teamMember?: TeamMember };

  const mutationLockMessage = 'Unlock this record to make changes';

  const openPayDrawer = useCallback(
    (record: SalaryRow) => {
      setPayModal(record);
      setPayPreferredMethod(record.teamMember?.preferredMethod as 'BANK' | 'UPI' | undefined);
      payForm.resetFields();
      setSplitMode('single');
      setSplits([
        {
          id: '1',
          amount: 0,
          method: record.teamMember?.preferredMethod === 'UPI' ? 'upi' : 'bank_transfer',
          transactionId: '',
          voucherNo: '',
          referenceNo: '',
          paymentFrom: '',
          paidBy: '',
          payoutDate: dayjs().toISOString(),
          proofFiles: [],
          internalNotes: '',
        },
        {
          id: '2',
          amount: 0,
          method: record.teamMember?.preferredMethod === 'UPI' ? 'upi' : 'bank_transfer',
          transactionId: '',
          voucherNo: '',
          referenceNo: '',
          paymentFrom: '',
          paidBy: '',
          payoutDate: dayjs().toISOString(),
          proofFiles: [],
          internalNotes: '',
        },
      ]);
      setProofImages([]);
      setSinglePaymentMethod(
        record.teamMember?.preferredMethod === 'UPI' ? 'upi' : 'bank_transfer',
      );
      setSameDateForAll(false);
      setSameNotesForAll(false);
      setSamePaidByForAll(false);
      setAdvanceTarget('next_month');
      setAdvanceInstallmentValue(null);
    },
    [payForm, setPayModal],
  );

  const handleLock = useCallback(
    async (record: SalaryRow) => {
      if (!currentWorkspaceId || !record._id) return;

      try {
        await lockSalaryRecord(currentWorkspaceId, record._id);
        patchRecord(record._id, { isLocked: true });
        msgApi.success('Salary record locked');
        await load();
      } catch (e) {
        msgApi.error(parseApiError(e));
      }
    },
    [currentWorkspaceId, load, msgApi, patchRecord],
  );

  const handleUnlock = useCallback(
    async (record: SalaryRow) => {
      if (!currentWorkspaceId || !record._id) return;

      try {
        await unlockSalaryRecord(currentWorkspaceId, record._id);
        patchRecord(record._id, { isLocked: false });
        msgApi.success('Salary record unlocked');
        await load();
      } catch (e) {
        msgApi.error(parseApiError(e));
      }
    },
    [currentWorkspaceId, load, msgApi, patchRecord],
  );

  const getStatusTag = (r: SalaryRecord & { teamMember?: TeamMember }) => {
    const derivedStatus = getRecordStatus(r);
    const settlementStatus = getSettlementStatus(r);
    const lockIndicator = r.isLocked ? (
      <Tooltip title="This record is locked">
        <LockOutlined style={{ color: 'var(--cr-warning-500)', marginLeft: 4 }} />
      </Tooltip>
    ) : null;
    const overpaidAmount = Math.max(0, (r.paidAmount ?? 0) - (r.netSalary ?? 0));
    const advanceOutMonthLabel = r.advanceOut
      ? dayjs(
          `${r.advanceOut.targetYear}-${String(r.advanceOut.targetMonth).padStart(2, '0')}-01`,
        ).format('MMMM YYYY')
      : null;
    const advanceRecoveryTooltip = r.advanceRecovery?.amount
      ? `This month includes ${formatCurrencyFull(r.advanceRecovery.amount)} advance recovery from an earlier overpayment.`
      : null;
    const renderStatusChip = (
      label: string,
      status: string,
      style?: React.CSSProperties,
      tooltipTitle?: string,
    ) => {
      const chip = (
        <DsTag
          status={status}
          style={{
            cursor: 'default',
            minWidth: 132,
            textAlign: 'center',
            display: 'inline-block',
            ...style,
          }}
        >
          {label}
        </DsTag>
      );

      if (!tooltipTitle) {
        return chip;
      }

      return (
        <Tooltip title={tooltipTitle}>
          <span className="inline-flex" style={{ cursor: 'default' }}>
            {chip}
          </span>
        </Tooltip>
      );
    };

    if (settlementStatus === 'salary_not_set') {
      return (
        <span className="inline-flex items-center gap-1.5">
          {renderStatusChip('Set Base Pay', 'pending', {
            background: 'var(--cr-warning-50)',
            color: 'var(--cr-warning-700)',
          })}
          {lockIndicator}
        </span>
      );
    }

    if (settlementStatus === 'not_generated') {
      return (
        <span className="inline-flex items-center gap-1.5">
          {renderStatusChip(
            'Not Generated',
            'pending',
            { background: 'var(--cr-warning-50)', color: 'var(--cr-warning-700)' },
            'This is a preview row. The payroll record will be created when payroll is generated or when you record the first payment.',
          )}
          {lockIndicator}
        </span>
      );
    }

    if (derivedStatus === 'missing_method') {
      return (
        <span className="inline-flex items-center gap-1.5">
          {renderStatusChip('Add Payment Method', 'overdue', {
            background: 'var(--cr-danger-50)',
            color: 'var(--cr-danger-700)',
          })}
          {lockIndicator}
        </span>
      );
    }

    if (settlementStatus === 'overpaid') {
      const tooltipParts = [`Paid ${formatCurrencyFull(overpaidAmount)} more than net pay.`];

      if (r.advanceOut && advanceOutMonthLabel) {
        tooltipParts.push(
          `Advance recovery of ${formatCurrencyFull(r.advanceOut.amount)} is scheduled for ${advanceOutMonthLabel}.`,
        );
      }

      if (advanceRecoveryTooltip) {
        tooltipParts.push(advanceRecoveryTooltip);
      }

      return (
        <span className="inline-flex items-center gap-1.5">
          {renderStatusChip(
            'Overpaid',
            'advance',
            { background: 'var(--cr-indigo-50)', color: 'var(--cr-indigo-400)' },
            tooltipParts.join(' '),
          )}
          {lockIndicator}
        </span>
      );
    }

    let statusLabel = 'Payment Pending';
    let statusStyle: React.CSSProperties | undefined;
    let statusVariant = 'pending';
    let tooltipTitle = advanceRecoveryTooltip ?? undefined;

    if (settlementStatus === 'partial') {
      statusLabel = 'Partially Paid';
      statusVariant = 'partial';
      tooltipTitle = advanceRecoveryTooltip
        ? `Partially paid. ${advanceRecoveryTooltip}`
        : undefined;
    } else if (settlementStatus === 'paid') {
      statusLabel = 'Fully Paid';
      statusVariant = 'paid';
      tooltipTitle = advanceRecoveryTooltip ? `Fully paid. ${advanceRecoveryTooltip}` : undefined;
    } else if (advanceRecoveryTooltip) {
      tooltipTitle = `Payment pending. ${advanceRecoveryTooltip}`;
    }

    return (
      <span className="inline-flex items-center gap-1.5">
        {renderStatusChip(statusLabel, statusVariant, statusStyle, tooltipTitle)}
        {lockIndicator}
      </span>
    );
  };

  const columns: ColumnsType<SalaryRow> = [
    {
      title: 'Employee',
      key: 'employee',
      fixed: 'left',
      width: 240,
      render: (_, r) => {
        const member = r.teamMember;
        const name = member?.name || 'Unknown';
        const avatar = member?.avatar;
        // Phase 23 plan 23-11: piece-rate row indicators
        const memberSalaryType = member?.salaryType || r.salaryType || 'monthly';
        const isPieceRate = memberSalaryType === 'piece_rate';
        return (
          <div className="flex items-center gap-2.5">
            <DsAvatar name={name} size={34} src={avatar} />
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-semibold text-heading">{name}</p>
              <p className="m-0 text-[11px] text-subtle">{member?.designation || '-'}</p>
              {isPieceRate && (
                <Space size={4} style={{ marginTop: 4 }} wrap>
                  <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                    {t('salary.piece_rate.row.chip')}
                  </Tag>
                  {r.pieceRateStale && (
                    <Tag
                      color="warning"
                      icon={<ReloadOutlined />}
                      style={{
                        marginInlineEnd: 0,
                        background: 'var(--cr-warning-50)',
                        color: 'var(--cr-warning-700)',
                        borderColor: 'var(--cr-warning-500)',
                      }}
                    >
                      {t('salary.piece_rate.row.stale')}
                    </Tag>
                  )}
                </Space>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Days',
      key: 'days',
      width: 140,
      render: (_value: unknown, r: SalaryRow) => {
        if (!r._id || r.isPreview) {
          return <span className="text-[13px] text-muted">-</span>;
        }

        const basisLabel =
          r.salaryDayBasis === 'calendar_month_days'
            ? 'Calendar basis'
            : `Fixed ${r.fixedMonthDays ?? r.totalDays} days`;
        const attendanceLabel =
          r.attendancePayModeApplied === 'disabled' ? 'Attendance ignored' : 'Attendance based';

        return (
          <Tooltip title={`${basisLabel}. ${attendanceLabel}.`}>
            <span className="text-[13px]">
              {formatPayrollDayValue(r.presentDays)}/{formatPayrollDayValue(r.totalDays)} days
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Net Pay',
      dataIndex: 'netSalary',
      key: 'net',
      width: 150,
      render: (_, r) => {
        if (r.isPreview) {
          if (r.effectiveSalary && r.effectiveSalary > 0) {
            return (
              <Tooltip title="Expected net pay based on base salary - payroll not yet generated for this month.">
                <span className="text-[13px] text-muted italic">
                  {formatCurrencyFull(r.effectiveSalary)}
                </span>
              </Tooltip>
            );
          }
          return <span className="text-[13px] text-muted">-</span>;
        }

        const hasAdjustmentRollup =
          (r.activeAdjustmentCount ?? r.adjustmentCount ?? 0) > 0 ||
          (r.additions ?? 0) > 0 ||
          (r.deductions ?? 0) > 0;
        const baseEarned = calculateAttendanceNetSalary({
          baseSalary: r.baseSalary ?? 0,
          totalDays: r.totalDays ?? 0,
          presentDays: r.presentDays ?? 0,
        });

        // Component breakdown - only if member has CTC + template
        const member = r.teamMember;
        const hasCTCBreakdown =
          features.salaryComponents.visible && member?.ctcAmount && member?.componentTemplateId;

        let breakdownContent: React.ReactNode = null;
        if (hasCTCBreakdown) {
          const template = templates.find(
            (candidate: SalaryComponentTemplate) => candidate._id === member.componentTemplateId,
          );
          if (template) {
            try {
              const ctcVal = member.ctcAmount!;
              const { breakdown } = calculateComponents(
                ctcVal,
                template.components,
                member.componentOverrides || [],
              );
              breakdownContent = (
                <div className="min-w-[200px]">
                  <div className="mb-1.5 text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    {`CTC Breakdown - ${currencyFmt.inline(ctcVal)}`}
                  </div>
                  <div className="space-y-1">
                    {breakdown.map((comp: CalculatedComponent) => (
                      <div key={comp.componentId} className="flex justify-between text-sm">
                        <span
                          className={
                            comp.isBasicComponent ? 'font-medium text-blue-700' : 'text-gray-600'
                          }
                        >
                          {comp.name}
                          {!comp.includedInCtc ? ' *' : ''}
                        </span>
                        <span className="font-medium">
                          {currencyFmt.inline(comp.calculatedAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {breakdown.some((component: CalculatedComponent) => !component.includedInCtc) && (
                    <div className="mt-1.5 border-t border-gray-100 pt-1 text-[10px] text-faint">
                      * Above CTC (employer contribution)
                    </div>
                  )}
                </div>
              );
            } catch {
              breakdownContent = null;
            }
          }
        }

        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[15px] font-bold text-heading">
                {formatCurrencyFull(r.netSalary || 0)}
              </span>
              {breakdownContent && (
                <Popover content={breakdownContent} trigger="hover" placement="right">
                  <AppstoreOutlined className="cursor-help text-[11px] text-blue-700" />
                </Popover>
              )}
            </div>
            {hasAdjustmentRollup && (
              <Tooltip
                title={`Base earned ${formatCurrencyFull(baseEarned)} + Additions ${formatCurrencyFull(r.additions || 0)} - Deductions ${formatCurrencyFull(r.deductions || 0)}`}
              >
                <span className="text-[11px] text-subtle">
                  Adj. +{formatCurrencyFull(r.additions || 0)} / -
                  {formatCurrencyFull(r.deductions || 0)}
                </span>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: 'Paid',
      key: 'paid',
      width: 110,
      render: (_, r) => {
        const paid = r.paidAmount ?? 0;
        if (paid > 0) {
          return (
            <span className="font-semibold text-[var(--cr-success)]">
              {formatCurrencyFull(paid)}
            </span>
          );
        }
        return <span className="text-muted">-</span>;
      },
    },
    {
      title: 'Remaining',
      key: 'remaining',
      width: 140,
      render: (_, r) => {
        if (r.isPreview) {
          return <span className="text-[12px] text-muted">-</span>;
        }

        const netSalary = r.netSalary ?? 0;
        const paidAmount = r.paidAmount ?? 0;
        const deductionsAmt = r.deductions ?? 0;
        const remaining = netSalary - paidAmount;
        const isOverpaid = remaining < 0;
        const overpaidAmount = Math.abs(remaining);
        const isDeductionRecovery =
          isOverpaid && deductionsAmt > 0 && overpaidAmount <= deductionsAmt;

        if (isOverpaid) {
          const subLabel = isDeductionRecovery ? 'Recovery' : 'Overpaid';
          const tooltip = isDeductionRecovery
            ? `A deduction was applied after full payment. ${formatCurrencyFull(overpaidAmount)} needs to be recovered from the employee.`
            : `Fully paid, plus ${formatCurrencyFull(overpaidAmount)} recorded as overpayment.`;
          return (
            <Tooltip title={tooltip}>
              <div>
                <span className="text-[14px] font-semibold" style={{ color: 'var(--cr-warning)' }}>
                  −{formatCurrencyFull(overpaidAmount)}
                </span>
                <div className="mt-0.5 text-[11px] text-muted">{subLabel}</div>
              </div>
            </Tooltip>
          );
        }

        const amountColor = remaining === 0 ? 'var(--cr-success)' : 'var(--cr-warning)';
        return (
          <span className="text-[14px] font-semibold" style={{ color: amountColor }}>
            {formatCurrencyFull(remaining)}
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 155,
      render: (_, r) => getStatusTag(r),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      fixed: 'right',
      width: 240,
      render: (_, r) => {
        const memberId = getRecordMemberId(r);
        const isForm16Loading = Boolean(memberId) && form16LoadingMemberId === memberId;
        const isEmailSending = Boolean(r._id) && emailPayslipLoadingId === String(r._id);
        const derivedStatus = getRecordStatus(r);
        const isMutationLocked = Boolean(r.isLocked);
        // D-04: preview rows trigger salary calculation ("Calculate"), not payment.
        // Non-preview rows trigger real disbursement ("Pay"). Plan 26-08.
        const primaryActionLabel = r.isPreview
          ? 'Calculate'
          : derivedStatus === 'paid' || derivedStatus === 'advance'
            ? 'Add Advance'
            : derivedStatus === 'salary_not_set'
              ? 'Set Base Pay'
              : 'Pay';
        const handleOpenSetSalary = () => {
          setSetSalaryModal(r);
          setPassbookImage(r.teamMember?.bankDetails?.passbookImageUrl || null);
          setQrCodeImage(r.teamMember?.upiDetails?.qrCodeUrl || null);
          setSameAsEmployeeName(false);
          const memberSalaryType = r.teamMember?.salaryType || 'monthly';
          // Phase 23: piece_rate uses a separate editor (plans 23-10/11); fall back to 'monthly' for this legacy editor.
          setSalaryMode(memberSalaryType === 'piece_rate' ? 'monthly' : memberSalaryType);
          setPaymentMethod((r.teamMember?.preferredMethod as 'UPI' | 'BANK') || 'UPI');
          const member = r.teamMember;
          const configuredSalaryDayBasis =
            member?.salaryDayBasis === 'calendar_month_days'
              ? 'calendar_month_days'
              : 'fixed_month_days';
          const configuredFixedMonthDays =
            configuredSalaryDayBasis === 'fixed_month_days'
              ? (member?.fixedMonthDays ??
                member?.workingDays ??
                Math.max(1, Math.min(31, Number(payrollDisplay?.defaultWorkingDays ?? 26) || 26)))
              : null;
          setSalaryForm.setFieldsValue({
            baseSalary:
              r.baseSalary > 0
                ? r.baseSalary
                : resolveEffectiveMonthlySalary(r.teamMember, {
                    month: r.month,
                    year: r.year,
                    defaultWorkingDays: payrollDisplay?.defaultWorkingDays ?? 26,
                  }),
            preferredPayoutMethod: r.teamMember?.preferredMethod,
            upiId: r.teamMember?.upiDetails?.upiId,
            bankName: r.teamMember?.bankDetails?.bankName,
            accountHolderName: r.teamMember?.bankDetails?.accountHolderName,
            accountNumber: r.teamMember?.bankDetails?.accountNumber,
            confirmAccountNumber: r.teamMember?.bankDetails?.accountNumber,
            ifscCode: r.teamMember?.bankDetails?.ifscCode,
            deductions: r.deductions || 0,
            additions: r.additions || 0,
            hourlyRate: r.teamMember?.salaryAmount,
            dailyHours: r.teamMember?.dailyHours || 8,
            salaryDayBasis: configuredSalaryDayBasis,
            fixedMonthDays: configuredFixedMonthDays,
            attendancePayMode: member?.attendancePayMode ?? 'default',
            finalMonthlyOverride: r.teamMember?.finalMonthlyOverride,
            ctcAmount: memberSalaryType === 'hourly' ? null : (member?.ctcAmount ?? null),
            componentTemplateId:
              memberSalaryType === 'hourly' ? null : (member?.componentTemplateId ?? null),
            componentOverrides:
              memberSalaryType === 'hourly' ? [] : (member?.componentOverrides ?? []),
          });
        };
        const handlePrimaryAction = async () => {
          if (isMutationLocked) {
            msgApi.error(mutationLockMessage);
            return;
          }

          if (derivedStatus === 'salary_not_set') {
            handleOpenSetSalary();
            return;
          }

          let payTarget = r;
          if (r.isPreview) {
            if (!currentWorkspaceId) {
              msgApi.error('No workspace selected');
              return;
            }

            try {
              const memberId = getRecordMemberId(r);
              if (!memberId) {
                throw new Error('Cannot determine team member ID for this record.');
              }

              await ensureSalaryRecord(currentWorkspaceId, memberId, r.month, r.year);
              const { records: freshRecords, teamMembers: freshMembers } = await load();
              const refreshedRecord = freshRecords.find(
                (candidate) => getRecordMemberId(candidate) === memberId,
              );
              const hydratedRecord = hydrateRecordWithMember(refreshedRecord ?? r, freshMembers);

              if (!hydratedRecord._id) {
                throw new Error('Payroll record could not be generated for this employee.');
              }

              payTarget = hydratedRecord;
            } catch (e) {
              msgApi.error(parseApiError(e));
              return;
            }
          }

          openPayDrawer(payTarget);
        };
        const handleOpenTaxDeclaration = () => {
          if (!currentWorkspaceId) {
            msgApi.error('No workspace selected');
            return;
          }

          if (!r.teamMember) {
            msgApi.error('Team member details are not available for this row');
            return;
          }

          openTdsModal(r.teamMember as TeamMember, r);
        };
        const handleOpenFnf = () => {
          if (!currentWorkspaceId) {
            msgApi.error('No workspace selected');
            return;
          }

          if (!r.teamMember) {
            msgApi.error('Team member details are not available for this row');
            return;
          }

          if (!r.teamMember.dateOfResignation) {
            msgApi.warning('FnF is only available for offboarding employees.');
            return;
          }

          openFnfModal(r.teamMember as TeamMember);
        };
        const showSalaryRevisionAction =
          features.salaryRevisions.visible && features.salaryIncrements.visible;
        const enableSalaryRevisionAction =
          features.salaryRevisions.enabled && features.salaryIncrements.enabled;
        const getLockedMenuLabel = (label: string) =>
          isMutationLocked ? (
            <Tooltip title={mutationLockMessage}>
              <span>{label}</span>
            </Tooltip>
          ) : (
            label
          );
        const menuItems: MenuProps['items'] = [
          {
            type: 'group',
            label: 'Salary',
            children: [
              {
                key: 'base-pay',
                icon: canEditSalary ? <SettingOutlined /> : <LockOutlined />,
                label: getLockedMenuLabel(
                  derivedStatus === 'salary_not_set' ? 'Set Base Pay' : 'Edit Base Pay',
                ),
                disabled: !canEditSalary || isMutationLocked,
              },
              ...(derivedStatus !== 'salary_not_set' && showSalaryRevisionAction
                ? [
                    {
                      key: 'revision',
                      icon: enableSalaryRevisionAction ? <RiseOutlined /> : <LockOutlined />,
                      label: getLockedMenuLabel('Salary Revision'),
                      disabled: !enableSalaryRevisionAction || isMutationLocked,
                    },
                  ]
                : []),
              {
                key: 'adjustments',
                icon: canViewAdjustments ? <AuditOutlined /> : <LockOutlined />,
                label: getLockedMenuLabel('Adjustments'),
                disabled: !canViewAdjustments || isMutationLocked,
              },
            ],
          },
          { type: 'divider' },
          {
            type: 'group',
            label: 'Payslip & Tax',
            children: [
              {
                key: 'payslip',
                icon: features.payslipGeneration.enabled ? <FilePdfOutlined /> : <LockOutlined />,
                label: 'Download Payslip',
                disabled:
                  !features.payslipGeneration.enabled ||
                  payslipGenerating ||
                  !r._id ||
                  String(r._id).startsWith('new-') ||
                  r.isPreview,
              },
              ...(canEmailPayslips
                ? [
                    {
                      key: 'email-payslip',
                      icon: <MailOutlined />,
                      label: isEmailSending ? 'Sending…' : 'Email Payslip',
                      disabled:
                        isEmailSending ||
                        !currentWorkspaceId ||
                        !r._id ||
                        String(r._id).startsWith('new-') ||
                        r.isPreview,
                    },
                  ]
                : []),
              ...(canManageTaxDeclarations
                ? [
                    {
                      key: 'tds',
                      icon: <AuditOutlined />,
                      label: 'TDS Declaration',
                      disabled: !currentWorkspaceId || !r.teamMember,
                    },
                  ]
                : []),
              ...(canGenerateForm16
                ? [
                    {
                      key: 'form16',
                      icon: <FilePdfOutlined />,
                      label: isForm16Loading ? 'Downloading…' : 'Form 16',
                      disabled: isForm16Loading || !currentWorkspaceId || !memberId,
                    },
                  ]
                : []),
            ],
          },
          { type: 'divider' },
          {
            type: 'group',
            label: 'Records',
            children: [
              {
                key: 'ledger',
                icon: <HistoryOutlined />,
                label: 'Payment Ledger',
              },
              ...(canManageFnfSettlements && r.teamMember?.dateOfResignation
                ? [
                    {
                      key: 'fnf',
                      icon: <WalletOutlined />,
                      label: 'FnF Settlement',
                      disabled: !currentWorkspaceId || !r.teamMember,
                    },
                  ]
                : []),
              ...(r._id && !r.isPreview
                ? [
                    {
                      key: r.isLocked ? 'unlock' : 'lock',
                      icon: r.isLocked ? <UnlockOutlined /> : <LockOutlined />,
                      label: r.isLocked ? 'Unlock Record' : 'Lock Record',
                    },
                  ]
                : []),
            ],
          },
        ];

        const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'adjustments') {
            openAdjustments(r);
            return;
          }
          if (key === 'ledger') {
            openLedger(r);
            return;
          }
          if (key === 'payslip') {
            void handleDownloadPayslip(r);
            return;
          }
          if (key === 'base-pay') {
            handleOpenSetSalary();
            return;
          }
          if (key === 'revision') {
            if (!enableSalaryRevisionAction) {
              return;
            }
            setSelectedMemberForIncrement(r.teamMember as TeamMember);
            setIncrementModalOpen(true);
            return;
          }
          if (key === 'lock') {
            void handleLock(r);
            return;
          }
          if (key === 'unlock') {
            void handleUnlock(r);
            return;
          }
          if (key === 'email-payslip') {
            void handleEmailPayslip(r);
            return;
          }
          if (key === 'tds') {
            handleOpenTaxDeclaration();
            return;
          }
          if (key === 'form16') {
            void handleDownloadForm16(r);
            return;
          }
          if (key === 'fnf') {
            handleOpenFnf();
            return;
          }
        };

        // Phase 23 plan 23-11: piece-rate preview (pre-lock only)
        const memberSalaryTypeForPreview = r.teamMember?.salaryType || r.salaryType || 'monthly';
        const showPiecePreview = memberSalaryTypeForPreview === 'piece_rate' && !r.isLocked;
        const memberIdForPreview = getRecordMemberId(r);
        return (
          <Space size={8}>
            {showPiecePreview && memberIdForPreview && (
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() =>
                  setPreviewState({
                    open: true,
                    teamMemberId: memberIdForPreview,
                    memberName: r.teamMember?.name || 'Worker',
                    month: r.month,
                    year: r.year,
                  })
                }
              >
                Preview
              </Button>
            )}
            <Tooltip
              title={
                isMutationLocked
                  ? mutationLockMessage
                  : r.isPreview
                    ? 'Payroll not yet generated for this month. Clicking Pay will auto-generate the record and open the payment drawer so you can record the payment.'
                    : undefined
              }
            >
              <span>
                <Button
                  size="small"
                  type={r.isPreview ? 'default' : 'primary'}
                  icon={r.isPreview ? <ThunderboltOutlined /> : <RupeeOutlined />}
                  onClick={() => void handlePrimaryAction()}
                  disabled={isMutationLocked}
                  style={{ width: 124, justifyContent: 'flex-start' }}
                >
                  {primaryActionLabel}
                </Button>
              </span>
            </Tooltip>
            <Dropdown
              trigger={['click']}
              menu={{
                items: menuItems,
                onClick: handleMenuClick,
                style: { maxHeight: 320, overflowY: 'auto' },
              }}
              placement="bottomRight"
            >
              <Button
                size="small"
                className="relative"
                icon={<MoreOutlined />}
                aria-label={`More actions for ${r.teamMember?.name ?? 'this row'}`}
              >
                {derivedStatus === 'salary_not_set' && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                )}
                {derivedStatus === 'missing_method' && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
                )}
              </Button>
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  // statusCounts provided by useSalaryData hook

  const hasActiveFilters = statusFilter !== 'all' || search !== '' || sortKey !== 'name_asc';

  useEffect(() => {
    if (env.isProd) return;

    console.log('[salary][fe][page] render snapshot', {
      currentWorkspaceId,
      month,
      year,
      loading,
      viewMode,
      filteredRecordsLength: filteredRecords.length,
      page,
      pageSize,
      totalRecords,
      totalPages,
      statusCounts,
      firstRecord: filteredRecords[0],
    });
  }, [
    currentWorkspaceId,
    month,
    year,
    loading,
    viewMode,
    filteredRecords,
    page,
    pageSize,
    totalRecords,
    totalPages,
    statusCounts,
  ]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-subtle">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {msgCtx}
      {modalCtx}
      <DsPageHeader
        title={t('salary.runPayroll.pageTitle')}
        sub={t('salary.runPayroll.pageSubtitle')}
      />
      <h1 className="sr-only">Run Payroll</h1>
      <SalarySummaryCards
        totalPayable={totalPayable}
        totalPaid={totalPaid}
        totalPending={totalPending}
        totalOverpaid={totalOverpaid}
        isOverpaidTotal={isOverpaidTotal}
        mergedRowsCount={statusCounts.all}
        paidCount={paidCount}
        pendingCount={pendingCount}
        overpaidCount={statusCounts.advance}
        selectedMonthLabel={selectedMonthLabel}
        loading={loading}
      />

      <UpcomingJoinersHint
        count={upcomingJoinersCount}
        nextJoinerMonth={nextJoinerMonth}
        nextJoinerYear={nextJoinerYear}
        onViewMonth={(nextMonth, nextYear) => {
          setMonth(nextMonth);
          setYear(nextYear);
          updateRouteParams({ month: String(nextMonth), year: String(nextYear) });
        }}
      />

      {focusedTeamMemberId && (
        <div
          className="mb-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 md:flex-row md:items-center md:justify-between"
          style={{
            borderColor: 'var(--cr-primary-border, var(--cr-primary-border))',
            background: 'var(--cr-primary-light, var(--cr-primary-light))',
          }}
        >
          <div>
            <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-blue-700 uppercase">
              Focused Payroll View
            </p>
            <p className="m-0 mt-1 text-[13px] text-heading">
              This view is focused on one employee so you can jump back from the payments register
              directly into the matching payroll row.
            </p>
          </div>
          <Button size="small" onClick={() => updateRouteParams({ teamMemberId: null })}>
            Show all employees
          </Button>
        </div>
      )}

      {/* Payslip Email summary strip */}
      {monthlyTaskStatus && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-2.5"
          style={{
            borderColor: 'var(--cr-border,var(--cr-border))',
            background: 'var(--cr-surface-2,var(--cr-bg))',
          }}
        >
          <button
            type="button"
            onClick={() => setPayslipEmailsDrawerOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-[12px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <MailOutlined className="text-[12px]" />
            Payslip Emails: {monthlyTaskStatus.payslipEmails.sent}/
            {monthlyTaskStatus.payslipEmails.total} sent
          </button>
        </div>
      )}

      {/* Over-plan-limit notice. Backend trims this org-scoped register to the
          allowed member set when the workspace is past its plan cap; surface the
          "Showing N of TOTAL — upgrade" banner above the register (mirrors the
          Team list). Renders nothing unless capped. -> store.memberCap. */}
      {memberCap?.capped && <MemberCapNotice {...memberCap} className="mb-4" />}

      {/* Search and Filter Bar - will be moved inside Card */}

      <SalaryPageHeader
        viewMode={viewMode}
        setViewMode={(nextView) => {
          setViewMode(nextView);
          updateRouteParams({ view: nextView === 'table' ? null : nextView });
        }}
        month={month}
        year={year}
        setMonth={(nextMonth) => {
          setMonth(nextMonth);
          updateRouteParams({ month: String(nextMonth) });
        }}
        setYear={(nextYear) => {
          setYear(nextYear);
          updateRouteParams({ year: String(nextYear) });
        }}
        search={search}
        setSearch={(nextSearch) => {
          setSearch(nextSearch);
          updateRouteParams({ search: nextSearch.trim() ? nextSearch : null });
        }}
        sortKey={sortKey}
        setSortKey={(nextSortKey) => {
          setSortKey(nextSortKey);
          updateRouteParams({ sort: nextSortKey === 'name_asc' ? null : nextSortKey });
        }}
        statusFilter={statusFilter}
        setStatusFilter={(nextStatus) => {
          setStatusFilter(nextStatus);
          updateRouteParams({ status: nextStatus === 'all' ? null : nextStatus });
        }}
        statusCounts={statusCounts}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        loading={loading}
        filteredRecords={filteredRecords}
        columns={columns}
        shiftSummaries={shiftSummaries}
        shiftSummariesLoading={shiftSummariesLoading}
        shiftRowsByKey={shiftRowsByKey}
        shiftRowsLoadingByKey={shiftRowsLoadingByKey}
        shiftRowsLoadedByKey={shiftRowsLoadedByKey}
        shiftRowsErrorByKey={shiftRowsErrorByKey}
        shiftPaginationByKey={shiftPaginationByKey}
        onLoadShiftRows={loadShiftRows}
        canExport={canExport}
        salaryFilterSummary={salaryFilterSummary}
        getExportData={getExportData}
        onLoad={load}
        onLoadShiftSummaries={loadShiftSummaries}
        onNavigateMonth={(m, y) => {
          setMonth(m);
          setYear(y);
          updateRouteParams({
            month: String(m),
            year: String(y),
          });
        }}
        currentPage={page}
        pageSize={pageSize}
        totalRecords={totalRecords}
        setCurrentPage={setPage}
        onBulkPayslipDownload={handleBulkPayslipDownload}
        showPayslipGeneration={features.payslipGeneration.visible}
        enablePayslipGeneration={features.payslipGeneration.enabled}
        payslipGenerating={payslipGenerating}
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={setSelectedRowKeys}
        showBulkPayments={features.bulkPayments.visible}
        payableSelectedCount={payableSelectedCount}
        lockedSelectedCount={lockedSelectedCount}
        onOpenBulkPayment={() => setBulkPaymentOpen(true)}
        onOpenBulkPayslip={() => {
          const selectedRecords = filteredRecords.filter(
            (record) => Boolean(record._id) && selectedRowKeys.includes(String(record._id)),
          );
          void generatePayslip(selectedRecords, 'combined');
        }}
        onBulkEmailPayslips={
          canEmailPayslips
            ? () => {
                void handleBulkEmailPayslips();
              }
            : undefined
        }
        bulkPayslipEmailing={bulkPayslipEmailing}
        onClearSelection={clearSelection}
        onOpenComplianceExport={
          currentWorkspaceId && canUseComplianceExports ? openComplianceModal : undefined
        }
        wsId={canUseComplianceExports ? (currentWorkspaceId ?? undefined) : undefined}
      />

      <SetSalaryModal
        key={setSalaryModal?._id ?? 'set-salary-closed'}
        open={!!setSalaryModal}
        record={setSalaryModal}
        form={setSalaryForm}
        saving={saving}
        salaryMode={salaryMode}
        setSalaryMode={setSalaryMode}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        passbookImage={passbookImage}
        setPassbookImage={setPassbookImage}
        qrCodeImage={qrCodeImage}
        setQrCodeImage={setQrCodeImage}
        sameAsEmployeeName={sameAsEmployeeName}
        setSameAsEmployeeName={setSameAsEmployeeName}
        onClose={() => {
          setSetSalaryModal(null);
          setPassbookImage(null);
          setQrCodeImage(null);
          setPaymentMethod(undefined);
        }}
        onSubmit={(vals, meta) =>
          handleSetSalary({
            vals,
            salaryMode,
            paymentMethod,
            sameAsEmployeeName,
            passbookImage,
            qrCodeImage,
            setPassbookImage,
            setQrCodeImage,
            ctcAmount: meta.ctcAmount,
            selectedTemplateId: meta.selectedTemplateId,
            componentOverrides: meta.componentOverrides,
          })
        }
        getRecordStatus={getRecordStatus}
      />

      <BulkPaymentModal
        open={bulkPaymentOpen}
        records={selectedRecords}
        month={month}
        year={year}
        onClose={() => {
          setBulkPaymentOpen(false);
          clearSelection();
        }}
        onSubmit={handleBulkPayment}
        canAdvance={canAdvance}
        showCommission={features.commissionTracking.visible}
      />

      {currentWorkspaceId && (
        <BulkEmailProgressModal
          open={bulkEmailModalOpen}
          workspaceId={currentWorkspaceId}
          jobId={bulkEmailJobId}
          onClose={() => {
            setBulkEmailModalOpen(false);
            setBulkEmailJobId(null);
          }}
        />
      )}

      <PayDrawer
        open={!!payModal}
        record={payModal}
        form={payForm}
        saving={saving}
        dueAmount={dueAmount}
        advancePaidAmount={advancePaidAmount}
        outstandingAdvance={outstandingAdvance}
        payPreferredMethod={payPreferredMethod ?? null}
        splitMode={splitMode}
        setSplitMode={setSplitMode}
        canSplit={canSplit}
        splits={splits}
        setSplits={setSplits}
        sameDateForAll={sameDateForAll}
        setSameDateForAll={setSameDateForAll}
        samePaidByForAll={samePaidByForAll}
        setSamePaidByForAll={setSamePaidByForAll}
        sameNotesForAll={sameNotesForAll}
        setSameNotesForAll={setSameNotesForAll}
        singlePaymentMethod={singlePaymentMethod}
        setSinglePaymentMethod={setSinglePaymentMethod}
        addCommission={addCommission}
        setAddCommission={setAddCommission}
        commissionAmount={commissionAmount}
        setCommissionAmount={setCommissionAmount}
        commissionNote={commissionNote}
        setCommissionNote={setCommissionNote}
        commissionTitle={commissionTitle}
        setCommissionTitle={setCommissionTitle}
        advanceTarget={advanceTarget}
        setAdvanceTarget={setAdvanceTarget}
        canAdvance={canAdvance}
        advanceInstallmentValue={advanceInstallmentValue}
        setAdvanceInstallmentValue={setAdvanceInstallmentValue}
        proofImages={proofImages}
        setProofImages={setProofImages}
        currentWorkspace={currentWorkspace}
        setCreateBankAccountOpen={setCreateBankAccountOpen}
        onClose={handlePayDrawerClose}
        onSubmit={() => submitPayment()}
        onComplianceOverride={(reason) =>
          submitPayment({ overrideCompliance: true, overrideReason: reason })
        }
        latestComplianceResult={
          pendingComplianceBreaches
            ? { breaches: pendingComplianceBreaches, warnings: [] }
            : undefined
        }
        totalSplitAmount={totalSplitAmount}
        projectedCurrentMonthExcess={projectedCurrentMonthExcess}
        getSalaryBasisMeta={getSalaryBasisMeta}
        formatCurrencyFull={formatCurrencyFull}
        formatPayrollDayValue={formatPayrollDayValue}
        msgApi={msgApi}
        onManagePlan={advancePlanDrawerPlanId ? () => setAdvancePlanDrawerOpen(true) : undefined}
        workspaceId={currentWorkspaceId ?? ''}
        onCoaAccountChange={setSelectedCoaAccountId}
      />

      {currentWorkspaceId && advancePlanDrawerPlanId && (
        <AdvancePlanDrawer
          open={advancePlanDrawerOpen}
          onClose={() => setAdvancePlanDrawerOpen(false)}
          workspaceId={currentWorkspaceId}
          planId={advancePlanDrawerPlanId}
          onChanged={() => {
            /* Refresh the salary table so updated recovery amounts reflect */
            void Promise.resolve();
          }}
        />
      )}

      {currentWorkspaceId && canUseComplianceExports && (
        <ComplianceExportModal
          open={complianceModal.open}
          onClose={closeComplianceModal}
          workspaceId={currentWorkspaceId}
          month={month}
          year={year}
        />
      )}

      {currentWorkspaceId && canManageFnfSettlements && fnfModal.member && (
        <FnfSettlementModal
          open={fnfModal.open}
          onClose={closeFnfModal}
          workspaceId={currentWorkspaceId}
          member={fnfModal.member}
        />
      )}

      {currentWorkspaceId && canManageTaxDeclarations && tdsModal.member && (
        <TaxDeclarationModal
          open={tdsModal.open}
          onClose={closeTdsModal}
          workspaceId={currentWorkspaceId}
          member={tdsModal.member}
          month={tdsModal.salary?.month ?? month}
          year={tdsModal.salary?.year ?? year}
        />
      )}

      <AdjustmentDrawer
        open={!!adjustmentDrawerRecord}
        record={adjustmentDrawerRecord}
        form={adjustmentForm}
        adjustmentSummary={adjustmentSummary}
        adjustmentHistory={adjustmentHistory}
        adjustmentsLoading={adjustmentsLoading}
        adjustmentSaving={adjustmentSaving}
        adjustmentProof={adjustmentProof}
        setAdjustmentProof={setAdjustmentProof}
        adjustmentCorrectionSource={adjustmentCorrectionSource}
        canCreateAdjustments={canCreateAdjustments}
        canReverseAdjustments={canReverseAdjustments}
        onClose={() => {
          setAdjustmentDrawerRecord(null);
          setAdjustmentHistory([]);
          setAdjustmentsLoading(false);
          setReverseAdjustmentTarget(null);
          setReverseAdjustmentIntent('reverse');
          resetAdjustmentComposer();
        }}
        onSubmit={handleCreateAdjustment}
        onReverse={(adjustment, intent) => openReverseAdjustmentModal(adjustment, intent)}
        onDuplicate={(adjustment) => {
          if (adjustment.status === 'reversed') {
            prepareAdjustmentCorrectionDraft(adjustment);
          } else {
            openReverseAdjustmentModal(adjustment, 'reverse_and_correct');
          }
        }}
        onResetComposer={resetAdjustmentComposer}
        onFillDeductionForRemaining={handleFillDeductionForRemaining}
        formatPayrollDayValue={formatPayrollDayValue}
        formatAdjustmentCategory={formatAdjustmentCategory}
        getAdjustmentActorName={getAdjustmentActorName}
      />

      <ReverseAdjustmentModal
        open={!!reverseAdjustmentTarget}
        intent={reverseAdjustmentIntent}
        form={reverseAdjustmentForm}
        confirmLoading={reverseSaving}
        onCancel={() => {
          setReverseAdjustmentTarget(null);
          setReverseAdjustmentIntent('reverse');
          reverseAdjustmentForm.resetFields();
        }}
        onSubmit={handleReverseAdjustment}
      />

      <ReversePaymentModal
        open={!!reversePaymentTarget}
        transaction={reversePaymentTarget}
        form={reversePaymentForm}
        loading={reversePaymentSaving}
        onCancel={() => {
          setReversePaymentTarget(null);
          reversePaymentForm.resetFields();
        }}
        onSubmit={async (vals) => {
          if (!reversePaymentTarget || !monthTransactionsModal) return;
          const ok = await handleReversePayment({
            vals,
            reversePaymentTarget,
            monthTransactionsModal,
            openLedger,
          });
          if (ok) {
            setReversePaymentTarget(null);
            reversePaymentForm.resetFields();
          }
        }}
      />

      <MonthTransactionsModal
        open={!!monthTransactionsModal}
        data={monthTransactionsModal}
        isLedgerLoading={isLedgerLoading}
        ledgerError={ledgerError}
        expandedSplits={expandedSplits}
        canExport={canExport}
        exportRows={monthLedgerExportRows}
        exportFilename={monthLedgerExportFilename}
        exportFilterSummary={monthLedgerFilterSummary}
        getExportData={getMonthLedgerExportData}
        onClose={() => {
          setMonthTransactionsModal(null);
          setExpandedSplits(new Set());
          setReversePaymentTarget(null);
          reversePaymentForm.resetFields();
        }}
        onToggleSplit={(id) => toggleSplit(id)}
        onOpenLedger={(rec) => openLedger(rec)}
        onLoadFullLedger={(rec) => loadFullLedger(rec)}
        onShowFullHistory={() => setShowFullHistory(true)}
        onSetMonthTransactionsModal={(data) => setMonthTransactionsModal(data)}
        onSetReversePaymentTarget={(t) => setReversePaymentTarget(t)}
        onResetReversePaymentForm={() => reversePaymentForm.resetFields()}
        reversePaymentAccess={reversePaymentAccess}
        getSettlementMeta={getSettlementMeta}
        formatCurrencyFull={formatCurrencyFull}
      />

      <MonthDetailDrawer
        open={!!ledgerModal}
        ledgerRecord={ledgerModal}
        ledgerData={ledgerData}
        ledgerError={ledgerError}
        isLedgerLoading={isLedgerLoading}
        ledgerViewMonthKey={ledgerViewMonthKey}
        expandedSplits={expandedSplits}
        onClose={() => {
          setLedgerModal(null);
          setLedgerData(null);
          setLedgerError(null);
          setShowFullHistory(false);
          setLedgerViewMonthKey(null);
        }}
        onSetLedgerViewMonthKey={(key) => setLedgerViewMonthKey(key)}
        onToggleSplit={(id) => toggleSplit(id)}
        onSelectTransaction={(t) => setSelectedTransaction(t)}
        onShowFullHistory={() => setShowFullHistory(true)}
        onRetry={() => ledgerModal && openLedger(ledgerModal)}
        getSettlementMeta={getSettlementMeta}
        formatCurrencyFull={formatCurrencyFull}
      />

      <FullHistoryDrawer
        open={showFullHistory}
        ledgerData={ledgerData}
        isLedgerLoading={isLedgerLoading}
        canExport={canExport}
        exportRows={fullLedgerExportRows}
        exportFilename={fullLedgerExportFilename}
        exportFilterSummary={fullLedgerFilterSummary}
        getExportData={getFullLedgerExportData}
        historySearch={historySearch}
        setHistorySearch={setHistorySearch}
        historyMethodFilter={historyMethodFilter}
        setHistoryMethodFilter={setHistoryMethodFilter}
        historyDateRange={historyDateRange}
        setHistoryDateRange={setHistoryDateRange}
        historyAccountFilter={historyAccountFilter}
        setHistoryAccountFilter={setHistoryAccountFilter}
        ledgerAccounts={ledgerAccounts}
        expandedSplits={expandedSplits}
        onClose={() => {
          setShowFullHistory(false);
          setHistorySearch('');
          setHistoryMethodFilter(new Set());
          setHistoryDateRange('all');
          setHistoryAccountFilter(new Set());
        }}
        onToggleSplit={(id) => toggleSplit(id)}
        onSelectTransaction={(t) => setSelectedTransaction(t)}
        getSettlementMeta={getSettlementMeta}
        formatCurrencyFull={formatCurrencyFull}
      />

      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      <CreateBankAccountModal
        open={createBankAccountOpen}
        value={newBankAccountLabel}
        loading={creatingBankAccount}
        existingAccounts={currentWorkspace?.bankAccounts || []}
        onClose={() => {
          setCreateBankAccountOpen(false);
          setNewBankAccountLabel('');
        }}
        onChange={setNewBankAccountLabel}
        onSubmit={handleCreateBankAccount}
      />

      {/* Salary Revision Modal */}
      <SalaryIncrementModal
        open={incrementModalOpen}
        onClose={() => {
          setIncrementModalOpen(false);
          setSelectedMemberForIncrement(null);
        }}
        member={selectedMemberForIncrement}
        currentSalary={selectedMemberForIncrement?.salaryAmount || 0}
      />

      <PayslipEmailsDrawer
        open={payslipEmailsDrawerOpen}
        onClose={() => setPayslipEmailsDrawerOpen(false)}
        data={monthlyTaskStatus}
        month={month}
        year={year}
        workspaceId={currentWorkspaceId ?? ''}
        onRefetch={fetchMonthlyTaskStatus}
      />
      <LockedRecordsDrawer
        open={lockedRecordsDrawerOpen}
        onClose={() => setLockedRecordsDrawerOpen(false)}
        data={monthlyTaskStatus}
        month={month}
        year={year}
        workspaceId={currentWorkspaceId ?? ''}
        canEdit={canEditSalary}
        onRefetch={fetchMonthlyTaskStatus}
      />

      {/* Phase 23 plan 23-11: Piece-rate preview drawer */}
      {previewState.open && previewState.teamMemberId && currentWorkspaceId && (
        <PieceRatePreviewDrawer
          open={previewState.open}
          wsId={currentWorkspaceId}
          teamMemberId={previewState.teamMemberId}
          memberName={previewState.memberName ?? ''}
          month={previewState.month ?? month}
          year={previewState.year ?? year}
          onClose={() => setPreviewState({ open: false })}
          onApplied={() => {
            setPreviewState({ open: false });
            void load();
          }}
        />
      )}
    </>
  );
}
