import dayjs from 'dayjs';
import type { ExportField } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Row type - flat display model used by PDF + Excel generators
// ─────────────────────────────────────────────────────────────────────────────

export interface AttendanceExportRow {
  memberId: string;
  memberName: string;
  designation: string;
  shiftName: string;
  date: string; // formatted: 'DD MMM YYYY'
  dayOfWeek: string; // 'Mon', 'Tue', etc.
  status: string; // title-case: 'Present', 'Half Day', etc.
  checkIn: string; // 'HH:MM' or '-'
  checkOut: string; // 'HH:MM' or '-'
  note: string;
  autoMarked: string; // 'Yes' | 'No'
}

// ─────────────────────────────────────────────────────────────────────────────
// Status label map - raw backend value → human-readable label
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABEL_MAP: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  late: 'Late',
  on_leave: 'On Leave',
  holiday: 'Holiday',
  week_off: 'Week Off',
  unmarked: 'Unmarked',
};

// ─────────────────────────────────────────────────────────────────────────────
// Status cell colors - keyed by the human-readable label produced above.
// Each entry is { fill: [R,G,B], text: [R,G,B] } for jspdf-autotable.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CELL_COLORS: Record<
  string,
  {
    fill: [number, number, number];
    text: [number, number, number];
  }
> = {
  Present: { fill: [220, 252, 231], text: [21, 128, 61] },
  Absent: { fill: [254, 226, 226], text: [185, 28, 28] },
  'Half Day': { fill: [255, 237, 213], text: [154, 52, 18] },
  Late: { fill: [254, 249, 195], text: [133, 77, 14] },
  'On Leave': { fill: [219, 234, 254], text: [29, 78, 216] },
  Holiday: { fill: [237, 233, 254], text: [109, 40, 217] },
  'Week Off': { fill: [243, 244, 246], text: [75, 85, 99] },
  Unmarked: { fill: [249, 250, 251], text: [156, 163, 175] },
};

// ─────────────────────────────────────────────────────────────────────────────
// Field definitions
//
// DEFAULT SET (defaultEnabled: true) - 6 fields:
//   Employee Name, Date, Day, Status, Check-In, Check-Out
//
// CUSTOM-ONLY SET (defaultEnabled: false) - 4 fields:
//   Designation, Shift, Note, Auto-Marked
// ─────────────────────────────────────────────────────────────────────────────

export const ATTENDANCE_EXPORT_FIELDS: ExportField<AttendanceExportRow>[] = [
  // ── Default fields ──────────────────────────────────────────────────────────
  {
    key: 'memberId',
    label: 'Employee ID',
    defaultEnabled: false,
    getValue: (r) => r.memberId,
    pdf: { cellWidth: 25, halign: 'center' },
  },
  {
    key: 'memberName',
    label: 'Employee Name',
    defaultEnabled: true,
    getValue: (r) => r.memberName,
    pdf: { halign: 'left' },
  },
  {
    key: 'date',
    label: 'Date',
    defaultEnabled: true,
    getValue: (r) => r.date,
    pdf: { cellWidth: 30, halign: 'center' },
  },
  {
    key: 'dayOfWeek',
    label: 'Day',
    defaultEnabled: true,
    getValue: (r) => r.dayOfWeek,
    pdf: { cellWidth: 14, halign: 'center' },
  },
  {
    key: 'status',
    label: 'Status',
    defaultEnabled: true,
    getValue: (r) => r.status,
    pdf: {
      cellWidth: 28,
      halign: 'center',
      getCellColors: (v) => STATUS_CELL_COLORS[v as string],
    },
  },
  {
    key: 'checkIn',
    label: 'Check-In',
    defaultEnabled: false,
    getValue: (r) => r.checkIn,
    pdf: { cellWidth: 22, halign: 'center' },
  },
  {
    key: 'checkOut',
    label: 'Check-Out',
    defaultEnabled: false,
    getValue: (r) => r.checkOut,
    pdf: { cellWidth: 22, halign: 'center' },
  },

  // ── Custom-only fields ───────────────────────────────────────────────────────
  {
    key: 'designation',
    label: 'Designation',
    defaultEnabled: false,
    getValue: (r) => r.designation,
    pdf: { cellWidth: 38, halign: 'left' },
  },
  {
    key: 'shiftName',
    label: 'Shift',
    defaultEnabled: false,
    getValue: (r) => r.shiftName,
    pdf: { cellWidth: 32, halign: 'left' },
  },
  {
    key: 'note',
    label: 'Note',
    defaultEnabled: false,
    getValue: (r) => r.note,
    pdf: { halign: 'left' },
  },
  {
    key: 'autoMarked',
    label: 'Auto-Marked',
    defaultEnabled: false,
    getValue: (r) => r.autoMarked,
    pdf: { cellWidth: 24, halign: 'center' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status character map for matrix view
// P = Present, A = Absent, H = Half Day, L = Leave, W = Week Off, Ho = Holiday, -- = No record
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_CHAR_MAP: Record<string, string> = {
  present: 'P',
  absent: 'A',
  half_day: 'H',
  late: 'P', // Late counts as present
  on_leave: 'L',
  holiday: 'Ho',
  week_off: 'W',
  unmarked: '--',
};

export function getStatusChar(raw: string): string {
  return STATUS_CHAR_MAP[raw] ?? '--';
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix export row type
// ─────────────────────────────────────────────────────────────────────────────

export interface AttendanceMatrixRow {
  memberId: string;
  memberName: string;
  designation: string;
  shiftName: string;
  days: string[]; // 28-31 elements based on month
  totalPresent: number;
  totalAbsent: number;
  totalHalfDays: number;
  totalLeaves: number;
  totalWeekOffs: number;
  totalHolidays: number;
}

// Shift group header row (for grouping employees by shift)
export interface AttendanceMatrixShiftGroup {
  isShiftHeader: true;
  shiftName: string;
  days: string[]; // empty for header
  totalPresent: number;
  totalAbsent: number;
  totalHalfDays: number;
  totalLeaves: number;
  totalWeekOffs: number;
  totalHolidays: number;
}

// Union type for matrix export
export type AttendanceMatrixExportRow = AttendanceMatrixRow | AttendanceMatrixShiftGroup;

// ─────────────────────────────────────────────────────────────────────────────
// Matrix export fields - dynamically generated based on month days
// ─────────────────────────────────────────────────────────────────────────────

// Helper to get value from either row type
function getMatrixValue(row: AttendanceMatrixExportRow, key: string): string | number {
  if ('isShiftHeader' in row && row.isShiftHeader) {
    // Shift header row
    if (key === 'memberName') return row.shiftName;
    if (key === 'shiftName') return '';
    if (key === 'memberId') return '';
    if (key === 'designation') return '';
    if (key === 'days') return '';
    const typedRow = row as AttendanceMatrixShiftGroup;
    if (key === 'totalPresent') return typedRow.totalPresent;
    if (key === 'totalAbsent') return typedRow.totalAbsent;
    if (key === 'totalHalfDays') return typedRow.totalHalfDays;
    if (key === 'totalLeaves') return typedRow.totalLeaves;
    if (key === 'totalWeekOffs') return typedRow.totalWeekOffs;
    if (key === 'totalHolidays') return typedRow.totalHolidays;
    return 0;
  }
  const typedRow = row as AttendanceMatrixRow;
  if (key === 'memberId') return typedRow.memberId;
  if (key === 'memberName') return typedRow.memberName;
  if (key === 'designation') return typedRow.designation;
  if (key === 'shiftName') return typedRow.shiftName;
  if (key === 'days') return typedRow.days.join(',');
  if (key === 'totalPresent') return typedRow.totalPresent;
  if (key === 'totalAbsent') return typedRow.totalAbsent;
  if (key === 'totalHalfDays') return typedRow.totalHalfDays;
  if (key === 'totalLeaves') return typedRow.totalLeaves;
  if (key === 'totalWeekOffs') return typedRow.totalWeekOffs;
  if (key === 'totalHolidays') return typedRow.totalHolidays;
  return '';
}

export function getAttendanceMatrixFields(
  daysInMonth: number,
): ExportField<AttendanceMatrixExportRow>[] {
  const dayFields: ExportField<AttendanceMatrixExportRow>[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dayFields.push({
      key: `day${d}`,
      label: String(d),
      defaultEnabled: true,
      getValue: (r) => {
        if ('isShiftHeader' in r && r.isShiftHeader) return '';
        return r.days[d - 1] ?? '--';
      },
      pdf: { cellWidth: 6, halign: 'center' },
    });
  }

  return [
    // ── Static columns ─────────────────────────────────────────────────────────
    {
      key: 'memberId',
      label: 'ID',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'memberId'),
      pdf: { cellWidth: 10, halign: 'center' },
    },
    {
      key: 'memberName',
      label: 'Employee Name',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'memberName'),
      pdf: { cellWidth: 25, halign: 'left' },
    },
    {
      key: 'designation',
      label: 'Designation',
      defaultEnabled: false,
      getValue: (r) => getMatrixValue(r, 'designation'),
      pdf: { cellWidth: 18, halign: 'left' },
    },
    {
      key: 'shiftName',
      label: 'Shift',
      defaultEnabled: false,
      getValue: (r) => getMatrixValue(r, 'shiftName'),
      pdf: { cellWidth: 15, halign: 'left' },
    },
    // ── Day columns (dynamic) ────────────────────────────────────────────────
    ...dayFields,
    // ── Totals columns ────────────────────────────────────────────────────────
    {
      key: 'totalPresent',
      label: 'P',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'totalPresent'),
      pdf: { cellWidth: 6, halign: 'center' },
    },
    {
      key: 'totalAbsent',
      label: 'A',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'totalAbsent'),
      pdf: { cellWidth: 6, halign: 'center' },
    },
    {
      key: 'totalHalfDays',
      label: 'H',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'totalHalfDays'),
      pdf: { cellWidth: 6, halign: 'center' },
    },
    {
      key: 'totalLeaves',
      label: 'L',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'totalLeaves'),
      pdf: { cellWidth: 6, halign: 'center' },
    },
    {
      key: 'totalWeekOffs',
      label: 'W',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'totalWeekOffs'),
      pdf: { cellWidth: 6, halign: 'center' },
    },
    {
      key: 'totalHolidays',
      label: 'Ho',
      defaultEnabled: true,
      getValue: (r) => getMatrixValue(r, 'totalHolidays'),
      pdf: { cellWidth: 6, halign: 'center' },
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers exported for use in AttendanceExportModal
// ─────────────────────────────────────────────────────────────────────────────

export function formatAttendanceStatus(raw: string): string {
  return STATUS_LABEL_MAP[raw] ?? raw;
}

export function formatAttendanceDate(isoDate: string): string {
  return dayjs(isoDate).format('DD MMM YYYY');
}

export function formatAttendanceDayOfWeek(isoDate: string): string {
  return dayjs(isoDate).format('ddd');
}

export function formatAttendanceTime(time: string | undefined | null): string {
  if (!time) return '-';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
