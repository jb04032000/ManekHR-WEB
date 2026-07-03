import dayjs from 'dayjs';
import {
  friendlyFromAxiosMessage,
  isNetworkError,
  NETWORK_UNREACHABLE_MESSAGE,
} from '@/lib/format/http-errors';

// ── Status helpers (mirrors mobile app) ───────────
const STATUS_COLOR: Record<string, string> = {
  present: 'var(--cr-success-500)',
  absent: 'var(--cr-danger-500)',
  half_day: 'var(--cr-warning-500)',
  late: 'var(--cr-warning-500)',
  on_leave: 'var(--cr-indigo-400)',
  holiday: 'var(--cr-info-500)',
  week_off: 'var(--cr-text-3)',
  unmarked: 'var(--cr-neutral-300)',
  pending: 'var(--cr-warning-500)',
  paid: 'var(--cr-success-500)',
  partial: 'var(--cr-warning-500)',
  partially_paid: 'var(--cr-warning-500)',
  overdue: 'var(--cr-danger-500)',
  payable: 'var(--cr-danger-500)',
  receivable: 'var(--cr-success-500)',
  active: 'var(--cr-success-500)',
  cancelled: 'var(--cr-danger-500)',
  expired: 'var(--cr-text-3)',
  trial: 'var(--cr-indigo-400)',
};

const STATUS_BG: Record<string, string> = {
  present: 'var(--cr-success-50)',
  absent: 'var(--cr-danger-50)',
  half_day: 'var(--cr-warning-50)',
  late: 'var(--cr-warning-50)',
  on_leave: 'var(--cr-indigo-50)',
  holiday: 'var(--cr-info-50)',
  week_off: 'var(--cr-bg)',
  unmarked: 'var(--cr-bg)',
  pending: 'var(--cr-warning-50)',
  paid: 'var(--cr-success-50)',
  partial: 'var(--cr-warning-50)',
  partially_paid: 'var(--cr-warning-50)',
  overdue: 'var(--cr-danger-50)',
  active: 'var(--cr-success-50)',
  cancelled: 'var(--cr-danger-50)',
  expired: 'var(--cr-bg)',
  trial: 'var(--cr-indigo-50)',
};

export const getStatusColor = (status: string) => STATUS_COLOR[status] ?? 'var(--cr-text-3)';
export const getStatusBg = (status: string) => STATUS_BG[status] ?? 'var(--cr-bg)';

export const getStatusTag = (status: string): { color: string; bg: string; label: string } => ({
  color: getStatusColor(status),
  bg: getStatusBg(status),
  label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
});

// ── Ant Design Tag color map (for <Tag color="..."> ──
const ANT_TAG_PRESET: Record<string, string> = {
  present: 'success',
  absent: 'error',
  half_day: 'warning',
  late: 'orange',
  on_leave: 'purple',
  holiday: 'cyan',
  week_off: 'default',
  paid: 'success',
  pending: 'warning',
  partial: 'orange',
  partially_paid: 'orange',
  overdue: 'error',
  active: 'success',
  cancelled: 'error',
  expired: 'default',
  trial: 'purple',
};
export const getAntTagColor = (status: string) => ANT_TAG_PRESET[status] ?? 'default';

// ── Currency ──────────────────────────────────────
export function formatCurrency(amount: number, symbol = '₹', locale = 'en-IN'): string {
  if (isNaN(amount)) return `${symbol}0`;
  if (amount >= 10_00_000) return `${symbol}${(amount / 10_00_000).toFixed(2)}L`;
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  return `${symbol}${amount.toLocaleString(locale)}`;
}

export function formatCurrencyFull(amount: number, symbol = '₹', locale = 'en-IN'): string {
  return `${symbol}${Number(amount ?? 0).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// ── Dates ─────────────────────────────────────────
export const fmt = (date?: string | Date | null, fmt = 'DD MMM YYYY') =>
  date ? dayjs(date).format(fmt) : '-';

export const fmtTime = (date?: string | Date | null) =>
  date ? dayjs(date).format('hh:mm A') : '-';

export const todayISO = () => dayjs().format('YYYY-MM-DD');

export function monthOptions(n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const d = dayjs().subtract(i, 'month');
    return {
      month: d.month() + 1,
      year: d.year(),
      label: d.format('MMMM YYYY'),
      short: d.format('MMM YY'),
    };
  });
}

// ── String helpers ────────────────────────────────
export function getInitials(name = ''): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

export function avatarColor(name = ''): string {
  const COLORS = [
    'var(--cr-primary)',
    'var(--cr-primary-hover)',
    'var(--cr-primary-hover)',
    'var(--cr-danger-700)',
    'var(--cr-warning-700)',
    'var(--cr-success-700)',
    'var(--cr-info-700)',
    'var(--cr-danger-700)',
  ];
  const idx = (name.charCodeAt(0) || 0) % COLORS.length;
  return COLORS[idx];
}

export function truncate(str: string, n = 30): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ── Error parsing ─────────────────────────────────
export function parseApiError(err: unknown): string {
  if (!err) return 'Something went wrong';

  // Transport-layer failure (backend down / timeout / connection refused) -
  // checked first so a raw "timeout of 15000ms exceeded" never leaks through the
  // `err.message` branches below. Returns the English friendly floor; auth
  // screens that hold an ActionResult.errorCode upgrade this to a localized
  // NETWORK_UNREACHABLE message via useAuthErrorMessage.
  if (isNetworkError(err)) return NETWORK_UNREACHABLE_MESSAGE;

  // Check for axios error structure with response
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    if (response?.data) {
      const data = response.data;
      // Handle our backend format: { success: false, message: "...", code: "..." }
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        if (obj.message && typeof obj.message === 'string') {
          return obj.message;
        }
        // Backend envelope (crewroster-backend HttpExceptionFilter) nests the
        // real message at `data.error.message`, NOT top-level `data.message`;
        // `data.error` can also be a bare string. Reading it here surfaces
        // coded errors (e.g. advance-salary ADVANCE_REQUEST_DAY_CLOSED /
        // ADVANCE_DUPLICATE) instead of falling through to the generic
        // "Request failed with status code N" sentence. Keep in sync with the
        // server-action `extractErrorMessage` (lib/format/http-errors.ts),
        // which already reads this nested field.
        const errField = obj.error;
        if (typeof errField === 'string' && errField) {
          return errField;
        }
        if (errField && typeof errField === 'object') {
          const nestedMsg = (errField as Record<string, unknown>).message;
          if (typeof nestedMsg === 'string' && nestedMsg) {
            return nestedMsg;
          }
        }
      }
    }
  }

  if (err instanceof Error) {
    const msg = err.message;
    // Never surface a raw "Request failed with status code N" to the user -
    // map it to a plain-language sentence (server actions strip the axios
    // response, so this is all the client receives for an unwrapped error).
    if (typeof msg === 'string' && msg) return friendlyFromAxiosMessage(msg) ?? msg;
    return 'Something went wrong';
  }
  // Next.js server actions serialize errors as plain objects { message, digest }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    const raw = obj.message ?? obj.error ?? obj.msg;
    if (typeof raw === 'string' && raw) return friendlyFromAxiosMessage(raw) ?? raw;
    // Backend may nest: { message: { code, message } }
    if (raw && typeof raw === 'object') {
      const nested = (raw as Record<string, unknown>).message;
      if (typeof nested === 'string' && nested) return nested;
    }
  }
  return 'Something went wrong';
}

// ── Module / action labels ────────────────────────
export const MODULE_LABELS: Record<string, string> = {
  attendance: 'Attendance',
  team: 'Team',
  salary: 'Salary',
  // leave + resource_scopes added for the central plan-gate's ModuleLockedPage
  // (DashboardLayout) so those locked routes show a friendly name, not the raw
  // entitlement key. Keep in sync with ROUTE_MODULES in lib/constants/nav-permissions.ts.
  leave: 'Leave',
  resource_scopes: 'Resource Scopes',
  shifts: 'Shifts',
  roles: 'Roles',
  settings: 'Settings',
  bills: 'Bills',
  machines: 'Machines',
  holidays: 'Holidays',
  finance: 'Finance',
  parties: 'Parties',
  workspace: 'Workspace',
  reports: 'Reports',
  maintenance: 'Maintenance',
  locations: 'Locations',
  inventory: 'Inventory',
  manufacturing: 'Manufacturing',
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  mark: 'Mark',
  export: 'Export',
  add_payment: 'Add Payment',
  remove: 'Remove',
};

export const ALL_MODULES = Object.entries(MODULE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
export const ALL_ACTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ATTENDANCE_STATUSES = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'week_off', label: 'Week Off' },
];

// ─── Indian Paise Formatting (Phase F-14 - used by all report pages) ─────────

/** Full format for report tables: ₹1,23,456.78 */
export const fmtPaise = (paise: number): string =>
  '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Compact format for KPI dashboard cards: ₹12.50 L, ₹1.00 Cr */
export const fmtPaiseCompact = (paise: number): string => {
  const r = paise / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(2)} Cr`;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(2)} L`;
  return fmtPaise(paise);
};
