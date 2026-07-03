'use client';

import { useState, useCallback, useRef } from 'react';
import { App } from 'antd';
import dayjs from 'dayjs';
import { listAttendance, markAttendance, updateAttendance } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { TeamMember, AttendanceRecord, AttendanceStatus, PaginatedResponse } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseMemberDayAttendanceReturn {
  /** Open the drawer for a specific date (ISO YYYY-MM-DD). */
  openDay: (dateIso: string) => void;
  /** Close + reset the drawer. */
  close: () => void;

  // Props forwarded directly to AttendanceDetailDrawer
  open: boolean;
  selectedMember: TeamMember | null;
  date: string;
  record: AttendanceRecord | null;
  pendingStatus: Record<string, AttendanceStatus>;
  failedIds: Set<string>;
  onStatusChange: (status: AttendanceStatus) => void;
  drawerNote: string;
  onNoteChange: (note: string) => void;
  onSaveNote: () => Promise<void>;
  savingNote: boolean;
  onReload: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Self-contained hook that manages all state needed to open AttendanceDetailDrawer
 * for a SINGLE member + chosen date. Reuses the same server actions
 * (markAttendance / updateAttendance) as useAttendanceData but scoped to one
 * member without loading the full team list.
 *
 * @param workspaceId - active workspace id
 * @param member - the TeamMember whose day is being viewed/edited
 * @param onChanged - optional callback fired after a successful status change or note save
 */
export function useMemberDayAttendance(
  workspaceId: string | null | undefined,
  member: TeamMember | null,
  onChanged?: () => void,
): UseMemberDayAttendanceReturn {
  const { message: msgApi } = App.useApp();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>('');
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [drawerNote, setDrawerNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Record<string, AttendanceStatus>>({});
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  // Debounce timer for status changes (mirrors useAttendanceData.handleMarkOne)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot for optimistic revert on error
  const recordRef = useRef<AttendanceRecord | null>(null);

  // Keep recordRef in sync for use inside debounced callbacks
  const syncRecord = (r: AttendanceRecord | null) => {
    setRecord(r);
    recordRef.current = r;
  };

  // ── Load the record for the given member+date ────────────────────────────────

  const loadRecord = useCallback(
    async (dateIso: string) => {
      if (!workspaceId || !member) return;
      try {
        const res = await listAttendance(workspaceId, {
          date: dateIso,
          filters: JSON.stringify({ memberId: member.id }),
          limit: 1,
        });
        const arr = Array.isArray(res)
          ? res
          : ((res as PaginatedResponse<AttendanceRecord>).data ?? []);
        const rec = (arr[0] as AttendanceRecord & { note?: string }) ?? null;
        syncRecord(rec ?? null);
        setDrawerNote(rec?.note ?? '');
      } catch {
        syncRecord(null);
        setDrawerNote('');
      }
    },
    [workspaceId, member],
  );

  // ── Open for a date ──────────────────────────────────────────────────────────

  const openDay = useCallback(
    (dateIso: string) => {
      if (!member) return;
      // Cancel any in-flight debounce from a previous day
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      setPendingStatus({});
      setFailedIds(new Set());
      setDate(dateIso);
      setDrawerNote('');
      syncRecord(null);
      setOpen(true);
      void loadRecord(dateIso);
    },
    [member, loadRecord],
  );

  // ── Close + reset ────────────────────────────────────────────────────────────

  const close = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setOpen(false);
    setDate('');
    syncRecord(null);
    setDrawerNote('');
    setPendingStatus({});
    setFailedIds(new Set());
  }, []);

  // ── Reload (called by AttendanceDetailDrawer after save-times) ───────────────

  const onReload = useCallback(async () => {
    if (date) await loadRecord(date);
    onChanged?.();
  }, [date, loadRecord, onChanged]);

  // ── Status change (debounced optimistic, mirrors handleMarkOne) ──────────────

  const onStatusChange = useCallback(
    (status: AttendanceStatus) => {
      if (!workspaceId || !member) return;
      const memberId = member.id;

      setFailedIds((prev) => {
        const n = new Set(prev);
        n.delete(memberId);
        return n;
      });

      const previousStatus = (recordRef.current?.status ?? 'unmarked') as AttendanceStatus;
      setPendingStatus((prev) => ({ ...prev, [memberId]: status }));

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        debounceTimer.current = null;
        try {
          const existing = recordRef.current;
          const returned = existing
            ? await updateAttendance(workspaceId, existing._id, { status })
            : await markAttendance(workspaceId, {
                teamMemberId: memberId,
                date,
                status,
              });

          // Patch local record state with the returned value so subsequent
          // updates (note save, time save) have the real _id.
          if (returned) {
            syncRecord({
              ...(returned as AttendanceRecord),
              teamMemberId: memberId,
              status: (returned as AttendanceRecord).status ?? status,
            } as AttendanceRecord);
          } else {
            syncRecord({
              ...(recordRef.current ?? {}),
              teamMemberId: memberId,
              status,
              date,
            } as AttendanceRecord);
          }

          onChanged?.();
        } catch (e) {
          // Revert optimistic status
          setPendingStatus((prev) => {
            const n = { ...prev };
            if (n[memberId] === status) n[memberId] = previousStatus;
            return n;
          });
          setFailedIds((prev) => new Set([...prev, memberId]));
          msgApi.error(parseApiError(e));
        } finally {
          setPendingStatus((prev) => {
            const n = { ...prev };
            delete n[memberId];
            return n;
          });
        }
      }, 600);
    },
    [workspaceId, member, date, onChanged, msgApi],
  );

  // ── Save note ────────────────────────────────────────────────────────────────

  const onSaveNote = useCallback(async () => {
    if (!workspaceId || !member) return;
    setSavingNote(true);
    try {
      const existing = recordRef.current;
      if (existing) {
        await updateAttendance(workspaceId, existing._id, { note: drawerNote });
      } else {
        // No record yet - mark as present to persist the note
        await markAttendance(workspaceId, {
          teamMemberId: member.id,
          date,
          status: 'present',
          note: drawerNote,
        });
      }
      msgApi.success('Note saved');
      await loadRecord(date);
      onChanged?.();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingNote(false);
    }
  }, [workspaceId, member, date, drawerNote, loadRecord, onChanged, msgApi]);

  // selectedMember reflects the member prop (or null if closed) to satisfy
  // AttendanceDetailDrawer's selectedMember prop contract.
  const selectedMember = open ? member : null;

  return {
    openDay,
    close,
    open,
    selectedMember,
    date: date || dayjs().format('YYYY-MM-DD'),
    record,
    pendingStatus,
    failedIds,
    onStatusChange,
    drawerNote,
    onNoteChange: setDrawerNote,
    onSaveNote,
    savingNote,
    onReload,
  };
}
