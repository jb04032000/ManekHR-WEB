'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { useTranslations } from 'next-intl';
import {
  listAttendance,
  getAttendanceSummary,
  markAttendance,
  bulkMarkAttendance,
  updateAttendance,
  removeAttendance,
  listTeam,
  listHolidays,
  listUpcomingLeaves,
  listStaleSessions,
} from '@/lib/actions';
import type { StaleSession } from '@/lib/actions';
import type {
  TeamMember,
  AttendanceRecord,
  AttendanceSummary,
  AttendanceStatus,
  MarkAttendancePayload,
  PaginatedResponse,
  ShiftInfo,
  UpcomingLeaveEntry,
  Holiday,
  BulkMarkAttendanceResult,
  BulkMarkAttendancePayload,
} from '@/types';
import { parseApiError, todayISO } from '@/lib/utils';
import { isShiftCurrentlyActive } from '../AttendanceDailyTable';
import type { StatusHistoryEntry } from '../AttendanceDetailDrawer';

export interface UseAttendanceDataReturn {
  // Data
  members: TeamMember[];
  records: AttendanceRecord[];
  summary: AttendanceSummary | null;
  holidays: Holiday[];
  upcomingLeaves: UpcomingLeaveEntry[];
  monthlyRecords: Record<string, Record<string, string>>;
  /**
   * Raw attendance rows for the selected MONTH (not just today). The monthly
   * grid needs these — previously the page fed it the daily `records` array, so
   * a past month rendered all-blank cells while the summary still counted
   * today's single record ("1P / 0A" bug). Kept separate from `records` so the
   * daily view's derived state (attMap, tiles) is unaffected. Feeds
   * AttendanceMonthlyGrid; `monthlyRecords` (the map) still feeds the export.
   */
  monthlyRecordsList: AttendanceRecord[];
  /** Members with an open check-in from the previous day (no checkout yet - overnight shift). */
  carryoverRecords: AttendanceRecord[];
  /** memberId → yesterday's AttendanceRecord for quick lookup in table cells. */
  carryoverMap: Record<string, AttendanceRecord>;
  // Loading
  loading: boolean;
  monthlyLoading: boolean;
  marking: boolean;
  // Optimistic state
  pendingStatus: Record<string, AttendanceStatus>;
  failedIds: Set<string>;
  // Reload fns
  loadDaily: () => Promise<void>;
  loadMonthly: () => Promise<void>;
  // Actions
  handleMarkOne: (memberId: string, status: AttendanceStatus, note?: string) => void;
  handleBulkMark: () => Promise<void>;
  handleBulkMarkShift: (shiftMembers: TeamMember[], status: AttendanceStatus) => Promise<void>;
  handleBulkMarkShiftWithTimes: (
    shiftMembers: TeamMember[],
    shift: ShiftInfo,
    times?: { checkIn?: string | null; checkOut?: string | null },
  ) => Promise<void>;
  handleBulkMarkWithTimes: (
    payload: BulkMarkAttendancePayload,
  ) => Promise<BulkMarkAttendanceResult>;
  handleRemove: (memberId: string) => Promise<void>;
  handleSetTimes: (
    memberId: string,
    checkInIso: string | null,
    checkOutIso: string | null,
  ) => Promise<void>;
  handleCloseOvernightShift: (memberId: string, checkOutIso: string) => Promise<void>;
  staleSessions: StaleSession[];
  closeStaleSession: (sessionId: string, memberId: string, checkOutIso: string) => Promise<void>;
  // Bulk mark controls
  bulkStatus: AttendanceStatus;
  setBulkStatus: (s: AttendanceStatus) => void;
  // Drawer data
  drawerVisible: boolean;
  selectedMember: TeamMember | null;
  drawerNote: string;
  setDrawerNote: (n: string) => void;
  savingNote: boolean;
  statusHistory: StatusHistoryEntry[];
  loadingHistory: boolean;
  openDrawer: (member: TeamMember) => void;
  closeDrawer: () => void;
  handleSaveNote: () => Promise<void>;
  handleDrawerStatusChange: (status: AttendanceStatus) => void;
  // Derived
  attMap: Record<string, AttendanceRecord>;
  uniqueShifts: ShiftInfo[];
  uniqueRoles: string[];
  unmarkedCount: number;
  filteredUnmarkedCount: number;
  hasActiveFilters: boolean;
  displayMembers: TeamMember[];
  sortedShiftEntries: [string | null, TeamMember[]][];
  expandedShifts: string[];
  setExpandedShifts: (keys: string[]) => void;
  // Filters
  activeStatusFilter: string | null;
  setActiveStatusFilter: (f: string | null) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  selectedShifts: string[];
  setSelectedShifts: (ids: string[]) => void;
  selectedRoles: string[];
  setSelectedRoles: (roles: string[]) => void;
  clearAllFilters: () => void;
}

/** All attendance page state + logic, extracted to keep page.tsx < 300 LOC */
export function useAttendanceData(
  currentWorkspaceId: string | undefined | null,
  date: string,
  month: number,
  year: number,
  showSuccess: (msg: string) => void,
  showError: (msg: string) => void,
): UseAttendanceDataReturn {
  const t = useTranslations('attendance.dataHook');
  const tAtt = useTranslations('attendance');
  const statusLabel = (s: AttendanceStatus): string => {
    const map: Partial<Record<AttendanceStatus, string>> = {
      present: tAtt('present'),
      absent: tAtt('absent'),
      half_day: tAtt('halfDay'),
      on_leave: tAtt('leave'),
      holiday: tAtt('weeklyOff'),
      week_off: tAtt('weeklyOff'),
    };
    return map[s] ?? s;
  };
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present');
  const [pendingStatus, setPendingStatus] = useState<Record<string, AttendanceStatus>>({});
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<UpcomingLeaveEntry[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<Record<string, Record<string, string>>>({});
  // Raw month rows for the grid (see UseAttendanceDataReturn.monthlyRecordsList).
  const [monthlyRecordsList, setMonthlyRecordsList] = useState<AttendanceRecord[]>([]);
  const [carryoverRecords, setCarryoverRecords] = useState<AttendanceRecord[]>([]);
  const [staleSessions, setStaleSessions] = useState<StaleSession[]>([]);
  // All yesterday's open sessions (before today-filter) - used to restore carryover
  // when a Day 2 record is removed (P1b).
  const allYesterdayOpenRef = useRef<AttendanceRecord[]>([]);

  // Filters
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [expandedShifts, setExpandedShifts] = useState<string[]>([]);

  // Drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [drawerNote, setDrawerNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const attMapRef = useRef<Record<string, AttendanceRecord>>({});
  const membersRef = useRef<TeamMember[]>([]);
  const drawerHadPendingChange = useRef(false);
  const prevWorkspaceId = useRef<string | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadDaily = useCallback(async () => {
    if (!currentWorkspaceId) return;
    Object.values(debounceTimers.current).forEach(clearTimeout);
    debounceTimers.current = {};
    setPendingStatus({});
    setFailedIds(new Set());
    setLoading(true);
    try {
      const yesterday = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
      const [mRes, aRes, sRes, hRes, ydayRes] = await Promise.allSettled([
        listTeam(currentWorkspaceId, { limit: 500 }),
        listAttendance(currentWorkspaceId, { date, limit: 500 }),
        getAttendanceSummary(currentWorkspaceId, date),
        listHolidays(currentWorkspaceId),
        listAttendance(currentWorkspaceId, { date: yesterday, limit: 500 }),
      ]);
      if (mRes.status === 'fulfilled') setMembers(mRes.value.members ?? []);
      if (aRes.status === 'fulfilled') {
        const val = aRes.value;
        setRecords(
          Array.isArray(val) ? val : ((val as PaginatedResponse<AttendanceRecord>).data ?? []),
        );
      }
      if (sRes.status === 'fulfilled') setSummary(sRes.value);
      if (hRes.status === 'fulfilled') setHolidays(hRes.value || []);
      if (ydayRes.status === 'fulfilled') {
        const val = ydayRes.value;
        const ydayRecs = Array.isArray(val)
          ? val
          : ((val as PaginatedResponse<AttendanceRecord>).data ?? []);
        // Store ALL open yesterday sessions before filtering - used in handleRemove (P1b)
        const allOpen = ydayRecs.filter((r) => r.checkIn && !r.checkOut);
        allYesterdayOpenRef.current = allOpen;
        // Only show carryover if: open session (no checkout) AND member has no record for today
        // (today's check-in means their overnight session was implicitly closed by a new shift)
        const todayMemberIds = new Set(
          (aRes.status === 'fulfilled'
            ? Array.isArray(aRes.value)
              ? aRes.value
              : ((aRes.value as PaginatedResponse<AttendanceRecord>).data ?? [])
            : []
          ).map((r) =>
            typeof r.teamMemberId === 'string'
              ? r.teamMemberId
              : (r.teamMemberId as { _id: string })._id,
          ),
        );
        setCarryoverRecords(
          allOpen.filter((r) => {
            const mid =
              typeof r.teamMemberId === 'string'
                ? r.teamMemberId
                : (r.teamMemberId as { _id: string })._id;
            return !todayMemberIds.has(mid); // hide if already active today
          }),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, date]);

  const loadMonthly = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setMonthlyLoading(true);
    try {
      const [mRes, aRes] = await Promise.allSettled([
        listTeam(currentWorkspaceId, { limit: 500 }),
        listAttendance(currentWorkspaceId, { month, year, limit: 1000 }),
      ]);
      if (mRes.status === 'fulfilled') setMembers(mRes.value.members ?? []);
      if (aRes.status === 'fulfilled') {
        const val = aRes.value;
        const recs = Array.isArray(val)
          ? val
          : ((val as PaginatedResponse<AttendanceRecord>).data ?? []);
        // Keep the raw rows so the grid renders the correct month (bugfix for the
        // "1P / 0A on a blank month" issue — see monthlyRecordsList docs).
        setMonthlyRecordsList(recs);
        const map: Record<string, Record<string, string>> = {};
        recs.forEach((r) => {
          const mid =
            typeof r.teamMemberId === 'string'
              ? r.teamMemberId
              : (r.teamMemberId as { _id: string })._id;
          const d = r.date?.slice(0, 10);
          if (!mid || !d) return;
          if (!map[mid]) map[mid] = {};
          map[mid][d] = r.status;
        });
        setMonthlyRecords(map);
      }
    } finally {
      setMonthlyLoading(false);
    }
  }, [currentWorkspaceId, month, year]);

  // ── Side effects ───────────────────────────────────────────────────────────

  useEffect(
    () => () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (!currentWorkspaceId) return;
    const from = dayjs().format('YYYY-MM-DD');
    const to = dayjs().add(6, 'day').format('YYYY-MM-DD');
    listUpcomingLeaves(currentWorkspaceId, from, to)
      .then((data) => setUpcomingLeaves(Array.isArray(data) ? data : []))
      .catch(() => setUpcomingLeaves([]));
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (prevWorkspaceId.current !== null && prevWorkspaceId.current !== currentWorkspaceId) {
      setActiveStatusFilter(null);
      setSearchQuery('');
      setSelectedShifts([]);
      setSelectedRoles([]);
    }
    prevWorkspaceId.current = currentWorkspaceId ?? null;
  }, [currentWorkspaceId]);

  // P3a: load stale sessions (open > 24h) whenever workspace or date changes
  useEffect(() => {
    if (!currentWorkspaceId) return;
    listStaleSessions(currentWorkspaceId)
      .then(setStaleSessions)
      .catch(() => setStaleSessions([]));
  }, [currentWorkspaceId, date]);

  const fetchDrawerHistory = useCallback(
    async (member: TeamMember) => {
      if (!currentWorkspaceId) return;
      setLoadingHistory(true);
      try {
        const res = await listAttendance(currentWorkspaceId, {
          date,
          filters: JSON.stringify({ memberId: member.id }),
          limit: 1,
        });
        const recs = Array.isArray(res)
          ? res
          : ((res as PaginatedResponse<AttendanceRecord>).data ?? []);
        const record = recs[0] as AttendanceRecord & {
          statusHistory?: StatusHistoryEntry[];
          note?: string;
        };
        if (record) {
          setStatusHistory((record.statusHistory ?? []) as StatusHistoryEntry[]);
          if (record.note) setDrawerNote(record.note);
        } else {
          setStatusHistory([]);
        }
      } catch {
        setStatusHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [currentWorkspaceId, date],
  );

  useEffect(() => {
    if (!drawerVisible || !selectedMember) return;
    const isPending = selectedMember.id in pendingStatus;
    if (!isPending && drawerHadPendingChange.current) {
      drawerHadPendingChange.current = false;
      fetchDrawerHistory(selectedMember);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStatus, drawerVisible, selectedMember?.id]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const attMap = records.reduce<Record<string, AttendanceRecord>>((acc, r) => {
    const id =
      typeof r.teamMemberId === 'string' ? r.teamMemberId : (r.teamMemberId as { _id: string })._id;
    if (id) acc[id] = r;
    return acc;
  }, {});
  useEffect(() => {
    attMapRef.current = attMap;
    membersRef.current = members;
  }, [attMap, members]);

  const getEffectiveStatus = (memberId: string): string =>
    pendingStatus[memberId] ?? attMap[memberId]?.status ?? 'unmarked';

  const unmarkedCount = members.filter((m) => !attMap[m.id] && !(m.id in pendingStatus)).length;

  const uniqueShifts: ShiftInfo[] = Array.from(
    members
      .reduce((map, m) => {
        if (m.shift) map.set(m.shift.id, m.shift);
        return map;
      }, new Map<string, ShiftInfo>())
      .values(),
  );
  const uniqueRoles = [...new Set(members.map((m) => m.designation).filter(Boolean))] as string[];
  const hasActiveFilters =
    !!activeStatusFilter ||
    !!searchQuery.trim() ||
    selectedShifts.length > 0 ||
    selectedRoles.length > 0;

  const clearAllFilters = () => {
    setActiveStatusFilter(null);
    setSearchQuery('');
    setSelectedShifts([]);
    setSelectedRoles([]);
  };

  const displayMembers = members.filter((m) => {
    if (activeStatusFilter && getEffectiveStatus(m.id) !== activeStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.designation?.toLowerCase().includes(q))
        return false;
    }
    if (selectedShifts.length > 0 && (!m.shift || !selectedShifts.includes(m.shift.id)))
      return false;
    if (selectedRoles.length > 0 && (!m.designation || !selectedRoles.includes(m.designation)))
      return false;
    return true;
  });

  const filteredUnmarkedCount = displayMembers.filter(
    (m) => !attMap[m.id] && !(m.id in pendingStatus),
  ).length;

  const groupedByShift = displayMembers.reduce<Map<string | null, TeamMember[]>>((acc, m) => {
    const key = m.shift?.id ?? null;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(m);
    return acc;
  }, new Map());

  const sortedShiftEntries = Array.from(groupedByShift.entries()).sort(([aId], [bId]) => {
    if (aId === null) return 1;
    if (bId === null) return -1;
    const aShift = uniqueShifts.find((s) => s.id === aId);
    const bShift = uniqueShifts.find((s) => s.id === bId);
    if (!aShift || !bShift) return 0;
    if (date === todayISO()) {
      const aActive = isShiftCurrentlyActive(aShift.startTime, aShift.endTime);
      const bActive = isShiftCurrentlyActive(bShift.startTime, bShift.endTime);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
    }
    return aShift.name.localeCompare(bShift.name);
  });

  // Auto-expand shifts. Runs on member-list / date / filter changes, but NOT on
  // `records` changes - marking attendance must not reset the user's manual
  // collapse state.
  useEffect(() => {
    if (members.length === 0) return;
    queueMicrotask(() => {
      const filtered = members.filter((m) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!m.name.toLowerCase().includes(q) && !m.designation?.toLowerCase().includes(q))
            return false;
        }
        if (selectedShifts.length > 0 && (!m.shift || !selectedShifts.includes(m.shift.id)))
          return false;
        if (selectedRoles.length > 0 && (!m.designation || !selectedRoles.includes(m.designation)))
          return false;
        return true;
      });
      const visibleKeys = [...new Set(filtered.map((m) => m.shift?.id ?? 'unassigned'))];
      if (visibleKeys.length === 0) return;
      if (visibleKeys.length === 1) {
        setExpandedShifts(visibleKeys);
        return;
      }
      const isFilterActive =
        !!activeStatusFilter ||
        !!searchQuery.trim() ||
        selectedShifts.length > 0 ||
        selectedRoles.length > 0;
      if (isFilterActive) {
        setExpandedShifts(visibleKeys);
        return;
      }
      if (date === todayISO()) {
        const activeIds = [
          ...new Set(
            members
              .filter((m) => m.shift && isShiftCurrentlyActive(m.shift.startTime, m.shift.endTime))
              .map((m) => m.shift!.id),
          ),
        ];
        if (activeIds.length > 0) setExpandedShifts(activeIds);
      }
    });
  }, [members, date, activeStatusFilter, searchQuery, selectedShifts, selectedRoles]);

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleMarkOne = (memberId: string, status: AttendanceStatus, note?: string) => {
    if (!currentWorkspaceId) return;
    setFailedIds((prev) => {
      const n = new Set(prev);
      n.delete(memberId);
      return n;
    });
    const previousStatus = (attMapRef.current[memberId]?.status ?? 'unmarked') as AttendanceStatus;
    setPendingStatus((prev) => ({ ...prev, [memberId]: status }));
    clearTimeout(debounceTimers.current[memberId]);
    debounceTimers.current[memberId] = setTimeout(async () => {
      delete debounceTimers.current[memberId];
      let succeeded = false;
      try {
        const existing = attMapRef.current[memberId];
        const notePayload = note !== undefined ? { note } : {};
        const returned = existing
          ? await updateAttendance(currentWorkspaceId, existing._id, { status, ...notePayload })
          : await markAttendance(currentWorkspaceId, {
              teamMemberId: memberId,
              date,
              status,
              ...notePayload,
            });
        succeeded = true;

        // Directly patch records state from the returned record - this is immediate and
        // reliable regardless of whether the subsequent listAttendance refresh succeeds.
        // Normalise teamMemberId to the plain string so attMap keying matches m.id.
        // Always fall back to the requested `status` in case the backend returns null
        // or the record is missing the status field (e.g. mark() upsert race).
        setRecords((prev) => {
          const normalized: AttendanceRecord = {
            ...(returned != null ? (returned as object) : {}),
            teamMemberId: memberId,
            status: (returned as AttendanceRecord | null)?.status ?? status,
            date: (returned as AttendanceRecord | null)?.date ?? date,
          } as AttendanceRecord;
          const exists = prev.some((r) => {
            const rid =
              typeof r.teamMemberId === 'string'
                ? r.teamMemberId
                : (r.teamMemberId as { _id: string })._id;
            return rid === memberId;
          });
          return exists
            ? prev.map((r) => {
                const rid =
                  typeof r.teamMemberId === 'string'
                    ? r.teamMemberId
                    : (r.teamMemberId as { _id: string })._id;
                return rid === memberId ? normalized : r;
              })
            : [...prev, normalized];
        });

        // Background refresh - keeps summary chips and full record data (incl. _id) in sync.
        // MERGE strategy: if fresh data somehow omits the member we just marked (transient
        // race or backend null-return), we keep our direct-patched record rather than
        // reverting to unmarked.  In 99% of cases the fresh data WILL include the record
        // and we simply use it (giving us the real _id for subsequent updates).
        Promise.allSettled([
          listAttendance(currentWorkspaceId, { date, limit: 500 }),
          getAttendanceSummary(currentWorkspaceId, date),
        ]).then(([aRes, sRes]) => {
          if (aRes.status === 'fulfilled') {
            const val = aRes.value;
            const fresh = Array.isArray(val)
              ? val
              : ((val as PaginatedResponse<AttendanceRecord>).data ?? []);
            const getMid = (r: AttendanceRecord) =>
              typeof r.teamMemberId === 'string'
                ? r.teamMemberId
                : (r.teamMemberId as { _id: string })._id;
            const freshHasMember = fresh.some((r) => getMid(r) === memberId);
            if (freshHasMember) {
              setRecords(fresh);
            } else {
              // Fresh data is missing the just-marked member - keep our direct patch
              // so the button doesn't revert to unmarked while the DB catches up.
              setRecords((prev) => {
                const ourRecord = prev.find((r) => getMid(r) === memberId);
                return ourRecord ? [...fresh, ourRecord] : fresh;
              });
            }
          }
          if (sRes.status === 'fulfilled') setSummary(sRes.value);
        });
      } catch (e) {
        setPendingStatus((prev) => {
          const n = { ...prev };
          if (n[memberId] === status) n[memberId] = previousStatus;
          return n;
        });
        setFailedIds((prev) => new Set([...prev, memberId]));
        const memberName = membersRef.current.find((m) => m.id === memberId)?.name;
        showError(`${memberName ? `${memberName}: ` : ''}${parseApiError(e)}`);
      } finally {
        setPendingStatus((prev) => {
          const n = { ...prev };
          delete n[memberId];
          return n;
        });
      }
    }, 600);
  };

  const handleBulkMark = async () => {
    if (!currentWorkspaceId) return;
    const dayOfWeek = dayjs(date).format('ddd');
    const carryoverMids = new Set(Object.keys(carryoverMap));
    const targetMembers = hasActiveFilters ? displayMembers : members;
    const toMarkMembers = targetMembers.filter(
      (m) => !attMap[m.id] && !m.weeklyOff?.includes(dayOfWeek) && !carryoverMids.has(m.id),
    );
    const skipped = targetMembers.filter(
      (m) => !attMap[m.id] && !m.weeklyOff?.includes(dayOfWeek) && carryoverMids.has(m.id),
    ).length;
    if (toMarkMembers.length === 0 && skipped === 0) {
      showSuccess(t('allMembersMarked'));
      return;
    }
    const targetIds = toMarkMembers.map((m) => m.id);
    // Optimistic: show status immediately on all target rows
    setPendingStatus((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = bulkStatus;
      });
      return next;
    });
    setMarking(true);
    try {
      const payload: MarkAttendancePayload[] = toMarkMembers.map((m) => ({
        teamMemberId: m.id,
        status: bulkStatus,
        date,
      }));
      if (payload.length > 0) await bulkMarkAttendance(currentWorkspaceId, { records: payload });
      const markedMsg =
        payload.length > 0
          ? t('bulkMarked', { count: payload.length, status: statusLabel(bulkStatus) })
          : '';
      const skippedMsg = skipped > 0 ? t('bulkSkipped', { count: skipped }) : '';
      showSuccess([markedMsg, skippedMsg].filter(Boolean).join(' · '));
      // Patch records directly - status only, no times (no loadDaily → no full re-render)
      const targetSet = new Set(targetIds);
      const getMid = (r: AttendanceRecord) =>
        typeof r.teamMemberId === 'string'
          ? r.teamMemberId
          : (r.teamMemberId as { _id: string })._id;
      setRecords((prev) => {
        const updated = prev.map((r) =>
          targetSet.has(getMid(r)) ? { ...r, status: bulkStatus } : r,
        );
        const existingIds = new Set(prev.map(getMid));
        const added = toMarkMembers
          .filter((m) => !existingIds.has(m.id))
          .map((m) => ({ teamMemberId: m.id, status: bulkStatus, date }) as AttendanceRecord);
        return [...updated, ...added];
      });
      // Background summary refresh only - no listAttendance to avoid stale CHECK_IN events
      // overwriting our clean patch and re-rendering the whole table.
      getAttendanceSummary(currentWorkspaceId, date)
        .then((s) => setSummary(s))
        .catch(() => {});
    } catch (e) {
      showError(parseApiError(e));
    } finally {
      setPendingStatus((prev) => {
        const next = { ...prev };
        targetIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setMarking(false);
    }
  };

  const handleBulkMarkShift = async (shiftMembers: TeamMember[], status: AttendanceStatus) => {
    if (!currentWorkspaceId) return;
    const dayOfWeek = dayjs(date).format('ddd');
    const carryoverMids = new Set(Object.keys(carryoverMap));
    const toMark = shiftMembers.filter(
      (m) => !attMap[m.id] && !m.weeklyOff?.includes(dayOfWeek) && !carryoverMids.has(m.id),
    );
    const skipped = shiftMembers.filter(
      (m) => !attMap[m.id] && !m.weeklyOff?.includes(dayOfWeek) && carryoverMids.has(m.id),
    ).length;
    if (toMark.length === 0 && skipped === 0) {
      showSuccess(t('shiftAllMarked'));
      return;
    }
    const targetIds = toMark.map((m) => m.id);
    // Optimistic: show status immediately on all target rows
    setPendingStatus((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = status;
      });
      return next;
    });
    try {
      const payload: MarkAttendancePayload[] = toMark.map((m) => ({
        teamMemberId: m.id,
        status,
        date,
      }));
      if (payload.length > 0) await bulkMarkAttendance(currentWorkspaceId, { records: payload });
      const markedMsg =
        payload.length > 0
          ? t('shiftMarked', { count: payload.length, status: statusLabel(status) })
          : '';
      const skippedMsg = skipped > 0 ? t('shiftSkipped', { count: skipped }) : '';
      showSuccess([markedMsg, skippedMsg].filter(Boolean).join(' · '));
      // Patch records directly - status only, no times (no loadDaily → no full re-render)
      const targetSet = new Set(targetIds);
      const getMid = (r: AttendanceRecord) =>
        typeof r.teamMemberId === 'string'
          ? r.teamMemberId
          : (r.teamMemberId as { _id: string })._id;
      setRecords((prev) => {
        const updated = prev.map((r) => (targetSet.has(getMid(r)) ? { ...r, status } : r));
        const existingIds = new Set(prev.map(getMid));
        const added = toMark
          .filter((m) => !existingIds.has(m.id))
          .map((m) => ({ teamMemberId: m.id, status, date }) as AttendanceRecord);
        return [...updated, ...added];
      });
      // Background summary refresh only - skip listAttendance to avoid:
      //   1. full table re-render from setRecords(fresh)
      //   2. stale CHECK_IN events overwriting our clean no-times patch
      // Real _id will sync on next natural loadDaily (date change / filter change).
      getAttendanceSummary(currentWorkspaceId, date)
        .then((s) => setSummary(s))
        .catch(() => {});
    } catch (e) {
      showError(parseApiError(e));
    } finally {
      setPendingStatus((prev) => {
        const next = { ...prev };
        targetIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }
  };

  const handleBulkMarkShiftWithTimes = async (
    shiftMembers: TeamMember[],
    _shift: ShiftInfo,
    times?: { checkIn?: string | null; checkOut?: string | null },
  ) => {
    if (!currentWorkspaceId) return;
    const checkInIso = times?.checkIn ?? null;
    const checkOutIso = times?.checkOut ?? null;
    if (!checkInIso && !checkOutIso) {
      showError(t('shiftSelectTime'));
      return;
    }
    const targetIds = shiftMembers.map((m) => m.id);
    // Optimistic: show present immediately on all rows in this shift
    setPendingStatus((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = 'present';
      });
      return next;
    });
    try {
      const records = shiftMembers.map((m) => ({
        teamMemberId: m.id,
        date,
        status: 'present' as AttendanceStatus,
        ...(checkInIso ? { checkIn: checkInIso } : {}),
        ...(checkOutIso ? { checkOut: checkOutIso } : {}),
      }));
      const res = (await bulkMarkAttendance(currentWorkspaceId, {
        records,
      })) as BulkMarkAttendanceResult;
      const marked = res.marked ?? records.length;
      const skippedLocked = res.skippedLocked ?? 0;
      const parts: string[] = [];
      if (checkInIso) parts.push(t('partCheckIn'));
      if (checkOutIso) parts.push(t('partCheckOut'));
      const markedMsg =
        marked > 0 ? t('shiftMarkedTimes', { count: marked, parts: parts.join(' + ') }) : '';
      const skippedMsg = skippedLocked > 0 ? t('shiftLockedSkipped', { count: skippedLocked }) : '';
      showSuccess([markedMsg, skippedMsg].filter(Boolean).join(' · '));
      // Patch records directly with times - no loadDaily → no full re-render
      const getMid = (r: AttendanceRecord) =>
        typeof r.teamMemberId === 'string'
          ? r.teamMemberId
          : (r.teamMemberId as { _id: string })._id;
      const targetSet = new Set(targetIds);
      setRecords((prev) => {
        const updated = prev.map((r) => {
          if (!targetSet.has(getMid(r))) return r;
          return {
            ...r,
            status: 'present' as AttendanceStatus,
            ...(checkInIso ? { checkIn: checkInIso } : {}),
            ...(checkOutIso ? { checkOut: checkOutIso } : {}),
          };
        });
        const existingIds = new Set(prev.map(getMid));
        const added = shiftMembers
          .filter((m) => !existingIds.has(m.id))
          .map(
            (m) =>
              ({
                teamMemberId: m.id,
                status: 'present' as AttendanceStatus,
                date,
                ...(checkInIso ? { checkIn: checkInIso } : {}),
                ...(checkOutIso ? { checkOut: checkOutIso } : {}),
              }) as AttendanceRecord,
          );
        return [...updated, ...added];
      });
      // Background summary refresh only - skip listAttendance for same reasons as
      // handleBulkMarkShift (avoid full re-render + stale event overwrite).
      getAttendanceSummary(currentWorkspaceId, date)
        .then((s) => setSummary(s))
        .catch(() => {});
    } catch (e) {
      showError(parseApiError(e));
    } finally {
      setPendingStatus((prev) => {
        const next = { ...prev };
        targetIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }
  };

  /**
   * Optimistic bulk-mark-with-times. Used by header-level "Bulk with times"
   * dropdown (mark at shift times / custom time). Avoids full re-render by
   * patching setRecords directly and skipping the listAttendance refresh.
   */
  const handleBulkMarkWithTimes = async (
    payload: BulkMarkAttendancePayload,
  ): Promise<BulkMarkAttendanceResult> => {
    if (!currentWorkspaceId) throw new Error(t('noWorkspace'));
    const records = payload.records;
    const targetIds = records.map((r) => r.teamMemberId);
    // Optimistic: show target status (defaults to 'present' for times flow)
    setPendingStatus((prev) => {
      const next = { ...prev };
      records.forEach((r) => {
        next[r.teamMemberId] = (r.status ?? 'present') as AttendanceStatus;
      });
      return next;
    });
    try {
      const result = (await bulkMarkAttendance(
        currentWorkspaceId,
        payload,
      )) as BulkMarkAttendanceResult;
      // Patch records directly with the provided times - no loadDaily → no full re-render
      const getMid = (r: AttendanceRecord) =>
        typeof r.teamMemberId === 'string'
          ? r.teamMemberId
          : (r.teamMemberId as { _id: string })._id;
      const byId = new Map(records.map((r) => [r.teamMemberId, r]));
      setRecords((prev) => {
        const updated = prev.map((r) => {
          const src = byId.get(getMid(r));
          if (!src) return r;
          return {
            ...r,
            ...(src.status ? { status: src.status as AttendanceStatus } : {}),
            ...(src.checkIn !== undefined && src.checkIn !== null ? { checkIn: src.checkIn } : {}),
            ...(src.checkOut !== undefined && src.checkOut !== null
              ? { checkOut: src.checkOut }
              : {}),
          };
        });
        const existingIds = new Set(prev.map(getMid));
        const added = records
          .filter((r) => !existingIds.has(r.teamMemberId))
          .map(
            (r) =>
              ({
                teamMemberId: r.teamMemberId,
                status: (r.status ?? 'present') as AttendanceStatus,
                date,
                ...(r.checkIn ? { checkIn: r.checkIn } : {}),
                ...(r.checkOut ? { checkOut: r.checkOut } : {}),
              }) as AttendanceRecord,
          );
        return [...updated, ...added];
      });
      // Background summary refresh only
      getAttendanceSummary(currentWorkspaceId, date)
        .then((s) => setSummary(s))
        .catch(() => {});
      return result;
    } finally {
      setPendingStatus((prev) => {
        const next = { ...prev };
        targetIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!currentWorkspaceId) return;
    const snapshot = attMapRef.current[memberId];
    const getMid = (r: AttendanceRecord) =>
      typeof r.teamMemberId === 'string' ? r.teamMemberId : (r.teamMemberId as { _id: string })._id;
    setRecords((prev) => prev.filter((r) => getMid(r) !== memberId));
    try {
      await removeAttendance(currentWorkspaceId, memberId, date);
      showSuccess(t('removed'));
      // P1b: if this member had a suppressed overnight session (open yesterday but hidden
      // because today's record existed), restore it now that today's record is gone.
      const yesterdayOpen = allYesterdayOpenRef.current.find((r) => getMid(r) === memberId);
      if (yesterdayOpen) {
        setCarryoverRecords((prev) =>
          prev.some((r) => getMid(r) === memberId) ? prev : [...prev, yesterdayOpen],
        );
      }
    } catch (e) {
      if (snapshot) setRecords((prev) => [...prev, snapshot]);
      showError(parseApiError(e));
    }
  };

  const handleSetTimes = async (
    memberId: string,
    checkInIso: string | null,
    checkOutIso: string | null,
  ) => {
    if (!currentWorkspaceId) return;
    const getMid = (r: AttendanceRecord) =>
      typeof r.teamMemberId === 'string' ? r.teamMemberId : (r.teamMemberId as { _id: string })._id;

    // Snapshot for revert
    const snapshot = attMapRef.current[memberId];

    // Optimistic: patch checkIn/checkOut immediately
    setRecords((prev) =>
      prev.map((r) =>
        getMid(r) === memberId ? { ...r, checkIn: checkInIso, checkOut: checkOutIso } : r,
      ),
    );

    try {
      const existing = attMapRef.current[memberId];
      const returned = existing
        ? await updateAttendance(currentWorkspaceId, existing._id, {
            checkIn: checkInIso,
            checkOut: checkOutIso,
          })
        : await markAttendance(currentWorkspaceId, {
            teamMemberId: memberId,
            date,
            status: 'present',
            checkIn: checkInIso ?? undefined,
            checkOut: checkOutIso ?? undefined,
          });

      // Patch with real returned record so _id is always fresh
      if (returned) {
        setRecords((prev) =>
          prev.map((r) =>
            getMid(r) === memberId
              ? { ...(returned as AttendanceRecord), teamMemberId: memberId }
              : r,
          ),
        );
      }

      // Background refresh (no loading spinner - same pattern as handleMarkOne)
      Promise.allSettled([
        listAttendance(currentWorkspaceId, { date, limit: 500 }),
        getAttendanceSummary(currentWorkspaceId, date),
      ]).then(([aRes, sRes]) => {
        if (aRes.status === 'fulfilled') {
          const val = aRes.value;
          const fresh = Array.isArray(val)
            ? val
            : ((val as PaginatedResponse<AttendanceRecord>).data ?? []);
          const freshHasMember = fresh.some((r) => getMid(r) === memberId);
          setRecords(
            freshHasMember
              ? fresh
              : (prev) => {
                  const our = prev.find((r) => getMid(r) === memberId);
                  return our ? [...fresh, our] : fresh;
                },
          );
        }
        if (sRes.status === 'fulfilled') setSummary(sRes.value);
      });
    } catch (e) {
      // Revert to pre-action values
      setRecords((prev) => prev.map((r) => (getMid(r) === memberId && snapshot ? snapshot : r)));
      showError(parseApiError(e));
    }
  };

  const openDrawer = (member: TeamMember) => {
    setSelectedMember(member);
    setDrawerVisible(true);
    setDrawerNote(attMap[member.id]?.note ?? '');
    setStatusHistory([]);
    fetchDrawerHistory(member);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setSelectedMember(null);
    setDrawerNote('');
    setStatusHistory([]);
  };

  const handleSaveNote = async () => {
    if (!selectedMember || !currentWorkspaceId) return;
    setSavingNote(true);
    try {
      const existing = attMap[selectedMember.id];
      if (existing) await updateAttendance(currentWorkspaceId, existing._id, { note: drawerNote });
      else
        await markAttendance(currentWorkspaceId, {
          teamMemberId: selectedMember.id,
          date,
          status: 'present',
          note: drawerNote,
        });
      showSuccess(t('saved'));
      loadDaily();
    } catch (e) {
      showError(parseApiError(e));
    } finally {
      setSavingNote(false);
    }
  };

  const handleCloseOvernightShift = async (memberId: string, checkOutIso: string) => {
    if (!currentWorkspaceId) return;
    const getMid = (r: AttendanceRecord) =>
      typeof r.teamMemberId === 'string' ? r.teamMemberId : (r.teamMemberId as { _id: string })._id;

    const cr = carryoverRecords.find((r) => getMid(r) === memberId);
    if (!cr) return;

    // Optimistic: drop from carryoverRecords immediately - banner, badge, and Active
    // indicator all update without waiting for the network round-trip.
    setCarryoverRecords((prev) => prev.filter((r) => getMid(r) !== memberId));

    try {
      await updateAttendance(currentWorkspaceId, cr._id, { checkOut: checkOutIso });
      showSuccess(t('overnightClosed'));

      // Background reconcile - re-fetch yesterday to confirm final state.
      // Capture today's member IDs now (before the async gap).
      const yesterday = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
      const todayMemberIds = new Set(records.map((r) => getMid(r)));
      listAttendance(currentWorkspaceId, { date: yesterday, limit: 500 })
        .then((val) => {
          const ydayRecs = Array.isArray(val)
            ? val
            : ((val as PaginatedResponse<AttendanceRecord>).data ?? []);
          setCarryoverRecords(
            ydayRecs.filter((r) => {
              if (!r.checkIn || r.checkOut) return false;
              return !todayMemberIds.has(getMid(r));
            }),
          );
        })
        .catch(() => {});
    } catch (e) {
      const is404 = (e as any)?.response?.status === 404 || (e as any)?.status === 404;
      if (is404) {
        // Record already deleted elsewhere - optimistic removal stands, just inform admin
        showSuccess(t('sessionAlreadyClosedRemoved'));
      } else {
        setCarryoverRecords((prev) => [...prev, cr]);
        showError(parseApiError(e));
      }
    }
  };

  // P3a: close a stale session (open > 24h) by record ID
  const closeStaleSession = async (sessionId: string, memberId: string, checkOutIso: string) => {
    if (!currentWorkspaceId) return;
    setStaleSessions((prev) => prev.filter((s) => s._id !== sessionId));
    try {
      await updateAttendance(currentWorkspaceId, sessionId, { checkOut: checkOutIso });
      showSuccess(t('staleClosed'));
    } catch (e) {
      const is404 = (e as any)?.response?.status === 404 || (e as any)?.status === 404;
      if (is404) {
        showSuccess(t('sessionAlreadyClosed'));
      } else {
        setStaleSessions((prev) =>
          prev.some((s) => s._id === sessionId)
            ? prev
            : [...prev, { _id: sessionId, memberId, memberName: '', date: '', checkIn: '' }],
        );
        showError(parseApiError(e));
      }
    }
  };

  const handleDrawerStatusChange = (status: AttendanceStatus) => {
    if (!selectedMember) return;
    drawerHadPendingChange.current = true;
    handleMarkOne(selectedMember.id, status);
  };

  const carryoverMap = carryoverRecords.reduce<Record<string, AttendanceRecord>>((acc, r) => {
    const mid =
      typeof r.teamMemberId === 'string' ? r.teamMemberId : (r.teamMemberId as { _id: string })._id;
    if (mid) acc[mid] = r;
    return acc;
  }, {});

  return {
    members,
    records,
    summary,
    holidays,
    upcomingLeaves,
    monthlyRecords,
    monthlyRecordsList,
    carryoverRecords,
    carryoverMap,
    loading,
    monthlyLoading,
    marking,
    pendingStatus,
    failedIds,
    loadDaily,
    loadMonthly,
    handleMarkOne,
    handleBulkMark,
    handleBulkMarkShift,
    handleBulkMarkShiftWithTimes,
    handleBulkMarkWithTimes,
    handleRemove,
    handleSetTimes,
    handleCloseOvernightShift,
    staleSessions,
    closeStaleSession,
    bulkStatus,
    setBulkStatus,
    drawerVisible,
    selectedMember,
    drawerNote,
    setDrawerNote,
    savingNote,
    statusHistory,
    loadingHistory,
    openDrawer,
    closeDrawer,
    handleSaveNote,
    handleDrawerStatusChange,
    attMap,
    uniqueShifts,
    uniqueRoles,
    unmarkedCount,
    filteredUnmarkedCount,
    hasActiveFilters,
    displayMembers,
    sortedShiftEntries,
    expandedShifts,
    setExpandedShifts,
    activeStatusFilter,
    setActiveStatusFilter,
    searchQuery,
    setSearchQuery,
    selectedShifts,
    setSelectedShifts,
    selectedRoles,
    setSelectedRoles,
    clearAllFilters,
  };
}
