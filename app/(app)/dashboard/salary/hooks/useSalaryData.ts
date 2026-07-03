import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import { useSalaryPageStore } from '../store/useSalaryPageStore';
import { getPaymentCreditedAmount } from '../utils/salary-page.utils';
import type {
  SalaryRecord,
  TeamMember,
  StatusFilter,
  ShiftPayrollSummary,
} from '../types/salary-page.types';
import { createSalaryExportRows } from '@/lib/exportFields/salaryFields';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { env } from '@/lib/env';

type MergedRow = SalaryRecord & { teamMember?: TeamMember };

const FE_SALARY_DEBUG = typeof window !== 'undefined' && env.isDev;

function normalizeTeamMember(member?: TeamMember | null): TeamMember | undefined {
  if (!member) return undefined;

  const rawMember = member as TeamMember & {
    _id?: string;
    shiftId?: {
      _id?: string;
      name?: string;
      startTime?: string;
      endTime?: string;
      color?: string;
    } | null;
  };

  const normalizedShift =
    rawMember.shift ??
    (rawMember.shiftId && typeof rawMember.shiftId === 'object'
      ? {
          id: rawMember.shiftId._id || '',
          name: rawMember.shiftId.name || 'Unassigned',
          startTime: rawMember.shiftId.startTime || '',
          endTime: rawMember.shiftId.endTime || '',
          color: rawMember.shiftId.color || '',
        }
      : undefined);

  return {
    ...rawMember,
    id: rawMember.id || rawMember._id || '',
    shift: normalizedShift,
  };
}

function normalizeSalaryRecord(record: SalaryRecord): MergedRow {
  return {
    ...record,
    isPreview: Boolean(record.isPreview),
    isLocked: Boolean(record.isLocked),
    teamMember: normalizeTeamMember(record.teamMember),
  };
}

function getSortParams(sortKey: string): {
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

function getStatusParam(statusFilter: StatusFilter): string | undefined {
  if (statusFilter === 'all' || statusFilter === 'missing_method') {
    return undefined;
  }

  return statusFilter;
}

export function useSalaryData() {
  // i18n: the shift-rows load error was a hardcoded English string (salary.shift.loadError).
  const tShift = useTranslations('salary.shift');
  const searchParams = useSearchParams();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const isHydrated = useWorkspaceStore((state) => state.isHydrated);
  const teamMemberIdFilter = searchParams.get('teamMemberId')?.trim() || undefined;

  const {
    records,
    teamMembers,
    month,
    year,
    search,
    sortKey,
    statusFilter,
    viewMode,
    page,
    pageSize,
    totalRecords,
    totalPages,
    serverSummary,
  } = useSalaryPageStore(
    useShallow((s) => ({
      records: s.records,
      teamMembers: s.teamMembers,
      month: s.month,
      year: s.year,
      search: s.search,
      sortKey: s.sortKey,
      statusFilter: s.statusFilter,
      viewMode: s.viewMode,
      page: s.page,
      pageSize: s.pageSize,
      totalRecords: s.totalRecords,
      totalPages: s.totalPages,
      serverSummary: s.serverSummary,
    })),
  );

  const setPaginatedResult = useSalaryPageStore((s) => s.setPaginatedResult);
  const setLoading = useSalaryPageStore((s) => s.setLoading);
  const setPage = useSalaryPageStore((s) => s.setPage);
  const [shiftSummaries, setShiftSummaries] = useState<ShiftPayrollSummary[]>([]);
  const [shiftSummariesLoading, setShiftSummariesLoading] = useState(false);
  const [shiftRowsByKey, setShiftRowsByKey] = useState<Record<string, SalaryRecord[]>>({});
  const [shiftRowsLoadingByKey, setShiftRowsLoadingByKey] = useState<Record<string, boolean>>({});
  const [shiftRowsLoadedByKey, setShiftRowsLoadedByKey] = useState<Record<string, boolean>>({});
  const [shiftRowsErrorByKey, setShiftRowsErrorByKey] = useState<
    Record<string, string | undefined>
  >({});
  const [shiftPaginationByKey, setShiftPaginationByKey] = useState<
    Partial<Record<string, { page: number; limit: number; total: number; pages: number }>>
  >({});
  const mainRequestTokenRef = useRef(0);
  const shiftRowsLoadingRef = useRef<Record<string, boolean>>({});
  const shiftPaginationRef = useRef<
    Partial<Record<string, { page: number; limit: number; total: number; pages: number }>>
  >({});
  const shiftRequestSignatureRef = useRef<Record<string, string>>({});
  const shiftRequestTokenRef = useRef<Record<string, number>>({});

  useEffect(() => {
    shiftRowsLoadingRef.current = shiftRowsLoadingByKey;
  }, [shiftRowsLoadingByKey]);

  useEffect(() => {
    shiftPaginationRef.current = shiftPaginationByKey;
  }, [shiftPaginationByKey]);

  const loadData = useCallback(async () => {
    if (!currentWorkspaceId || !isHydrated) {
      return { records: [] as SalaryRecord[], teamMembers: [] as TeamMember[] };
    }

    const requestToken = mainRequestTokenRef.current + 1;
    mainRequestTokenRef.current = requestToken;
    setLoading(true);
    try {
      if (FE_SALARY_DEBUG) {
        console.log('[salary][fe] requesting paginated records', {
          currentWorkspaceId,
          month,
          year,
          page,
          pageSize,
          search: search.trim() || undefined,
          teamMemberId: teamMemberIdFilter,
          status: getStatusParam(statusFilter),
          sort: getSortParams(sortKey),
        });
      }

      const response = await salaryApi.getRecordsPaginated(currentWorkspaceId, {
        month,
        year,
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        teamMemberId: teamMemberIdFilter,
        status: getStatusParam(statusFilter),
        ...getSortParams(sortKey),
      });

      const normalizedRecords = (response.records || []).map(normalizeSalaryRecord);

      if (mainRequestTokenRef.current !== requestToken) {
        if (FE_SALARY_DEBUG) {
          console.log('[salary][fe] ignoring stale paginated response', {
            requestToken,
            currentRequestToken: mainRequestTokenRef.current,
          });
        }
        return {
          records: normalizedRecords,
          teamMembers: normalizedRecords
            .map((record) => record.teamMember)
            .filter((member): member is TeamMember => Boolean(member)),
        };
      }

      if (FE_SALARY_DEBUG) {
        console.log('[salary][fe] paginated response received', {
          recordCount: normalizedRecords.length,
          pagination: response.pagination,
          summary: response.summary,
          firstRecord: normalizedRecords[0],
        });
      }

      // Forward the optional over-cap notice so RunPayrollPage can render
      // <MemberCapNotice> above the register. -> PaginatedSalaryResponse.memberCap.
      setPaginatedResult(
        normalizedRecords,
        response.pagination,
        response.summary,
        response.memberCap ?? null,
      );

      return {
        records: normalizedRecords,
        teamMembers: normalizedRecords
          .map((record) => record.teamMember)
          .filter((member): member is TeamMember => Boolean(member)),
      };
    } catch (error) {
      if (FE_SALARY_DEBUG) {
        console.error('[salary][fe] failed to load paginated records', error);
      }
      return { records: [] as SalaryRecord[], teamMembers: [] as TeamMember[] };
    } finally {
      if (mainRequestTokenRef.current === requestToken) {
        setLoading(false);
      }
    }
  }, [
    currentWorkspaceId,
    isHydrated,
    month,
    year,
    page,
    pageSize,
    search,
    teamMemberIdFilter,
    sortKey,
    statusFilter,
    setLoading,
    setPaginatedResult,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadShiftSummaries = useCallback(async () => {
    if (!currentWorkspaceId || !isHydrated) {
      startTransition(() => {
        setShiftSummaries([]);
      });
      return [];
    }

    startTransition(() => {
      setShiftSummariesLoading(true);
    });
    try {
      const response = await salaryApi.getShiftSummaries(currentWorkspaceId, {
        month,
        year,
        search: search.trim() || undefined,
        teamMemberId: teamMemberIdFilter,
        status: getStatusParam(statusFilter),
      });
      startTransition(() => {
        setShiftSummaries(response || []);
        setShiftRowsByKey({});
        setShiftRowsLoadingByKey({});
        setShiftRowsLoadedByKey({});
        setShiftRowsErrorByKey({});
        setShiftPaginationByKey({});
      });
      shiftRowsLoadingRef.current = {};
      shiftPaginationRef.current = {};
      shiftRequestSignatureRef.current = {};
      shiftRequestTokenRef.current = {};
      return response || [];
    } catch (error) {
      if (FE_SALARY_DEBUG) {
        console.error('[salary][fe] failed to load shift summaries', error);
      }
      startTransition(() => {
        setShiftSummaries([]);
      });
      return [];
    } finally {
      startTransition(() => {
        setShiftSummariesLoading(false);
      });
    }
  }, [currentWorkspaceId, isHydrated, month, year, search, statusFilter, teamMemberIdFilter]);

  useEffect(() => {
    if (viewMode === 'shift') {
      void loadShiftSummaries();
    }
  }, [viewMode, loadShiftSummaries]);

  const loadShiftRows = useCallback(
    async (
      shiftKey: string,
      options?: {
        page?: number;
        limit?: number;
      },
    ) => {
      if (!currentWorkspaceId || !isHydrated) {
        return;
      }

      const currentPagination = shiftPaginationRef.current[shiftKey];
      const requestedPage = options?.page ?? currentPagination?.page ?? 1;
      const requestedLimit = options?.limit ?? currentPagination?.limit ?? pageSize;
      const requestSignature = [
        shiftKey,
        month,
        year,
        requestedPage,
        requestedLimit,
        search.trim() || '',
        teamMemberIdFilter || '',
        getStatusParam(statusFilter) || 'all',
        sortKey,
      ].join(':');

      if (
        shiftRowsLoadingRef.current[shiftKey] &&
        shiftRequestSignatureRef.current[shiftKey] === requestSignature
      ) {
        return;
      }

      shiftRequestSignatureRef.current[shiftKey] = requestSignature;
      const requestToken = (shiftRequestTokenRef.current[shiftKey] ?? 0) + 1;
      shiftRequestTokenRef.current[shiftKey] = requestToken;

      setShiftRowsLoadingByKey((prev) => ({ ...prev, [shiftKey]: true }));
      setShiftRowsErrorByKey((prev) => ({ ...prev, [shiftKey]: undefined }));
      try {
        const response = await salaryApi.getRecordsPaginated(currentWorkspaceId, {
          month,
          year,
          page: requestedPage,
          limit: requestedLimit,
          search: search.trim() || undefined,
          teamMemberId: teamMemberIdFilter,
          status: getStatusParam(statusFilter),
          shiftId: shiftKey,
          ...getSortParams(sortKey),
        });

        if (shiftRequestTokenRef.current[shiftKey] !== requestToken) {
          return;
        }

        const normalizedRecords = (response.records || []).map(normalizeSalaryRecord);
        setShiftRowsByKey((prev) => ({
          ...prev,
          [shiftKey]: normalizedRecords,
        }));
        setShiftPaginationByKey((prev) => ({
          ...prev,
          [shiftKey]: response.pagination,
        }));
        setShiftRowsErrorByKey((prev) => ({ ...prev, [shiftKey]: undefined }));
      } catch (error) {
        if (FE_SALARY_DEBUG) {
          console.error('[salary][fe] failed to load shift rows', {
            shiftKey,
            error,
          });
        }
        if (shiftRequestTokenRef.current[shiftKey] === requestToken) {
          setShiftRowsErrorByKey((prev) => ({
            ...prev,
            [shiftKey]: tShift('loadError'),
          }));
        }
      } finally {
        if (shiftRequestTokenRef.current[shiftKey] === requestToken) {
          setShiftRowsLoadingByKey((prev) => ({ ...prev, [shiftKey]: false }));
          setShiftRowsLoadedByKey((prev) => ({ ...prev, [shiftKey]: true }));
        }
      }
    },
    [
      currentWorkspaceId,
      isHydrated,
      month,
      year,
      pageSize,
      search,
      teamMemberIdFilter,
      sortKey,
      statusFilter,
      tShift,
    ],
  );

  const mergedRows = useMemo(() => records as MergedRow[], [records]);

  const getSettlementStatus = useCallback(
    (
      record: SalaryRecord,
    ): 'salary_not_set' | 'not_generated' | 'pending' | 'partial' | 'paid' | 'overpaid' => {
      if (record.settlementStatus) {
        return record.settlementStatus;
      }

      if (record.isPreview) {
        const configuredSalary = record.effectiveSalary ?? record.baseSalary ?? 0;
        return configuredSalary > 0 ? 'not_generated' : 'salary_not_set';
      }

      const paid = record.paidAmount ?? 0;
      const net = record.netSalary ?? 0;
      const base = record.baseSalary ?? 0;

      if (base <= 0) return 'salary_not_set';
      if (net <= 0) return 'salary_not_set';
      if (paid > net) return 'overpaid';
      if (paid >= net) return 'paid';
      if (paid > 0) return 'partial';
      return 'pending';
    },
    [],
  );

  const getRecordStatus = useCallback(
    (record: SalaryRecord): string => {
      const settlementStatus = getSettlementStatus(record);
      if (settlementStatus === 'overpaid') {
        return 'advance';
      }
      return settlementStatus;
    },
    [getSettlementStatus],
  );

  const filteredRecords = useMemo(() => mergedRows, [mergedRows]);

  const effectiveSummary = useMemo(() => {
    if (!serverSummary) {
      return {
        totalPayable: 0,
        totalPaid: 0,
        totalPending: 0,
        totalOverpaid: 0,
        employeesCount: 0,
        paidCount: 0,
        pendingCount: 0,
        partialCount: 0,
        advanceCount: 0,
        salaryNotSetCount: 0,
        notGeneratedCount: 0,
        upcomingJoinersCount: 0,
        nextJoinerMonth: null,
        nextJoinerYear: null,
      };
    }

    return serverSummary;
  }, [serverSummary]);

  const statusCounts = useMemo(
    () => ({
      all: effectiveSummary.employeesCount ?? 0,
      pending: effectiveSummary.pendingCount ?? 0,
      partial: effectiveSummary.partialCount ?? 0,
      paid: effectiveSummary.paidCount ?? 0,
      advance: effectiveSummary.advanceCount ?? 0,
      salary_not_set: effectiveSummary.salaryNotSetCount ?? 0,
      not_generated: effectiveSummary.notGeneratedCount ?? 0,
    }),
    [effectiveSummary],
  );

  const totalPayable = effectiveSummary.totalPayable ?? 0;
  const totalPaid = effectiveSummary.totalPaid ?? 0;
  const totalPending = effectiveSummary.totalPending ?? 0;
  const totalOverpaid = effectiveSummary.totalOverpaid ?? 0;
  const isOverpaidTotal = totalOverpaid > 0;

  const paidCount = (effectiveSummary.paidCount ?? 0) + (effectiveSummary.advanceCount ?? 0);
  const pendingCount = (effectiveSummary.pendingCount ?? 0) + (effectiveSummary.partialCount ?? 0);

  const upcomingJoinersCount = effectiveSummary.upcomingJoinersCount ?? 0;
  const nextJoinerMonth = effectiveSummary.nextJoinerMonth ?? null;
  const nextJoinerYear = effectiveSummary.nextJoinerYear ?? null;

  useEffect(() => {
    if (!FE_SALARY_DEBUG) return;

    console.log('[salary][fe] derived page state', {
      recordsLength: records.length,
      mergedRowsLength: mergedRows.length,
      filteredRecordsLength: filteredRecords.length,
      totalRecords,
      totalPages,
      statusCounts,
      effectiveSummary,
    });
  }, [
    records.length,
    mergedRows.length,
    filteredRecords.length,
    totalRecords,
    totalPages,
    statusCounts,
    effectiveSummary,
  ]);

  const isFinanciallySettled = (record: SalaryRecord): boolean => {
    if (record.isPreview) return false;
    const paid = record.paidAmount ?? 0;
    const net = record.netSalary ?? 0;
    return paid >= net;
  };

  const getExportData = useCallback(async () => {
    if (!currentWorkspaceId) return [];

    const accumulatedRecords: SalaryRecord[] = [];
    let exportPage = 1;
    let exportTotalPages = 1;
    const exportPageSize = 100;

    do {
      const response = await salaryApi.getRecordsPaginated(currentWorkspaceId, {
        month,
        year,
        page: exportPage,
        limit: exportPageSize,
        search: search.trim() || undefined,
        teamMemberId: teamMemberIdFilter,
        status: getStatusParam(statusFilter),
        ...getSortParams(sortKey),
      });

      accumulatedRecords.push(...(response.records || []).map(normalizeSalaryRecord));
      exportTotalPages = response.pagination.pages;
      exportPage += 1;
    } while (exportPage <= exportTotalPages);

    const exportRecords =
      statusFilter === 'not_generated'
        ? accumulatedRecords.filter((record) => getRecordStatus(record) === 'not_generated')
        : accumulatedRecords;

    const exportReadyRecords = exportRecords.map((record) => ({
      ...record,
      _id: record._id ?? undefined,
    }));

    const currencyConfig = usePayrollConfigStore.getState().getCurrencyConfig();
    return createSalaryExportRows(exportReadyRecords, month, year, currencyConfig);
  }, [
    currentWorkspaceId,
    getRecordStatus,
    month,
    year,
    search,
    sortKey,
    statusFilter,
    teamMemberIdFilter,
  ]);

  const getRecordMemberId = (record: SalaryRecord): string =>
    typeof record.teamMemberId === 'string' ? record.teamMemberId : record.teamMemberId?._id || '';

  const hydrateRecordWithMember = (
    record: SalaryRecord,
    members: TeamMember[] = teamMembers,
  ): SalaryRecord & { teamMember?: TeamMember } => {
    const memberId = getRecordMemberId(record);
    const member = members.find((candidate) => candidate.id === memberId);
    return member ? { ...record, teamMember: member } : record;
  };

  return {
    load: loadData,
    loadShiftSummaries,
    loadShiftRows,
    mergedRows,
    filteredRecords,
    shiftSummaries,
    shiftSummariesLoading,
    shiftRowsByKey,
    shiftRowsLoadingByKey,
    shiftRowsLoadedByKey,
    shiftRowsErrorByKey,
    shiftPaginationByKey,
    statusCounts,
    totalPayable,
    totalPaid,
    totalPending,
    totalOverpaid,
    isOverpaidTotal,
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
  };
}
