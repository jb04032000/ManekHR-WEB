import dayjs from 'dayjs';
import { listAttendance } from '@/lib/actions';
import { generateCsvFromAoa } from '@/lib/export/generateCsv';
import type { AttendanceRecord, PaginatedResponse } from '@/types';

// ── Status label map (English, for CSV readability) ───────────────────────────

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half Day',
  on_leave: 'On Leave',
  holiday: 'Holiday',
  week_off: 'Week Off',
};

function fmtStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return dayjs(iso).format('hh:mm A');
}

function fmtHours(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Public export helper ──────────────────────────────────────────────────────

export interface ExportMemberAttendanceOptions {
  wsId: string;
  memberId: string;
  memberName: string;
  month: number;
  year: number;
}

/**
 * Fetches this member's attendance records for the given month/year using the
 * same `listAttendance` call that `MemberAttendancePanel` uses, builds a CSV
 * row array, and triggers a browser download.
 *
 * Returns:
 *   'ok'    - download triggered successfully
 *   'empty' - no records found for that period (caller should show a message)
 */
export async function exportMemberAttendance(
  opts: ExportMemberAttendanceOptions,
): Promise<'ok' | 'empty'> {
  const { wsId, memberId, memberName, month, year } = opts;

  const res = await listAttendance(wsId, {
    filters: JSON.stringify({ memberId }),
    month,
    year,
    limit: 100,
  });

  const records: AttendanceRecord[] = Array.isArray(res)
    ? res
    : ((res as PaginatedResponse<AttendanceRecord>).data ?? []);

  if (records.length === 0) return 'empty';

  // Sort ascending by date (same as the panel's sortedRecords)
  const sorted = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Header row
  const header: string[] = [
    'Date',
    'Day',
    'Status',
    'Check-In',
    'Check-Out',
    'Hours Worked',
    'Source',
  ];

  const dataRows: (string | number)[][] = sorted.map((r) => [
    dayjs(r.date).format('DD MMM YYYY'),
    dayjs(r.date).format('ddd'),
    fmtStatus(r.status),
    fmtTime(r.checkIn),
    fmtTime(r.checkOut),
    fmtHours(r.workedMinutes),
    r.dominantSource ?? '',
  ]);

  const safeName = memberName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  const filename = `attendance-${safeName}-${year}-${String(month).padStart(2, '0')}.csv`;

  await generateCsvFromAoa([header, ...dataRows], filename);

  return 'ok';
}
