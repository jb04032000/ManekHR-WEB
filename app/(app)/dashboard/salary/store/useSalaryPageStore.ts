import { create } from 'zustand';
import type {
  SalaryRecord,
  SalarySummary,
  TeamMember,
  StatusFilter,
  ViewMode,
  SalaryAdjustment,
  LedgerRecord,
  LedgerMonth,
} from '../types/salary-page.types';

interface SalaryPageState {
  records: SalaryRecord[];
  teamMembers: TeamMember[];
  loading: boolean;
  selectedRowKeys: string[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  serverSummary: SalarySummary | null;
  /**
   * Over-plan-limit notice from the paginated register response. Present only
   * when the workspace is past its plan member cap (post-grace), so the register
   * was server-trimmed. Drives <MemberCapNotice> above the register in
   * RunPayrollPage. Null = not capped. -> PaginatedSalaryResponse.memberCap.
   */
  memberCap: { capped: boolean; visibleCount: number; totalCount: number; limit: number } | null;
  month: number;
  year: number;
  search: string;
  sortKey: string;
  statusFilter: StatusFilter;
  viewMode: ViewMode;
  payModal: SalaryRecord | null;
  setSalaryModal: SalaryRecord | null;
  complianceModal: {
    open: boolean;
  };
  fnfModal: {
    open: boolean;
    member: TeamMember | null;
  };
  tdsModal: {
    open: boolean;
    member: TeamMember | null;
    salary: SalaryRecord | null;
  };
  adjustmentDrawerRecord: SalaryRecord | null;
  monthTransactionsModal: { record: SalaryRecord; monthData: LedgerMonth | null } | null;
  incrementModalOpen: boolean;
  selectedMemberForIncrement: TeamMember | null;
  ledgerData: LedgerRecord | null;
  isLedgerLoading: boolean;
  ledgerError: string | null;
  adjustmentHistory: SalaryAdjustment[];
  adjustmentsLoading: boolean;

  setMonth: (month: number) => void;
  setYear: (year: number) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSortKey: (key: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setViewMode: (mode: ViewMode) => void;
  setPayModal: (record: SalaryRecord | null) => void;
  setSetSalaryModal: (record: SalaryRecord | null) => void;
  openComplianceModal: () => void;
  closeComplianceModal: () => void;
  openFnfModal: (member: TeamMember) => void;
  closeFnfModal: () => void;
  openTdsModal: (member: TeamMember, salary: SalaryRecord | null) => void;
  closeTdsModal: () => void;
  setAdjustmentDrawerRecord: (record: SalaryRecord | null) => void;
  setMonthTransactionsModal: (
    data: { record: SalaryRecord; monthData: LedgerMonth | null } | null,
  ) => void;
  setIncrementModalOpen: (open: boolean) => void;
  setSelectedMemberForIncrement: (member: TeamMember | null) => void;
  setLedgerData: (data: LedgerRecord | null) => void;
  setIsLedgerLoading: (loading: boolean) => void;
  setLedgerError: (error: string | null) => void;
  setAdjustmentHistory: (history: SalaryAdjustment[]) => void;
  setAdjustmentsLoading: (loading: boolean) => void;
  setLoadResult: (records: SalaryRecord[], teamMembers: TeamMember[]) => void;
  setPaginatedResult: (
    records: SalaryRecord[],
    pagination: { page: number; limit: number; total: number; pages: number },
    summary: SalarySummary,
    memberCap?: {
      capped: boolean;
      visibleCount: number;
      totalCount: number;
      limit: number;
    } | null,
  ) => void;
  setLoading: (loading: boolean) => void;
  setSelectedRowKeys: (keys: string[]) => void;
  clearSelection: () => void;
  patchRecord: (id: string, patch: Partial<SalaryRecord>) => void;
  reset: () => void;
}

export const useSalaryPageStore = create<SalaryPageState>((set) => ({
  records: [],
  teamMembers: [],
  loading: false,
  selectedRowKeys: [],
  page: 1,
  pageSize: 50,
  totalRecords: 0,
  totalPages: 0,
  serverSummary: null,
  memberCap: null,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  search: '',
  sortKey: 'name_asc',
  statusFilter: 'all',
  viewMode: 'table',
  payModal: null,
  setSalaryModal: null,
  complianceModal: {
    open: false,
  },
  fnfModal: {
    open: false,
    member: null,
  },
  tdsModal: {
    open: false,
    member: null,
    salary: null,
  },
  adjustmentDrawerRecord: null,
  monthTransactionsModal: null,
  incrementModalOpen: false,
  selectedMemberForIncrement: null,
  ledgerData: null,
  isLedgerLoading: false,
  ledgerError: null,
  adjustmentHistory: [],
  adjustmentsLoading: false,

  setMonth: (month) => set({ month, page: 1, selectedRowKeys: [] }),
  setYear: (year) => set({ year, page: 1, selectedRowKeys: [] }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setSearch: (search) => set({ search, page: 1, selectedRowKeys: [] }),
  setSortKey: (sortKey) => set({ sortKey, page: 1 }),
  setStatusFilter: (statusFilter) => set({ statusFilter, page: 1, selectedRowKeys: [] }),
  setViewMode: (viewMode) => set({ viewMode }),
  setPayModal: (payModal) => set({ payModal }),
  setSetSalaryModal: (setSalaryModal) => set({ setSalaryModal }),
  openComplianceModal: () =>
    set({
      complianceModal: {
        open: true,
      },
    }),
  closeComplianceModal: () =>
    set({
      complianceModal: {
        open: false,
      },
    }),
  openFnfModal: (member) =>
    set({
      fnfModal: {
        open: true,
        member,
      },
    }),
  closeFnfModal: () =>
    set({
      fnfModal: {
        open: false,
        member: null,
      },
    }),
  openTdsModal: (member, salary) =>
    set({
      tdsModal: {
        open: true,
        member,
        salary,
      },
    }),
  closeTdsModal: () =>
    set({
      tdsModal: {
        open: false,
        member: null,
        salary: null,
      },
    }),
  setAdjustmentDrawerRecord: (adjustmentDrawerRecord) => set({ adjustmentDrawerRecord }),
  setMonthTransactionsModal: (monthTransactionsModal) => set({ monthTransactionsModal }),
  setIncrementModalOpen: (incrementModalOpen) => set({ incrementModalOpen }),
  setSelectedMemberForIncrement: (selectedMemberForIncrement) =>
    set({ selectedMemberForIncrement }),
  setLedgerData: (ledgerData) => set({ ledgerData }),
  setIsLedgerLoading: (isLedgerLoading) => set({ isLedgerLoading }),
  setLedgerError: (ledgerError) => set({ ledgerError }),
  setAdjustmentHistory: (adjustmentHistory) => set({ adjustmentHistory }),
  setAdjustmentsLoading: (adjustmentsLoading) => set({ adjustmentsLoading }),
  setLoadResult: (records, teamMembers) => set({ records, teamMembers, selectedRowKeys: [] }),
  setPaginatedResult: (records, pagination, summary, memberCap = null) =>
    set({
      records,
      teamMembers: records.map((r) => r.teamMember).filter(Boolean) as TeamMember[],
      selectedRowKeys: [],
      page: pagination.page,
      pageSize: pagination.limit,
      totalRecords: pagination.total,
      totalPages: pagination.pages,
      serverSummary: summary,
      memberCap: memberCap ?? null,
      loading: false,
    }),
  setLoading: (loading) => set({ loading }),
  setSelectedRowKeys: (selectedRowKeys) => set({ selectedRowKeys }),
  clearSelection: () => set({ selectedRowKeys: [] }),
  patchRecord: (id, patch) =>
    set((state) => ({
      records: state.records.map((r) => (r._id === id ? { ...r, ...patch } : r)),
    })),
  reset: () =>
    set({
      search: '',
      statusFilter: 'all',
      sortKey: 'name_asc',
      page: 1,
      selectedRowKeys: [],
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    }),
}));
