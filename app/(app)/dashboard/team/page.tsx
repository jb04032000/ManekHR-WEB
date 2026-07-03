'use client';
/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-unused-expressions -- Pre-existing Date.now()-in-render + transitive-deps + setState-in-effect + unused-expression patterns in 1892-LOC hub monolith; documented Phase 5 W2 carry-forward for separate refactor approval (~6 errors + 22 warnings before disable). */
import { useEffect, useState, useCallback, useRef, useMemo, memo, useDeferredValue } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  App,
  Card,
  Button,
  Checkbox,
  Input,
  Tag,
  Space,
  Tooltip,
  Form,
  Select,
  DatePicker,
  Dropdown,
  Skeleton,
  Result,
} from 'antd';
import {
  PlusOutlined,
  HistoryOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  StopOutlined,
  SearchOutlined,
  LockOutlined,
  KeyOutlined,
  MoreOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  UndoOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  MailOutlined,
  UploadOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { Key } from 'antd/es/table/interface';
import type { MenuProps } from 'antd';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  listTeam,
  deleteTeamMember,
  updateTeamMember,
  listShifts,
  listRoles,
  offboardMember,
  bulkUpdateTeamStatus,
  bulkArchiveTeamMembers,
  bulkRestoreTeamMembers,
  restoreTeamMember,
  deleteTeamMemberPermanent,
  getTeamStatusCounts,
  type TeamStatusCounts,
} from '@/lib/actions';
import type {
  TeamMember,
  Shift,
  Role,
  LedgerRecord,
  MonthlyTaskStatusResponse,
  TeamListResponse,
} from '@/types';
import { parseApiError, fmt } from '@/lib/utils';
import { resolveEffectiveMonthlySalary } from '@/lib/salary';
import { LIST_ALL_LIMIT } from '@/lib/constants';
import { salaryApi } from '@/lib/api';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import {
  DsAvatar,
  DsTag,
  DsTable,
  DsModal,
  BulkActionBar,
  SelectionMode,
  DsCard,
} from '@/components/ui';
import { StatTile } from '@/components/ui/StatTile';
import { TableCustomScrollbar } from '@/components/ui/TableCustomScrollbar';
import { useDebounce } from '@/hooks/useDebounce';
import { ExportButton } from '@/components/export';
import { TEAM_EXPORT_FIELDS } from '@/lib/exportFields/teamFields';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { PayslipEmailsDrawer } from '@/components/dashboard/PayslipEmailsDrawer';
import GrantAppAccessModal from '@/components/dashboard/team/GrantAppAccessModal';
import { MemberCapNotice } from '@/components/dashboard/MemberCapNotice';
import TeamBulkImportModal from '@/components/dashboard/team/import/TeamBulkImportModal';
import { generateIdCardsPdf } from '@/lib/export/generateIdCardPdf';
import dayjs from 'dayjs';

const { Option } = Select;
type StatusFilterType = 'all' | 'active' | 'inactive' | 'offboarding' | 'archived';

// React.memo wrappers for the heavy children so they short-circuit on identical
// props. Without this, the AntD Table + BulkActionBar re-run their full render
// every keystroke in the search box (even with memoized props on the parent),
// which makes the controlled Input fall behind fast typing.
const MemoDsTable = memo(DsTable) as typeof DsTable;
const MemoBulkActionBar = memo(BulkActionBar);

// StatTile lifted to components/ui/StatTile.tsx for reuse across admin pages.

function TeamConsole() {
  const t = useTranslations('team');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // useDeferredValue lets React interrupt slow downstream renders (Table,
  // KPI cards, etc.) when a newer keystroke arrives. The Input keeps rendering
  // with the urgent `search` value so typing stays responsive even while the
  // filter/sort passes are still working through the previous value.
  const deferredSearch = useDeferredValue(search);
  // 500ms covers typical slow-typist cadence (300–500ms between keystrokes).
  // With 300ms, each key press could outrun the timer and fire its own request.
  const debouncedSearch = useDebounce(deferredSearch, 500);
  const [designationFilter, setDesignationFilter] = useState<string | null>(() =>
    searchParams.get('designation'),
  );
  const [shiftFilters, setShiftFilters] = useState<string[]>([]);
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('active');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { message: msgApi } = App.useApp();
  const [accessModal, setAccessModal] = useState<TeamMember | null>(null);
  // CSV bulk import wizard (header "Bulk upload"). Gated on the same
  // `add_member` subscription as single add - that's what the BE bulk-create
  // endpoint enforces.
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Wave 4 W4.4 (2026-05-10) - auto-open Grant Access modal when arriving
  // from the team detail page CTA (`?grantAccess=<memberId>`). The detail
  // page punts to the hub so we keep a single modal implementation; here we
  // resolve the id against the loaded member list and open the modal once.
  // The query param is stripped after open to keep the URL clean.
  //
  // P1.3 (2026-05-14) - NONE-state guard. Only open the modal when the
  // member is actually in the NONE access state. INVITED / ACTIVE members
  // are lifecycle-managed via the rail on the detail page; auto-opening
  // the grant modal for them would route to a "Member already has app
  // access" 400 from BE → error toast → owner confusion.
  useEffect(() => {
    const targetId = searchParams?.get('grantAccess');
    if (!targetId || members.length === 0 || accessModal) return;
    const target = members.find((m) => m.id === targetId);
    if (!target) return;

    const stripQueryParam = () => {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('grantAccess');
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    };

    const isNoneState = !target.hasAppAccess && target.appAccessStatus !== 'invited';

    if (isNoneState) {
      setAccessModal(target);
      stripQueryParam();
    } else {
      // Already invited or active - route to the detail page rail which
      // owns the post-grant lifecycle (resend / revoke / change-role /
      // overrides). Strip the param so a back-nav doesn't reopen.
      stripQueryParam();
      router.replace(`/dashboard/team/${target.id}?tab=app-access`, {
        scroll: false,
      });
    }
  }, [searchParams, members, accessModal, router]);

  // Feature access checks
  const { entitlements } = useSubscriptionStore();
  const teamModule = entitlements?.moduleAccess?.find((m) => m.module === 'team');
  const canAddMember =
    teamModule?.subFeatures?.find((sf) => sf.key === 'add_member')?.access !== 'locked';
  const canBulkDeactivate =
    teamModule?.subFeatures?.find((sf) => sf.key === 'bulk_deactivate')?.access !== 'locked';
  const canBulkRestore =
    teamModule?.subFeatures?.find((sf) => sf.key === 'bulk_restore')?.access !== 'locked';
  const canBulkArchive =
    teamModule?.subFeatures?.find((sf) => sf.key === 'bulk_archive')?.access !== 'locked';
  const canRestoreMember =
    teamModule?.subFeatures?.find((sf) => sf.key === 'restore_member')?.access !== 'locked';
  const canOffboardMember =
    teamModule?.subFeatures?.find((sf) => sf.key === 'offboard_member')?.access !== 'locked';
  const canExportTeam =
    teamModule?.subFeatures?.find((sf) => sf.key === 'export_team')?.access !== 'locked';
  const canUseDesignationFilter =
    teamModule?.subFeatures?.find((sf) => sf.key === 'designation_filter')?.access !== 'locked';

  const { payslipGeneration, payslipEmail } = useSalaryFeatures();
  const [sendingPayslipFor, setSendingPayslipFor] = useState<string | null>(null);
  const [monthlyTaskStatus, setMonthlyTaskStatus] = useState<MonthlyTaskStatusResponse | null>(
    null,
  );
  const [payslipEmailsDrawerOpen, setPayslipEmailsDrawerOpen] = useState(false);

  const fetchMonthlyTaskStatus = useCallback(async () => {
    if (!currentWorkspaceId || !payslipEmail.enabled) return;
    const now = new Date();
    try {
      const status = await salaryApi.getMonthlyTaskStatus(
        currentWorkspaceId,
        now.getMonth() + 1,
        now.getFullYear(),
      );
      setMonthlyTaskStatus(status);
    } catch {
      /* non-critical */
    }
  }, [currentWorkspaceId, payslipEmail.enabled]);

  const handleSendLatestPayslip = useCallback(
    async (m: TeamMember) => {
      if (!currentWorkspaceId || !m.email) return;
      setSendingPayslipFor(m.id);
      try {
        const ledgerRaw = await salaryApi.getLedger(currentWorkspaceId, m.id);
        // API typed as LedgerRecord[] but backend returns single LedgerRecord
        const ledgerRecord = (Array.isArray(ledgerRaw) ? ledgerRaw[0] : ledgerRaw) as
          | LedgerRecord
          | undefined;
        const months = ledgerRecord?.months ?? [];
        if (months.length === 0) {
          msgApi.warning('No payroll records found for this member');
          return;
        }
        const latest = months[0];
        if (!latest?.salaryId) {
          msgApi.warning('Payslip data unavailable for the latest month');
          return;
        }
        const res = await salaryApi.sendPayslipEmail(currentWorkspaceId, {
          salaryId: latest.salaryId,
        });
        if ((res as any)?.sent === false) {
          msgApi.warning((res as any).reason ?? 'Could not send payslip');
        } else {
          msgApi.success(`Payslip for ${latest.monthLabel} sent to ${m.email}`);
          fetchMonthlyTaskStatus();
        }
      } catch (e) {
        msgApi.error(parseApiError(e) ?? 'Failed to send payslip');
      } finally {
        setSendingPayslipFor(null);
      }
    },
    [currentWorkspaceId, msgApi, fetchMonthlyTaskStatus],
  );

  const [resignModal, setResignModal] = useState<TeamMember | null>(null);
  const [resignForm] = Form.useForm();
  const [deactivateModal, setDeactivateModal] = useState<TeamMember | null>(null);
  const [deleteModal, setDeleteModal] = useState<TeamMember | null>(null);
  useEffect(() => {
    fetchMonthlyTaskStatus();
  }, [fetchMonthlyTaskStatus]);

  const loadedRef = useRef(false);
  const currentWorkspaceRef = useRef(currentWorkspaceId);
  // Monotonic token: latest fetch wins. Prevents stale responses (earlier
  // requests returning after newer ones) from overwriting current results.
  const fetchIdRef = useRef(0);

  // ── Server-side mode (activated when total members > LIST_ALL_LIMIT) ──────
  const [serverMode, setServerMode] = useState(false);
  const [serverTotal, setServerTotal] = useState(0);
  // Member-cap notice payload. Present only when the workspace is over its
  // plan's member limit (post-grace) and the list was server-trimmed. Surfaced
  // via <MemberCapNotice> above the table. -> TeamListResponse.memberCap.
  const [memberCap, setMemberCap] = useState<TeamListResponse['memberCap'] | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(15);
  const [serverSortBy, setServerSortBy] = useState<string | undefined>(undefined);
  const [serverSortOrder, setServerSortOrder] = useState<'asc' | 'desc'>('asc');
  // Incrementing this triggers the server-fetch effect without changing page/sort.
  // Also drives the status-counts refetch effect so every mutation path refreshes
  // both the list and the filter-pill counts consistently.
  const [serverRefreshKey, setServerRefreshKey] = useState(0);

  // Status-bucket counts for the segmented filter + hero KPIs. Fetched from a
  // dedicated backend endpoint so counts stay accurate even in server mode
  // where `members` holds only the current page.
  const [statusCounts, setStatusCounts] = useState<TeamStatusCounts | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return;

    // Always bump serverRefreshKey so the status-counts effect refires in
    // both client and server modes. The server-list fetch effect guards on
    // serverMode so client-mode bumps are harmless there.
    setServerRefreshKey((k) => k + 1);

    if (serverMode) {
      const [sRes, rRes] = await Promise.allSettled([
        listShifts(currentWorkspaceId),
        listRoles(currentWorkspaceId),
      ]);
      if (sRes.status === 'fulfilled') setShifts(sRes.value);
      if (rRes.status === 'fulfilled') setRoles(rRes.value);
      return;
    }

    setLoading(true);
    try {
      const [mRes, sRes, rRes] = await Promise.allSettled([
        listTeam(currentWorkspaceId, { limit: LIST_ALL_LIMIT, status: 'all' }),
        listShifts(currentWorkspaceId),
        listRoles(currentWorkspaceId),
      ]);
      if (mRes.status === 'fulfilled') {
        const val = mRes.value;
        // Capture the optional over-limit notice (absent on most responses).
        setMemberCap(val.memberCap ?? null);
        if ((val.pages ?? 1) > 1) {
          setServerMode(true);
          setServerTotal(val.total);
        } else {
          setServerMode(false);
          setMembers(val.members ?? []);
        }
      }
      if (sRes.status === 'fulfilled') setShifts(sRes.value);
      if (rRes.status === 'fulfilled') setRoles(rRes.value);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, serverMode]);

  useEffect(() => {
    if (currentWorkspaceRef.current !== currentWorkspaceId) {
      loadedRef.current = false;
      currentWorkspaceRef.current = currentWorkspaceId;
      // Reset all filters so stale state from the previous workspace doesn't bleed in
      setSearch('');
      setDesignationFilter(null);
      setShiftFilters([]);
      setRoleFilters([]);
      setTablePage(1);
      setStatusFilter('active');
      setStatusCounts(null);
    }
    if (currentWorkspaceId && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!serverMode || !currentWorkspaceId) return;
    const myFetchId = ++fetchIdRef.current;
    setLoading(true);
    listTeam(currentWorkspaceId, {
      page: tablePage,
      limit: tablePageSize,
      search: debouncedSearch || undefined,
      sortBy: serverSortBy,
      sortOrder: serverSortOrder,
      status: statusFilter === 'all' ? undefined : statusFilter,
      filters: {
        ...(shiftFilters.length > 0 ? { shiftId: shiftFilters } : {}),
        ...(roleFilters.length > 0 ? { rbacRoleId: roleFilters } : {}),
      },
    })
      .then((val) => {
        // Ignore if a newer fetch has been issued - prevents stale responses
        // from overwriting current results when the user types quickly.
        if (myFetchId !== fetchIdRef.current) return;
        setMembers(val.members ?? []);
        setServerTotal(val.total);
        setMemberCap(val.memberCap ?? null);
      })
      .catch((e) => {
        if (myFetchId !== fetchIdRef.current) return;
        msgApi.error(parseApiError(e));
      })
      .finally(() => {
        if (myFetchId !== fetchIdRef.current) return;
        setLoading(false);
      });
  }, [
    serverMode,
    currentWorkspaceId,
    tablePage,
    tablePageSize,
    debouncedSearch,
    serverSortBy,
    serverSortOrder,
    serverRefreshKey,
    statusFilter,
    shiftFilters,
    roleFilters,
  ]);

  // Status-bucket counts - refetch whenever the workspace changes or
  // serverRefreshKey ticks (every mutation bumps it via load() or directly).
  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    getTeamStatusCounts(currentWorkspaceId)
      .then((counts) => {
        if (!cancelled) setStatusCounts(counts);
      })
      .catch(() => {
        /* non-fatal - pills fall back to label-only */
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, serverRefreshKey]);

  // Desktop table wrapper - passed to <TableCustomScrollbar> which finds the
  // AntD `.ant-table-content` inside, hides its (unstylable) native scrollbar,
  // and draws our branded draggable bar + wheel-to-horizontal scroll.
  const tableWrapRef = useRef<HTMLDivElement>(null);

  // Client mode: no API call needed - filtering is done in-memory in the filtered variable

  // Handles AntD Table's onChange in server-side mode (pagination + column sort)
  const handleTableChange: NonNullable<TableProps<TeamMember>['onChange']> = useCallback(
    (pag, _filters, sorter) => {
      if (!serverMode) return;
      setSelectedRowKeys([]);
      const s = Array.isArray(sorter) ? sorter[0] : sorter;
      const newPageSize = pag.pageSize ?? tablePageSize;
      if (newPageSize !== tablePageSize) {
        setTablePageSize(newPageSize);
        setTablePage(1); // reset to first page on size change
      } else {
        setTablePage(pag.current ?? 1);
      }
      if (s?.field) {
        setServerSortBy(String(s.field));
        setServerSortOrder(s.order === 'ascend' ? 'asc' : 'desc');
      } else {
        setServerSortBy(undefined);
      }
    },
    [serverMode, tablePageSize],
  );

  const openAdd = useCallback(() => {
    router.push('/dashboard/team/new');
  }, [router]);

  const openEdit = useCallback(
    (m: TeamMember) => {
      router.push(`/dashboard/team/${m.id}?edit=1`);
    },
    [router],
  );

  const openView = useCallback(
    (m: TeamMember) => {
      router.push(`/dashboard/team/${m.id}`);
    },
    [router],
  );

  const handleDelete = async () => {
    if (!currentWorkspaceId || !deleteModal) return;
    try {
      if (deleteModal.isDeleted) {
        await deleteTeamMemberPermanent(currentWorkspaceId, deleteModal.id);
        msgApi.success(t('memberDeletedPermanently'));
      } else {
        await deleteTeamMember(currentWorkspaceId, deleteModal.id);
        msgApi.success(t('memberArchived'));
      }
      setDeleteModal(null);
      setSelectedRowKeys([]);
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } catch (e) {
      // 2026-05-22 defensive UX: BE archive is idempotent server-side now,
      // but if a stale row legitimately 404s (member missing entirely) we
      // surface a friendlier toast and trigger a refresh so the list state
      // re-syncs instead of leaving the owner staring at a raw axios string.
      const status =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 404) {
        msgApi.info(t('memberStaleRefreshing'));
        setDeleteModal(null);
        setSelectedRowKeys([]);
        serverMode ? setServerRefreshKey((k) => k + 1) : load();
        return;
      }
      msgApi.error(parseApiError(e));
    }
  };

  const handleRestore = useCallback(
    async (memberId: string) => {
      if (!currentWorkspaceId) return;
      try {
        await restoreTeamMember(currentWorkspaceId, memberId);
        msgApi.success(t('memberRestored'));
        serverMode ? setServerRefreshKey((k) => k + 1) : load();
      } catch (e) {
        msgApi.error(parseApiError(e));
      }
    },
    [currentWorkspaceId, msgApi, t, serverMode, load],
  );

  const handleBulkDeactivate = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setBulkLoading(true);
    try {
      await bulkUpdateTeamStatus(currentWorkspaceId, {
        memberIds: selectedRowKeys as string[],
        status: 'inactive',
      });
      msgApi.success(t('bulkDeactivated'));
      setSelectedRowKeys([]);
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBulkLoading(false);
    }
  }, [currentWorkspaceId, selectedRowKeys, msgApi, t, serverMode, load]);

  const handleBulkReactivate = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setBulkLoading(true);
    try {
      await bulkUpdateTeamStatus(currentWorkspaceId, {
        memberIds: selectedRowKeys as string[],
        status: 'active',
      });
      msgApi.success(t('bulkReactivated'));
      setSelectedRowKeys([]);
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBulkLoading(false);
    }
  }, [currentWorkspaceId, selectedRowKeys, msgApi, t, serverMode, load]);

  const handleBulkArchive = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setBulkLoading(true);
    try {
      await bulkArchiveTeamMembers(currentWorkspaceId, { memberIds: selectedRowKeys as string[] });
      msgApi.success(t('bulkArchived'));
      setSelectedRowKeys([]);
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBulkLoading(false);
    }
  }, [currentWorkspaceId, selectedRowKeys, msgApi, t, serverMode, load]);

  const handleBulkRestore = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setBulkLoading(true);
    try {
      await bulkRestoreTeamMembers(currentWorkspaceId, { memberIds: selectedRowKeys as string[] });
      msgApi.success(t('bulkRestored'));
      setSelectedRowKeys([]);
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBulkLoading(false);
    }
  }, [currentWorkspaceId, selectedRowKeys, msgApi, t, serverMode, load]);

  // Bulk permanent delete (archived members only). The backend exposes a
  // per-member permanent-delete route, so fan out one request per selected
  // id and tolerate partial failures (e.g. a row already removed elsewhere)
  // rather than aborting the whole batch on the first rejection.
  const handleBulkDeletePermanent = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setBulkLoading(true);
    // Promise.allSettled never rejects, so per-row failures are read off the
    // results array rather than caught - a partial failure (e.g. one row
    // already removed elsewhere) still reports the rest as deleted.
    try {
      const ids = selectedRowKeys as string[];
      const results = await Promise.allSettled(
        ids.map((id) => deleteTeamMemberPermanent(currentWorkspaceId, id)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const ok = results.length - failed;
      if (failed === 0) {
        msgApi.success(t('bulkDeletedPermanently'));
      } else {
        msgApi.warning(t('bulkDeletePartial', { ok, failed }));
      }
      setSelectedRowKeys([]);
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } finally {
      setBulkLoading(false);
    }
  }, [currentWorkspaceId, selectedRowKeys, msgApi, t, serverMode, load]);

  const handleDeactivate = async () => {
    if (!currentWorkspaceId || !deactivateModal) return;
    try {
      await updateTeamMember(currentWorkspaceId, deactivateModal.id, {
        isActive: false,
      });
      msgApi.success(t('deactivated'));
      setDeactivateModal(null);
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleReactivate = useCallback(
    async (memberId: string) => {
      if (!currentWorkspaceId) return;
      try {
        await updateTeamMember(currentWorkspaceId, memberId, {
          isActive: true,
        });
        msgApi.success(t('reactivated'));
        serverMode ? setServerRefreshKey((k) => k + 1) : load();
      } catch (e) {
        msgApi.error(parseApiError(e));
      }
    },
    [currentWorkspaceId, msgApi, t, serverMode, load],
  );

  const handleResign = async (vals: {
    dateOfResignation: dayjs.Dayjs;
    resignationNote?: string;
  }) => {
    if (!currentWorkspaceId || !resignModal) return;
    try {
      await offboardMember(currentWorkspaceId, resignModal.id, {
        lastWorkingDate: vals.dateOfResignation.format('YYYY-MM-DD'),
        resignationNote: vals.resignationNote,
      });
      msgApi.success(t('offboarded'));
      setResignModal(null);
      resignForm.resetFields();
      serverMode ? setServerRefreshKey((k) => k + 1) : load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleCancelOffboard = useCallback(
    async (memberId: string) => {
      if (!currentWorkspaceId) return;
      try {
        await updateTeamMember(currentWorkspaceId, memberId, {
          dateOfResignation: undefined,
          resignationNote: undefined,
        });
        msgApi.success(t('offboardCancelled'));
        serverMode ? setServerRefreshKey((k) => k + 1) : load();
      } catch (e) {
        msgApi.error(parseApiError(e));
      }
    },
    [currentWorkspaceId, msgApi, t, serverMode, load],
  );

  // Members passing every active filter EXCEPT the designation chip. This is
  // the facet base: the designation chip counts derive from it, so the number
  // on each chip always matches the rows that appear once the chip is applied
  // (counts reflect the active status / search / shift / role). Server mode
  // returns the current page as-is - designation chips are hidden there.
  const nonDesignationFiltered = useMemo(() => {
    if (serverMode) return members;
    const q = debouncedSearch.toLowerCase();
    const nowTs = Date.now();
    return members.filter((m) => {
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.mobile?.includes(debouncedSearch) ||
        m.designation?.toLowerCase().includes(q) ||
        m.employeeCode?.toLowerCase().includes(q);
      if (!matchSearch) return false;
      const matchShift =
        shiftFilters.length === 0 || (m.shift && shiftFilters.includes(m.shift.id));
      if (!matchShift) return false;
      const matchRole =
        roleFilters.length === 0 ||
        (m.role &&
          (roleFilters.includes((m.role as { _id?: string; id?: string })?.id || '') ||
            roleFilters.includes((m.role as { _id?: string; id?: string })?._id || '')));
      if (!matchRole) return false;
      const resignTs = m.dateOfResignation ? new Date(m.dateOfResignation).getTime() : 0;
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? m.isActive && !(resignTs > nowTs)
            : statusFilter === 'offboarding'
              ? m.isActive && resignTs > nowTs
              : statusFilter === 'inactive'
                ? !m.isActive && !m.isDeleted
                : statusFilter === 'archived'
                  ? m.isDeleted
                  : false;
      return matchStatus;
    });
  }, [serverMode, members, debouncedSearch, shiftFilters, roleFilters, statusFilter]);

  // Designation chips - counts come from the facet base (above) so they stay in
  // sync with the other active filters. Only designations present in the current
  // context are offered, so empty chips don't linger after a status switch.
  const designationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of nonDesignationFiltered) {
      const d = m.designation;
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
  }, [nonDesignationFiltered]);
  // Offer the designations present in the current context (count > 0), plus the
  // currently-selected one even when the active status/search now yields zero of
  // it - otherwise its chip would vanish while the filter stays applied, leaving
  // no way to toggle it back off (stranded filter -> empty table).
  const designations = useMemo(() => {
    const present = Object.keys(designationCounts);
    if (designationFilter && !present.includes(designationFilter)) {
      return [...present, designationFilter];
    }
    return present;
  }, [designationCounts, designationFilter]);

  // In server mode the API already applied search/sort/pagination - use members
  // as-is. In client mode the designation chip is the only filter not folded
  // into the facet base, so apply it here on top of nonDesignationFiltered.
  const filtered = useMemo(() => {
    if (serverMode) return members;
    return nonDesignationFiltered.filter(
      (m) => !designationFilter || m.designation === designationFilter,
    );
  }, [serverMode, members, nonDesignationFiltered, designationFilter]);

  const selectedMembers = useMemo(
    () => filtered.filter((m) => selectedRowKeys.includes(m.id)),
    [filtered, selectedRowKeys],
  );
  const selectionMode: SelectionMode = useMemo(() => {
    if (selectedRowKeys.length === 0 || selectedMembers.length === 0) return 'empty';
    if (selectedMembers.every((m) => m.isDeleted)) return 'all-archived';
    if (selectedMembers.every((m) => m.isActive && !m.isDeleted)) return 'all-active';
    if (selectedMembers.every((m) => !m.isActive && !m.isDeleted)) return 'all-inactive';
    return 'mixed';
  }, [selectedRowKeys, selectedMembers]);

  // §7 Part B (read side) - gate the Salary column to mirror the BE read-filter
  // (`crewroster-backend/src/modules/team/team-read-filter.ts`): only an
  // `all`-scoped pay viewer (or owner) may see every member's salary. Without
  // this a server-stripped `salaryAmount` renders as a misleading ₹0. (Self-
  // scoped members are redirected away by TeamPage, so this list is always
  // owner / all-scoped.)
  const { canPath, data: myPerms } = useMyPermissions();
  const canViewSalaryColumn = !!myPerms?.isOwner || canPath('team.profile.pay.view', 'all');
  // Access managers + owner get the workspace Team Activity log entry point.
  const canViewActivity = !!myPerms?.isOwner || canPath('team.appAccess.manage', 'all');
  // Permanent (irreversible) delete is split from archive: owner-only by
  // default; a manager may archive (team.member.delete) but needs the separate
  // team.member.delete_permanent grant to permanently delete.
  const canDeletePermanent = !!myPerms?.isOwner || canPath('team.member.delete_permanent');

  // Bulk ID-card download for the current selection. Read-only export (no
  // mutation) so it is NOT PIN-gated, mirroring the existing Export action.
  // Declared after `selectedMembers` to avoid a TDZ reference. -> lib/export/
  // generateIdCardPdf.
  const handleBulkIdCards = useCallback(async () => {
    if (selectedMembers.length === 0) return;
    setBulkLoading(true);
    try {
      await generateIdCardsPdf(
        selectedMembers.map((m) => ({
          name: m.name,
          employeeCode: m.employeeCode,
          designation: m.designation,
          bloodGroup: m.bloodGroup,
          emergencyContactName: m.emergencyContactName,
          emergencyContactNumber: m.emergencyContactNumber,
          location: m.location,
          avatar: m.avatar,
        })),
        {
          workspaceName: currentWorkspace?.name ?? 'ManekHR',
          logoUrl: currentWorkspace?.branding?.pdfHeaderLogo ?? currentWorkspace?.branding?.logo,
          // Owner-uploaded light background watermark + company address (SSOT).
          backgroundUrl: currentWorkspace?.branding?.idCardBackground,
          companyAddress: currentWorkspace?.address,
        },
      );
    } catch (e) {
      msgApi.error(parseApiError(e) ?? 'Could not generate ID cards.');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedMembers, currentWorkspace, msgApi]);

  // Per-member action menu (the row / card kebab). Single source of truth
  // shared by the desktop table Actions column AND the mobile card list, so the
  // lifecycle actions + their permission/state gating stay identical on both.
  // Cross-links: setDeleteModal / setResignModal / setDeactivateModal /
  // setAccessModal (modals below), handleRestore / handleReactivate /
  // handleCancelOffboard / handleSendLatestPayslip (mutations above).
  const buildMemberMenuItems = useCallback(
    (m: TeamMember): MenuProps['items'] => {
      const handleDeleteMember = () => setDeleteModal(m);
      if (m.isDeleted) {
        return [
          {
            key: 'restore',
            icon: <UndoOutlined />,
            label: t('restore'),
            onClick: () => handleRestore(m.id),
          },
          ...(canDeletePermanent
            ? [
                { type: 'divider' as const, key: 'divider' },
                {
                  key: 'deletePermanent',
                  icon: <DeleteOutlined style={{ color: 'var(--cr-danger-700)' }} />,
                  label: (
                    <Tooltip placement="left" title={t('lifecycleHelp.deletePermanently')}>
                      <span className="text-red-700">{t('deletePermanently')}</span>
                    </Tooltip>
                  ),
                  onClick: handleDeleteMember,
                },
              ]
            : []),
        ];
      }
      if (m.isActive) {
        const accessNone = !m.hasAppAccess && m.appAccessStatus !== 'invited';
        return [
          ...(accessNone
            ? [
                {
                  key: 'grantAccess',
                  icon: <KeyOutlined />,
                  label: t('grantAccess'),
                  onClick: () => setAccessModal(m),
                },
                { type: 'divider' as const, key: 'grant-divider' },
              ]
            : []),
          ...(m.dateOfResignation && new Date(m.dateOfResignation) > new Date()
            ? [
                {
                  key: 'cancelOffboard',
                  icon: <StopOutlined style={{ transform: 'rotate(180deg)' }} />,
                  label: t('cancelOffboard'),
                  onClick: () => handleCancelOffboard(m.id),
                },
              ]
            : []),
          ...(!(m.dateOfResignation && new Date(m.dateOfResignation) > new Date())
            ? [
                {
                  key: 'offboard',
                  icon: <CalendarOutlined />,
                  label: t('setLastWorkingDay'),
                  onClick: () => setResignModal(m),
                },
              ]
            : []),
          {
            key: 'deactivate',
            icon: <StopOutlined />,
            label: (
              <Tooltip placement="left" title={t('lifecycleHelp.deactivate')}>
                <span>{t('deactivate')}</span>
              </Tooltip>
            ),
            onClick: () => setDeactivateModal(m),
          },
          ...(payslipGeneration.enabled && payslipEmail.enabled
            ? [
                {
                  key: 'sendLatestPayslip',
                  icon: <MailOutlined />,
                  label: (() => {
                    const quota = monthlyTaskStatus?.emailQuota;
                    const quotaExhausted = quota && quota.limit > 0 && quota.used >= quota.limit;
                    const tooltipMsg = quotaExhausted
                      ? t('monthlyEmailLimitReached', { used: quota.used, limit: quota.limit })
                      : !m.email
                        ? t('noEmailOnFile')
                        : undefined;
                    return (
                      <Tooltip title={tooltipMsg}>
                        <span>{t('sendLatestPayslip')}</span>
                      </Tooltip>
                    );
                  })(),
                  disabled:
                    !m.email ||
                    sendingPayslipFor === m.id ||
                    !!(
                      monthlyTaskStatus?.emailQuota.limit &&
                      monthlyTaskStatus.emailQuota.used >= monthlyTaskStatus.emailQuota.limit
                    ),
                  onClick: () => handleSendLatestPayslip(m),
                },
              ]
            : []),
          { type: 'divider' as const, key: 'divider' },
          {
            key: 'archive',
            icon: <InboxOutlined />,
            label: (
              <Tooltip placement="left" title={t('lifecycleHelp.archive')}>
                <span>{t('archive')}</span>
              </Tooltip>
            ),
            onClick: handleDeleteMember,
          },
        ];
      }
      return [
        {
          key: 'reactivate',
          icon: <StopOutlined style={{ transform: 'rotate(180deg)' }} />,
          label: t('reactivate'),
          onClick: () => handleReactivate(m.id),
        },
        { type: 'divider' as const, key: 'divider' },
        {
          key: 'archive',
          icon: <InboxOutlined />,
          label: (
            <Tooltip placement="left" title={t('lifecycleHelp.archive')}>
              <span>{t('archive')}</span>
            </Tooltip>
          ),
          onClick: handleDeleteMember,
        },
      ];
    },
    [
      t,
      canDeletePermanent,
      handleRestore,
      handleCancelOffboard,
      handleReactivate,
      handleSendLatestPayslip,
      payslipGeneration,
      payslipEmail,
      monthlyTaskStatus,
      sendingPayslipFor,
    ],
  );

  const columns = useMemo<ColumnsType<TeamMember>>(
    () => [
      {
        title: t('member'),
        dataIndex: 'name',
        key: 'name',
        fixed: 'left',
        width: 220,
        sorter: (a, b) => a.name.localeCompare(b.name),
        defaultSortOrder: 'ascend',
        render: (name, m) => (
          <div className="flex cursor-pointer items-center gap-2.5" onClick={() => openView(m)}>
            <DsAvatar name={name} size={36} src={m.avatar} />
            <div>
              <p className="font-semibold text-gray-900">{name}</p>
              <p className="text-xs text-gray-700">{m.designation ?? 'No role assigned'}</p>
            </div>
          </div>
        ),
      },
      {
        title: t('employeeCode'),
        dataIndex: 'employeeCode',
        key: 'employeeCode',
        width: 120,
        align: 'center',
        render: (v: string | undefined) =>
          v ? (
            <span className="font-mono text-xs font-medium text-gray-700">{v}</span>
          ) : (
            <span className="text-faint">-</span>
          ),
      },
      {
        title: t('mobile'),
        dataIndex: 'mobile',
        key: 'mobile',
        width: 160,
        align: 'center',
        render: (v: string | undefined, m: TeamMember) => {
          if (!v) return <span className="text-faint"> - </span>;
          // Phase 1f (2026-05-21): surface an "unverified" pill next to the
          // mobile when the member's row carries no `mobileVerifiedAt`. The
          // pill is informational only; users can still operate on the row.
          // The tag is BE-served so the column updates automatically once an
          // invite acceptance or follow-up OTP flow flips the timestamp.
          const isVerified = !!m.mobileVerifiedAt;
          const verifiedTooltip = m.mobileVerifiedAt
            ? `${t('mobileBadge.verifiedLabel')} (${new Date(m.mobileVerifiedAt).toLocaleDateString()})`
            : t('mobileBadge.verifiedLabel');
          return (
            <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
              <span className="tabular-nums">{v}</span>
              {isVerified ? (
                /* Phase 1f verified-state badge in list view (2026-05-22).
                   Small green check icon, NOT a full pill. Verified is the
                   expected state at scale; a pill on every row clutters the
                   table. Icon-only keeps the row clean while still giving
                   the owner a visible trust signal + a date tooltip on
                   hover for audit purposes. */
                <Tooltip title={verifiedTooltip}>
                  <CheckCircleFilled
                    aria-label={t('mobileBadge.verifiedLabel')}
                    className="text-[12px] text-[var(--cr-success-600,#16a34a)]"
                  />
                </Tooltip>
              ) : (
                <Tooltip title={t('mobileBadge.unverifiedTooltip')}>
                  <Tag
                    color="default"
                    className="m-0 px-1.5 py-0 text-[10px] leading-4"
                    aria-label={t('mobileBadge.unverifiedAriaLabel')}
                  >
                    {t('mobileBadge.unverifiedLabel')}
                  </Tag>
                </Tooltip>
              )}
            </span>
          );
        },
      },
      {
        title: t('email'),
        dataIndex: 'email',
        key: 'email',
        width: 200,
        align: 'center',
        ellipsis: true,
        render: (v) => v ?? <span className="text-faint"> - </span>,
      },
      {
        title: 'Shift',
        key: 'shift',
        width: 140,
        align: 'center' as const,
        render: (_: unknown, m: TeamMember) =>
          m.shift ? (
            <span
              className="inline-flex min-w-[88px] items-center justify-center rounded px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: m.shift.color + '20',
                color: `color-mix(in srgb, ${m.shift.color} 60%, black)`,
              }}
            >
              {m.shift.name}
            </span>
          ) : (
            <span className="text-faint">-</span>
          ),
      },
      {
        title: t('salary'),
        key: 'salary',
        hidden: !canViewSalaryColumn,
        width: 160,
        sorter: (a, b) => Number(a.salaryAmount ?? 0) - Number(b.salaryAmount ?? 0),
        render: (_, m) => {
          const isHourly = m.salaryType === 'hourly';
          const baseLabel = (
            <span className="font-semibold">
              ₹{Number(m.salaryAmount ?? 0).toLocaleString('en-IN')}{' '}
              <span className="text-[11px] text-subtle">/{isHourly ? 'hr' : 'mo'}</span>
            </span>
          );
          if (!isHourly) return baseLabel;
          // For hourly employees, also surface the approximate monthly
          // equivalent so the list matches the detail/payslip view (which
          // resolves to the same monthly figure via resolveEffectiveMonthlySalary).
          const monthly = resolveEffectiveMonthlySalary(m);
          if (!monthly || monthly <= 0) return baseLabel;
          // Compact form: ₹72k / ₹1.2L for readability in a narrow column.
          const monthlyShort =
            monthly >= 100000
              ? `₹${(monthly / 100000).toFixed(monthly >= 1000000 ? 0 : 1)}L`
              : monthly >= 1000
                ? `₹${Math.round(monthly / 1000)}k`
                : `₹${Math.round(monthly)}`;
          return (
            <span className="font-semibold whitespace-nowrap">
              ₹{Number(m.salaryAmount ?? 0).toLocaleString('en-IN')}{' '}
              <span className="text-[11px] text-subtle">/hr</span>
              <span className="text-[11px] text-subtle"> · ~{monthlyShort}/mo</span>
            </span>
          );
        },
      },
      {
        title: t('status'),
        dataIndex: 'isActive',
        key: 'active',
        width: 100,
        align: 'center',
        sorter: (a, b) => {
          if (a.dateOfResignation && a.isActive && new Date(a.dateOfResignation) > new Date())
            return 1;
          if (b.dateOfResignation && b.isActive && new Date(b.dateOfResignation) > new Date())
            return -1;
          return Number(b.isActive) - Number(a.isActive);
        },
        render: (v, m) => {
          const hasNoticePeriod =
            v && m.dateOfResignation && new Date(m.dateOfResignation) > new Date();
          if (hasNoticePeriod) {
            return (
              <DsTag
                status="warning"
                label={t('noticePeriod')}
                style={{ minWidth: 76, textAlign: 'center' }}
              />
            );
          }
          return (
            <DsTag
              status={v ? 'active' : 'inactive'}
              style={{ minWidth: 76, textAlign: 'center' }}
            />
          );
        },
      },
      {
        title: t('joined'),
        dataIndex: 'dateOfJoining',
        key: 'joined',
        width: 110,
        align: 'center',
        sorter: (a, b) => (a.dateOfJoining ?? '').localeCompare(b.dateOfJoining ?? ''),
        render: (v) => (v ? fmt(v) : <span className="text-faint"> - </span>),
      },
      ...(payslipEmail.enabled
        ? [
            {
              title: 'Payslip',
              key: 'payslipEmail',
              width: 90,
              align: 'center' as const,
              render: (_: unknown, m: TeamMember) => {
                const memberStatus = monthlyTaskStatus?.payslipEmails.members.find(
                  (ms) => ms.teamMemberId === m.id,
                );
                if (!memberStatus) return <span className="text-faint">-</span>;
                if (memberStatus.payslipEmailSentAt) {
                  return (
                    <Tooltip title={`Sent ${fmt(memberStatus.payslipEmailSentAt)}`}>
                      <CheckCircleOutlined className="text-base text-green-700" />
                    </Tooltip>
                  );
                }
                return (
                  <Tooltip title="Not sent this month">
                    <MailOutlined className="text-base text-faint" />
                  </Tooltip>
                );
              },
            },
          ]
        : []),
      {
        title: tCommon('actions'),
        key: 'actions',
        fixed: 'right',
        width: 100,
        align: 'center' as const,
        render: (_, m) => {
          const handleViewDetails = () => openView(m);
          const handleEditMember = () => openEdit(m);

          const menuItems = buildMemberMenuItems(m);

          return (
            <div className="flex items-center justify-end gap-2">
              {/* Hover-revealed primary actions. Visible on row hover, always
                  visible on touch (coarse pointer) and when a child button has
                  keyboard focus (focus-within). */}
              <span className="row-actions-secondary inline-flex items-center gap-1">
                <Tooltip title={tCommon('viewDetails')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    aria-label={tCommon('viewDetails')}
                    className="text-faint transition-colors hover:text-gray-900"
                    onClick={handleViewDetails}
                  />
                </Tooltip>

                {m.isActive && (
                  <Tooltip title={tCommon('edit')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label={tCommon('edit')}
                      className="text-faint transition-colors hover:text-gray-900"
                      onClick={handleEditMember}
                    />
                  </Tooltip>
                )}
              </span>

              {/* Always-visible overflow */}
              <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  aria-label={tCommon('more')}
                  className="text-faint transition-colors hover:text-gray-900"
                />
              </Dropdown>
            </div>
          );
        },
      },
    ],
    [
      t,
      tCommon,
      canViewSalaryColumn,
      canDeletePermanent,
      openView,
      openEdit,
      buildMemberMenuItems,
      handleRestore,
      handleReactivate,
      handleCancelOffboard,
      handleSendLatestPayslip,
      sendingPayslipFor,
      payslipGeneration,
      payslipEmail,
      monthlyTaskStatus,
    ],
  );

  /**
   * Human-readable summary of currently active filters.
   * Passed to ExportButton and forwarded to the PDF generator.
   * Returns undefined when no filters are active.
   */
  const filterSummary: string | undefined = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== 'all') parts.push(`Status: ${statusFilter}`);
    if (debouncedSearch) parts.push(`Search: "${debouncedSearch}"`);
    if (designationFilter) parts.push(`Designation: ${designationFilter}`);
    if (shiftFilters.length > 0) {
      const shiftNames = shifts
        .filter((s) => shiftFilters.includes(s._id))
        .map((s) => s.name)
        .join(', ');
      if (shiftNames) parts.push(`Shift: ${shiftNames}`);
    }
    if (roleFilters.length > 0) {
      const roleNames = roles
        .filter((r) => roleFilters.includes(r._id))
        .map((r) => r.name)
        .join(', ');
      if (roleNames) parts.push(`Role: ${roleNames}`);
    }
    return parts.length > 0 ? parts.join(' | ') : undefined;
  }, [statusFilter, debouncedSearch, designationFilter, shiftFilters, roleFilters, shifts, roles]);

  /**
   * DEV FLAG: Set to true to force the server-fetch path even when
   * serverMode is false. Lets you QA the server-mode export branch without
   * needing a workspace with > LIST_ALL_LIMIT members.
   * MUST be false before merging to production.
   */
  const IS_FORCE_SERVER_FETCH = false;

  /**
   * Returns all data rows to export, respecting active filters.
   * Client mode: returns the already-filtered local array.
   * Server mode: re-fetches all pages from the API.
   */
  const getExportData = useCallback(async (): Promise<TeamMember[]> => {
    if (!serverMode && !IS_FORCE_SERVER_FETCH) {
      return filtered;
    }
    // Server mode: paginate in chunks of 1000 (backend enforces @Max(1000) on limit)
    const PAGE_SIZE = 1000;
    let page = 1;
    let allRows: TeamMember[] = [];
    while (true) {
      const res = await listTeam(currentWorkspaceId!, {
        limit: PAGE_SIZE,
        page,
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        filters: {
          ...(shiftFilters.length > 0 ? { shiftId: shiftFilters } : {}),
          ...(roleFilters.length > 0 ? { rbacRoleId: roleFilters } : {}),
        },
      });
      const batch = res.members ?? [];
      allRows = [...allRows, ...batch];
      if (allRows.length >= res.total || batch.length < PAGE_SIZE) break;
      page++;
    }
    let rows = allRows;
    if (designationFilter) rows = rows.filter((m) => m.designation === designationFilter);
    return rows;
  }, [
    serverMode,
    filtered,
    currentWorkspaceId,
    debouncedSearch,
    statusFilter,
    shiftFilters,
    roleFilters,
    designationFilter,
  ]);

  const hasActiveFilters =
    !!debouncedSearch || !!designationFilter || shiftFilters.length > 0 || roleFilters.length > 0;
  const clearFilters = useCallback(() => {
    setSearch('');
    setDesignationFilter(null);
    setShiftFilters([]);
    setRoleFilters([]);
  }, []);

  // Stable refs for DsTable so rapid keystrokes don't force AntD Table to
  // reconcile on new prop references every render.
  const handleTableSelectionChange = useCallback((keys: Key[]) => {
    setSelectedRowKeys(keys);
  }, []);
  const tableLocale = useMemo(
    () => ({
      emptyText:
        hasActiveFilters && filtered.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <span className="mb-3 text-gray-700">{t('noMembersMatchFilters')}</span>
            <Button type="link" onClick={clearFilters}>
              {t('clearFilters')}
            </Button>
          </div>
        ) : undefined,
    }),
    [hasActiveFilters, filtered.length, clearFilters],
  );
  const tablePagination = useMemo(
    () =>
      serverMode
        ? {
            total: serverTotal,
            current: tablePage,
            pageSize: tablePageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '25', '50'],
            showTotal: (total: number, range: [number, number]) =>
              `${range[0]}–${range[1]} of ${total}`,
          }
        : undefined,
    [serverMode, serverTotal, tablePage, tablePageSize],
  );
  const onClearBulkSelection = useCallback(() => setSelectedRowKeys([]), []);
  const bulkActions = useMemo(
    () => [
      // ID cards - read-only export, enabled for any selection (no enabledFor),
      // no confirm/PIN. Always first so it's reachable regardless of status mix.
      {
        key: 'bulk-id-cards',
        label: 'ID cards',
        icon: <IdcardOutlined />,
        onClick: handleBulkIdCards,
      },
      {
        key: 'bulk-reactivate',
        label: t('reactivate'),
        icon: <CheckCircleOutlined />,
        enabledFor: ['all-inactive'] as SelectionMode[],
        disabledTooltip: !canBulkRestore ? t('upgradeRequired') : t('selectSameStatusForBulk'),
        confirmTitle: () => t('bulkReactivateConfirm', { count: selectedRowKeys.length }),
        onClick: handleBulkReactivate,
      },
      {
        key: 'bulk-deactivate',
        label: t('deactivate'),
        icon: <StopOutlined />,
        enabledFor: ['all-active'] as SelectionMode[],
        disabledTooltip: !canBulkDeactivate ? t('upgradeRequired') : t('selectSameStatusForBulk'),
        confirmTitle: () => t('bulkDeactivateConfirm', { count: selectedRowKeys.length }),
        onClick: handleBulkDeactivate,
      },
      {
        key: 'bulk-archive',
        label: t('archive'),
        icon: <InboxOutlined />,
        enabledFor: ['all-active', 'all-inactive'] as SelectionMode[],
        disabledTooltip: !canBulkArchive ? t('upgradeRequired') : t('selectSameStatusForBulk'),
        confirmTitle: () => t('bulkArchiveConfirm', { count: selectedRowKeys.length }),
        confirmDescription: () => t('bulkArchiveDesc'),
        onClick: handleBulkArchive,
      },
      {
        key: 'bulk-restore',
        label: t('restore'),
        icon: <UndoOutlined />,
        enabledFor: ['all-archived'] as SelectionMode[],
        disabledTooltip: !canBulkRestore ? t('upgradeRequired') : t('selectArchivedForBulk'),
        confirmTitle: () => t('bulkRestoreConfirm', { count: selectedRowKeys.length }),
        onClick: handleBulkRestore,
      },
      // Permanent (irreversible) bulk delete - archived selection only, and
      // only for owners / holders of the dedicated delete_permanent grant,
      // mirroring the per-row overflow menu. Hidden entirely without the grant
      // so we never show an action the caller can't perform.
      ...(canDeletePermanent
        ? [
            {
              key: 'bulk-delete',
              label: t('deletePermanently'),
              icon: <DeleteOutlined />,
              danger: true,
              enabledFor: ['all-archived'] as SelectionMode[],
              disabledTooltip: t('selectArchivedForBulk'),
              confirmTitle: () => t('bulkDeleteConfirm', { count: selectedRowKeys.length }),
              confirmDescription: () => t('bulkDeleteDesc'),
              onClick: handleBulkDeletePermanent,
            },
          ]
        : []),
    ],
    [
      t,
      canBulkRestore,
      canBulkDeactivate,
      canBulkArchive,
      canDeletePermanent,
      selectedRowKeys.length,
      handleBulkIdCards,
      handleBulkReactivate,
      handleBulkDeactivate,
      handleBulkArchive,
      handleBulkRestore,
      handleBulkDeletePermanent,
    ],
  );

  // ── KPI computations ──────────────────────────────────────────────────
  // Status-bucket counts (active / offboarding / inactive / archived / all)
  // come from the server via `statusCounts` so they stay accurate in both
  // client and server modes.
  //
  // `onboardingCount` and `missingPayrollCount` remain client-computed from
  // `members` because they depend on per-member fields (joining date, bank
  // details, UPI). In server mode these are partial (scoped to the current
  // page) - matches the previous behavior. KPI cards continue to render them
  // as soft-stat hints, not authoritative totals.
  const { onboardingCount, missingPayrollCount } = useMemo(() => {
    const nowTs = Date.now();
    const thirtyDaysAgoTs = nowTs - 30 * 24 * 60 * 60 * 1000;
    let onboarding = 0;
    let missingPayroll = 0;
    for (const m of members) {
      if (!m.isActive || m.isDeleted) continue;
      const resignTs = m.dateOfResignation ? new Date(m.dateOfResignation).getTime() : 0;
      const isOffboarding = resignTs > nowTs;
      if (m.dateOfJoining && new Date(m.dateOfJoining).getTime() > thirtyDaysAgoTs) {
        onboarding += 1;
      }
      if (!isOffboarding) {
        const mm = m as unknown as {
          bankDetails?: { accountNumber?: string };
          upiDetails?: { upiId?: string };
        };
        if (!m.salaryAmount || (!mm.bankDetails?.accountNumber && !mm.upiDetails?.upiId)) {
          missingPayroll += 1;
        }
      }
    }
    return { onboardingCount: onboarding, missingPayrollCount: missingPayroll };
  }, [members]);
  const activeCount = statusCounts?.active ?? 0;
  const offboardingCount = statusCounts?.offboarding ?? 0;
  const inactiveCount = statusCounts?.inactive ?? 0;
  const archivedCount = statusCounts?.archived ?? 0;
  const allCount = statusCounts?.all ?? (serverMode ? serverTotal : members.length);
  const totalCount = statusCounts?.all ?? (serverMode ? serverTotal : members.length);

  return (
    <>
      {/* Outer rhythm = 16px between hero section and table card.
          Hero section groups header / alert / stats with gap-4 (16px)
          so this keeps a uniform vertical cadence across the whole
          page; table card's own padding + rounded corners give it
          sufficient visual separation as a module. Payslips banner
          lives INSIDE the table card as a table-chrome row - it
          describes "this month's payslip status for THESE members"
          and so belongs adjacent to the member list, not as a free-
          floating callout in the hero zone. */}
      <div className="space-y-4">
        {/* ── Page header + alerts + KPI tiles (grouped, 20px rhythm) ──
            Canonical admin-page header pattern (reference for other modules):
            • Modest H1 (22-24px), no display/poster scale
            • Compact metadata sub-line replaces prose description
            • Action zone top-right: secondary icon → primary CTA → kebab
            • One primary CTA per page (Add member). Tertiary actions live
              in the kebab overflow. */}
        <section className="flex flex-col gap-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="m-0 font-display text-[20px] leading-[1.25] font-semibold text-heading">
                {t('title')}
              </h1>
              <p className="m-0 mt-1 text-[12px] text-subtle">
                {totalCount} {totalCount === 1 ? 'member' : 'members'}
                {' · '}
                {activeCount} active
                {offboardingCount > 0 && ` · ${offboardingCount} offboarding`}
              </p>
            </div>
            {/* ── Desktop action toolbar (sm+) ── the canonical inline row:
                Activity / Export / Bulk upload / Add member / kebab. */}
            <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
              {canViewActivity && (
                <Tooltip title={t('railActivityDesc')}>
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={() => router.push('/dashboard/team/activity')}
                  >
                    {t('railActivityLabel')}
                  </Button>
                </Tooltip>
              )}
              {!canExportTeam ? (
                <Tooltip title={t('upgradeRequired')}>
                  <span>
                    <ExportButton
                      fields={TEAM_EXPORT_FIELDS}
                      getExportData={getExportData}
                      title="Team Members"
                      filename="manekhr_team"
                      filterSummary={filterSummary}
                      disabled={loading}
                      module="team"
                      _forceServerModeFetch={IS_FORCE_SERVER_FETCH}
                    />
                  </span>
                </Tooltip>
              ) : (
                <ExportButton
                  fields={TEAM_EXPORT_FIELDS}
                  getExportData={getExportData}
                  title="Team Members"
                  filename="manekhr_team"
                  filterSummary={filterSummary}
                  disabled={loading || !canExportTeam}
                  module="team"
                  _forceServerModeFetch={IS_FORCE_SERVER_FETCH}
                />
              )}
              <Tooltip title={!canAddMember ? t('upgradeRequired') : 'Import members from a CSV'}>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setBulkImportOpen(true)}
                  disabled={!canAddMember}
                >
                  Bulk upload
                </Button>
              </Tooltip>
              <Tooltip
                title={
                  <span className="flex items-center gap-1.5">
                    Add member
                    <kbd className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] leading-none">
                      N
                    </kbd>
                  </span>
                }
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  className="cr-cta-gold"
                  onClick={openAdd}
                  disabled={!canAddMember}
                  data-shortcut="team-add"
                >
                  Add member
                </Button>
              </Tooltip>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'employee-code',
                      icon: <SettingOutlined />,
                      label: 'Employee Code Settings',
                      onClick: () => router.push('/dashboard/workspace/employee-code'),
                    },
                  ],
                }}
              >
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  aria-label="More page actions"
                  className="text-muted"
                />
              </Dropdown>
            </div>

            {/* ── Mobile action block (< sm) ── full-width primary CTA on top,
                then an even 2-column grid of the secondary actions so they read
                as one tidy, equal-width group instead of wrapping unevenly.
                Settings (employee-code) is surfaced as a real button here rather
                than buried in a kebab, per the "show the actions" intent. */}
            <div className="flex w-full flex-col gap-2 sm:hidden">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="cr-cta-gold w-full"
                onClick={openAdd}
                disabled={!canAddMember}
              >
                Add member
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {canViewActivity && (
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={() => router.push('/dashboard/team/activity')}
                    className="w-full"
                  >
                    {t('railActivityLabel')}
                  </Button>
                )}
                {/* ExportButton has no className prop, so the wrapper (the grid
                    cell) forces its inner button full-width. */}
                <div className="[&_button]:w-full">
                  <ExportButton
                    fields={TEAM_EXPORT_FIELDS}
                    getExportData={getExportData}
                    title="Team Members"
                    filename="manekhr_team"
                    filterSummary={filterSummary}
                    disabled={loading || !canExportTeam}
                    module="team"
                    _forceServerModeFetch={IS_FORCE_SERVER_FETCH}
                  />
                </div>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setBulkImportOpen(true)}
                  disabled={!canAddMember}
                  className="w-full"
                >
                  Bulk upload
                </Button>
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => router.push('/dashboard/workspace/employee-code')}
                  className="w-full"
                >
                  Code settings
                </Button>
              </div>
            </div>
          </header>

          {/* ── Critical alert banner ───────────────────────────────────
            Only renders when an attention-required signal exists.
            Pattern reusable: red bordered strip + icon + headline + action
            link. Reserve for module-blocking issues (here: missing payroll
            data that could block pay run). */}
          {missingPayrollCount > 0 && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 px-4 py-2.5 text-[13px]"
            >
              <ExclamationCircleOutlined className="shrink-0 text-[15px] text-red-600" />
              <span className="font-semibold text-red-900">
                {missingPayrollCount} {missingPayrollCount === 1 ? 'member is' : 'members are'}{' '}
                missing payroll data
              </span>
              <span className="text-red-700/80">· may block this month&rsquo;s pay run.</span>
              <button
                type="button"
                onClick={() => router.push('/dashboard/salary')}
                className="ml-auto text-[12px] font-semibold tracking-wide text-red-700 uppercase transition-colors hover:text-red-900 hover:underline"
              >
                Review &amp; fix →
              </button>
            </div>
          )}

          {/* ── KPI Tiles ───────────────────────────────────────────────
            Flat grid (no card wrapper) so tiles read as part of the page
            rhythm, not a nested module. One tile carries the gold-rail
            emphasis (Active workforce) - the canonical premium moment. */}
          <section>
            {loading && members.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border bg-surface px-5 py-4"
                    style={{ borderColor: 'var(--cr-border-subtle,rgba(0,0,0,0.06))' }}
                  >
                    <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatTile
                  label="Active workforce"
                  value={String(activeCount)}
                  hint="On payroll this month"
                  emphasis
                />
                <StatTile
                  label="Onboarding"
                  value={String(onboardingCount)}
                  hint={onboardingCount > 0 ? 'Joined in last 30 days' : 'No joiners · 30d'}
                />
                <StatTile
                  label="Offboarding"
                  value={String(offboardingCount)}
                  hint={offboardingCount > 0 ? 'Notice period active' : 'No notice periods'}
                />
                <StatTile
                  label="Missing payroll data"
                  value={String(missingPayrollCount)}
                  hint={missingPayrollCount > 0 ? 'May block pay run' : 'All set for pay run'}
                  tone={missingPayrollCount > 0 ? 'danger' : 'neutral'}
                />
              </div>
            )}
          </section>
        </section>

        {/* Capped-report notice - renders only when the workspace is over its
            plan's member limit (post-grace) and the list was server-trimmed.
            -> components/dashboard/MemberCapNotice.tsx. */}
        {memberCap?.capped && (
          <MemberCapNotice
            capped={memberCap.capped}
            visibleCount={memberCap.visibleCount}
            totalCount={memberCap.totalCount}
            limit={memberCap.limit}
          />
        )}

        {/* ── Team Table ─────────────────────────────────────────────── */}
        <DsCard className="overflow-hidden rounded-[28px]" styles={{ body: { padding: 24 } }}>
          {/* ── Payslip cycle row (table chrome) ──────────────────────
              Contextual status callout for "this month's payslip emails
              for THESE members". Edge-to-edge inside the card so it
              reads as table chrome, not a free-floating banner. Negative
              margins break out of DsCard's 24px body padding; parent
              overflow-hidden clips the top corners to match the card
              radius. Only renders when the workspace has the payslip
              email feature enabled and we have a status snapshot. */}
          {payslipEmail.enabled && monthlyTaskStatus && (
            <>
              <button
                type="button"
                onClick={() => setPayslipEmailsDrawerOpen(true)}
                className="-mx-6 -mt-6 mb-5 flex w-[calc(100%+48px)] cursor-pointer items-center gap-3 border-b border-blue-100 bg-blue-50/60 px-6 py-3.5 text-left text-blue-800 transition-colors hover:bg-blue-50"
              >
                <MailOutlined className="shrink-0 text-[16px] text-blue-700" />
                {/* Tappable list-row body: title over counts (stacked on mobile,
                    inline on sm+). The whole row opens the drawer; "View" is the
                    trailing affordance, vertically centered - not wrapped to a
                    lonely second line. */}
                <span className="flex min-w-0 flex-1 flex-col leading-tight sm:flex-row sm:items-center sm:gap-2">
                  <span className="truncate text-[13px] font-semibold">
                    Payslips -{' '}
                    {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="mt-0.5 text-[12px] whitespace-nowrap sm:mt-0">
                    <span className="text-blue-700">
                      {monthlyTaskStatus.payslipEmails.sent}/{monthlyTaskStatus.payslipEmails.total}{' '}
                      sent
                    </span>
                    {monthlyTaskStatus.emailQuota.limit > 0 && (
                      <span className="text-blue-700/70">
                        {' · '}Quota {monthlyTaskStatus.emailQuota.used}/
                        {monthlyTaskStatus.emailQuota.limit}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tracking-wide text-primary uppercase">
                  View
                  <span aria-hidden>→</span>
                </span>
              </button>
              <PayslipEmailsDrawer
                open={payslipEmailsDrawerOpen}
                onClose={() => setPayslipEmailsDrawerOpen(false)}
                data={monthlyTaskStatus}
                month={new Date().getMonth() + 1}
                year={new Date().getFullYear()}
                workspaceId={currentWorkspaceId ?? ''}
                onRefetch={fetchMonthlyTaskStatus}
              />
            </>
          )}

          {/* ── Table card header ─────────────────────────────────────
              Two-row pattern (canonical for admin tables):
              Row 1 - status count-pills (left) + role/shift/search (right)
              Row 2 - secondary chip filters (designation), only when data
                     present in the page's filter universe.
              Replaces the previous solid Segmented control with discrete
              chips so empty buckets are easily hidden and active state
              uses the brand pill tokens. */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Status count-pills - left */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: 'active', label: t('activeOnly'), count: activeCount, alwaysShow: true },
                  { key: 'all', label: t('allMembers'), count: allCount, alwaysShow: true },
                  {
                    key: 'inactive',
                    label: t('inactiveOnly'),
                    count: inactiveCount,
                    alwaysShow: true,
                  },
                  {
                    key: 'offboarding',
                    label: t('offboarding'),
                    count: offboardingCount,
                    alwaysShow: false,
                  },
                  {
                    key: 'archived',
                    label: t('archivedMembers'),
                    count: archivedCount,
                    alwaysShow: false,
                  },
                ] as const
              ).map(({ key, label, count, alwaysShow }) => {
                const active = statusFilter === key;
                if (!alwaysShow && count === 0 && !active) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(key);
                      setSelectedRowKeys([]);
                      if (serverMode) setTablePage(1);
                    }}
                    aria-pressed={active}
                    className={`cr-filter-chip ${active ? 'cr-filter-chip--active' : ''}`}
                  >
                    <span>{label}</span>
                    <span className="cr-filter-chip__count tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Filters - full-width stacked on mobile (consistent, aligned),
                inline right-aligned on desktop. */}
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Select
                mode="multiple"
                size="middle"
                maxTagCount="responsive"
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                value={roleFilters}
                onChange={(v) => {
                  setRoleFilters(v);
                  setSelectedRowKeys([]);
                  if (serverMode) setTablePage(1);
                }}
                style={{ height: 36 }}
                allowClear
                placeholder="Role: All"
                aria-label="Filter by role"
                className="team-filter-select w-full sm:w-[180px]"
                optionFilterProp="children"
              >
                {roles.map((r) => (
                  <Option key={r._id} value={r._id}>
                    {r.name}
                  </Option>
                ))}
              </Select>
              <Select
                mode="multiple"
                size="middle"
                maxTagCount="responsive"
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                value={shiftFilters}
                onChange={(v) => {
                  setShiftFilters(v);
                  setSelectedRowKeys([]);
                  if (serverMode) setTablePage(1);
                }}
                style={{ height: 36 }}
                allowClear
                placeholder="Shift: All"
                aria-label="Filter by shift"
                className="team-filter-select w-full sm:w-[180px]"
                optionFilterProp="children"
              >
                {shifts.map((s) => (
                  <Option key={s._id} value={s._id}>
                    {s.name}
                  </Option>
                ))}
              </Select>
              {/* Width-controlling wrapper: an AntD Input defaults to width:100%
                  (which overrode a `sm:w-[220px]` utility), so the search blew
                  out full-width on desktop. The plain div owns the width (full on
                  mobile, 220px on sm+) and the Input just fills it. */}
              <div className="w-full sm:w-[220px]">
                <Input
                  prefix={<SearchOutlined className="text-faint" />}
                  placeholder="Filter members…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (serverMode && tablePage !== 1) setTablePage(1);
                  }}
                  style={{ height: 36 }}
                  size="middle"
                  allowClear
                  aria-label={t('searchPlaceholder')}
                  data-shortcut="team-search"
                  className="w-full"
                />
              </div>
              {hasActiveFilters && (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseCircleOutlined />}
                  onClick={clearFilters}
                  className="text-subtle hover:text-error"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* ── Secondary chip filter: free-text `designation` field ───
            Distinct from RBAC role select above (which filters by
            permission role). Renders only in client mode and only when
            workspace data has at least one designation. Uses the same
            `cr-filter-chip` token as status pills for visual rhythm. */}
          {!serverMode && designations.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium tracking-wide text-subtle uppercase">
                Designation
              </span>
              <button
                type="button"
                disabled={!canUseDesignationFilter}
                onClick={() => canUseDesignationFilter && setDesignationFilter(null)}
                aria-pressed={!designationFilter && canUseDesignationFilter}
                data-shortcut="team-filter-chip"
                className={`cr-filter-chip ${!designationFilter && canUseDesignationFilter ? 'cr-filter-chip--active' : ''}`}
              >
                <span>{t('filterAll')}</span>
                <span className="cr-filter-chip__count tabular-nums">
                  {nonDesignationFiltered.length}
                </span>
              </button>
              {(canUseDesignationFilter ? designations : ['Manager', 'Developer', 'Designer']).map(
                (d) => {
                  const active = designationFilter === d && canUseDesignationFilter;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!canUseDesignationFilter}
                      onClick={() =>
                        canUseDesignationFilter &&
                        setDesignationFilter((prev) => (prev === d ? null : d))
                      }
                      aria-pressed={active}
                      data-shortcut="team-filter-chip"
                      className={`cr-filter-chip ${active ? 'cr-filter-chip--active' : ''}`}
                    >
                      <span>{d}</span>
                      <span className="cr-filter-chip__count tabular-nums">
                        {designationCounts[d] ?? 0}
                      </span>
                    </button>
                  );
                },
              )}
              {!canUseDesignationFilter && (
                <UpgradePrompt module="team" subFeature="designation_filter" compact />
              )}
            </div>
          )}

          <MemoBulkActionBar
            selectedCount={selectedRowKeys.length}
            selectionMode={selectionMode}
            onClearSelection={onClearBulkSelection}
            loading={bulkLoading}
            actions={bulkActions}
          />

          {/* Mobile card list - sub-md only (the DsTable has 11+ cols needing
            horizontal scroll on phones). Each card mirrors the desktop row:
            a select checkbox (feeds the shared BulkActionBar above), the key
            fields (name, status, role, emp code, verified mobile, email, shift,
            joined) with SALARY GATED by canViewSalaryColumn exactly like the
            table column, tap-to-view, and the SAME kebab actions via
            buildMemberMenuItems. */}
          <div className="flex flex-col gap-2 md:hidden">
            {loading ? (
              <div className="py-8 text-center text-sm text-subtle">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-subtle">
                {tableLocale?.emptyText ?? 'No members'}
              </div>
            ) : (
              filtered.map((m) => {
                const isHourly = m.salaryType === 'hourly';
                const monthly = isHourly ? resolveEffectiveMonthlySalary(m) : 0;
                const monthlyShort =
                  monthly >= 100000
                    ? `₹${(monthly / 100000).toFixed(monthly >= 1000000 ? 0 : 1)}L`
                    : monthly >= 1000
                      ? `₹${Math.round(monthly / 1000)}k`
                      : monthly > 0
                        ? `₹${Math.round(monthly)}`
                        : '';
                const onNotice = !!(
                  m.isActive &&
                  m.dateOfResignation &&
                  new Date(m.dateOfResignation) > new Date()
                );
                const status: 'active' | 'inactive' | 'warning' = onNotice
                  ? 'warning'
                  : m.isActive
                    ? 'active'
                    : 'inactive';
                const statusLabel = onNotice ? 'Notice' : m.isActive ? 'Active' : 'Inactive';
                const selected = selectedRowKeys.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-2.5 rounded-xl border border-border-light bg-surface p-3 transition-colors"
                  >
                    {/* Select - feeds the shared BulkActionBar (selectedRowKeys). */}
                    <Checkbox
                      className="mt-2.5 shrink-0"
                      checked={selected}
                      onChange={(e) =>
                        setSelectedRowKeys((keys) =>
                          e.target.checked ? [...keys, m.id] : keys.filter((k) => k !== m.id),
                        )
                      }
                      aria-label={`Select ${m.name || 'team member'}`}
                    />
                    {/* Tap the body -> member detail page. */}
                    <button
                      type="button"
                      onClick={() => openView(m)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <DsAvatar name={m.name} size={44} src={m.avatar} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-semibold text-heading">
                            {m.name}
                          </span>
                          <DsTag status={status} label={statusLabel} />
                        </div>
                        <div className="truncate text-[12px] text-muted">
                          {m.designation || 'Employee'}
                          {m.employeeCode ? (
                            <span className="ml-1 font-mono text-[11px] text-faint">
                              · {m.employeeCode}
                            </span>
                          ) : null}
                        </div>
                        {m.mobile && (
                          <div className="flex items-center gap-1.5 text-[12px] text-muted">
                            <span className="tabular-nums">{m.mobile}</span>
                            {m.mobileVerifiedAt ? (
                              <CheckCircleFilled
                                aria-label={t('mobileBadge.verifiedLabel')}
                                className="text-[11px] text-[var(--cr-success-600,#16a34a)]"
                              />
                            ) : (
                              <Tag
                                color="default"
                                className="m-0 px-1.5 py-0 text-[10px] leading-4"
                              >
                                {t('mobileBadge.unverifiedLabel')}
                              </Tag>
                            )}
                          </div>
                        )}
                        {m.email && (
                          <div className="truncate text-[12px] text-muted">{m.email}</div>
                        )}
                        {(m.shift || m.dateOfJoining) && (
                          <div className="text-[12px] text-subtle">
                            {m.shift ? m.shift.name : ''}
                            {m.shift && m.dateOfJoining ? ' · ' : ''}
                            {m.dateOfJoining ? `Joined ${fmt(m.dateOfJoining)}` : ''}
                          </div>
                        )}
                        {/* Salary - gated identically to the desktop column so it
                            never leaks to a viewer without pay-view permission. */}
                        {canViewSalaryColumn && (
                          <div className="text-[12px] font-medium text-heading">
                            ₹{Number(m.salaryAmount ?? 0).toLocaleString('en-IN')}
                            <span className="ml-0.5 text-subtle">/{isHourly ? 'hr' : 'mo'}</span>
                            {isHourly && monthlyShort ? ` · ~${monthlyShort}/mo` : ''}
                          </div>
                        )}
                      </div>
                    </button>
                    {/* Same lifecycle actions as the desktop row kebab. */}
                    <Dropdown
                      menu={{ items: buildMemberMenuItems(m) }}
                      trigger={['click']}
                      placement="bottomRight"
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        aria-label={tCommon('more')}
                        className="mt-0.5 shrink-0 text-faint"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop / tablet table - md+ */}
          <div ref={tableWrapRef} className="team-table-wrap hidden md:block">
            <MemoDsTable
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              loading={loading}
              selectedRowKeys={selectedRowKeys}
              onSelectionChange={handleTableSelectionChange}
              rowSelectionLabel={(m) => `Select ${m.name || 'team member'}`}
              locale={tableLocale}
              showAllOption={!serverMode}
              pagination={tablePagination}
              onChange={serverMode ? handleTableChange : undefined}
              // sticky={false} -> use the real `.ant-table-content` scroller (not
              // AntD's sticky bar) so TableCustomScrollbar can drive it. Its
              // native scrollbar is hidden in globals.css; our branded bar draws
              // below. Trade-off: the header no longer sticks on page scroll -
              // acceptable for a paginated list.
              sticky={false}
            />
            {/* Branded, fully-custom horizontal scrollbar (native scrollbar
                styling was unreliable across browsers). Finds `.ant-table-content`
                inside this wrapper; draggable + wheel-to-horizontal. */}
            <TableCustomScrollbar containerRef={tableWrapRef} />
          </div>
        </DsCard>
      </div>

      {/* Grant App Access modal - single source of truth lives in the
          shared component. Auto-opens via `?grantAccess=<id>` deep-link
          (see useEffect above); the detail page renders the same modal
          inline so no cross-page navigation is needed. */}
      <GrantAppAccessModal
        open={!!accessModal}
        member={accessModal}
        roles={roles}
        workspaceId={currentWorkspaceId ?? ''}
        onClose={() => setAccessModal(null)}
        onGranted={() => {
          if (serverMode) {
            setServerRefreshKey((k) => k + 1);
          } else {
            load();
          }
        }}
      />

      {/* CSV bulk import wizard. PIN-gated submit -> BE team.service.bulkCreate.
          onImported refreshes the list (server or client mode) like other
          mutations on this page. */}
      <TeamBulkImportModal
        open={bulkImportOpen}
        workspaceId={currentWorkspaceId ?? ''}
        shifts={shifts}
        onClose={() => setBulkImportOpen(false)}
        onImported={() => {
          if (serverMode) {
            setServerRefreshKey((k) => k + 1);
          } else {
            load();
          }
        }}
      />

      {/* Archive / Delete-permanently confirmation modal.
          Same modal serves both paths - branches on deleteModal.isDeleted:
            • isDeleted === false → soft archive (neutral styling)
            • isDeleted === true  → permanent delete (red danger styling) */}
      <DsModal
        open={!!deleteModal}
        onCancel={() => setDeleteModal(null)}
        title={
          <span className="font-display">
            {deleteModal?.isDeleted ? t('deleteMember') : t('archiveMember')} - {deleteModal?.name}
          </span>
        }
        onOk={handleDelete}
        okText={deleteModal?.isDeleted ? t('confirmDelete') : t('confirmArchive')}
        okButtonProps={deleteModal?.isDeleted ? { danger: true } : { type: 'primary' }}
      >
        {deleteModal?.isDeleted ? (
          <div className="space-y-4">
            <p className="text-[13px] text-gray-600">{t('deleteDesc')}</p>
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-red-900">
                <WarningOutlined className="text-red-700" /> {t('deleteWarning')}
              </p>
              <ul className="ml-4 list-disc space-y-1 text-[11px] text-red-800">
                <li>{t('deletePoint1')}</li>
                <li>{t('deletePoint2')}</li>
                <li>{t('deletePoint3')}</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-gray-600">{t('archiveDesc')}</p>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-blue-900">
                <InfoCircleOutlined className="text-blue-700" /> {t('archiveWarning')}
              </p>
              <ul className="ml-4 list-disc space-y-1 text-[11px] text-blue-800">
                <li>{t('archivePoint1')}</li>
                <li>{t('archivePoint2')}</li>
                <li>{t('archivePoint3')}</li>
              </ul>
            </div>
          </div>
        )}
      </DsModal>

      {/* Deactivate member modal */}
      <DsModal
        open={!!deactivateModal}
        onCancel={() => setDeactivateModal(null)}
        title={
          <span className="font-display">
            {t('deactivateMember')} - {deactivateModal?.name}
          </span>
        }
        onOk={handleDeactivate}
        okText={t('confirmDeactivate')}
        okButtonProps={{ danger: true }}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-gray-600">{t('deactivateDesc')}</p>
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-orange-900">
              <WarningOutlined className="text-orange-600" /> {t('deactivateWarning')}
            </p>
            <ul className="ml-4 list-disc space-y-1 text-[11px] text-orange-800">
              <li>{t('deactivatePoint1')}</li>
              <li>{t('deactivatePoint2')}</li>
              <li>{t('deactivatePoint3')}</li>
            </ul>
          </div>
        </div>
      </DsModal>

      {/* Resign member modal - Offboard */}
      <DsModal
        open={!!resignModal}
        onCancel={() => {
          setResignModal(null);
          resignForm.resetFields();
        }}
        title={
          <span className="font-display">
            {t('setLastWorkingDay')} - {resignModal?.name}
          </span>
        }
        onOk={() => resignForm.submit()}
        okText={t('confirmOffboard')}
        okButtonProps={{ danger: true }}
      >
        <p className="mb-4 text-sm text-gray-700">{t('offboardDesc')}</p>
        <Form form={resignForm} layout="vertical" onFinish={handleResign} requiredMark={false}>
          <Form.Item
            name="dateOfResignation"
            label={
              <span className="mb-1.5 text-sm font-medium text-gray-700">
                {t('lastWorkingDate')}
              </span>
            }
            rules={[{ required: true, message: t('selectLastWorkingDate') }]}
          >
            <DatePicker
              className="w-full"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
          <Form.Item
            name="resignationNote"
            label={
              <span className="mb-1.5 text-sm font-medium text-gray-700">{t('notesReason')}</span>
            }
          >
            <Input.TextArea rows={3} placeholder={t('notesReasonPlaceholder')} />
          </Form.Item>
        </Form>
      </DsModal>
    </>
  );
}

/**
 * §7 Part B (Access Control Initiative) - scope-composed Team route.
 *
 * `/dashboard/team` serves two audiences from one route (the option-(c)
 * pattern - one route per module, composed by the caller's resolved
 * scope):
 *   - `team.view` at `all` (Manager / HR / Owner) → the member console
 *     (`TeamConsole` above).
 *   - `team.view` at `self` only (Worker / Member) → their OWN profile.
 *     They never see the member list; we redirect to the detail route,
 *     which is itself scope-aware (field-level gating, Part B).
 *
 * Permissions resolve before either branch mounts, so a self-scoped
 * member never briefly sees the console (no data leak, no flash) and the
 * console never fires its workspace-wide fetches on their behalf.
 */
export default function TeamPage() {
  const t = useTranslations('team');
  const router = useRouter();
  const { canPath, data, loading } = useMyPermissions();

  // Self-scoped = a non-owner without org-wide `team.directory.view`. They
  // get their own profile, never the member list.
  //
  // Phase 1c: Team grants live on the path model (`permissionPaths` +
  // `permissionPathOverrides`); the legacy flat `permissions[]` no longer
  // mirrors them. Using flat `can('team', 'view', 'all')` here would
  // misclassify a member granted `team.directory.view@all` via the override
  // matrix as `selfScoped: true` and lock them into an infinite redirect
  // loop (`/dashboard/team` → `/dashboard/team/<id>` → "Back to team" →
  // `/dashboard/team` …). The path check is the canonical source of truth.
  const selfScoped = !!data && !data.isOwner && !canPath('team.directory.view', 'all');

  useEffect(() => {
    if (selfScoped && data?.teamMemberId) {
      router.replace(`/dashboard/team/${data.teamMemberId}`);
    }
  }, [selfScoped, data?.teamMemberId, router]);

  if (loading || !data) return <TeamRouteSkeleton />;

  if (selfScoped) {
    // Redirected to own profile above when a directory row exists.
    // Otherwise there is nothing to show - a friendly empty state, not
    // the manager console.
    return data.teamMemberId ? (
      <TeamRouteSkeleton />
    ) : (
      <Result status="info" title={t('selfNoProfileTitle')} subTitle={t('selfNoProfileBody')} />
    );
  }

  return <TeamConsole />;
}

function TeamRouteSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton active paragraph={{ rows: 1 }} />
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );
}
