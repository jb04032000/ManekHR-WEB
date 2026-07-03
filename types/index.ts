import type { GrantedPath, PathOverride } from '@/types/rbac-registry';
export type { GrantedPath, PathOverride };

// ── Auth ──────────────────────────────────────────
/**
 * One DPDP deletion-scope marker on the User (ACCOUNT-DELETION-AND-DPDP-PLAN.md §4).
 * `pending` = inside the 30-day admin-mediated recovery window; `purged` = finalized.
 * `purgeAfter` is the recover-by cutoff (ISO). Mirrors the BE AccountDeletionMarker.
 */
export interface AccountDeletionMarker {
  state: 'pending' | 'purged';
  requestedAt: string;
  purgeAfter: string;
  requestedBy?: string;
}

export interface User {
  _id: string;
  name: string;
  email?: string;
  mobile?: string;
  profilePicture?: string;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  hasWorkspace: boolean;
  hasPassword: boolean;
  /**
   * Per-product policy/terms consent timestamps (ISO), stamped by the backend
   * at signup from the chosen product and on each PolicyGate accept. Null/absent
   * = not accepted. These ride out on the sanitised user (not in
   * sanitizeUser's SENSITIVE_KEYS), so the FE reads them directly. Used by
   * `resolvePostAuthTarget` (lib/auth/post-auth-target.ts) to tell a
   * workspaceless ERP-intent signup (erp set, connect not) apart from a
   * Connect-only user, so the former finishes onboarding at /auth/setup-workspace
   * instead of being force-pushed to /connect/feed.
   */
  erpPolicyAcceptedAt?: string | null;
  connectPolicyAcceptedAt?: string | null;
  /**
   * Set when the current session was minted via the SMS-OTP forgot-password
   * flow (BE embeds the corresponding `forgotPasswordReset: true` claim in
   * the JWT). The settings page hides the "current password" field and
   * routes the submit through POST /auth/change-password-after-forgot
   * instead of PATCH /users/change-password while this flag is true.
   * Cleared after the BE re-issues a fresh token pair without the claim.
   */
  forgotPasswordReset?: boolean;
  /** True when the user has set a 6-digit App Lock PIN. */
  hasPin: boolean;
  /** ISO timestamp when the user (re)set their App Lock PIN; absent when never set. */
  pinSetAt?: string;
  /**
   * Per-user App Lock idle timeout in ms. `null`/absent ⇒ the per-workspace
   * `Workspace.appLockIdleMs` applies (and falls through to the env default).
   * Setting a value here overrides the workspace value for THIS user - also
   * the only idle source for a Connect-only (workspace-less) account.
   */
  appLockIdleMs?: number | null;
  isActive: boolean;
  googleId?: string;
  isAdmin?: boolean;
  deletedAt?: string;
  // Seeded demo/sample account marker (BE User.isDemo). Hidden from the admin
  // Users list by default; surfaced with a "Demo" tag when the admin toggles
  // "Show demo accounts". Mirrors the backend user.schema.ts isDemo field.
  isDemo?: boolean;
  /**
   * DPDP self-serve deletion markers (ACCOUNT-DELETION-AND-DPDP-PLAN.md). Present
   * only once a scope has been scheduled. `state==='pending'` means the scope is
   * inside its 30-day, admin-mediated recovery window (recovery is by contacting
   * Zari - there is no self-cancel). The backend returns these on `auth/me` (they
   * are not in sanitizeUser's SENSITIVE_KEYS). Consumed by the account-deletion
   * danger zones (account security + Connect profile) to show the "scheduled"
   * state instead of the delete action. Keep in sync with the BE User schema.
   */
  connectDeletion?: AccountDeletionMarker | null;
  erpDeletion?: AccountDeletionMarker | null;
  accountDeletion?: AccountDeletionMarker | null;
  createdAt?: string;
  sessionLimitOverride?: number | null;
  /**
   * UI hints the user has permanently dismissed (e.g. `connect_explore`).
   * Persisted server-side; absent on sessions that predate the field.
   */
  dismissedHints?: string[];
  /**
   * Public-profile slug - the human-readable identifier in `/u/<handle>`.
   * Auto-generated at signup from `name`; user-editable from
   * `/account/profile` with a 30-day cooldown. `null` for pre-backfill rows
   * (the public profile route falls back to ObjectId lookup in that case).
   */
  handle?: string | null;
  /**
   * When `handle` was last claimed by the user. Drives the 30-day cooldown
   * on user-initiated changes; `null` for auto-generated handles.
   */
  handleChangedAt?: string | null;
}

// ── App Lock (Quick PIN) ──────────────────────────
export interface PinStatus {
  pinSet: boolean;
  locked: boolean;
  unlockExpiresAt: string | null;
}

export interface PinUnlockResult {
  ok: true;
  unlockExpiresAt: string;
}

export type PlatformAccess = 'web_only' | 'mobile_only' | 'both';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
  isNewUser: boolean;
  platformAccess?: PlatformAccess;
  /**
   * SMS-OTP forgot-password path returns this - FE post-login redirect routes
   * to /dashboard/settings/security/change-password instead of /dashboard.
   */
  mustResetPassword?: boolean;
}

// ── Branding ─────────────────────────────────────
export interface BrandingAssets {
  logo?: string;
  pdfHeaderLogo?: string;
  pdfWatermarkLogo?: string;
  pdfFooterDetails?: string;
  // Owner-uploaded background image for the employee ID card (light watermark).
  idCardBackground?: string;
}

export interface WorkspaceExportPreferences {
  includeHeaderLogo: boolean;
  includeFooter: boolean;
  includeWatermark: boolean;
  showExportDate?: boolean;
  orientation?: 'portrait' | 'landscape' | 'auto';
}

// ── Employee Code Settings ────────────────────────
export interface EmployeeCodeSettings {
  enabled: boolean;
  format: string;
  prefix: string;
  startingNumber: number;
  allowCustom: boolean;
}

export interface EmployeeCodeSettingsResponse {
  settings: EmployeeCodeSettings;
  currentCounter: number;
  nextSequence: number;
  // Fixed workspace code the backend embeds as the {WS} token in every generated
  // employee code (e.g. "ZARI"). Auto-derived server-side; read-only on the client.
  // Keep in sync with backend getEmployeeCodeSettings response + the {WS} renderer
  // in app/dashboard/workspace/employee-code/page.tsx.
  workspaceCode?: string;
}

export interface BackfillEmployeeCodesResponse {
  assigned: number;
  skipped: number;
  conflicts: { memberId: string; name: string }[];
  counter: number;
}

export type TeamMemberDocumentType =
  | 'aadhaar'
  | 'pan'
  | 'passport'
  | 'driving_license'
  | 'voter_id'
  | 'offer_letter'
  | 'appointment_letter'
  | 'education'
  | 'experience'
  | 'passbook'
  | 'other';

export interface TeamMemberDocument {
  id: string;
  teamMemberId?: string;
  workspaceId?: string;
  type: TeamMemberDocumentType;
  label?: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  createdAt?: string;
}

export interface PendingDocument {
  localId: string;
  type: TeamMemberDocumentType;
  label?: string;
  file: File;
  previewUrl: string;
  fileName: string;
}

// ── Designations (F1, 2026-05-13) ─────────────────
// Per-locale labels with canonical-en key mirrored to `team_member.designation`
// for mobile-app contract compatibility. Backend returns record shape via
// `GET /workspaces/:id/designations`; legacy workspaces with `string[]` are
// coerced server-side by `normalizeDesignationsForRead`.
export type DesignationLocale = 'en' | 'gu-en' | 'hi-en' | 'gu';

export interface DesignationLabels {
  en: string;
  'gu-en'?: string;
  'hi-en'?: string;
  gu?: string;
}

export interface DesignationRecord {
  canonical: string;
  isPreset: boolean;
  labels: DesignationLabels;
}

// ── Workspace ─────────────────────────────────────

/** Defaulter-alerts configuration stored in workspace.attendanceSettings.defaulterAlerts. */
export interface DefaulterAlertsConfig {
  enabled: boolean;
  channels: { inApp: boolean; email: boolean };
  recipients: {
    mode: 'managers' | 'specificPeople' | 'both';
    specificPeople: string[];
  };
}

/** Notification policy stored in workspace.notificationPolicy. */
export interface WorkspaceNotificationPolicy {
  permissionChanges?: {
    enabled: boolean;
    channels: { inApp: boolean; email: boolean; sms: boolean };
  };
}

export interface Workspace {
  _id: string;
  name: string;
  // Immutable, system-generated short workspace code (e.g. "ZARI"). Embedded as
  // the {WS} token in every employee code. Never user-editable.
  workspaceCode?: string;
  businessType?: string;
  location?: string;
  // Company postal address — single source of truth for the employee ID card.
  address?: string;
  timezone: string;
  fiscalYearStartMonth?: number;
  ownerId: string;
  isActive: boolean;
  isDefault?: boolean;
  /**
   * Union for backward-compat: legacy docs may still carry `string[]` until
   * read through `normalizeDesignationsForRead` (BE) or the FE
   * `listDesignations` action. New writes always emit `DesignationRecord[]`.
   * Prefer calling `listDesignations(workspaceId)` over reading this field
   * directly when locale-aware labels matter.
   */
  designations: (string | DesignationRecord)[];
  bankAccounts: BankAccount[];
  branding?: BrandingAssets;
  exportPreferences?: WorkspaceExportPreferences;
  createdAt?: string;
  // App Lock idle timeout override (ms). null = deployment default.
  appLockIdleMs?: number | null;
  // Kiosk fields (M-04)
  kioskEnabled?: boolean;
  kioskTokenRotatedAt?: string | null;
  kioskAllowedIpRanges?: string[];
  // Employee self-service policy (Access Control Initiative §8). Absent on
  // workspaces that never set it - treat a missing field as both-false.
  selfServiceConfig?: {
    selfPunch: boolean;
    selfLeaveApply: boolean;
  };
  // Attendance-module workspace preferences. Currently hosts the compliance
  // threshold (defaulters cutoff %), shared across all managers in the
  // workspace. Absent on workspaces that never set it - readers should
  // fall back to 90 (the schema default).
  attendanceSettings?: {
    complianceThresholdPct: number;
    defaulterAlerts?: DefaulterAlertsConfig;
  };
  // Workspace-level notification policy (Phase 2.4). Controls when and how
  // members are notified about workspace events (e.g. permission changes).
  // Absent on workspaces that never set it - readers apply schema defaults:
  // permissionChanges.enabled = true, channels.inApp = true, others false.
  notificationPolicy?: WorkspaceNotificationPolicy;
}

/** Kiosk configuration state for a workspace (subset of Workspace - no hash exposed). */
export interface WorkspaceKioskState {
  kioskEnabled: boolean;
  kioskTokenRotatedAt: string | null;
  kioskAllowedIpRanges: string[];
}

export interface WorkspaceMember {
  _id: string;
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member';
  user?: User;
}

export interface BankAccount {
  id: string;
  label: string;
}

// ── Team ──────────────────────────────────────────
export interface RbacRoleInfo {
  id: string;
  name: string;
  color: string;
}

export interface ShiftInfo {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}

export interface TeamMember {
  id: string;
  workspaceId?: string;
  name: string;
  mobile?: string;
  email?: string;
  designation?: string;
  avatar?: string;
  rbacRole?: RbacRoleInfo;
  /** Raw role ID - convenience field for change-role flows that need the
   *  pre-population value without re-deriving from rbacRole.id. */
  rbacRoleId?: string;
  role?: RbacRoleInfo;
  hasAppAccess: boolean;
  appAccessStatus?: 'none' | 'invited' | 'active';
  /** ISO timestamp of when the current invite expires; only meaningful when
   *  appAccessStatus === 'invited'. */
  appAccessInviteExpiry?: string;
  /** Raw invite token (URL slug). Returned only when appAccessStatus ===
   *  'invited' so the rail can render a copyable share link any time the
   *  owner returns to the detail page. */
  appAccessInviteToken?: string;
  /** ISO timestamp of when the member was granted access (whether the
   *  invite was later accepted or not). */
  appAccessGrantedAt?: string;
  /** User ID of the actor that granted access - used in the access section
   *  header ("Granted by X on Y"). */
  appAccessGrantedBy?: string;
  /** Display name of the granting actor; populated server-side via the
   *  `appAccessGrantedBy` reference. May be undefined if the user has been
   *  deleted or the response chain didn't populate the join. */
  appAccessGrantedByName?: string;
  /** Per-member permission overrides on top of the assigned role (P3).
   *  Empty array = no overrides; falls through to pure role permissions. */
  permissionOverrides?: TeamMemberPermissionOverride[];
  /** Per-member registry-path overrides (Team-module granular paths). BE returns
   *  these as of Phase 1c. Absent on pre-1c API responses - treat as empty. */
  permissionPathOverrides?: PathOverride[];
  linkedUserId?: string;
  shift?: ShiftInfo;
  weeklyOff: string[];
  scheduleType: 'shift' | 'custom';
  customSchedule?: { startTime: string; endTime: string };
  salaryType: 'monthly' | 'hourly' | 'piece_rate';
  pieceRateConfig?: PieceRateConfig;
  salaryAmount: number;
  salaryDayBasis?: 'fixed_month_days' | 'calendar_month_days';
  fixedMonthDays?: number | null;
  attendancePayMode?: 'default' | 'enabled' | 'disabled';
  dailyHours?: number;
  workingDays?: number;
  finalMonthlyOverride?: number;
  // Statutory & Tax
  pan?: string;
  uan?: string;
  taxRegime?: 'old' | 'new';
  stateOfEmployment?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant';
  pfApplicable?: boolean;
  pfOptedOut?: boolean;
  esiApplicable?: boolean;
  esiIpNumber?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  isNonItrFiler?: boolean;
  ctcAmount?: number;
  componentTemplateId?: string;
  componentOverrides?: EmployeeComponentOverride[];
  bankDetails?: BankDetails;
  upiDetails?: UpiDetails;
  preferredMethod?: 'BANK' | 'UPI';
  dateOfBirth?: string;
  dateOfJoining?: string;
  dateOfResignation?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  address?: string;
  // Denormalised work-location NAME (legacy string; the ID card derives the city
  // from it). Set from the picked location in the form.
  location?: string;
  // Canonical reference into the workspace Locations master list (the same
  // entity the Machines module uses). Links employee ↔ machine-section location.
  locationId?: string;
  employeeCode?: string;
  reportsTo?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  // Kiosk fields (M-04) - no hash fields exposed
  kioskPinSet?: boolean;
  kioskPinSetAt?: string | null;
  kioskFailedAttempts?: number;
  kioskLockedUntil?: string | null;
  // Karigar profile (F-11)
  isKarigar?: boolean;
  karigarSkillType?: string;
  karigarDailyRatePaise?: number;
  // Phase 1f mobile-OTP verification (2026-05-21). ISO timestamp set when the
  // member's mobile number is OTP-verified at add-member time (proof token
  // accepted by BE) OR carried over from a source TeamMember during cross-
  // workspace importMembers. `null` until verified. Drives the "unverified
  // mobile" badge on the team list and member profile surfaces.
  mobileVerifiedAt?: string | null;
  /**
   * Phase 1 compliance - per-member minimum monthly wage override (INR).
   * When set, overrides PayrollConfig.compliance.minimumWageMonthly for this
   * member's compliance guard. Null = use workspace default.
   * Writable by HR and Owner only (statutory field group gate).
   */
  minimumWageMonthlyOverride?: number | null;
}

/** Kiosk PIN state for a team member (subset of TeamMember - no hash exposed). */
export interface TeamMemberKioskState {
  kioskPinSet: boolean;
  kioskPinSetAt: string | null;
  kioskFailedAttempts: number;
  kioskLockedUntil: string | null;
}

export interface BankDetails {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  passbookImageUrl?: string;
}

export interface UpiDetails {
  upiId: string;
  qrCodeUrl?: string;
}

// ── Attendance ────────────────────────────────────
export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'late'
  | 'on_leave'
  | 'holiday'
  | 'week_off';

export interface AttendanceRecord {
  _id: string;
  workspaceId: string;
  /** String ID when not populated; partial TeamMember object when populated by backend */
  teamMemberId: string | { _id: string; name: string };
  date: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  note?: string;
  markedBy?: string;
  autoMarked?: boolean;
  teamMember?: TeamMember;
  statusHistory?: Array<{
    status: string;
    changedAt: string;
    changedBy: string | { _id: string; name: string } | null;
  }>;
  // Phase C: policy engine projection fields
  workedMinutes?: number | null;
  lateMinutes?: number | null;
  earlyMinutes?: number | null;
  otMinutes?: number | null;
  computeReason?: string | null;
  // Phase M: kiosk / manual entry fields
  dominantSource?: AttendanceEventSource;
  lockState?: 'open' | 'locked';
  /** Decorated by backend at read time: true when payroll is generated + locked for this period (D-27, M-05). */
  isLocked?: boolean;
  events?: AttendanceEvent[];
}

/** One paired check-in -> check-out work block. `out` is null while open. */
export interface AttendanceDaySession {
  in: string; // ISO
  out: string | null; // ISO
}

/**
 * Self-service single-day attendance (`GET /me/attendance/day`). Carries the
 * first-in/last-out projection summary PLUS the full paired session list and
 * live punch state - powers the member's "today" clock and calendar day-detail.
 */
export interface MeAttendanceDay {
  date: string; // YYYY-MM-DD (UTC)
  status: string | null;
  checkIn: string | null; // ISO
  checkOut: string | null; // ISO
  workedMinutes: number | null;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  otMinutes: number | null;
  /** True when the last punch of the day was a CHECK_IN (an open session). */
  currentlyIn: boolean;
  lastPunchType: 'CHECK_IN' | 'CHECK_OUT' | null;
  lastPunchAt: string | null; // ISO
  /** Total CHECK_IN + CHECK_OUT punches recorded for the day. */
  punchCount: number;
  sessions: AttendanceDaySession[];
}

/** One entry per member who has on_leave records within the queried date range */
export interface UpcomingLeaveEntry {
  memberId: string;
  memberName: string;
  /** Earliest on-leave date in range (YYYY-MM-DD) */
  firstDate: string;
  /** Latest on-leave date in range (YYYY-MM-DD) */
  lastDate: string;
  totalDays: number;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  half_day: number;
  late: number;
  on_leave: number;
  holiday: number;
  week_off: number;
  unmarked: number;
  total: number;
  /**
   * Present (optional) only when this workspace is OVER its plan's member limit
   * after the grace window. Drives the <MemberCapNotice> banner above the
   * attendance report (components/dashboard/MemberCapNotice.tsx). Absent = not
   * capped. The backend returns it as a SIBLING of `data` on the getSummary
   * envelope; getAttendanceSummary (lib/actions/attendance.actions.ts) merges it
   * onto this object so the consumer reads it as `summary.memberCap`. Keep in
   * sync with the backend attendance getSummary response shape.
   */
  memberCap?: {
    capped: boolean;
    visibleCount: number;
    totalCount: number;
    limit: number;
  };
}

// ── Live Presence (Phase 3 - "who's in" board) ───────────────
export type LivePresenceStatus =
  | 'working'
  | 'done'
  | 'present'
  | 'on_leave'
  | 'absent'
  | 'not_punched'
  | 'week_off'
  | 'holiday';

export interface LivePresenceMember {
  memberId: string;
  name: string;
  designation: string;
  shiftName: string;
  presence: LivePresenceStatus;
  late: boolean;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
  lateMinutes: number | null;
}

export interface LivePresenceCounts {
  working: number;
  done: number;
  present: number;
  on_leave: number;
  absent: number;
  not_punched: number;
  week_off: number;
  holiday: number;
  late: number;
  total: number;
}

export interface LivePresence {
  date: string;
  generatedAt: string;
  counts: LivePresenceCounts;
  members: LivePresenceMember[];
}

// ── Attendance Grid (Phase 3 - member×day heatmap / muster) ──
export interface AttendanceGridCell {
  status: string;
  late: boolean;
  workedMinutes: number | null;
}

export interface AttendanceGridMember {
  memberId: string;
  name: string;
  designation: string;
  shiftName: string;
  /** Day-of-month (1-31, as a string key) → cell. */
  days: Record<string, AttendanceGridCell>;
  /** Per-status counts for the month. */
  summary: Record<string, number>;
}

export interface AttendanceGrid {
  month: number;
  year: number;
  daysInMonth: number;
  members: AttendanceGridMember[];
}

// ── Overtime Analytics (Phase 3 - OT worked visibility, not OT pay) ──
export interface OvertimeAnalyticsKpi {
  /** Total OT minutes worked across the workspace this month. */
  totalOtMinutes: number;
  /** Count of member-days that carried any OT. */
  otDays: number;
  /** Highest single-day OT (minutes) by any member this month. */
  peakDayMinutes: number;
  /** Distinct members who worked any OT. */
  membersWithOt: number;
  /** totalOtMinutes / membersWithOt, rounded. */
  avgOtMinutesPerMember: number;
}

export interface OvertimeAnalyticsDay {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  /** Day-of-month (1-31). */
  day: number;
  otMinutes: number;
  otDays: number;
}

export interface OvertimeAnalyticsMember {
  memberId: string;
  name: string;
  designation: string;
  shiftName: string;
  otMinutes: number;
  otDays: number;
  /** That member's highest single-day OT (minutes). */
  peakDayMinutes: number;
}

/** OT folded by shift name or designation. */
export interface OvertimeAnalyticsGroup {
  label: string;
  otMinutes: number;
  otDays: number;
  members: number;
}

export interface OvertimeAnalytics {
  month: number;
  year: number;
  daysInMonth: number;
  kpi: OvertimeAnalyticsKpi;
  daily: OvertimeAnalyticsDay[];
  byMember: OvertimeAnalyticsMember[];
  byShift: OvertimeAnalyticsGroup[];
  byDesignation: OvertimeAnalyticsGroup[];
}

// ── Attendance Compliance (Phase 3 - defaulters + leaderboards) ──
export interface ComplianceMember {
  memberId: string;
  name: string;
  designation: string;
  shiftName: string;
  /** Days the member was scheduled: present + late + absent + half-day. */
  scheduledDays: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  onLeave: number;
  /** Sum of late minutes across the member's late days. */
  lateMinutes: number;
  /** Present-equivalent % of scheduled days; `null` when no scheduled days. */
  attendanceRate: number | null;
}

export interface ComplianceSummary {
  totalMembers: number;
  /** Members that had at least one scheduled day (an `attendanceRate`). */
  membersWithRate: number;
  avgAttendanceRate: number;
  /** Members at exactly 100%. */
  perfectCount: number;
  totalLateDays: number;
  totalAbsentDays: number;
  totalLateMinutes: number;
}

export interface ComplianceReport {
  month: number;
  year: number;
  summary: ComplianceSummary;
  members: ComplianceMember[];
}

// ── Absence Patterns (Phase 3f - Bradford-style absence analysis) ──
export interface AbsencePatternMember {
  memberId: string;
  name: string;
  designation: string;
  shiftName: string;
  /** Total absent days in the lookback window. */
  absentDays: number;
  /** Number of distinct absence spells (consecutive-day runs). */
  spells: number;
  /** Longest single run of consecutive absent days. */
  longestSpell: number;
  /** Bradford Factor = spells² × absentDays. Advisory only. */
  bradfordScore: number;
  /** Absence count per weekday, index 0 = Sunday … 6 = Saturday. */
  weekday: number[];
}

export interface AbsencePatternSummary {
  /** Members with at least one absence in the window. */
  totalMembers: number;
  avgBradford: number;
  /** Members with a Bradford score ≥ 125 (high band or above). */
  flaggedCount: number;
  totalSpells: number;
  /** Workspace-wide absence count per weekday, index 0 = Sunday … 6 = Saturday. */
  weekday: number[];
}

export interface AbsencePatterns {
  /** Lookback window length in months. */
  months: number;
  /** ISO window start. */
  from: string;
  /** ISO window end. */
  to: string;
  summary: AbsencePatternSummary;
  members: AbsencePatternMember[];
}

// ── Attendance Policy (Phase C - policy engine config) ───────
export interface AttendancePolicyLateArrival {
  countAsLop: boolean;
  lopAfterNLateDays: number | null;
}

export interface AttendancePolicyEarlyDeparture {
  enabled: boolean;
  thresholdMinutes: number;
  countAsHalfDay: boolean;
}

export interface AttendancePolicyOt {
  enabled: boolean;
  thresholdMinutes: number;
  capMinutes: number | null;
}

export interface AttendancePolicyCompOff {
  enabled: boolean;
}

export interface AttendancePolicy {
  _id: string;
  /** Mongoose `id` virtual - alias for `_id`. */
  id?: string;
  wsId: string;
  name: string;
  isDefault: boolean;
  lateArrival: AttendancePolicyLateArrival;
  earlyDeparture: AttendancePolicyEarlyDeparture;
  ot: AttendancePolicyOt;
  compOff: AttendancePolicyCompOff;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAttendancePolicyPayload {
  name: string;
  isDefault?: boolean;
  lateArrival?: Partial<AttendancePolicyLateArrival>;
  earlyDeparture?: Partial<AttendancePolicyEarlyDeparture>;
  ot?: Partial<AttendancePolicyOt>;
  compOff?: Partial<AttendancePolicyCompOff>;
}

export type UpdateAttendancePolicyPayload = Partial<CreateAttendancePolicyPayload>;

export interface AttendancePolicyDryRunPayload {
  dateRange: { from: string; to: string };
  /** Optional team-member id filter. Omit to simulate the whole workspace. */
  scope?: string[];
}

export interface AttendancePolicyDryRunChange {
  teamMemberId: string;
  date: string;
  before: { status: string; workedMinutes: number | null };
  after: { status: string; workedMinutes: number | null; lateMinutes: number };
}

export interface AttendancePolicyDryRunResult {
  changed: AttendancePolicyDryRunChange[];
  summary: { total: number; changed: number; unchanged: number };
}

// ── Leave Management (Leave epic L5) ─────────────────────────
export type LeaveTypeLocale = 'en' | 'gu-en' | 'hi-en' | 'gu';

export interface LeaveTypeLabels {
  en: string;
  'gu-en'?: string | null;
  'hi-en'?: string | null;
  gu?: string | null;
}

export type LeaveTypeUnit = 'full_day' | 'half_day_capable';
export type LeaveStatutoryBasis = 'factories_act' | 'shops_act' | 'maternity_act' | 'voluntary';
export type LeaveAccrualMode = 'upfront_annual' | 'periodic_accrual' | 'none';
export type LeaveAccrualFrequency = 'monthly' | 'quarterly' | 'annual';
export type LeaveGenderApplicability = 'male' | 'female' | 'any';

export interface LeaveTypeApplicability {
  gender: LeaveGenderApplicability;
  minTenureDays: number | null;
  designationIds: string[];
}

export interface LeaveTypeAccrualRule {
  mode: LeaveAccrualMode;
  annualQuantity: number;
  rate: number | null;
  frequency: LeaveAccrualFrequency | null;
  proRateFirstPeriod: boolean;
  accrualCap: number | null;
  eligibleAfterDays: number;
}

export interface LeaveTypeYearEndRule {
  carryForwardCap: number;
  lapseExcess: boolean;
  encashable: boolean;
  encashmentCap: number | null;
}

export interface LeaveTypeCompOff {
  isCompOff: boolean;
  validityDays: number;
}

export interface LeaveType {
  _id: string;
  /** Mongoose `id` virtual - alias for `_id`. */
  id?: string;
  workspaceId: string;
  code: string;
  labels: LeaveTypeLabels;
  color: string;
  isPaid: boolean;
  unit: LeaveTypeUnit;
  statutoryBasis: LeaveStatutoryBasis;
  /** Cap on one request's day count. null = unbounded. */
  maxPerRequest: number | null;
  applicability: LeaveTypeApplicability;
  accrualRule: LeaveTypeAccrualRule;
  yearEndRule: LeaveTypeYearEndRule;
  compOff: LeaveTypeCompOff;
  /** System types (LWP) are non-deletable and accept only label/colour edits. */
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLeaveTypePayload {
  code: string;
  labels: LeaveTypeLabels;
  color?: string;
  isPaid: boolean;
  unit: LeaveTypeUnit;
  statutoryBasis: LeaveStatutoryBasis;
  maxPerRequest?: number | null;
  applicability?: Partial<LeaveTypeApplicability>;
  accrualRule: LeaveTypeAccrualRule;
  yearEndRule: LeaveTypeYearEndRule;
  compOff: LeaveTypeCompOff;
  isActive?: boolean;
  sortOrder?: number;
}

/** Update payload - `code` is immutable post-create, so it is omitted. */
export type UpdateLeaveTypePayload = Partial<Omit<CreateLeaveTypePayload, 'code'>>;

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn';
export type CompOffRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveHalfDaySession = 'none' | 'first_half' | 'second_half';
export type LeaveApprovalDecision = 'approved' | 'rejected' | null;

export interface LeaveApprovalStep {
  level: number;
  approverUserId: string;
  decision: LeaveApprovalDecision;
  decidedAt: string | null;
  note: string | null;
}

export interface LeaveDaySegment {
  date: string;
  leaveTypeId: string;
  quantity: number;
}

export interface LeaveRequest {
  _id: string;
  id?: string;
  workspaceId: string;
  teamMemberId: string;
  appliedBy: string;
  primaryLeaveTypeId: string;
  fromDate: string;
  toDate: string;
  firstDayHalf: LeaveHalfDaySession;
  lastDayHalf: LeaveHalfDaySession;
  dayBreakdown: LeaveDaySegment[];
  totalDays: number;
  paidDays: number;
  lwpDays: number;
  reason: string | null;
  attachments: string[];
  status: LeaveRequestStatus;
  approvalChain: LeaveApprovalStep[];
  currentLevel: number;
  finalDecisionAt: string | null;
  isRetroactive: boolean;
  salaryInvalidated: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompOffRequest {
  _id: string;
  id?: string;
  workspaceId: string;
  teamMemberId: string;
  appliedBy: string;
  compOffLeaveTypeId: string;
  workDate: string;
  quantity: number;
  reason: string | null;
  attachments: string[];
  status: CompOffRequestStatus;
  approvalChain: LeaveApprovalStep[];
  currentLevel: number;
  finalDecisionAt: string | null;
  ledgerEntryId: string | null;
  lotExpiresOn: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Optional approver note recorded on an approve / reject decision. */
export interface DecideLeavePayload {
  note?: string;
}

export interface LeaveRequestSettings {
  _id: string;
  workspaceId: string;
  /** Ordered approval chain - one approver user id per level. Empty = auto-approve. */
  approverUserIds: string[];
  sandwichLeave: boolean;
  retroMaxDaysBack: number;
  maxAttachmentsPerRequest: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateLeaveSettingsPayload {
  approverUserIds: string[];
  sandwichLeave: boolean;
  retroMaxDaysBack: number;
  maxAttachmentsPerRequest: number;
}

export interface LeaveApproverDelegation {
  _id: string;
  id?: string;
  workspaceId: string;
  /** The approver delegating their authority (also the creator / revoker). */
  fromUserId: string;
  /** The delegate who may act in the approver's place during the window. */
  toUserId: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
  isActive: boolean;
  revokedBy: string | null;
  revokedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDelegationPayload {
  toUserId: string;
  startsOn: string;
  endsOn: string;
  reason?: string;
}

export interface LeaveBalance {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  leaveTypeId: string;
  year: number;
  opening: number;
  credited: number;
  used: number;
  /** Days locked by pending (not-yet-approved) requests. */
  pending: number;
  lapsed: number;
  encashed: number;
  /** Derived: opening + credited − used − pending − lapsed − encashed. */
  available: number;
  lastLedgerSeq: number;
  createdAt?: string;
  updatedAt?: string;
}

export type LeaveLedgerEntryType =
  | 'opening'
  | 'accrual'
  | 'usage'
  | 'usage_reversal'
  | 'adjustment'
  | 'carry_forward'
  | 'lapse'
  | 'encashment'
  | 'comp_off_credit'
  | 'comp_off_expiry';

export interface LeaveLedgerEntry {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  leaveTypeId: string;
  year: number;
  seq: number;
  entryType: LeaveLedgerEntryType;
  /** Signed - credits positive, debits negative. */
  quantity: number;
  effectiveDate: string;
  reason: string | null;
  actorUserId: string | null;
  createdAt?: string;
}

export interface PostAdjustmentPayload {
  teamMemberId: string;
  leaveTypeId: string;
  year: number;
  /** Signed correction - positive credits days, negative debits. */
  quantity: number;
  reason: string;
}

export interface ApplyLeavePayload {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  firstDayHalf?: LeaveHalfDaySession;
  lastDayHalf?: LeaveHalfDaySession;
  reason?: string;
  attachments?: string[];
}

/** Apply-time decomposition preview - paid-vs-LWP split before submitting. */
export interface LeavePreviewResult {
  totalDays: number;
  paidDays: number;
  lwpDays: number;
  dayBreakdown: LeaveDaySegment[];
}

/** An active comp-off lot - a non-expired, unspent earned credit (L6b). */
export interface CompOffLotView {
  ledgerEntryId: string;
  /** The holiday / weekly-off worked that earned this lot. */
  sourceWorkDate: string;
  /** Days originally credited to the lot. */
  creditedDays: number;
  /** Unconsumed days remaining in the lot. */
  remainingDays: number;
  /** When the lot lapses if unused. */
  expiresOn: string;
}

/** Claim a worked holiday / weekly-off as comp-off (L6b). */
export interface ApplyCompOffPayload {
  workDate: string;
  /** Days earned - a full day (1) or half day (0.5). */
  quantity: number;
  reason?: string;
}

// ── Attendance Event (Phase A - event-sourced foundation) ────
export type AttendancePunchType =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'BREAK_OUT'
  | 'BREAK_IN'
  | 'OT_IN'
  | 'OT_OUT'
  | 'STATUS_SET';

export type AttendanceEventSource =
  | 'manual'
  | 'manual_override'
  | 'device_push'
  | 'connector'
  | 'file_upload'
  | 'auto_cron'
  | 'regularization'
  | 'kiosk';

export type AttendanceVerifyMethod =
  | 'fp'
  | 'face'
  | 'card'
  | 'password'
  | 'palm'
  | 'manual'
  | 'auto';

export interface AttendanceEvent {
  _id: string;
  wsId: string;
  teamMemberId: string | { _id: string; name: string } | null;
  deviceSerial: string | null;
  deviceUserId: string | null;
  timestamp: string; // ISO string
  punchType: AttendancePunchType;
  statusValue: AttendanceStatus | null;
  verifyMethod: AttendanceVerifyMethod | null;
  source: AttendanceEventSource;
  sourceMeta: Record<string, unknown> | null;
  markedBy: string | { _id: string; name: string } | null;
  note: string | null;
  correctsEventId: string | null;
  createdAt: string;
  // Phase M: soft-delete (void) fields
  voidedAt?: string | null;
  voidedBy?: { _id: string; name: string } | null;
  voidReason?: string | null;
}

export interface AttendanceEventQuery {
  memberId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  deviceSerial?: string; // filter by device serial (used on device detail page)
  page?: number;
  limit?: number;
}

export interface AttendanceEventListResponse {
  items: AttendanceEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface AttendanceRecomputePayload {
  memberId?: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

// ── Audit timeline (M-05, D-28, D-29) ───────────────────────────────
/** Discriminated union for per-record audit timeline items returned by GET /attendance/:id/audit */
export type AuditItem =
  | {
      kind: 'event';
      at: string;
      eventId: string;
      punchType: string;
      source: AttendanceEventSource;
      verifyMethod: string | null;
      by: { _id: string; name: string } | null;
      voided: boolean;
      voidReason?: string | null;
    }
  | {
      kind: 'void';
      at: string;
      eventId: string;
      by: { _id: string; name: string } | null;
      reason: string;
    }
  | {
      kind: 'status_history';
      at: string;
      status: string;
      by: { _id: string; name: string } | null;
    };

// ── Activity log (2026-05-22) - per-module "who did what" feed ──────
/**
 * One redacted activity event (matches BE `ActivityEventDto`). Sensitive
 * values (salary / bank / statutory) are NEVER present; `meta` carries only a
 * fail-closed allowlist (e.g. `{ groups: ['pay','bank'] }` for an update,
 * `{ salaryType }` for a create, `{ sendMethod }` for a grant).
 */
export interface ActivityEvent {
  id: string;
  module: string;
  action: string;
  actor: { id: string; name: string };
  target: { id: string; name: string; type: string } | null;
  at: string;
  meta: Record<string, unknown>;
}

export interface ActivityListResponse {
  items: ActivityEvent[];
  total: number;
  page?: number;
  limit?: number;
}

export interface ActivityQuery {
  actorId?: string;
  action?: string;
  /** ISO 8601 inclusive lower bound. */
  dateFrom?: string;
  /** ISO 8601 inclusive upper bound. */
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ── Regularization (Phase D) ────────────────────────────────────────
export type RegularizationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type RequestedAttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'LEAVE' | 'ABSENT';
/** Optional correction reason category (additive; mirrors the BE enum). */
export type RegularizationReasonCategory =
  | 'MISSING_CHECK_IN'
  | 'MISSING_CHECK_OUT'
  | 'WRONG_TIME'
  | 'FORGOT_PUNCH'
  | 'OFF_SITE'
  | 'OTHER';
export type ApprovalStepDecision = 'pending' | 'approved' | 'rejected';

export interface ApprovalChainStep {
  level: number;
  approverUserId: string;
  approverName?: string;
  decision: ApprovalStepDecision;
  decidedAt?: string;
  note?: string;
}

export interface RegularizationRequest {
  _id: string;
  wsId: string;
  memberId: string;
  memberName?: string;
  raisedBy: string;
  raisedByName?: string;
  date: string; // ISO YYYY-MM-DD
  currentStatus: string;
  requestedStatus: RequestedAttendanceStatus;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  reasonCategory?: RegularizationReasonCategory | null;
  attachments: string[];
  status: RegularizationStatus;
  approvalChain: ApprovalChainStep[];
  currentLevel: number;
  finalDecisionAt?: string;
  resultingEventId?: string;
  createdAt: string;
  updatedAt: string;
  salaryInvalidated?: boolean;
}

export interface CreateRegularizationPayload {
  memberId: string;
  date: string;
  requestedStatus: RequestedAttendanceStatus;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  reasonCategory?: RegularizationReasonCategory;
  attachments?: string[];
}

export interface DecideRegularizationPayload {
  note?: string;
}

export interface RegularizationListQuery {
  status?: RegularizationStatus;
  memberId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface RegularizationConfig {
  approvalLevels: number;
  maxDaysBack: number;
  fallbackApprover: string | null;
  maxAttachmentsPerRequest: number;
}

// Phase 23 - Piece rate
export type PieceRateUnit =
  | 'per_piece'
  | 'per_thousand_stitches'
  | 'per_design_completed'
  | 'blended';

export interface PerMachineRateOverride {
  machineId: string;
  rate: number;
}

export interface PieceRateConfig {
  unit: PieceRateUnit;
  defaultRate: number;
  basePortion: number;
  perMachineOverrides: PerMachineRateOverride[];
  effectiveFrom: string; // ISO date
  includeStitchUnit: boolean;
}

export interface PieceRateBreakdownRow {
  logId: string;
  downtimeCode: string; // ProductionLog.logCode (e.g. 'PROD-001')
  date: string; // YYYY-MM-DD
  machineId: string;
  machineCode: string;
  metricLabel: 'pieces' | 'stitches/1000' | 'designs' | 'hours';
  qty: number;
  rate: number;
  amount: number;
}

export interface PieceRateConfigSnapshot {
  unit: PieceRateUnit;
  defaultRate: number;
  basePortion: number;
  perMachineOverrides: PerMachineRateOverride[];
}

export interface PieceRatePreviewResponse {
  teamMemberId: string;
  month: number;
  year: number;
  pieceEarnings: number;
  basePortion: number;
  lopOnBase: number;
  netBase: number;
  totalEarnings: number;
  configSnapshot: PieceRateConfigSnapshot;
  breakdown: PieceRateBreakdownRow[];
}

export interface SetPieceRateConfigPayload {
  unit: PieceRateUnit;
  defaultRate: number;
  basePortion?: number;
  perMachineOverrides?: PerMachineRateOverride[];
  effectiveFrom?: string;
  includeStitchUnit?: boolean;
}

// ── Salary ────────────────────────────────────────
export interface SalaryRecord {
  _id: string | null;
  workspaceId: string;
  teamMemberId:
    | string
    | {
        _id: string;
        name: string;
        designation?: string;
        avatar?: string;
        shiftId?: { _id: string; name: string; startTime: string; endTime: string };
        bankDetails?: BankDetails;
        upiDetails?: UpiDetails;
        preferredMethod?: string;
        uan?: string;
        pan?: string;
        esiIpNumber?: string;
        employmentType?: TeamMember['employmentType'];
        pfApplicable?: boolean;
        pfOptedOut?: boolean;
        esiApplicable?: boolean;
      };
  month: number;
  year: number;
  baseSalary: number;
  totalDays: number;
  presentDays: number;
  salaryType?: 'monthly' | 'hourly' | 'piece_rate';
  salaryDayBasis?: 'fixed_month_days' | 'calendar_month_days';
  fixedMonthDays?: number | null;
  attendancePayModeApplied?: 'enabled' | 'disabled';
  deductions: number;
  additions: number;
  netSalary: number;
  pieceRateEarnings?: number;
  pieceRateConfigSnapshot?: PieceRateConfigSnapshot | null;
  pieceRateBreakdown?: PieceRateBreakdownRow[];
  pieceRateStale?: boolean;
  effectiveSalary?: number;
  status: 'pending' | 'partial' | 'paid' | 'advance';
  paidAmount?: number;
  settlementStatus?:
    | 'salary_not_set'
    | 'not_generated'
    | 'pending'
    | 'partial'
    | 'paid'
    | 'overpaid';
  advanceOut?: {
    amount: number;
    targetMonth: number;
    targetYear: number;
  } | null;
  advanceRecovery?: {
    amount: number;
  } | null;
  isPreview: boolean;
  isLocked?: boolean;
  lockedBy?: string;
  lockedAt?: string;
  adjustmentCount?: number;
  activeAdjustmentCount?: number;
  teamMember?: TeamMember;
}

export type SalaryAdjustmentType = 'addition' | 'deduction';
export type SalaryAdjustmentStatus = 'active' | 'reversed';
export type SalaryAdditionCategory =
  | 'bonus'
  | 'overtime'
  | 'reimbursement'
  | 'allowance'
  | 'incentive'
  | 'commission'
  | 'other';
export type SalaryDeductionCategory =
  | 'penalty'
  | 'advance_recovery'
  | 'loan_recovery'
  | 'fine'
  | 'absence_recovery'
  | 'other'
  | 'pf_employee'
  | 'esi_employee'
  | 'pt_employee'
  | 'tds_employee';
export type SalaryAdjustmentCategory = SalaryAdditionCategory | SalaryDeductionCategory;

export interface SalaryAdjustmentActor {
  _id: string;
  name: string;
  email?: string;
}

export interface SalaryAdjustment {
  _id: string;
  workspaceId: string;
  salaryId: string;
  teamMemberId: string;
  month: number;
  year: number;
  type: SalaryAdjustmentType;
  category: SalaryAdjustmentCategory;
  amount: number;
  source?: 'manual' | 'payment_recording' | 'system';
  linkedPaymentId?: string;
  advanceSourcePaymentId?: string;
  correctionOfAdjustmentId?:
    | string
    | {
        _id: string;
        reasonTitle: string;
        amount: number;
        type: SalaryAdjustmentType;
        category: SalaryAdjustmentCategory;
        status: SalaryAdjustmentStatus;
      };
  reasonTitle: string;
  note?: string;
  attachments?: string[];
  status: SalaryAdjustmentStatus;
  createdBy?: string | SalaryAdjustmentActor;
  createdAt?: string;
  reversedBy?: string | SalaryAdjustmentActor;
  reversedAt?: string;
  reversalReason?: string;
}

export interface SalaryAdjustmentAuditEvent {
  _id: string;
  workspaceId: string;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorNameSnapshot: string;
  salaryId?: string;
  teamMemberId?: string;
  month?: number;
  year?: number;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  salaryId: string;
  amount: number;
  paymentMode: string;
  paymentDate: string;
  referenceNo?: string;
  proofAttached?: boolean;
  proofUrls?: string[];
  paymentFrom?: string;
  splitLines?: LedgerSplitLine[];
  note?: string;
  paidBy?: string;
  commission?: number;
  commissionNote?: string;
  status?: 'active' | 'reversed';
  reversedAt?: string;
  reversalReason?: string;
  createdAt?: string;
}

export interface PayslipDataResponse {
  record: SalaryRecord & { teamMember?: TeamMember; paidAmount?: number };
  adjustments: SalaryAdjustment[];
  payments: Payment[];
  componentTemplate: SalaryComponentTemplate | null;
  workspaceName: string;
  branding: {
    includeHeaderLogo: boolean;
    headerLogoUrl?: string;
    includeWatermark: boolean;
    watermarkLogoUrl?: string;
    includeFooter: boolean;
    footerText?: string;
    showExportDate?: boolean;
  };
  /** Informational only: outstanding advance balance for this member. Does NOT affect net salary. */
  advanceOutstanding?: number;
  /** Informational only: outstanding employer loan balance for this member. Does NOT affect net salary. */
  loanOutstanding?: number;
}

export interface OwnPayslipDownload extends PayslipDataResponse {
  currencyConfig: { symbol: string; locale: string; code: string };
}

export interface BulkPaymentItem {
  salaryId?: string;
  teamMemberId?: string;
  month?: number;
  year?: number;
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
}

export interface BulkPaymentResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    index: number;
    teamMemberId?: string;
    salaryId?: string;
    success: boolean;
    paymentId?: string;
    error?: string;
    // Structured deny code (e.g. MEMBER_OFFBOARDED) when a per-item failure
    // carried one, mirroring the single-payment {code} contract so the row can
    // be localized. Backend: SalaryService.recordBulkPayment (LOW-2 fix).
    code?: string;
  }>;
}

export interface SalaryIncrement {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  effectiveMonth: number;
  effectiveYear: number;
  type: 'fixed_amount' | 'percentage';
  value: number;
  previousSalary: number;
  newSalary: number;
  note?: string;
  isApplied: boolean;
  appliedAt?: string;
  createdBy?: string;
  createdAt?: string;
}

// ── Paginated Salary Response ─────────────────────
export interface SalarySummary {
  totalPayable: number;
  totalPaid: number;
  totalPending: number;
  totalOverpaid: number;
  employeesCount: number;
  paidCount: number;
  pendingCount: number;
  partialCount: number;
  advanceCount: number;
  salaryNotSetCount: number;
  notGeneratedCount?: number;
  upcomingJoinersCount?: number;
  nextJoinerMonth?: number | null;
  nextJoinerYear?: number | null;
}

export interface ShiftPayrollSummary {
  shiftId: string | null;
  shiftName: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  employeeCount: number;
  totalPayable: number;
  totalPaid: number;
  totalDue: number;
  pendingCount: number;
  partialCount: number;
  paidCount: number;
  overpaidCount: number;
  notGeneratedCount: number;
  salaryNotSetCount: number;
}

export interface PayrollOverviewTrendPoint {
  month: number;
  year: number;
  label: string;
  totalPayable: number;
  totalPaid: number;
  totalDue: number;
}

export interface AdvancesLoansBonusBlock {
  totalOutstandingAdvances: number;
  totalActiveLoans: number;
  totalOutstandingLoanPrincipal: number;
  totalBonus: number;
  totalCommission: number;
  totalIncentive: number;
}

export interface PayrollOverviewResponse {
  summary: SalarySummary & { advancesLoansBonus?: AdvancesLoansBonusBlock };
  shiftSnapshot: ShiftPayrollSummary[];
  trend: PayrollOverviewTrendPoint[];
}

export interface PaginatedSalaryResponse {
  records: SalaryRecord[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: SalarySummary;
  /**
   * Present (optional) only when this workspace is OVER its plan's member limit
   * after the grace window, so the register was server-trimmed to the allowed
   * members. Drives the <MemberCapNotice> banner above the salary register
   * (components/dashboard/MemberCapNotice.tsx). Absent = not capped (and never
   * present for the internal/compliance statutory-export caller). Keep in sync
   * with the backend getSalaryRecordsPaginated response shape.
   */
  memberCap?: {
    capped: boolean;
    visibleCount: number;
    totalCount: number;
    limit: number;
  };
}

export interface PaymentRegisterRow {
  _id: string;
  salaryId: string;
  teamMemberId: string;
  teamMemberName: string;
  salaryMonth: number;
  salaryYear: number;
  paymentDate: string;
  paymentMode: string;
  amount: number;
  commission: number;
  creditedAmount: number;
  isAdvance: boolean;
  advanceForMonth?: number;
  advanceForYear?: number;
  status: 'active' | 'reversed';
  splitCount: number;
  referenceNo?: string;
  paidBy?: string;
  note?: string;
  proofAttached: boolean;
  createdAt?: string;
}

export interface PaymentRegisterResponse {
  records: PaymentRegisterRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: {
    totalCredited: number;
    totalReversed: number;
    activeCount: number;
    reversedCount: number;
    advanceCount: number;
    splitCount: number;
  };
}

// ── Salary Components ─────────────────────────────
export type PayrollPreset = 'basic' | 'standard' | 'professional' | 'enterprise' | 'custom';

export interface PayrollConfigFeatures {
  attendanceBasedPay: boolean;
  adjustments: boolean;
  advancePayments: boolean;
  splitPayments: boolean;
  commissionTracking: boolean;
  salaryComponents: boolean;
  payslipGeneration: boolean;
  bankDetails: boolean;
  proofAttachments: boolean;
  hourlySalary: boolean;
  bulkPayments: boolean;
  autoGenerate: boolean;
  salaryRevisions: boolean;
  salaryIncrements: boolean;
  /** Workspace-level toggle for the employer loan module. */
  loanManagement: boolean;
  /** Workspace-level toggle for the statutory + festival bonus module. */
  bonusTracking: boolean;
  /** Workspace-level toggle for the daily-wage running ledger (baki/udhaar). */
  dailyWageLedger: boolean;
}

export interface PayrollConfigRules {
  attendancePayModeDefault: 'enabled' | 'disabled';
  /** Phase 26 - D-01/D-03 attendance-calc toggles. Backend: payroll-config.schema.ts rules sub-doc. */
  holidayCountsAsPresent?: boolean;
  weekOffCountsAsPresent?: boolean;
  lateMarkAsHalfDay?: boolean;
}

export interface PayrollConfigDisplay {
  currencyCode: string;
  currencySymbol: string;
  currencyLocale: string;
  defaultWorkingDays: number;
  payDay: number;
  payCycle: 'monthly' | 'biweekly' | 'weekly';
}

export interface PtSlabEntry {
  minSalary: number;
  maxSalary: number | null;
  ptAmount: number;
}

export interface PayrollConfigStatutory {
  pfEnabled: boolean;
  pfEstablishmentCode: string;
  pfWageCeiling: number;
  esiEnabled: boolean;
  esiCode: string;
  esiGrossThreshold: number;
  ptEnabled: boolean;
  tdsEnabled: boolean;
  lwfEnabled: boolean;
  ptState: string;
  ptUseCustomSlabs: boolean;
  ptCustomSlabs: PtSlabEntry[];
}

export interface PayrollConfigDeductor {
  tan: string;
  pan: string;
  branchDivision: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  responsiblePersonName: string;
  responsiblePersonPan: string;
  responsiblePersonDesignation: string;
}

export interface PayrollConfigCompliance {
  /** Workspace-wide minimum monthly wage (INR). Null = guard inactive. */
  minimumWageMonthly: number | null;
  /** Skill category label for the owner's own reference. */
  minimumWageCategory: 'unskilled' | 'semi_skilled' | 'skilled' | 'highly_skilled';
  /** 50 by default. 75 allowed only when workspace has co-operative society deductions. */
  deductionCapPercent: 50 | 75;
  /** Advisory one-third installment norm enabled flag. Default true. */
  installmentAdvisoryOneThirdEnabled: boolean;
  /** Advisory maximum tenor months. Default 12. */
  installmentAdvisoryMaxMonths: number;
}

export interface PayrollConfig {
  _id: string;
  workspaceId: string;
  preset: PayrollPreset;
  features: PayrollConfigFeatures;
  rules: PayrollConfigRules;
  display: PayrollConfigDisplay;
  statutory?: PayrollConfigStatutory;
  deductor?: PayrollConfigDeductor;
  compliance?: PayrollConfigCompliance;
  /** Phase 26 D-01: salary date, payout window, advance request day. Backend: payroll-config.schema.ts disbursementRules. */
  disbursementRules?: DisbursementRules;
  /** Phase 26 D-03: regularization window + salary-loss toggle. Backend: payroll-config.schema.ts salaryLossConfig. */
  salaryLossConfig?: SalaryLossConfig;
  createdAt: string;
  updatedAt: string;
}

export interface PtSlabConfig {
  _id: string;
  state: string;
  frequency: 'monthly' | 'annual';
  slabs: PtSlabEntry[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaxDeclaration {
  _id?: string;
  workspaceId: string;
  teamMemberId: string;
  financialYear: number;
  taxRegime: 'old' | 'new';
  hraExemption: number;
  standardDeduction: number;
  deduction80C: number;
  deduction80D: number;
  deduction80G: number;
  deduction80CCD1B: number;
  deduction80TTA: number;
  otherDeductions: number;
  previousEmployerGross: number;
  previousEmployerTds: number;
  tdsDedutedSoFar: number;
  notes: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertTaxDeclarationPayload {
  financialYear: number;
  taxRegime: 'old' | 'new';
  hraExemption?: number;
  deduction80C?: number;
  deduction80D?: number;
  deduction80G?: number;
  deduction80CCD1B?: number;
  deduction80TTA?: number;
  otherDeductions?: number;
  previousEmployerGross?: number;
  previousEmployerTds?: number;
  notes?: string;
}

export interface TdsPreviewResponse {
  estimatedMonthlyTds: number;
  financialYear: number;
  regime: 'old' | 'new';
  hasPan: boolean;
}

export interface TdsChallan {
  _id: string;
  workspaceId: string;
  quarter: 1 | 2 | 3 | 4;
  financialYear: number;
  month: number;
  year: number;
  bsrCode: string;
  bankName: string;
  branchName: string;
  challanSerialNo: string;
  depositDate: string;
  tdsTotalDeposited: number;
  interestAmount: number;
  feeAmount: number;
  totalChallanAmount: number;
  section: string;
  minorHeadCode: string;
  remarks: string;
  createdAt: string;
}

export interface TdsLiabilityResponse {
  totalTdsDeducted: number;
  employeeCount: number;
  breakdown: Array<{
    employeeName: string;
    pan: string;
    tdsAmount: number;
  }>;
}

export interface TdsQuarterlySummary {
  quarter: number;
  financialYear: number;
  fyLabel: string;
  quarterLabel: string;
  quarterMonths: Array<{ month: number; year: number }>;
  totalTdsDeducted: number;
  totalChallanDeposited: number;
  difference: number;
  challans: TdsChallan[];
  employeeSummary: Array<{
    teamMemberId: string;
    employeeName: string;
    pan: string;
    grossSalary: number;
    tdsDeducted: number;
  }>;
}

export interface Form24QAnnexureII {
  grossSalary: number;
  standardDeduction: number;
  hraExemption: number;
  deduction80C: number;
  deduction80D: number;
  deduction80G: number;
  deduction80CCD1B: number;
  deduction80TTA: number;
  otherDeductions: number;
  taxRegime: 'old' | 'new';
  netTaxableIncome: number;
  taxLiability: number;
  totalTdsDeducted: number;
  previousEmployerGross: number;
  previousEmployerTds: number;
}

export interface Form24QEmployeeRecord {
  srNo: number;
  pan: string;
  name: string;
  grossSalary: number;
  tdsDeducted: number;
  taxRegime: 'old' | 'new';
  annexureII: Form24QAnnexureII | null;
}

export interface Form24QData {
  deductor: {
    tan: string;
    pan: string;
    name: string;
    branchDivision?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    responsiblePersonName: string;
    responsiblePersonPan: string;
    responsiblePersonDesignation: string;
  };
  financialYear: number;
  quarter: number;
  fyLabel: string;
  quarterLabel: string;
  challans: TdsChallan[];
  employees: Form24QEmployeeRecord[];
  totalTdsDeducted: number;
  totalChallanDeposited: number;
  isQ4: boolean;
}

export interface CreateChallanPayload {
  month: number;
  year: number;
  bsrCode: string;
  bankName?: string;
  branchName?: string;
  challanSerialNo: string;
  depositDate: string;
  tdsTotalDeposited: number;
  interestAmount?: number;
  feeAmount?: number;
  remarks?: string;
}

export interface EcrRow {
  uan: string;
  memberName: string;
  grossWages: number;
  epfWages: number;
  epsWages: number;
  edliWages: number;
  epfContribution: number;
  epsContribution: number;
  epfDiff: number;
  ncp: number;
  refundOfAdvances: number;
}

export interface EcrExportSummary {
  totalEmployees: number;
  totalEpfContribution: number;
  totalEpsContribution: number;
  totalEdliWages: number;
  totalNcpDays: number;
  excludedMissingUanCount: number;
}

export interface EcrExportResponse {
  rows: EcrRow[];
  text: string;
  filename: string;
  summary: EcrExportSummary;
}

export interface EsiRow {
  esicIpNumber: string;
  employeeName: string;
  grossSalary: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  reasonCode: string;
}

export interface EsiChallanExportSummary {
  totalEmployees: number;
  totalEmployeeContrib: number;
  totalEmployerContrib: number;
  totalContrib: number;
  missingIpNumberCount: number;
}

export interface EsiChallanExportResponse {
  rows: EsiRow[];
  csv: string;
  filename: string;
  summary: EsiChallanExportSummary;
}

export interface BankDisbursementRow {
  srNo: number;
  employeeName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  amount: number;
  paymentMode: 'NEFT' | 'RTGS';
  remarks: string;
  upiId?: string;
  preferredMethod: 'BANK' | 'UPI' | 'CASH' | 'UNKNOWN';
}

export interface BankFileExportResponse {
  bankRows: BankDisbursementRow[];
  upiRows: BankDisbursementRow[];
  skippedRows: Array<{ employeeName: string; reason: string }>;
  totalAmount: number;
  totalEmployees: number;
  bankCsv: string;
  upiCsv: string;
  bankFilename: string;
  upiFilename: string;
}

// ── Bank Transfer File Export ─────────────────────
export type BankTemplateId =
  | 'generic'
  | 'hdfc'
  | 'icici'
  | 'sbi'
  | 'axis'
  | 'kotak'
  | 'yes'
  | 'idfc'
  | 'indusind';

export type BankBlockReason = 'missing_account' | 'missing_ifsc' | 'invalid_ifsc';
export type BankFlag =
  | 'inactive'
  | 'on_hold'
  | 'partially_paid'
  | 'fully_paid'
  | 'preferred_upi'
  | 'preferred_cash';

export interface BankFileMeta {
  templateId: BankTemplateId;
  format: 'xlsx' | 'csv' | 'both';
  txnDate: string;
  month: number;
  year: number;
}

export interface BankFileApiRow {
  rowId: string;
  employeeCode: string;
  employeeName: string;
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  netSalary: number;
  paidSoFar: number;
  amount: number;
  paymentMode: 'NEFT' | 'RTGS' | 'IMPS';
  txnDate: string;
  remarks: string;
  email?: string;
  mobile?: string;
  upiId?: string;
  preferredMethod: 'BANK' | 'UPI' | 'CASH' | 'UNKNOWN';
  isActive: boolean;
  isDeleted: boolean;
  isLocked: boolean;
}

export interface BankFileRow extends BankFileApiRow {
  _include: boolean;
  _blockReason?: BankBlockReason;
  _flags: BankFlag[];
  _warnings: string[];
}

export interface BankFileRowsResponse {
  rows: BankFileApiRow[];
}

export interface GratuityAccrual {
  month: number;
  year: number;
  basicSalary: number;
  completedYears: number;
  gratuityAmount: number;
}

export interface GratuityLedger {
  workspaceId: string;
  teamMemberId: string;
  employeeName?: string;
  designation?: string;
  dateOfJoining: string;
  lastBasicSalary: number;
  completedYears: number;
  completedMonths: number;
  isEligible: boolean;
  gratuityAmount: number;
  lastCalculatedMonth: number;
  lastCalculatedYear: number;
  monthlyAccruals: GratuityAccrual[];
}

export interface GratuitySummary {
  totalEligibleEmployees: number;
  totalGratuityLiability: number;
  nearingEligibility: number;
  ledgers: GratuityLedger[];
}

export interface MonthlyTdsBreakdown {
  month: number;
  year: number;
  baseSalary: number;
  additions: number;
  deductions: number;
  netSalary: number;
  paidAmount: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
}

export interface Form16Declaration {
  taxRegime: 'old' | 'new';
  hraExemption: number;
  standardDeduction: number;
  deduction80C: number;
  deduction80D: number;
  deduction80G: number;
  deduction80CCD1B: number;
  deduction80TTA: number;
  otherDeductions: number;
  previousEmployerGross: number;
  previousEmployerTds: number;
}

export interface Form16Data {
  employeeName: string;
  employeePan: string;
  employeeDesignation: string;
  taxRegime: 'old' | 'new';
  employerName: string;
  financialYear: number;
  fyLabel: string;
  totalGrossSalary: number;
  totalBaseSalary: number;
  totalAdditions: number;
  totalDeductions: number;
  totalNetSalary: number;
  totalPaidAmount: number;
  totalPfDeducted: number;
  totalEsiDeducted: number;
  totalPtDeducted: number;
  totalTdsDeducted: number;
  declaration: Form16Declaration | null;
  monthlyBreakdown: MonthlyTdsBreakdown[];
  currencySymbol: string;
  currencyLocale: string;
}

// ── Attendance Import (Phase F) ──────────────────

export type ImportFileFormat =
  | 'zk_dat'
  | 'etimetrack_xls'
  | 'biotime_csv'
  | 'generic_csv'
  | 'generic_xls';

export interface ImportParsePreviewRow {
  deviceUserId: string;
  timestamp: string;
  punchType: string;
  verifyMethod: string | null;
}

export interface ImportParseResponse {
  format: ImportFileFormat;
  preview: ImportParsePreviewRow[];
  columnMap: Record<string, string>;
  headers: string[];
  deviceUserIds: string[];
}

export interface ImportCommitPayload {
  columnMap: Record<string, string>;
  memberMap: Record<string, string | null>;
  deviceSerial?: string | null;
  dryRun?: boolean;
}

export interface ImportCommitResult {
  inserted: number;
  skipped: number;
  willInsert?: number;
  errors: string[];
}

export interface PayslipEmailSendResponse {
  sent: boolean;
  reason?: string;
}

export interface BulkPayslipEmailResponse {
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    salaryId: string;
    result: PayslipEmailSendResponse;
  }>;
}

export type BulkEmailJobStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';

export interface BulkEmailJobDetail {
  salaryId: string;
  employeeName: string;
  email: string;
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
}

export interface BulkEmailJobStatusResponse {
  jobId: string;
  status: BulkEmailJobStatus;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
  details: BulkEmailJobDetail[];
}

export interface FnfOtherItem {
  description: string;
  amount: number;
}

export interface FnfSettlement {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  dateOfJoining: string;
  lastWorkingDate: string;
  resignationReason: string;
  completedYears: number;
  completedMonths: number;
  lastBasicSalary: number;
  lastGrossSalary: number;
  lastSalaryRecordId?: string;
  lastMonthNetSalary: number;
  gratuityEligible: boolean;
  gratuityAmount: number;
  leaveBalanceDays: number;
  leaveEncashmentAmount: number;
  leaveBalanceManuallyEntered: boolean;
  noticePeriodDays: number;
  noticeServedDays: number;
  noticeShortfallDays: number;
  noticeRecoveryAmount: number;
  outstandingAdvanceAmount: number;
  advanceRecoverableFromDues: number;
  advanceResidualUnrecovered: number;
  otherAdditions: FnfOtherItem[];
  otherDeductions: FnfOtherItem[];
  totalEarnings: number;
  totalDeductions: number;
  netFnfPayable: number;
  status: 'draft' | 'finalised' | 'paid';
  finalisedAt?: string;
  notes: string;
  createdAt: string;
}

export interface InitiateFnfPayload {
  lastWorkingDate: string;
  noticePeriodDays: number;
  noticeServedDays: number;
  leaveBalanceDays: number;
  otherAdditions?: FnfOtherItem[];
  otherDeductions?: FnfOtherItem[];
  notes?: string;
  resignationReason?: string;
}

export interface UpdatePayrollConfigPayload {
  preset?: PayrollPreset;
  features?: Partial<PayrollConfigFeatures>;
  rules?: Partial<PayrollConfigRules>;
  display?: Partial<PayrollConfigDisplay>;
  statutory?: Partial<PayrollConfigStatutory>;
  deductor?: Partial<PayrollConfigDeductor>;
  compliance?: Partial<PayrollConfigCompliance>;
}

export interface SalaryComponentDef {
  id: string;
  name: string;
  calcMode: 'percent_of_ctc' | 'percent_of_component' | 'fixed' | 'balancing';
  value?: number;
  referenceComponentId?: string;
  includedInCtc: boolean;
  isBasicComponent: boolean;
  isTaxable: boolean;
  isEmployerContribution?: boolean;
  sortOrder: number;
}

export interface SalaryComponentTemplate {
  _id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  components: SalaryComponentDef[];
  createdBy?: string;
  createdAt?: string;
}

export interface SalaryComponentInput extends Omit<SalaryComponentDef, 'id'> {
  id?: string;
}

export interface EmployeeComponentOverride {
  componentId: string;
  calcMode?: 'fixed' | 'percent_of_ctc' | 'percent_of_component';
  value?: number;
}

export interface SetBasePayBankDetailsPayload {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  passbookImageUrl?: string;
}

export interface SetBasePayUpiDetailsPayload {
  upiId: string;
  qrCodeUrl?: string;
}

interface SetBasePaySalaryConfigBase {
  salaryAmount: number;
  salaryType: 'monthly' | 'hourly' | 'piece_rate';
  salaryDayBasis: 'fixed_month_days' | 'calendar_month_days';
  fixedMonthDays?: number | null;
  attendancePayMode: 'default' | 'enabled' | 'disabled';
  preferredMethod?: 'BANK' | 'UPI';
  upiDetails?: SetBasePayUpiDetailsPayload;
  bankDetails?: SetBasePayBankDetailsPayload;
}

export interface MonthlySetBasePaySalaryConfigPayload extends SetBasePaySalaryConfigBase {
  salaryType: 'monthly';
  ctcAmount?: number | null;
  componentTemplateId?: string | null;
  componentOverrides?: EmployeeComponentOverride[];
}

export interface HourlySetBasePaySalaryConfigPayload extends SetBasePaySalaryConfigBase {
  salaryType: 'hourly';
  finalMonthlyOverride?: number | null;
  dailyHours?: number;
}

export type SetBasePaySalaryConfigPayload =
  | MonthlySetBasePaySalaryConfigPayload
  | HourlySetBasePaySalaryConfigPayload;

export interface CalculatedComponent {
  componentId: string;
  name: string;
  calculatedAmount: number;
  isBasicComponent: boolean;
  includedInCtc: boolean;
}

export interface CreateComponentTemplatePayload {
  name: string;
  isDefault?: boolean;
  components: SalaryComponentInput[];
}

// ============= F-04 Purchases Types =============

export type PurchaseVoucherState = 'draft' | 'confirmed' | 'received' | 'posted' | 'cancelled';

export interface PurchaseLineItem {
  itemId?: string;
  itemName: string;
  hsnSacCode?: string;
  qty: number;
  unit?: string;
  ratePaise: number;
  discountPct?: number;
  taxRate?: number;
  taxableValuePaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  lineTotalPaise: number;
  isCapitalGoods?: boolean;
}

export interface PurchaseOrder {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'purchase_order';
  voucherNumber?: string;
  voucherDate: string;
  financialYear: string;
  state: 'draft' | 'confirmed' | 'cancelled';
  partyId?: string;
  partySnapshot?: Record<string, any>;
  expectedDeliveryDate?: string;
  lineItems: PurchaseLineItem[];
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grandTotalPaise: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptNote {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'grn';
  voucherNumber?: string;
  voucherDate: string;
  financialYear: string;
  state: 'draft' | 'received' | 'cancelled';
  partyId?: string;
  partySnapshot?: Record<string, any>;
  sourcePoId?: string;
  sourcePoNumber?: string;
  vendorDeliveryNoteNumber?: string;
  vendorDeliveryNoteDate?: string;
  lineItems: Array<{
    itemId?: string;
    itemName?: string;
    qtyOrdered?: number;
    qtyReceived?: number;
    unit?: string;
    ratePaise?: number;
    batchNumber?: string;
    notes?: string;
  }>;
  receivedAt?: string;
  createdAt: string;
}

export interface Tds194QDetail {
  section: '194Q';
  rate: number;
  basePaise: number;
  tdsPaise: number;
  cumulativeBeforePaise: number;
}

export interface PurchaseBill {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'purchase_bill';
  voucherNumber?: string;
  voucherDate: string;
  financialYear: string;
  state: 'draft' | 'posted' | 'cancelled';
  vendorBillNumber?: string;
  vendorBillDate?: string;
  partyId?: string;
  partySnapshot?: Record<string, any>;
  placeOfSupplyStateCode?: string;
  /** 2c: tax on this purchase is payable by the recipient under reverse charge. */
  isReverseCharge?: boolean;
  /** 2c: self-invoice issued under Sec 31(3)(f) / Rule 47A for unregistered-supplier purchases. */
  rcmSelfInvoice?: { number: string; date: string; dueDate: string };
  lineItems: PurchaseLineItem[];
  sourcePoId?: string;
  sourcePoNumber?: string;
  sourceGrnId?: string;
  sourceGrnNumber?: string;
  tds194Q?: Tds194QDetail;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grandTotalPaise: number;
  netPayableToCreditorsAfterTdsPaise: number;
  amountPaidPaise: number;
  amountDuePaise: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue';
  ocrSourceFileUrl?: string;
  ocrConfidence?: number;
  ocrStatus?: 'manual' | 'ocr_prefilled' | 'ocr_auto_filled';
  msmePaymentDeadline?: string;
  msmeApplicable: boolean;
  postedAt?: string;
  createdAt: string;
}

/** 4a: recurring expense template (rent / electricity / maintenance etc.). */
export interface RecurringExpenseTemplate {
  _id: string;
  workspaceId: string;
  firmId: string;
  templateName: string;
  partyId?: string;
  paymentMode: 'cash' | 'bank' | 'cheque' | 'upi';
  bankAccountId?: string;
  lineItems: {
    expenseAccountId: string;
    description?: string;
    amountPaise: number;
    gstRate?: number;
    itcEligibility: 'full' | 'blocked' | 'nil_rated';
    costCentre?: string;
  }[];
  isIntraState: boolean;
  placeOfSupplyStateCode?: string;
  narration: string;
  schedule: {
    mode: 'monthly' | 'quarterly' | 'yearly' | 'every_n_days';
    dayOfMonth?: number;
    everyNDays?: number;
    startDate: string;
    endDate?: string;
  };
  autoPostOnGenerate: boolean;
  isActive: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  runCount: number;
}

export interface PaymentOutBillAllocation {
  billId: string;
  billNumber: string;
  billDuePaise: number;
  allocatedPaise: number;
  runningDuePaise: number;
}

export interface TdsAppliedDetail {
  section: 'sec_194c' | 'sec_194h' | 'sec_194j';
  rate: number;
  basePaise: number;
  tdsPaise: number;
  cumulativeBeforePaise: number;
}

export interface PaymentOut {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'payment_out';
  voucherNumber?: string;
  financialYear: string;
  paymentDate: string;
  partyId: string;
  partySnapshot?: Record<string, any>;
  paymentMode: 'cash' | 'bank' | 'upi' | 'cheque' | 'neft' | 'rtgs' | 'imps';
  bankAccountId?: string;
  referenceNo?: string;
  referenceDate?: string;
  totalAmountPaise: number;
  billAllocations: PaymentOutBillAllocation[];
  unappliedPaise: number;
  tdsApplied?: TdsAppliedDetail;
  /** 2c: payment voucher issued under Sec 31(3)(g) / Rule 52 for reverse-charge payments. */
  rcmPaymentVoucher?: { number: string; date: string };
  allocatedToCreditorsAfterTds94qPaise: number;
  netPaidPaise: number;
  state: 'draft' | 'posted' | 'cancelled';
  postedAt?: string;
  createdAt: string;
}

export interface CapitalGoodsItcSchedule {
  _id: string;
  workspaceId: string;
  firmId: string;
  sourceBillId: string;
  sourceBillNumber: string;
  sourceLineNo: number;
  itemName: string;
  totalItcPaise: number;
  monthsTotal: number;
  monthsAmortised: number;
  monthlyAmountPaise: number;
  startMonth: string;
  nextAmortisationMonth: string;
  status: 'amortising' | 'completed' | 'reversed';
  financialYear: string;
  itcSplit: 'cgst_sgst' | 'igst';
  cgstReleasedPaise: number;
  sgstReleasedPaise: number;
  igstReleasedPaise: number;
  cgstTotalPaise: number;
  sgstTotalPaise: number;
  igstTotalPaise: number;
}

export interface PayablesAgingBucket {
  partyId: string;
  partyName: string;
  current: number;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90plus: number;
  total: number;
}

export interface OcrLineItem {
  description?: string;
  qty?: number;
  unit?: string;
  ratePaise?: number;
  taxRate?: number;
  lineTotalPaise?: number;
  confidence: number;
}

export interface OcrExtractionResult {
  vendorName?: string;
  vendorGstin?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmountPaise?: number;
  taxableValuePaise?: number;
  gstAmountPaise?: number;
  lineItems: OcrLineItem[];
  confidence: number;
  rawText?: string;
  ocrStatus: 'manual' | 'ocr_prefilled' | 'ocr_auto_filled';
}

// ── Fixed Assets - F-05 ────────────────────────────
export interface AssetCategory {
  _id: string;
  workspaceId: string;
  firmId: string;
  name: string;
  description?: string;
  accountCode: string;
  depreciationMethod: 'slm' | 'wdv';
  slmRate: number;
  wdvRate: number;
  usefulLifeYears: number;
  residualValuePct: number;
  itActBlock?: string;
  itActRate?: number;
  scheduleIIRef?: string;
  isNesd: boolean;
  isSystem: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FixedAssetAuditEntry {
  at: string;
  by: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface FixedAsset {
  _id: string;
  workspaceId: string;
  firmId: string;
  assetCode: string;
  name: string;
  description?: string;
  categoryId: string;
  categorySnapshot?: Record<string, unknown>;
  financialYear: string;
  purchaseDate: string;
  installationDate?: string;
  purchaseBillId?: string;
  purchaseBillNumber?: string;
  partyId?: string;
  partyName?: string;
  costPaise: number;
  salvageValuePaise: number;
  depreciableAmountPaise: number;
  usefulLifeYears: number;
  depreciationMethod: 'slm' | 'wdv';
  slmRateOverride?: number;
  wdvRateOverride?: number;
  depreciationFrequency: 'monthly' | 'quarterly';
  shiftType: 'single' | 'double' | 'triple';
  openingNbvPaise: number;
  accumulatedDepreciationPaise: number;
  nbvPaise: number;
  lastDepreciationMonth?: string;
  nextDepreciationMonth?: string;
  locationId?: string;
  custodianMemberId?: string;
  serialNumber?: string;
  qrCodeData?: string;
  lastVerifiedAt?: string;
  lastVerifiedBy?: string;
  itcScheduleId?: string;
  itcClaimedPaise: number;
  machineId?: string;
  tags: string[];
  notes?: string;
  status: 'active' | 'disposed' | 'scrapped' | 'transferred';
  disposalDate?: string;
  disposalProceedsPaise: number;
  gainLossOnDisposalPaise: number;
  disposalNarration?: string;
  disposalVoucherId?: string;
  isFullyDepreciated: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  auditLog: FixedAssetAuditEntry[];
}

export interface DepreciationRun {
  _id: string;
  workspaceId: string;
  firmId: string;
  runMonth: string;
  runType: 'monthly' | 'quarterly' | 'manual';
  status: 'running' | 'completed' | 'failed';
  assetsProcessed: number;
  assetsSkipped: number;
  totalDepreciationPaise: number;
  ledgerEntryIds: string[];
  runAt?: string;
  runBy?: string;
  errorMessage?: string;
}

export interface DepreciationPreviewLine {
  assetId: string;
  assetCode: string;
  name: string;
  categoryName: string;
  method: 'slm' | 'wdv';
  periodStart: string;
  periodEnd: string;
  amountPaise: number;
  capped: boolean;
  newNbvPaise: number;
}

export interface ItcReversalResult {
  applicable: boolean;
  reasonCode: 'no_itc' | 'beyond_60_months' | 'within_60_months';
  itcClaimedPaise: number;
  monthsUsed: number;
  monthsRemaining: number;
  reversalPaise: number;
  formula: string;
  rule: 'rule_44_6' | 'none';
}

export interface DisposalPreview {
  assetCode: string;
  costPaise: number;
  accumulatedDepreciationPaise: number;
  nbvAtDisposalPaise: number;
  partialMonthDepreciationPaise: number;
  disposalProceedsPaise: number;
  gainLossPaise: number;
  itcReversal: ItcReversalResult;
}

export interface UpdateComponentTemplatePayload {
  name?: string;
  isDefault?: boolean;
  components?: SalaryComponentInput[];
}

export interface SeedComponentTemplatePayload {
  templateKey: 'simple' | 'standard_india' | 'ctc_with_pf';
}

// ── Shifts ────────────────────────────────────────
export interface Shift {
  _id: string;
  id: string; // alias for _id, returned by backend findAll
  workspaceId: string;
  name: string;
  startTime: string;
  endTime: string;
  workingDays: number[];
  weeklyOff: string[];
  color: string;
  colorBg: string;
  isDefault: boolean;
  gracePeriodMinutes: number;
  halfDayAfterLateMinutes: number;
  shiftType: 'fixed' | 'flexi' | 'split' | 'break';
  /** For flexi shifts - required worked hours/day; null = 8h default. */
  requiredHoursPerDay: number | null;
  /** Attendance policy that scores this shift; null = workspace default. */
  policyId: string | null;
  memberCount: number; // computed by backend aggregate
}

// ── Holidays ──────────────────────────────────────
export interface Holiday {
  _id: string;
  id: string;
  workspaceId: string;
  name: string;
  date: string;
  description?: string;
  isRecurring: boolean;
  type: 'national' | 'festival' | 'company' | 'other';
  createdBy?: string;
  createdAt?: string;
}

// ── Bills ─────────────────────────────────────────
export interface Bill {
  _id: string;
  workspaceId: string;
  type: 'payable' | 'receivable';
  partyName: string;
  amount: number;
  description?: string;
  invoiceUrl?: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'partially_paid' | 'overdue';
  amountPaid: number;
  createdBy?: string;
  createdAt?: string;
  // Finance/Bills hardening: soft-delete lifecycle flags. Reads always exclude
  // isDeleted:true on the BE, so the FE only ever sees active bills — these are
  // surfaced for type-completeness, not rendered.
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

// ── RBAC ──────────────────────────────────────────
export interface Role {
  _id: string;
  workspaceId?: string;
  name: string;
  description?: string;
  color?: string;
  isSystem: boolean;
  permissions: Permission[];
  /** Registry-path grants for the role (Phase 1c). Used by PermissionOverridesMatrix
   *  to display the role's inherited grant on path-classified rows. */
  permissionPaths?: GrantedPath[];
  memberCount?: number;
  createdBy?: string;
}

export interface Permission {
  module: string;
  actions: string[];
  /** Per-action scope, parallel to `actions`. `'self'` = own records only;
   *  `'all'` = workspace-wide. Missing → backend treats it as `'self'`. */
  actionScopes?: ('self' | 'all')[];
}

export interface RoleTemplate {
  name: string;
  description: string;
  permissions: Record<string, 'full' | 'view' | 'none'>;
}

// ── Statistics ────────────────────────────────────
/** One slice of a workforce breakdown. `label === null` = "Unassigned". */
export interface WorkforceBucket {
  label: string | null;
  count: number;
}

/** Dashboard workforce make-up (active members only). Backend: statistics.service. */
export interface WorkforceBreakdown {
  total: number;
  byDesignation: WorkforceBucket[];
  byEmploymentType: WorkforceBucket[];
  byShift: WorkforceBucket[];
}

/** Dashboard "people radar" — joiners this month + upcoming birthdays/anniversaries.
 *  `date` fields are ISO strings (the upcoming occurrence for birthdays/anniversaries). */
export interface PeopleRadar {
  newJoiners: Array<{ name: string; designation: string | null; date: string }>;
  birthdays: Array<{ name: string; date: string }>;
  anniversaries: Array<{ name: string; years: number; date: string }>;
}

export interface DashboardStats {
  attendance: AttendanceSummary & {
    previousPresent?: number;
  };
  salary: {
    totalPayable: number;
    totalPaid: number;
    totalRemaining: number;
    employeesCount: number;
    paidEmployeesCount: number;
    monthLabel: string;
    previousTotalPaid?: number;
    previousTotalRemaining?: number;
  };
  teamView: {
    totalMembers: number;
    previousTotalMembers?: number;
  };
  /** Workforce make-up + people radar — added in the 2026-06 dashboard rebuild.
   *  Optional so older/partial backend responses still type-check. */
  workforce?: WorkforceBreakdown;
  peopleRadar?: PeopleRadar;
}

// ── HR Overview (ManekHR admin landing) ───────────
// Mirror of backend HrOverviewService.HrOverviewResponse. People metrics only
// (team + salary); never machine/production/finance data. `salary` is null when
// the SALARY module is disabled for the workspace. Consumed by getHrOverview()
// (lib/actions/stats.actions.ts) -> the HrOverview dashboard landing component.
export interface HrOverviewByDesignation {
  designation: string;
  count: number;
}

export interface HrOverviewSalary {
  monthLabel: string;
  month: number;
  year: number;
  totalPayable: number;
  totalPaid: number;
  totalPending: number;
  employeesCount: number;
  paidEmployeesCount: number;
  pendingEmployeesCount: number;
  payrollGenerated: boolean;
}

export interface HrOverviewResponse {
  generatedAt: string;
  headcount: {
    active: number;
    addedThisMonth: number;
    withAppAccess: number;
  };
  byDesignation: HrOverviewByDesignation[];
  salary: HrOverviewSalary | null;
  modules: {
    salaryEnabled: boolean;
  };
}

// ── Subscription ──────────────────────────────────
export type FeatureAccessLevel = 'locked' | 'limited' | 'full';

export interface ModuleSubFeatureAccess {
  key: string;
  access: FeatureAccessLevel;
}

export interface ModuleAccessEntry {
  module: string;
  enabled: boolean;
  subFeatures: ModuleSubFeatureAccess[];
}

/**
 * Tier identifiers reference Tier.key from the dynamic Tier collection.
 * Admin can create custom tiers via /admin/tiers, so this is a plain string.
 * Seeded tier keys (free/starter/growth/business/enterprise/custom) are
 * documented in MODULE_INVENTORY.md §2.1 - but admin can add/remove freely.
 * For hierarchy comparisons, look up Tier.displayOrder via subscription.utils.ts.
 */
/**
 * Per-locale display text. `en` is the canonical/required value; the three other
 * locales are optional and fall back to `en` (then to a static default) via the
 * `pickLocalized` resolver (lib/localized-text.ts). Mirrors the backend
 * LocalizedTextField / LocalizedTextDto. Locale keys match app/i18n.ts.
 */
export interface LocalizedText {
  en: string;
  'gu-en'?: string | null;
  'hi-en'?: string | null;
  gu?: string | null;
}

/**
 * Optional per-plan marketing display config (subset the FE reads). Mirrors the
 * backend Plan.marketing subdoc. Only the admin-editable CARD CONTENT is typed
 * here: `tagline` (card subtitle) + `featureHighlights` (ordered checkmark
 * bullets). Both are localized; blank fields fall back to the static i18n copy.
 * Other marketing subfields (badge / displayOrder / isHighlighted / ...) exist on
 * the backend doc but are not consumed here, so they are intentionally untyped.
 * Cross-module link: rendered by components/marketing/ErpPricingTable.tsx +
 * app/(app)/account/subscription/plans/PlanCard.tsx; edited in app/(app)/admin/plans.
 */
export interface PlanMarketing {
  tagline?: LocalizedText;
  featureHighlights?: LocalizedText[];
}

export interface Plan {
  _id: string;
  name: string;
  tier: string;
  /** Product line this plan sells. Absent = legacy ERP plan. */
  product?: 'erp' | 'connect' | 'bundle';
  /**
   * Optional per-plan marketing display config (card tagline + feature bullets).
   * Mirrors backend Plan.marketing; used by the plan cards with a static fallback.
   */
  marketing?: PlanMarketing;
  isActive: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  entitlements: PlanEntitlements;
  /**
   * Free-trial length (days) new sign-ups on this plan receive. 0 = no trial.
   * Mirrors backend Plan.trialDurationDays / CreatePlanDto.trialDurationDays.
   * Read here so the admin plan editor can pre-fill it when editing.
   */
  trialDurationDays?: number;
  /**
   * Exactly ONE plan per product is the default new sign-ups are auto-assigned.
   * Backend enforces single-default (setting it true clears the others), so the
   * editor only ever sends `true`. Mirrors backend Plan.isDefault.
   */
  isDefault?: boolean;
  /**
   * When true, this is THE trial plan for its product: new sign-ups start on its
   * access for `trialDurationDays`, then drop to the default plan on expiry. The
   * backend forces isPubliclyVisible:false on it (never buyable) and enforces a
   * single trial plan per product (like isDefault). Mirrors backend Plan.isTrialPlan.
   */
  isTrialPlan?: boolean;
  /**
   * Pricing knobs read by the admin plan editor to pre-fill on edit. Mirror
   * backend Plan: upfrontDiscountPercent (% off yearly when paid upfront, 0-100),
   * installmentsEnabled (allow 0%-interest monthly installments), installmentMonths
   * (how many installments the yearly price splits into, 1-24).
   */
  upfrontDiscountPercent?: number;
  installmentsEnabled?: boolean;
  installmentMonths?: number;
  /**
   * Optional/configurable GST (per-plan). Mirrors backend Plan: gstEnabled
   * (GST is ON unless explicitly false — undefined/true = ON), gstRatePercent
   * (0-50, default 18), isPriceTaxInclusive (price already includes GST).
   * Drives the conditional GST line in checkout + the GST note on plan cards;
   * when off, no GST renders anywhere. Keep in sync with PlanD1Extensions.gstEnabled.
   */
  gstEnabled?: boolean;
  gstRatePercent?: number;
  isPriceTaxInclusive?: boolean;
}

export interface PlanEntitlements {
  maxWorkspaces: number;
  maxMembersPerWorkspace: number;
  maxTotalMembers: number;
  modules: string[];
  features: {
    export: boolean;
    apiAccess: boolean;
    advancedRbac: boolean;
    customRoles: boolean;
    shifts: boolean;
    bills: boolean;
  };
  moduleAccess?: ModuleAccessEntry[];
  platformAccess?: PlatformAccess;
  maxSessionsPerPlatform?: number;
  maxSessionsTotal?: number;
  emailsPerMonth?: number;
  storage?: PlanStorageEntitlements;
  communications?: PlanCommunicationsEntitlements;
  connect?: PlanConnectEntitlements;
}

/** Connect (network / marketplace) plan allowances. `-1` = unlimited. */
export interface PlanConnectEntitlements {
  maxListings?: number;
  leadsPerMonth?: number;
  includedBoostCredits?: number;
  verifiedBadge?: boolean;
  searchPriority?: number;
  /** Per-person Connect media storage cap (MB). `-1` = unlimited. Default 500. */
  storageMb?: number;
  /**
   * Count caps for company pages / storefronts / open jobs. `-1` = unlimited.
   * Also tunable per person via the admin Connect entitlements override; these
   * are the plan defaults. Edited in app/admin/plans (Connect Allowances).
   */
  maxCompanyPages?: number;
  maxStorefronts?: number;
  maxJobs?: number;
  /**
   * Over-limit (grandfathering) policy. `freeze` (default) = existing items stay
   * live + creation blocked; `hide_newest` = hide the newest excess from public
   * after the grace window. Mirrors backend PlanConnectEntitlements; edited in
   * app/admin/plans.
   */
  overLimitPolicy?: 'freeze' | 'hide_newest';
  /** Grace days before hide_newest suppresses anything. Default 30. */
  overLimitGraceDays?: number;
}

export interface PlanStorageEntitlements {
  totalGbPerWorkspace?: number;
  perFileMaxMb?: number;
}

/**
 * Wave 7 - credit-pack balances + auto-recharge config. Mirrors BE
 * `PlanCommunicationsEntitlements`. Balances mutate imperatively
 * (top-up via /add-ons/credit-pack flow, decrement via SMS/WA send).
 */
export interface PlanCommunicationsEntitlements {
  smsCreditsBalance?: number;
  whatsappCreditsBalance?: number;
  autoRechargeEnabled?: boolean;
  autoRechargeThresholdSms?: number;
  autoRechargeThresholdWhatsapp?: number;
  autoRechargeSmsPackSlug?: string;
  autoRechargeWhatsappPackSlug?: string;
  lastLowBalanceAlertAt?: string;
}

export interface MonthlyTaskStatusMember {
  salaryId: string;
  teamMemberId: string;
  name: string;
  email: string;
  payslipEmailSentAt: string | null;
  payslipEmailSentByName: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  lockedByName: string | null;
}

export interface MonthlyTaskStatusResponse {
  payslipEmails: {
    total: number;
    sent: number;
    locked: number;
    members: MonthlyTaskStatusMember[];
  };
  emailQuota: { limit: number; used: number; monthKey: string };
}

export interface Subscription {
  _id: string;
  userId: string;
  planId: string | Plan;
  status:
    | 'active'
    | 'cancelled'
    | 'expired'
    | 'trial'
    | 'superseded'
    | 'pending'
    | 'paused'
    | 'past_due'
    | 'grace_period';
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  purchasedEntitlements: PlanEntitlements;
  appliedEntitlements: PlanEntitlements;
  cancelledAt?: string;
  cancellationReason?: string;
  source?: 'self' | 'admin' | 'manual_payment' | 'paid_link' | 'trial' | 'migrated';
  assignedBy?: string | User;
  assignedAt?: string;
  assignmentNote?: string;
  previousSubscriptionId?: string;
  hasActiveAddOns?: boolean;
  adminEntitlementOverride?: boolean;
  workspaceId?: string;
  // D1c - recurring auto-renew (Razorpay Subscriptions API)
  razorpaySubscriptionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  // D1c - trial fields
  trialEndsAt?: string;
  trialCardRequired?: boolean;
  // ERP pricing/plan-gating: set once when a live trial lapsed and the account
  // was downgraded to Free. Drives the post-expiry "Your full access ended"
  // dashboard banner (components/subscription/TrialBanners.tsx). Mutually
  // exclusive with an in-flight `trialEndsAt` (a lapsed account is no longer
  // status==='trial'). Keep in sync with the backend Subscription schema.
  trialEndedAt?: string;
  // D1g - dunning
  gracePeriodUntil?: string;
  failedPaymentAttempts?: number;
  // D1c - pause
  isPaused?: boolean;
  pausedAt?: string;
  pauseReason?: string;
  resumeAt?: string;
  // D1i - admin entitlement override snapshot
  entitlementsOverride?: Partial<PlanEntitlements>;
}

// Re-export D1 billing types from dedicated file.
export type {
  BillingCycle,
  LifecycleCycle,
  PaymentMode,
  SubscriptionPaymentStatus,
  SubscriptionStatusFull,
  PriceQuote,
  CouponType,
  Coupon,
  CouponRedemptionStats,
  CouponValidationResult,
  ResolvedCoupon,
  CreateCheckoutPayload,
  CreateCheckoutResponse,
  ConfirmPaymentPayload,
  ConfirmPaymentResponse,
  CreateMandatePayload,
  CreateMandateResponse,
  SubscriptionPaymentRefund,
  BillingSnapshot,
  SubscriptionPayment,
  PaymentsListQuery,
  PaymentsListResponse,
  InvoiceMeta,
  RefundStatus,
  RefundRequest,
  RefundRequestPayload,
  RefundPolicyPublic,
  DunningStatus,
  BillingProfile,
  RazorpayOpenOptions,
  RazorpayCheckoutSuccessResponse,
  PlanD1Extensions,
  PlanWithBilling,
  // D3 admin DTOs
  AdminGrantSubscriptionPayload,
  AdminExtendPeriodPayload,
  AdminOverrideEntitlementsPayload,
  AdminPausePayload,
  AdminResumePayload,
  AdminForceCancelPayload,
  AdminManualPaymentPayload,
  AdminIssuePaymentLinkPayload,
  AdminPaymentLinkResult,
  AdminPaymentLinkListQuery,
  AdminPaymentLinkListResponse,
  AdminApproveRefundPayload,
  AdminRejectRefundPayload,
  AdminDirectRefundPayload,
  AdminCreateCouponPayload,
  AdminUpdateCouponPayload,
  AdminCouponListQuery,
  BillingPolicy,
  CouponAttribution,
  RefundPolicy,
  AuditActorType,
  BillingAuditEntry,
  AuditLogQuery,
  AuditLogResponse,
  AdminCreateCustomPlanPayload,
  AdminUpdateCustomPlanPayload,
} from './billing';

// ── API Responses ─────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Actual shape returned by the team list endpoint (members key, not data) */
export interface TeamListResponse {
  members: TeamMember[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  /**
   * Present (optional) only when this workspace is OVER its plan's member
   * limit after the grace window, so the list was server-trimmed to the
   * allowed members. Drives the <MemberCapNotice> banner above the Team list
   * (components/dashboard/MemberCapNotice.tsx). Absent = not capped.
   * `visibleCount` rows returned, `totalCount` actually exist, `limit` is the
   * plan's cap. Keep in sync with the backend Team list response shape.
   */
  memberCap?: {
    capped: boolean;
    visibleCount: number;
    totalCount: number;
    limit: number;
  };
}

// ── Notification ──────────────────────────────────
export interface Notification {
  _id: string;
  workspaceId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  /** Free-form payload - `category` drives invite deep-linking in the bell. */
  metadata?: { category?: string; [key: string]: unknown };
}

// ══════════════════════════════════════════════════
// DTO / Payload Types (for API calls & form handlers)
// ══════════════════════════════════════════════════

// ── Auth Payloads ─────────────────────────────────
export interface RegisterPayload {
  name: string;
  email?: string;
  mobile?: string;
  password: string;
  /**
   * 6-digit OTP from the registration-OTP email
   * (POST /auth/email-otp/send-register). Required by the BE for email-path
   * registration. Mobile-app and legacy User-only callers omit it.
   */
  emailOtp?: string;
  /**
   * Web combined-signup workspace block. When present the BE creates User +
   * Workspace atomically (compensating User-delete on workspace failure).
   * Used by the unified email/mobile SignupMode; legacy callers omit this
   * field and continue with User-only register.
   */
  workspace?: {
    name: string;
    location?: string;
    businessType?: 'trading' | 'manufacturing' | 'service' | 'composition';
    gstin?: string;
    pan?: string;
    fyStartMonth?: number;
  };
  /**
   * Wave 4.8 (2026-05-10) - atomic signup-and-accept-invite (email path).
   * BE creates User + joins existing workspace via bridge invite row in one
   * transaction.
   */
  inviteToken?: string;
  /**
   * Wave 5 (2026-05-21) - atomic product-policy consent at signup. When the
   * user ticks the T&C checkbox in `SignupMode`, the FE forwards the chosen
   * product here and the BE stamps `connectPolicyAcceptedAt` /
   * `erpPolicyAcceptedAt` on the same user-creation save. Eliminates the
   * post-signup round-trip race that caused the "you just accepted, accept
   * again?" gate.
   */
  acceptedPolicy?: 'connect' | 'erp';
  /**
   * Referral code from `?ref=` query or the in-form field (Task 22 -
   * referral program). Forwarded to the BE at signup; no-op when the
   * program is off (admin `enabled=false`). Only sent when non-empty.
   */
  referralCode?: string;
}

// ── Workspace Payloads ────────────────────────────
export interface CreateWorkspacePayload {
  name: string;
  location?: string;
  timezone?: string;
  designations?: string[];
  bankAccounts?: BankAccount[];
  // Business (firm) profile - captured inline at workspace creation.
  // All optional; user can Skip and complete via business-setup wizard.
  firmName?: string;
  businessType?: 'trading' | 'manufacturing' | 'service' | 'composition';
  gstin?: string;
  pan?: string;
  fyStartMonth?: number;
}

export interface UpdateWorkspacePayload {
  name?: string;
  location?: string;
  // Company postal address — single source of truth for the employee ID card.
  // Maps to backend Workspace.address (UpdateWorkspaceDto, max 300).
  address?: string;
  timezone?: string;
  designations?: string[];
  bankAccounts?: BankAccount[];
  appLockIdleMs?: number | null;
  selfServiceConfig?: {
    selfPunch: boolean;
    selfLeaveApply: boolean;
  };
  attendanceSettings?: {
    complianceThresholdPct?: number;
  };
}

export interface InviteMemberPayload {
  email?: string;
  mobile?: string;
  roleId?: string;
  // P1.5 (2026-05-14) - when set, links the invite to a directory employee
  // (TeamMember). Replaces the deprecated `team.grantAccess` flow.
  teamMemberId?: string;
  // P1.5 - delivery channel control. 'link' suppresses email + SMS so the
  // caller can copy + share the returned `inviteToken` manually.
  sendMethod?: 'auto' | 'link' | 'both';
  // P2.0.2 (2026-05-15) - per-channel override. When present, BE ignores
  // sendMethod and fires exactly the listed channels. Empty array =
  // suppress all dispatch (token still returned).
  channels?: ('email' | 'sms' | 'in_app')[];
}

export interface ChangeMemberRolePayload {
  roleId?: string;
}

// ── Team Payloads ─────────────────────────────────
export interface CreateTeamMemberPayload {
  name: string;
  mobile?: string;
  email?: string;
  designation?: string;
  department?: string;
  location?: string;
  locationId?: string | null;
  avatar?: string;
  rbacRoleId?: string | null;
  shiftId?: string | null;
  scheduleType?: 'shift' | 'custom';
  weeklyOff?: string[];
  customSchedule?: { startTime: string; endTime: string };
  salaryType?: 'monthly' | 'hourly' | 'piece_rate';
  salaryAmount?: number;
  salaryDayBasis?: 'fixed_month_days' | 'calendar_month_days';
  fixedMonthDays?: number | null;
  attendancePayMode?: 'default' | 'enabled' | 'disabled';
  dailyHours?: number;
  workingDays?: number;
  finalMonthlyOverride?: number | null;
  // Statutory & Tax
  pan?: string;
  uan?: string;
  taxRegime?: 'old' | 'new';
  stateOfEmployment?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant';
  pfApplicable?: boolean;
  pfOptedOut?: boolean;
  esiApplicable?: boolean;
  esiIpNumber?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  isNonItrFiler?: boolean;
  ctcAmount?: number;
  componentTemplateId?: string | null;
  componentOverrides?: EmployeeComponentOverride[];
  bankDetails?: BankDetails;
  upiDetails?: UpiDetails;
  preferredMethod?: 'BANK' | 'UPI' | 'CASH';
  dateOfBirth?: string;
  dateOfJoining?: string;
  dateOfResignation?: string;
  resignationNote?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  address?: string;
  // Father's/spouse name - accepted by the BE create DTO; used by CSV import.
  fatherOrSpouseName?: string;
  // Nationality + Aadhaar - accepted by the BE create DTO; used by CSV import.
  nationality?: string;
  aadhaar?: string;
  isActive?: boolean;
  // Always system-generated server-side; any client value is ignored. Kept only
  // for back-compat of older callers — the CSV importer and Add form omit it.
  employeeCode?: string;
  reportsTo?: string | null;
  /**
   * Phase 1f mobile-OTP verification (2026-05-21). Short-lived JWT proof
   * minted by `POST /team/verify-mobile/confirm` after the employee enters
   * the SMS-delivered OTP. When present at create-time, BE calls
   * `MobileOtpService.assertProofToken` and persists `mobileVerifiedAt`.
   * Absence = skipped verification = `mobileVerifiedAt: null`.
   */
  mobileVerifyToken?: string;
  /**
   * Phase 1 compliance - per-member minimum monthly wage override (INR).
   * Null clears the override and falls through to the workspace default.
   * Write-gated to HR and Owner (statutory field group).
   */
  minimumWageMonthlyOverride?: number | null;
}

export interface CreateTeamMemberResult {
  member: TeamMember;
  employeeCodeNotice?: {
    code: 'EMP_CODE_BUMPED';
    assigned: string;
    sequence: number;
  };
}

export interface UpdateTeamMemberPayload extends Partial<CreateTeamMemberPayload> {
  isNonItrFiler?: boolean;
}

/**
 * CSV bulk-import contract (team import wizard -> team.service.bulkCreate).
 * The wizard parses + column-maps a CSV into an array of full create payloads,
 * then posts them here behind a PIN gate. BE returns a per-row report; partial
 * success is normal (one bad row never blocks the rest).
 */
export interface BulkCreateTeamMembersPayload {
  members: CreateTeamMemberPayload[];
}

export interface BulkCreateTeamMembersResult {
  total: number;
  created: Array<{ index: number; id: string; name: string; employeeCode: string | null }>;
  failed: Array<{ index: number; name: string; error: string }>;
}

/**
 * P1.8.1 (2026-05-14) - context-aware grant-flow prelude payload returned
 * by `GET /workspaces/:wsId/team/:memberId/grant-context`. Drives the
 * Grant App Access drawer's 3-variant UX (none/registered/conflict) +
 * smart channel default + pre-seeded role + existing custom overrides.
 */
export interface GrantContextMatchedUser {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
}

export interface GrantContextConflict {
  memberId: string;
  name: string;
  employeeCode: string | null;
}

export type GrantContextStatus = 'none' | 'registered' | 'conflict' | 'already_granted';

export interface GrantContext {
  inviteeStatus: GrantContextStatus;
  matchedUser?: GrantContextMatchedUser | null;
  conflictWith?: GrantContextConflict;
  defaultRoleId?: string | null;
  customOverrides: TeamMemberPermissionOverride[];
}

export interface GrantAccessPayload {
  rbacRoleId: string;
  sendMethod: 'auto' | 'link' | 'both';
  email?: string;
  /** P2.0.2 (2026-05-15) - per-channel override matching ResendInvitePayload.
   *  When present, BE ignores sendMethod and dispatches exactly the listed
   *  channels. Empty array = generate token only, no dispatch. */
  channels?: ('email' | 'sms' | 'in_app')[];
}

// Wave 4.10 - F11 fix: BE returns inviteToken when sendMethod === 'link' or
// 'both'. Web modal flips to a success view + surfaces the URL so owners can
// share it via copy / WhatsApp / SMS / Email. The token is only present in
// the response; never re-fetchable, so the success view must capture it
// before unmounting the modal.
export interface GrantAccessResponse {
  message: string;
  inviteToken?: string;
}

// ── App Access Management (P1+P2+P3) ────────────────────────────────────
//
// Mirror of the BE DTOs in crewroster-backend/src/modules/team/dto/access.dto.ts.
// All four endpoints live under /workspaces/:wsId/team/:memberId/...

export interface RevokeAccessPayload {
  /** Free-text reason captured in the audit log. Not surfaced to the
   *  member; private to the owner-side audit trail. */
  reason?: string;
  /** Default true on the BE. Set to false for future "pause access"
   *  semantics that retain sessions + denylist. */
  hardRevoke?: boolean;
}

export interface ResendInvitePayload {
  sendMethod: 'auto' | 'link' | 'both';
  /** Optional one-shot email override - does NOT mutate
   *  TeamMember.email. Use when the stored email is wrong or unknown. */
  email?: string;
  /** When true, rotate the raw token even if the current one is still
   *  within the 7-day expiry window. Default behavior reuses. */
  forceRegenerate?: boolean;
  /** P1.8-revert.13 (2026-05-14) - per-channel control. When provided,
   *  overrides the sendMethod-derived channel mix. Empty array → token
   *  rotates but nothing dispatches. */
  channels?: ('email' | 'sms' | 'in_app')[];
}

export interface ResendInviteResponse {
  message: string;
  inviteToken?: string;
}

// ── P2.0 (2026-05-15) - /dashboard/invitations data shapes ──────────────
// Returned by GET /me/invites/sent. Aggregated across all workspaces
// where the caller is the inviter.
export type InviteLifecycleStatus = 'invited' | 'active' | 'declined' | 'removed';

export interface SentInviteWorkspace {
  id: string;
  name: string;
  businessType?: string;
  logo?: string;
}
export interface SentInviteRole {
  id: string;
  name: string;
  isSystem?: boolean;
}
export interface SentInviteInvitee {
  id: string;
  name?: string;
}
export interface SentInvite {
  id: string;
  workspace: SentInviteWorkspace | null;
  role: SentInviteRole | null;
  invitee: SentInviteInvitee | null;
  inviteeIdentifier: string | null;
  inviteeType: 'email' | 'mobile' | null;
  status: InviteLifecycleStatus;
  createdAt: string;
  inviteExpiry: string | null;
  joinedAt: string | null;
  declinedAt: string | null;
  removedAt: string | null;
  linkedTeamMemberId: string | null;
}

// Returned by GET /me/invites/history. Past invitations addressed to caller.
export interface InviteHistoryItem {
  id: string;
  workspace: SentInviteWorkspace | null;
  role: SentInviteRole | null;
  invitedBy: string;
  status: Exclude<InviteLifecycleStatus, 'invited'>;
  joinedAt: string | null;
  declinedAt: string | null;
  removedAt: string | null;
}

export interface ChangeAccessRolePayload {
  rbacRoleId: string;
}

export interface TeamMemberPermissionOverride {
  module: string;
  action: string;
  /** true → force-allow (extends the role). false → force-deny (overrides
   *  a role-granted action). */
  allowed: boolean;
  /** Scope qualifier for an allow-override. `'self'` = acts on their own
   *  records only; `'all'` = acts on every member's. When omitted the
   *  backend treats it as `'self'` (least-privilege / fail-closed). */
  scope?: 'self' | 'all';
}

export interface SetPermissionOverridesPayload {
  overrides: TeamMemberPermissionOverride[];
  /** Optional path-level overrides (registry-path granularity). When present
   *  the backend merges them with the action-level `overrides` array. */
  pathOverrides?: PathOverride[];
}

export interface BulkStatusPayload {
  memberIds: string[];
  status: 'active' | 'inactive';
}

export interface BulkDeletePayload {
  memberIds: string[];
}

export interface BulkRestorePayload {
  memberIds: string[];
}

// ── Attendance Payloads ───────────────────────────
export interface MarkAttendancePayload {
  teamMemberId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
}

export interface BulkMarkAttendanceRecord {
  teamMemberId: string;
  date: string;
  status?: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  note?: string;
}

export interface BulkMarkAttendancePayload {
  records: (MarkAttendancePayload | BulkMarkAttendanceRecord)[];
}

export interface BulkMarkAttendanceResult {
  marked: number;
  skippedLocked: number;
}

export interface UpdateAttendancePayload {
  status?: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  note?: string;
}

// ── Salary Payloads ───────────────────────────────
export interface UpdateSalaryPayload {
  baseSalary?: number;
  additions?: number;
  deductions?: number;
}

export interface CreateSalaryAdjustmentPayload {
  type: SalaryAdjustmentType;
  category: SalaryAdjustmentCategory;
  amount: number;
  correctionOfAdjustmentId?: string;
  reasonTitle: string;
  note?: string;
  attachments?: string[];
}

export interface ReverseSalaryAdjustmentPayload {
  reversalReason: string;
}

export interface SplitPaymentLine {
  method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  amount: number;
  transactionId?: string;
  voucherNo?: string;
  referenceNo?: string;
  paymentFrom?: string;
  paidBy?: string;
  dateTime?: string;
  note?: string;
  proofUrls?: string[];
}

export interface RecordSalaryPaymentPayload {
  salaryId?: string;
  teamMemberId?: string;
  month?: number;
  year?: number;
  advanceTarget?: 'next_month' | 'this_month';
  amount: number;
  paymentDate: string;
  paymentMode: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'split' | 'other';
  note?: string;
  referenceNo?: string;
  transactionId?: string;
  voucherNo?: string;
  proofAttached?: boolean;
  proofUrl?: string;
  proofUrls?: string[];
  paymentFrom?: string;
  paidBy?: string;
  splitLines?: SplitPaymentLine[];
  commission?: number;
  commissionNote?: string;
  commissionTitle?: string;
  advanceInstallments?: { installmentCount?: number; installmentAmount?: number };
  overrideCompliance?: boolean;
  overrideReason?: string;
  /** COA cash/bank account for ledger posting (D-10). Optional - silently skipped if Finance not configured. */
  coaAccountId?: string;
}

export interface OutstandingAdvancesResponse {
  totalAdvanced: number;
  totalRecovered: number;
  outstanding: number;
  advances: Array<{
    paymentId: string;
    amount: number;
    advanceForMonth: number;
    advanceForYear: number;
    recoveryStatus: 'pending' | 'recovered' | 'reversed' | 'partial';
    paymentDate: string;
    installments?: Array<{
      month: number;
      year: number;
      amount: number;
      status: string;
      index: number;
    }>;
  }>;
}

export interface AdvanceInstallmentRow {
  index: number;
  month: number;
  year: number;
  plannedAmount: number;
  appliedAmount: number;
  adjustmentId?: string;
  status: 'scheduled' | 'applied' | 'reversed' | 'carried';
}

// ── Employer Loan ─────────────────────────────────

export type LoanType = 'personal' | 'medical' | 'housing' | 'vehicle' | 'education' | 'other';
export type InterestType = 'zero' | 'flat' | 'reducing_balance';
export type LoanStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'paused'
  | 'completed'
  | 'written_off'
  | 'reversed';
export type LoanInstallmentStatus = 'scheduled' | 'applied' | 'reversed' | 'skipped' | 'carried';

export interface LoanInstallment {
  index: number;
  month: number;
  year: number;
  principalPlanned: number;
  interestPlanned: number;
  emiPlanned: number;
  appliedAmount: number;
  adjustmentId?: string;
  status: LoanInstallmentStatus;
  skipReason?: string;
  knockOnChoice?: 'extend_tenor' | 'raise_emi';
}

export interface LoanApprovalStep {
  stepIndex: number;
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedAt?: string;
  comment?: string;
}

export interface EmployerLoan {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  loanType: LoanType;
  principalAmount: number;
  disbursedOutsideApp: boolean;
  disbursementDate: string;
  disbursementReferenceNo?: string;
  disbursementNote?: string;
  interestType: InterestType;
  annualInterestRate: number;
  tenorMonths: number;
  emiAmount: number;
  startMonth: number;
  startYear: number;
  status: LoanStatus;
  recoveredAmount: number;
  remainingPrincipal: number;
  remainingAmount: number;
  totalInterestScheduled: number;
  interestPaidToDate: number;
  installments: LoanInstallment[];
  linkedAdjustmentIds: string[];
  approvalChain: LoanApprovalStep[];
  approvedAt?: string;
  approvedBy?: string;
  pausedAt?: string;
  pauseResumeDate?: string;
  closedAt?: string;
  closureType?: string;
  closureReason?: string;
  writeOffAmount?: number;
  medicalLoanExempt: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** One row in the loan EMI preview table */
export interface LoanSchedulePreviewRow {
  index: number;
  month: number;
  year: number;
  principalPart: number;
  interestPart: number;
  emiAmount: number;
  balanceAfter: number;
}

export interface LoanSchedulePreviewResponse {
  installments: LoanSchedulePreviewRow[];
  totalInterest: number;
  totalRepayable: number;
  emiAmount: number;
}

export interface CreateLoanPayload {
  teamMemberId: string;
  loanType: LoanType;
  principalAmount: number;
  disbursedOutsideApp?: boolean;
  disbursementDate: string;
  disbursementReferenceNo?: string;
  disbursementNote?: string;
  interestType: InterestType;
  annualInterestRate: number;
  tenorMonths: number;
  startMonth: number;
  startYear: number;
  approvalChain?: Array<{ approverId: string; approverName: string }>;
  medicalLoanExempt?: boolean;
  note?: string;
}

export interface PreviewLoanSchedulePayload {
  loanType: LoanType;
  principalAmount: number;
  interestType: InterestType;
  annualInterestRate: number;
  tenorMonths: number;
  startMonth: number;
  startYear: number;
}

export interface LoanDashboardResponse {
  totalActiveLoans: number;
  totalActiveAmount: number;
  totalOutstandingPrincipal: number;
  loans: EmployerLoan[];
}

// Lifecycle payloads (Part B)

export interface ApproveLoanPayload {
  decision: 'approve' | 'reject';
  comment?: string;
}

export interface SkipInstallmentPayload {
  installmentIndex: number;
  knockOnChoice: 'extend_tenor' | 'raise_emi';
  skipReason: string;
}

export interface PauseResumeLoanPayload {
  action: 'pause' | 'resume';
  /** ISO date string: auto-resume date (only for pause) */
  pauseResumeDate?: string;
  reason?: string;
}

export interface EarlyPayoffLoanPayload {
  payoffAmount: number;
  reason: string;
}

export interface TopUpLoanPayload {
  additionalAmount: number;
  disbursementDate: string;
  disbursedOutsideApp?: boolean;
  disbursementReferenceNo?: string;
  newTenorMonths?: number;
  reason: string;
}

export interface WriteOffLoanPayload {
  writeOffAmount: number;
  reason: string;
}

export interface AdvanceRecoveryPlan {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  sourcePaymentId: string;
  totalAmount: number;
  installmentAmount: number;
  installmentCount: number;
  startMonth: number;
  startYear: number;
  status: 'active' | 'paused' | 'completed' | 'reversed';
  recoveredAmount: number;
  remainingAmount: number;
  installments: AdvanceInstallmentRow[];
  closureType?: string;
  closureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvanceSchedulePreviewRow {
  index: number;
  month: number;
  year: number;
  amount: number;
  projectedNet?: number;
  capped?: boolean;
  complianceAllowed?: number;
}

/** Breach returned by the backend previewAdvanceSchedule complianceResult.breaches array. */
export interface AdvanceComplianceBreach {
  code: 'DEDUCTION_CAP' | 'MIN_WAGE_FLOOR';
  month: number;
  year: number;
  proposed: number;
  maxCompliant: number;
}

/** Warning returned by the backend previewAdvanceSchedule complianceResult.warnings array. */
export interface AdvanceComplianceWarning {
  code: 'ADVISORY_ONE_THIRD' | 'ADVISORY_12_MONTH' | 'MIN_WAGE_UNCONFIGURED';
  detail: string;
}

export interface AdvanceSchedulePreviewResponse {
  installments: AdvanceSchedulePreviewRow[];
  installmentCount: number;
  installmentAmount: number;
  totalAmount: number;
  complianceResult?: {
    breaches: AdvanceComplianceBreach[];
    warnings: AdvanceComplianceWarning[];
  };
}

export interface PreviewAdvanceSchedulePayload {
  totalAmount: number;
  startMonth: number;
  startYear: number;
  installmentCount?: number;
  installmentAmount?: number;
  teamMemberId?: string;
}

export interface EditAdvanceRecoveryPlanPayload {
  installmentAmount?: number;
  action?: 'pause' | 'resume';
}

export interface EarlyPayoffPayload {
  reason: string;
}

// ── Shift Payloads ────────────────────────────────
export interface CreateShiftPayload {
  name: string;
  startTime: string;
  endTime: string;
  workingDays?: number[];
  weeklyOff?: string[];
  color?: string;
  colorBg?: string;
  isDefault?: boolean;
  gracePeriodMinutes?: number;
  halfDayAfterLateMinutes?: number;
  shiftType?: 'fixed' | 'flexi' | 'split' | 'break';
  requiredHoursPerDay?: number | null;
  policyId?: string | null;
}

export type UpdateShiftPayload = CreateShiftPayload;

// ── Holiday Payloads ───────────────────────────────
export interface CreateHolidayPayload {
  name: string;
  date: string;
  description?: string;
  isRecurring?: boolean;
  type?: 'national' | 'festival' | 'company' | 'other';
}

export interface UpdateHolidayPayload {
  name?: string;
  date?: string;
  description?: string;
  isRecurring?: boolean;
  type?: 'national' | 'festival' | 'company' | 'other';
}

// Result of POST /holidays/bulk — partial success: rows that hit the unique
// {workspaceId,date} index come back as `skipped` rather than failing the batch.
// Mirrors HolidaysService.bulkCreate on the backend.
export interface BulkCreateHolidaysResult {
  created: Holiday[];
  skipped: { date: string; reason: string }[];
}

// ── Bill Payloads ─────────────────────────────────
export interface CreateBillPayload {
  type: 'payable' | 'receivable';
  partyName: string;
  amount: number;
  description?: string;
  invoiceUrl?: string;
  dueDate: string;
}

export interface UpdateBillPayload {
  partyName?: string;
  amount?: number;
  description?: string;
  invoiceUrl?: string;
  dueDate?: string;
}

export interface RecordBillPaymentPayload {
  amount: number;
  paymentDate: string;
  note?: string;
  paymentMode: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
}

// ── Role Payloads ─────────────────────────────────
export interface CreateRolePayload {
  name: string;
  description?: string;
  color?: string;
  permissions: Permission[];
  /** Fine-grained registry-path grants for this role (Phase 1c). Optional: callers that only use module-level permissions omit this field. */
  permissionPaths?: GrantedPath[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  color?: string;
  permissions?: Permission[];
  /** Fine-grained registry-path grants for this role (Phase 1c). Optional: callers that only use module-level permissions omit this field. */
  permissionPaths?: GrantedPath[];
}

// ── Subscription Payloads ─────────────────────────
export interface UpgradeSubscriptionPayload {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}

// ── Admin Payloads ────────────────────────────────
export interface UpdateUserStatusPayload {
  isActive: boolean;
  note?: string;
}

export interface CreatePlanPayload {
  name: string;
  tier: string;
  product?: 'erp' | 'connect' | 'bundle';
  monthlyPrice: number;
  yearlyPrice: number;
  entitlements: PlanEntitlements;
  isActive?: boolean;
  /**
   * Free-trial length (days) new sign-ups on this plan get. 0 = no trial.
   * Mirrors backend CreatePlanDto.trialDurationDays (integer >= 0).
   */
  trialDurationDays?: number;
  /**
   * Mark this the default plan for new sign-ups. Backend clears the previous
   * default on the same product automatically, so the editor only sends `true`.
   * Mirrors backend CreatePlanDto.isDefault.
   */
  isDefault?: boolean;
  /**
   * Mark this the trial plan for its product. New sign-ups start on its access
   * for trialDurationDays, then drop to the default plan. Backend forces
   * isPubliclyVisible:false (not buyable) and enforces one trial plan per product.
   * Mirrors backend CreatePlanDto.isTrialPlan.
   */
  isTrialPlan?: boolean;
  /**
   * Pricing knobs (admin-tunable). Mirror backend CreatePlanDto.
   * - upfrontDiscountPercent: % off the yearly price when paid in one upfront
   *   payment (0-100, default 0).
   * - installmentsEnabled: whether the yearly price can be paid in 0%-interest
   *   monthly installments (default true).
   * - installmentMonths: how many monthly installments the yearly price splits
   *   into (1-24, default 12).
   * Edited in app/admin/plans (Signup/Pricing section).
   */
  upfrontDiscountPercent?: number;
  installmentsEnabled?: boolean;
  installmentMonths?: number;
  /**
   * GST controls (admin-tunable, top-level — NOT inside entitlements). Mirror
   * backend CreatePlanDto: gstEnabled (default true), gstRatePercent (int 0-50,
   * default 18), isPriceTaxInclusive (default false). Edited in app/admin/plans
   * (Pricing section). When gstEnabled is false the backend zeroes GST everywhere.
   */
  gstEnabled?: boolean;
  gstRatePercent?: number;
  isPriceTaxInclusive?: boolean;
  /**
   * Per-plan marketing card content (admin-editable tagline + feature bullets,
   * localized). Mirrors backend CreatePlanDto.marketing (PlanMarketingDto). The
   * editor preserves any other existing marketing subfields (badge / displayOrder
   * / ...) it does not edit, so a save never wipes them. Edited in app/admin/plans.
   */
  marketing?: PlanMarketing;
}

export type UpdatePlanPayload = Partial<CreatePlanPayload>;

export interface AdminAssignPlanPayload {
  userId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  entitlements: PlanEntitlements;
  note?: string;
}

export interface AdminCustomAssignPayload {
  userId: string;
  planId?: string;
  // Product line for the new subscription. Defaults to the base plan's product
  // (or 'erp') on the backend; set explicitly to 'connect' for the fully-dynamic
  // Connect custom assignment (no base plan needed).
  product?: 'erp' | 'connect' | 'bundle';
  entitlements: PlanEntitlements;
  startDate: string;
  endDate: string;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  status?: 'active' | 'trial';
  note?: string;
}

export interface AdminUpdateSubscriptionPayload {
  status?: string;
  currentPeriodEnd?: string;
  entitlements?: Partial<PlanEntitlements>;
  note?: string;
}

/**
 * One Connect/ERP subscription summary on an admin user row. The backend now
 * splits a person's plans by product line (a person can hold an ERP plan AND a
 * Connect/bundle plan at once), so each side is reported separately.
 */
export interface AdminUserProductSubscription {
  planName: string;
  planTier: string;
  status: string;
  product: 'erp' | 'connect' | 'bundle';
  // Trial end date when status === 'trial' (opt-in trials sit on the Free plan
  // with status:'trial'), else null. Drives the "Trial" badge + "ends {date}"
  // text in the admin Users ERP-plan column. Mirrors admin.service.ts getUsers.
  trialEndsAt?: string | null;
}

/**
 * Admin Users table row. The old single `subscription` field is gone: the row
 * now reports ERP and Connect separately (a person may have both, since Connect
 * is person-centric while ERP is workspace-centric) plus product-membership
 * flags. Shape mirrors admin.service.ts getUsers. Read by app/admin/users
 * (Products / ERP plan / Connect columns) and the Manage Plans drawer.
 */
export interface AdminUserWithSubscription extends User {
  workspaceCount?: number;
  isErpUser: boolean;
  isConnectUser: boolean;
  erpSubscription: AdminUserProductSubscription | null;
  connectSubscription: AdminUserProductSubscription | null;
}

/**
 * Connect ads wallet (boost credits) snapshot for one person, whole rupees.
 * `balance` is spendable; `grantBalance` is plan-granted credits inside it;
 * `reserved` is held against in-flight boosts. Mirrors the admin wallet GET.
 */
export interface AdminConnectWallet {
  balance: number;
  grantBalance: number;
  reserved: number;
}

export interface UserWorkspace {
  _id: string;
  name: string;
  role: string;
  isActive: boolean;
  joinedAt?: string;
}

export interface AdminUserDetails {
  user: User;
  workspaces: UserWorkspace[];
  workspaceCount: number;
  subscription?: {
    _id: string;
    planName: string;
    planTier: string;
    status: string;
    billingCycle: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    source?: string;
    assignedBy?: { name: string; email?: string };
    assignedAt?: string;
    assignmentNote?: string;
    appliedEntitlements?: PlanEntitlements;
    purchasedEntitlements?: PlanEntitlements;
  } | null;
}

// ── User Payloads ─────────────────────────────────
export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  mobile?: string;
  profilePicture?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ── Ledger (for salary history listing) ───────────
export interface LedgerSplitLine {
  method: string;
  amount: number;
  dateTime?: string;
  paidBy?: string;
  referenceNo?: string;
  paymentFrom?: string;
  note?: string;
  proofUrls?: string[];
}

export interface LedgerTransaction {
  id: string;
  transactionType: string;
  amount: number;
  commission?: number;
  commissionNote?: string;
  method: string;
  dateTime: string;
  recordedBy?: string;
  paidBy?: string;
  referenceNo?: string;
  proofAttached?: boolean;
  proofUrl?: string;
  proofUrls?: string[];
  upiDebitedAccount?: { bankName: string; accountNumber: string; upiRef?: string };
  bankFromAccount?: { bankName: string; accountNumber: string };
  paymentFrom?: string;
  note?: string;
  splitLines?: LedgerSplitLine[];
  status?: 'active' | 'reversed';
  reversedAt?: string;
  reversalReason?: string;
}

export interface LedgerMonth {
  salaryId: string;
  monthKey: string;
  monthLabel: string;
  salary: number;
  status: 'pending' | 'partial' | 'paid' | 'advance';
  baseSalary: number;
  additions: number;
  deductions: number;
  isLocked: boolean;
  paid: number;
  remaining: number;
  transactions: LedgerTransaction[];
}

export interface LedgerRecord {
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  employeePhoto?: string;
  months: LedgerMonth[];
  totalSalary: number;
  totalPaid: number;
  totalRemaining: number;
  totalTransactions: number;
}

// ── Query Params ──────────────────────────────────
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string; // legacy alias kept for other callers
  order?: 'asc' | 'desc'; // legacy alias kept for other callers
  sortBy?: string; // backend field name (preferred)
  sortOrder?: 'asc' | 'desc'; // backend field name (preferred)
  includeDeleted?: boolean;
  // Mirror of includeDeleted for seeded demo/sample accounts. Used by the admin
  // Users list "Show demo accounts" toggle; passed through to GET /admin/users.
  includeDemo?: boolean;
}

export interface AttendanceQueryParams extends PaginationParams {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
  teamMemberId?: string;
  month?: number;
  year?: number;
  /** JSON string forwarded to backend QueryHelper, e.g. '{"memberId":"..."}' */
  filters?: string;
}

export interface TeamQueryParams extends PaginationParams {
  status?: 'all' | 'active' | 'inactive' | 'offboarding' | 'archived';
  appAccess?: 'all' | 'active' | 'invited' | 'none';
  filters?: Record<string, string | string[]>;
}

export interface BillQueryParams extends PaginationParams {
  type?: 'payable' | 'receivable';
  status?: string;
}

// ── Tier ────────────────────────────────────────────
export interface Tier {
  _id: string;
  name: string;
  key: string;
  /** Product line this tier belongs to. Absent = legacy ERP tier. */
  product?: 'erp' | 'connect' | 'bundle';
  displayOrder: number;
  color: string;
  description?: string;
  isActive: boolean;
  defaultEntitlements?: {
    maxWorkspaces: number;
    maxMembersPerWorkspace: number;
    maxTotalMembers: number;
  };
  defaultModuleAccess?: ModuleAccessEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTierPayload {
  name: string;
  key: string;
  product?: 'erp' | 'connect' | 'bundle';
  displayOrder?: number;
  color?: string;
  description?: string;
  isActive?: boolean;
  defaultEntitlements?: {
    maxWorkspaces?: number;
    maxMembersPerWorkspace?: number;
    maxTotalMembers?: number;
  };
  defaultModuleAccess?: ModuleAccessEntry[];
}

export interface UpdateTierPayload {
  name?: string;
  product?: 'erp' | 'connect' | 'bundle';
  displayOrder?: number;
  color?: string;
  description?: string;
  isActive?: boolean;
  defaultEntitlements?: {
    maxWorkspaces?: number;
    maxMembersPerWorkspace?: number;
    maxTotalMembers?: number;
  };
  defaultModuleAccess?: ModuleAccessEntry[];
}

// ── Add-Ons ────────────────────────────────────────
export type AddOnType = 'quota' | 'module' | 'subfeature' | 'credit_pack';

export interface CreditsDelta {
  sms?: number;
  whatsapp?: number;
}
export type AddOnBillingCycle = 'monthly' | 'yearly' | 'lifetime' | 'subscription';

export interface AddOnEntitlementDelta {
  extraWorkspaces?: number;
  extraMembersPerWorkspace?: number;
  extraTotalMembers?: number;
  extraSessionsPerPlatform?: number;
  extraSessionsTotal?: number;
  targetModule?: string;
  targetSubFeatureModule?: string;
  targetSubFeatureKey?: string;
  targetSubFeatureAccess?: FeatureAccessLevel;
  featureOverrides?: Record<string, boolean>;
  /** Wave 7 - credit-pack delta. Multiplied by quantity on activation. */
  creditsDelta?: CreditsDelta;
}

export interface AddOnDefinition {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  type: AddOnType;
  entitlementDelta: AddOnEntitlementDelta;
  monthlyPrice: number;
  yearlyPrice: number;
  lifetimePrice: number;
  stackable: boolean;
  maxStack: number;
  applicableTiers: string[];
  isActive: boolean;
  displayOrder: number;
  defaultBillingCycle: AddOnBillingCycle;
  allowedBillingCycles: string[];
  allowProratedBilling: boolean;
  minDaysBeforeRenewal: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PurchasedAddOnStatus = 'active' | 'expired' | 'cancelled' | 'superseded';
export type PurchasedAddOnSource = 'self' | 'admin';

export interface PurchasedAddOn {
  _id: string;
  userId: string;
  subscriptionId: string;
  addOnDefinitionId: string | AddOnDefinition;
  status: PurchasedAddOnStatus;
  source: PurchasedAddOnSource;
  assignedBy?: string;
  entitlementDelta: AddOnEntitlementDelta;
  billingCycle: AddOnBillingCycle;
  quantity: number;
  activatedAt?: string;
  expiresAt?: string;
  cancelledAt?: string;
  proratedAmount: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AddOnPreview {
  valid: boolean;
  error?: { code: string; message: string };
  proratedPrice?: number;
  fullPrice?: number;
  daysUntilRenewal?: number;
  billingCycle?: AddOnBillingCycle;
  entitlementPreview?: {
    before: PlanEntitlements;
    after: PlanEntitlements;
  };
  warnings?: string[];
}

export interface PurchaseAddOnPayload {
  addOnDefinitionId: string;
  quantity?: number;
  billingCycle?: AddOnBillingCycle;
}

export interface AdminAssignAddOnPayload {
  userId: string;
  addOnDefinitionId: string;
  quantity?: number;
  billingCycle?: AddOnBillingCycle;
  expiresAt?: string;
  note?: string;
}

// ─── Phase B: ADMS Biometric Devices ─────────────────────────────────────────

export type AttendanceDeviceStatus = 'pending_approval' | 'active' | 'paused' | 'revoked';
export type AttendanceDeviceVendor = 'zkteco' | 'essl' | 'realtime' | 'biomax' | 'unknown';

export interface AttendanceDevice {
  _id: string;
  wsId: string;
  serial: string;
  status: AttendanceDeviceStatus;
  vendor: AttendanceDeviceVendor;
  alias: string | null;
  firmwareVersion: string | null;
  firstSeenAt: string | null; // ISO string from JSON
  lastSeenAt: string | null;
  stats: {
    totalEvents: number;
    lastEventAt: string | null;
  };
  config: {
    timezone: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceDeviceCommand {
  _id: string;
  wsId: string;
  deviceId: string;
  serial: string;
  commandText: string;
  status: 'queued' | 'sent' | 'acknowledged' | 'failed';
  sentAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface UnassignedPunchPair {
  deviceSerial: string;
  deviceUserId: string;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AssignDeviceUserPayload {
  deviceSerial: string;
  deviceUserId: string;
  teamMemberId: string;
}

export interface RotateIngestTokenPayload {
  confirm: boolean;
}

export interface IngestTokenResponse {
  token: string;
}

// Phase I - Anomaly Alerts
export type AnomalyRuleType =
  | 'unknown_sn'
  | 'rapid_dup'
  | 'missed_streak'
  | 'off_shift_punch'
  | 'time_travel'
  | 'binding_conflict'
  | 'locked_payroll_push';
export type AnomalySeverity = 'low' | 'med' | 'high';

export interface Anomaly {
  _id: string;
  wsId: string;
  ruleType: AnomalyRuleType;
  severity: AnomalySeverity;
  /** String id when unpopulated; { _id, name } when populated by the list
   *  endpoint; null/absent for device-level anomalies with no member. */
  teamMemberId?: string | { _id: string; name: string } | null;
  deviceSerial?: string;
  context: Record<string, unknown>;
  contextKey?: string;
  acknowledged: boolean;
  acknowledgedBy?: { _id: string; name: string };
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnomalyRule {
  _id?: string;
  wsId: string;
  ruleType: AnomalyRuleType;
  enabled: boolean;
}

export interface AnomalyListResponse {
  items: Anomaly[];
  total: number;
  page: number;
  limit: number;
}

export interface AnomalyCountResponse {
  count: number;
}

// ============================================================
// Machines, Locations, ResourceScopes
// ============================================================

export type MachineStatus = 'active' | 'idle' | 'maintenance' | 'retired';

export interface MachineAttributes {
  needles?: number;
  heads?: number;
  hoopSizeMm?: number;
  maxRpm?: number;
  spec?: string;
}

export interface Machine {
  id: string;
  _id?: string;
  workspaceId: string;
  locationId: string;
  name: string;
  machineCode?: string;
  type: string;
  primaryMetric?: 'stitches' | 'pieces' | 'hours';
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  status: MachineStatus;
  floorTag?: string;
  attributes: MachineAttributes;
  installedOn?: string;
  notes?: string;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMachinePayload {
  locationId: string;
  name: string;
  machineCode?: string;
  type?: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  status?: MachineStatus;
  floorTag?: string;
  attributes?: MachineAttributes;
  installedOn?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateMachinePayload = Partial<Omit<CreateMachinePayload, 'locationId'>> & {
  locationId?: string;
};

export interface MachineStatusCounts {
  active: number;
  idle: number;
  maintenance: number;
  retired: number;
  total: number;
}

export interface MachineShiftAssignment {
  id: string;
  _id?: string;
  workspaceId: string;
  machineId:
    | string
    | {
        _id: string;
        name: string;
        machineCode?: string;
        status?: MachineStatus;
        locationId?: string;
      };
  shiftId: string | { _id: string; name: string; startTime?: string; endTime?: string };
  teamMemberId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isPrimary: boolean;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMachineAssignmentPayload {
  shiftId?: string;
  teamMemberId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isPrimary?: boolean;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export type UpdateMachineAssignmentPayload = Partial<
  Omit<CreateMachineAssignmentPayload, 'shiftId' | 'teamMemberId'>
>;

// Phase 21 - Production Logs (D-01, D-02)
export type PrimaryMetric = 'stitches' | 'pieces' | 'hours';

export interface ProductionLog {
  _id: string;
  workspaceId: string;
  assignmentId: string;
  machineId: string;
  teamMemberId: string;
  shiftId?: string | null;
  date: string; // YYYY-MM-DD
  logCode: string; // PROD-001
  primaryMetric: PrimaryMetric;
  stitchCount: number | null;
  pieceCount: number | null;
  hoursLogged: number | null;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  /** Backend-derived edit window state - may be absent on older records */
  editWindow?: 'editable' | 'expired' | 'payroll_locked';
}

export interface CreateProductionLogPayload {
  assignmentId?: string;
  teamMemberId: string;
  shiftId?: string;
  date: string; // YYYY-MM-DD
  stitchCount?: number;
  pieceCount?: number;
  hoursLogged?: number;
  notes?: string;
}

export interface UpdateProductionLogPayload {
  stitchCount?: number | null;
  pieceCount?: number | null;
  hoursLogged?: number | null;
  notes?: string;
}

export interface BulkProductionLogItem extends CreateProductionLogPayload {
  machineId: string; // required for bulk (controller has no /:machineId path)
}

export interface BulkProductionLogPayload {
  entries: BulkProductionLogItem[];
}

export interface BulkProductionLogResult {
  created: ProductionLog[];
  failed: { index: number; error: string; code?: string }[];
}

export interface ListProductionLogsParams {
  from?: string;
  to?: string;
  operatorId?: string;
  shiftId?: string;
  machineId?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListProductionLogsResponse {
  items: ProductionLog[];
  total: number;
}

export interface PeekNextCodeResponse {
  nextCode: string; // e.g. PROD-007
}

// Phase 22 - Downtime Logging (D-01, D-02, D-16)
export type ReasonCategory = 'mechanical' | 'operational';

export interface DowntimeReasonCode {
  _id: string;
  key: string; // immutable slug
  label: string;
  category: ReasonCategory;
  isSystem: boolean;
  isDisabled: boolean;
  sortOrder: number;
}

export interface WorkspaceDowntimeReasonConfig {
  _id: string;
  workspaceId: string;
  codes: DowntimeReasonCode[];
  createdAt: string;
  updatedAt: string;
}

export interface DowntimeEntry {
  _id: string;
  workspaceId: string;
  machineId: string;
  reasonCodeId: string;
  reasonCodeSnapshot: string;
  reasonLabelSnapshot: string;
  reasonCategory: ReasonCategory;
  startAt: string; // ISO 8601
  endAt: string | null; // null = open
  durationMinutes: number | null;
  notes?: string;
  loggedByUserId: string;
  closedByUserId: string | null;
  downtimeCode: string; // 'DT-001'
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Backend-derived edit window state (optional; older records may omit) */
  editWindow?: 'editable' | 'expired' | 'payroll_locked';
}

export interface CreateDowntimePayload {
  reasonCodeId: string;
  startAt: string;
  endAt?: string; // omit/null → open
  notes?: string;
}

export interface UpdateDowntimePayload {
  reasonCodeId?: string;
  startAt?: string;
  endAt?: string | null;
  notes?: string;
}

export interface CloseDowntimePayload {
  endAt?: string; // omit → server uses now
}

export interface ListDowntimeParams {
  from?: string;
  to?: string;
  machineId?: string;
  reasonCodeId?: string;
  status?: 'open' | 'closed';
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListDowntimeResponse {
  items: DowntimeEntry[];
  total: number;
}

export interface DowntimeReasonCodeUpdate {
  _id?: string; // present = update; absent = add
  label: string;
  category: ReasonCategory;
  isDisabled?: boolean;
  sortOrder?: number;
}

export interface DowntimeReasonCatalogueUpdate {
  codes: DowntimeReasonCodeUpdate[];
}

// ===== Phase 24: Machine Maintenance =====

export type MaintenanceCadenceMode =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'hours_based'
  | 'output_based';

export interface MaintenanceSchedule {
  _id: string;
  workspaceId: string;
  machineId: string;
  scheduleCode: string;
  name: string;
  cadenceMode: MaintenanceCadenceMode;
  cadenceInterval: number;
  technicianId: string | null;
  checklistItems: string[];
  leadTimeDays: number | null;
  estimatedDurationMinutes: number;
  defaultDowntimeReasonCodeId: string | null;
  anchorDate: string;
  nextDueAt: string;
  hoursAccumulated: number;
  outputAccumulated: number;
  lastServicedAt: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ServicePart {
  itemId: string | null;
  freeTextName: string | null;
  itemNameSnapshot: string | null;
  quantity: number;
  unitCostPaise: number | null;
  notes?: string;
}

export interface ChecklistTickState {
  item: string;
  ticked: boolean;
}

export interface ServiceLog {
  _id: string;
  workspaceId: string;
  machineId: string;
  scheduleId: string | null;
  serviceLogCode: string;
  servicedAt: string;
  serviceEndAt: string;
  durationMinutes: number;
  technicianId: string | null;
  technicianNameSnapshot?: string;
  partsReplaced: ServicePart[];
  costPaise: number;
  notes?: string;
  checklistTicked: ChecklistTickState[];
  linkedDowntimeId: string | null;
  loggedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceDueRow {
  scheduleId: string;
  scheduleCode: string;
  scheduleName: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  technicianId: string | null;
  technicianName?: string;
  nextDueAt: string;
  daysRemaining: number;
}

export interface CreateMaintenanceSchedulePayload {
  name: string;
  cadenceMode: MaintenanceCadenceMode;
  cadenceInterval: number;
  technicianId?: string;
  checklistItems?: string[];
  leadTimeDays?: number;
  estimatedDurationMinutes?: number;
  defaultDowntimeReasonCodeId?: string;
  anchorDate?: string;
}

export type UpdateMaintenanceSchedulePayload = Partial<CreateMaintenanceSchedulePayload>;

export interface ServicePartPayload {
  itemId?: string;
  freeTextName?: string;
  quantity: number;
  unitCostPaise?: number;
  notes?: string;
}

export interface CreateServiceLogPayload {
  scheduleId?: string;
  servicedAt: string;
  serviceEndAt: string;
  technicianId?: string;
  partsReplaced: ServicePartPayload[];
  costPaise?: number;
  notes?: string;
  checklistTicked?: ChecklistTickState[];
}

export interface UpdateServiceLogPayload {
  notes?: string;
  costPaise?: number;
}

export interface SetMaintenanceLeadTimePayload {
  leadTimeDays: number;
}

export interface ListServiceLogsParams {
  scheduleId?: string;
  technicianId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ListServiceLogsResponse {
  items: ServiceLog[];
  total: number;
}

export interface ListMaintenanceDueResponse {
  items: MaintenanceDueRow[];
  total: number;
}

export interface Location {
  id: string;
  _id?: string;
  workspaceId: string;
  name: string;
  locationCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  timezone?: string;
  notes?: string;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLocationPayload {
  name: string;
  locationCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  timezone?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateLocationPayload = Partial<Omit<CreateLocationPayload, 'locationCode'>>;

export interface ResourceScope {
  id: string;
  _id?: string;
  workspaceId: string;
  userId: string | { _id: string; name?: string; email?: string };
  machineIds: string[];
  locationIds: string[];
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertResourceScopePayload {
  userId: string;
  machineIds?: string[];
  locationIds?: string[];
  notes?: string;
  isActive?: boolean;
}

export type UpdateResourceScopePayload = Omit<UpsertResourceScopePayload, 'userId'>;

export interface MyResourceScopeResponse {
  hasScope: boolean;
  isActive: boolean;
  machineIds: string[];
  locationIds: string[];
}

// ============================================================
// Finance Module Types
// ============================================================

export interface Firm {
  _id: string;
  workspaceId: string;
  firmName: string;
  businessType: 'trading' | 'manufacturing' | 'service' | 'composition';
  gstin?: string;
  /** 2f multi-GSTIN: additional state registrations beyond the primary gstin.
   *  Each registration is a distinct place of business (own trade name + address). */
  additionalGstins?: {
    gstin: string;
    stateCode: string;
    label?: string;
    tradeName?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
  }[];
  pan?: string;
  /** Principal place of business - registered address for the primary GSTIN.
   *  Rendered on invoice/voucher headers; `stateCode` drives place-of-supply. */
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    stateCode?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  fyStartMonth: number;
  accountsBooksBeginDate?: string;
  // D21 period lock: postings/edits dated on or before this are blocked (set via /books-lock).
  booksLockedUptoDate?: string;
  aato: number;
  inventoryValuationMethod: 'moving_average' | 'fifo';
  lateFeePct: number;
  roundingPolicy: 'half_up' | 'round_off_to_rupee';
  qtyDecimalPlaces: number;
  primaryRole: 'owner' | 'manager' | 'accountant';
  /** Maker-checker (approval) toggle per voucher type. When sale_invoice is on, posting a
   *  draft routes it to pending_approval until a different user approves it (see
   *  InvoiceApprovalBar + BE sale-invoice.service postInvoice/approve). */
  makerCheckerEnabled?: {
    quotation?: boolean;
    sale_order?: boolean;
    proforma?: boolean;
    delivery_challan?: boolean;
    sale_invoice?: boolean;
    purchase_bill?: boolean;
    payment_out?: boolean;
  };
  gstinProviderConfig: {
    mode: 'platform' | 'byok';
    provider?: string;
    encryptedApiKey?: string;
  };
  brandProfile: Record<string, any>;
  invoiceLayout?: {
    showHsnColumn?: boolean;
    showDiscountColumn?: boolean;
    showBankDetails?: boolean;
    showSignature?: boolean;
    showTermsAndConditions?: boolean;
  };
  setupChecklistState: {
    step1Done: boolean;
    step2Done: boolean;
    step3Done: boolean;
    dismissedFields: string[];
  };
  mahuratEnabled: boolean;
  traditionalNewYearMode: string;
  // Phase 16 / FIN-15-04 - workspace-default voucher print locale (default 'en').
  defaultPrintLocale?: PrintLocale;
  qrmpScheme?: boolean;
  allowNegativeStock?: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Phase 16 / FIN-15-04 - voucher print locale (BCP 47). */
export type PrintLocale = 'en' | 'gu' | 'hi';

/**
 * Typed view of `Firm.brandProfile` (stored as a free-form object on the
 * schema). These keys are rendered by the voucher print themes
 * (`lib/finance/print/themes/*`); the finance branding editor is the writer.
 * Every field is optional - a firm may set as little or as much as it likes.
 */
export interface FirmBrandProfile {
  // Each optional field accepts `null` on the branding PATCH payload to clear
  // (unset) a stored value: `null` survives JSON.stringify and tells the
  // backend to $unset the key, whereas `undefined` is dropped from the request
  // body and would leave the old value untouched. Stored documents only ever
  // hold a string or omit the key, never an explicit null.
  logoUrl?: string | null;
  signatureUrl?: string | null;
  /** Hex colour, e.g. '#0B6E4F'. */
  primaryColor?: string | null;
  /** Hex colour, e.g. '#C9A24B'. */
  accentColor?: string | null;
  footerText?: string | null;
  termsAndConditions?: string | null;
  declaration?: string | null;
  upiId?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
}

export interface Account {
  _id: string;
  workspaceId: string;
  firmId: string;
  name: string;
  code: string;
  group?: string;
  subGroup?: string;
  type: 'asset' | 'liability' | 'capital' | 'income' | 'expense';
  isFromTemplate: boolean;
  isSystem: boolean;
  isDeleted: boolean;
  createdAt: string;
  // Last-set opening balance (display + edit prefill). The accounting truth is a
  // posted 'opening_balance' ledger entry maintained server-side. amountPaise >= 0.
  openingBalance?: { amountPaise: number; drOrCr: 'debit' | 'credit'; asOfDate: string };
}

export interface Party {
  _id: string;
  workspaceId: string;
  firmId: string;
  name: string;
  partyType: 'customer' | 'vendor' | 'broker' | 'transporter' | 'employee_advance';
  isInformal: boolean;
  gstin?: string;
  pan?: string;
  state?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditTermsDays: number;
  openingBalance?: { amount: number; type: 'debit' | 'credit'; asOfDate: string };
  consentLog: { channel: string; consented: boolean; timestamp: string }[];
  // Phase 16 / FIN-15-04 - per-party default voucher print locale.
  // Falls through to firm.defaultPrintLocale → 'en' when undefined.
  preferredLocale?: PrintLocale;
  // Phase 17 / Plan 17-01 - embedded RFM/GSTIN/blacklist intelligence sub-doc.
  // Optional everywhere; populated by the nightly RFM segmenter and the GSTIN monitor.
  intelligence?: PartyIntelligence;
  isDeleted: boolean;
  createdAt: string;
}

export interface FinanceItem {
  _id: string;
  workspaceId: string;
  firmId: string;
  itemCode?: string;
  name: string;
  description?: string;
  itemType: 'goods' | 'services';
  hsnSacCode?: string;
  gstRate: number;
  cessRate: number;
  unit: string;
  qtyDecimalPlaces: number;
  trackBatch: boolean;
  category?: string;
  unitConversions: { fromUnit: string; toUnit: string; factor: number }[];
  isDeleted: boolean;
}

export interface VoucherSeries {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: string;
  prefix: string;
  startNumber: number;
  padDigits: number;
  financialYear: string;
  lastUsed: number;
}

export interface AccountantInvite {
  _id: string;
  workspaceId: string;
  firmId: string;
  email: string;
  scopeRole: 'read_only' | 'adjusting_entry';
  status: 'pending' | 'accepted' | 'expired';
  modulePermissions: { module: string; access: 'none' | 'read' | 'write' }[];
  expiresAt?: string;
  createdAt: string;
}

export interface CashRegister {
  _id: string;
  workspaceId: string;
  firmId: string;
  name: string;
  type: 'main' | 'petty_cash';
  imprestAmount?: number;
  currentBalance: number;
  isDefault: boolean;
}

export interface GstinLookup {
  legalName: string;
  tradeName?: string;
  state: string;
  stateCode: string;
  address?: string;
  registrationDate?: string;
  status: 'active' | 'cancelled' | 'suspended' | 'provisional';
}

export interface FinanceChecklistItem {
  key: string;
  label: string;
  done: boolean;
  route: string;
}

// ── Sales - F-02 ──────────────────────────────────
export type VoucherState = 'draft' | 'pending_approval' | 'posted' | 'cancelled' | 'void';
export type VoucherType =
  | 'quotation'
  | 'sale_order'
  | 'proforma'
  | 'delivery_challan'
  | 'sale_invoice';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type EInvoiceStatus = 'not_applicable' | 'pending' | 'generated' | 'failed';

export interface SalesKpiSummary {
  totalInvoiced: number; // paise
  collected: number; // paise
  outstanding: number; // paise
  overdue: number; // paise
  topPending: Array<{ partyName: string; amountPaise: number }>;
}

export interface LineItem {
  itemId: string;
  itemName: string;
  hsnSacCode?: string;
  qty: number;
  unit: string;
  // R11 textile dual-unit breakdown (optional; display/print only, qty stays authoritative).
  secondaryQty?: number;
  secondaryUnit?: string;
  conversionFactor?: number;
  // R11 inventory metadata: chosen lot/godown so stock-out decrements the right lot on post.
  lotId?: string;
  godownId?: string;
  ratePaise: number;
  /** Optional high-precision per-unit rate, 1/10000-rupee units (4 dp). Authoritative when present; ratePaise is its rounded 2-dp mirror. */
  rateCentiPaise?: number;
  discountPct: number;
  discountFlatPaise?: number;
  taxRate: 0 | 5 | 12 | 18 | 28;
  cessRate: number;
  isTaxInclusive: boolean;
  taxableValuePaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  cessPaise?: number;
  lineTotalPaise?: number;
}

export interface AdditionalCharge {
  label: string;
  amountPaise: number;
  isTaxable: boolean;
  taxRate?: 0 | 5 | 12 | 18 | 28;
}

export interface AuditEntry {
  at: string;
  by: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export interface LinkedDoc {
  voucherType: VoucherType;
  voucherId: string;
  voucherNumber?: string;
}

/** Shared base fields for all sales vouchers */
interface VoucherBase {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherNumber?: string;
  voucherDate: string;
  state: VoucherState;
  partyId: string;
  partySnapshot?: Record<string, unknown>;
  placeOfSupplyStateCode?: string;
  /** 2c: tax payable by the recipient under reverse charge (Sec 9(3)/9(4)). */
  isReverseCharge?: boolean;
  /** 2d: this document is a Bill of Supply (composition / exempt) - no GST charged. */
  isBillOfSupply?: boolean;
  /** 2f: the firm GSTIN registration this document is issued under (multi-GSTIN). */
  sellerGstin?: string;
  paymentTerms?: { dueDays?: number; label?: string };
  lineItems: LineItem[];
  additionalCharges: AdditionalCharge[];
  notes?: string;
  internalNotes?: string;
  attachments?: unknown[];
  linkedDocs: LinkedDoc[];
  subtotalPaise?: number;
  totalDiscountPaise?: number;
  taxableValuePaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  cessPaise?: number;
  tcsPaise?: number;
  roundOffPaise?: number;
  grandTotalPaise?: number;
  amountInWords?: string;
  auditLog: AuditEntry[];
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleInvoice extends VoucherBase {
  voucherType: 'sale_invoice';
  dueDate?: string;
  idempotencyKey?: string;
  amountPaidPaise?: number;
  amountDuePaise?: number;
  paymentStatus?: PaymentStatus;
  tcsApplied?: { section: string; rate: number; basePaise: number; amountPaise: number };
  lateFeeSchedule?: { type: string; value: number; gracePeriodDays: number };
  shipping?: {
    mode?: string;
    vehicleNo?: string;
    transporter?: string;
    distance?: number;
    address?: unknown;
  };
  eInvoice?: {
    status: EInvoiceStatus;
    irn?: string;
    ackNo?: string;
    ackDate?: string;
    signedQrCode?: string;
    lastError?: string;
    attempts?: number;
  };
  ewayBill?: { ewbNo?: string; generatedAt?: string; validUpto?: string; vehicleNo?: string };
  upiQrPayload?: string;
  razorpayPaymentLinkUrl?: string;
  razorpayPaymentLinkId?: string;
  recurringTemplateId?: string;
  postedAt?: string;
  postedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

export interface Quotation extends VoucherBase {
  voucherType: 'quotation';
  validUntilDate?: string;
  conversionStatus?: string;
}

export interface SaleOrder extends VoucherBase {
  voucherType: 'sale_order';
  expectedDeliveryDate?: string;
  conversionStatus?: string;
}

export interface Proforma extends VoucherBase {
  voucherType: 'proforma';
  validUntilDate?: string;
  conversionStatus?: string;
}

export interface DeliveryChallan extends VoucherBase {
  voucherType: 'delivery_challan';
  challanType: 'goods' | 'job_work' | 'sample' | 'returnable';
  shipping?: {
    mode?: string;
    vehicleNo?: string;
    transporter?: string;
    distance?: number;
    address?: unknown;
  };
  conversionStatus?: string;
  // e-Way bill generated for this challan (mirrors SaleInvoice.ewayBill). Populated by
  // EwaybillService.generateForChallan; rendered by ChallanEwaySection on the challan page.
  ewayBill?: {
    ewbNo?: string;
    generatedAt?: string;
    validUpto?: string;
    vehicleNo?: string;
    status?: string;
  };
}

export interface RecurringInvoiceTemplate {
  _id: string;
  workspaceId: string;
  firmId: string;
  templateName: string;
  partyId: string;
  lineItems: LineItem[];
  additionalCharges: AdditionalCharge[];
  placeOfSupplyStateCode?: string;
  paymentTerms?: { dueDays?: number };
  notes?: string;
  schedule: {
    mode: 'monthly' | 'quarterly' | 'yearly' | 'every_n_days';
    dayOfMonth?: number;
    everyNDays?: number;
    startDate: string;
    endDate?: string;
  };
  amountAuto: boolean;
  autoPostOnGenerate: boolean;
  notifyOnGenerate: { email: boolean; whatsapp: boolean; sms: boolean };
  isActive: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  runCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── F-03: Payments-In + Party Ledger ────────────────────────────────────────

export interface PaymentAllocation {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDuePaise: number;
  allocatedPaise: number;
  runningDuePaise: number;
}

export interface PaymentReceipt {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherNumber?: string;
  financialYear: string;
  receiptDate: string;
  partyId: string;
  partySnapshot: { name?: string; gstin?: string };
  paymentMode:
    | 'cash'
    | 'bank'
    | 'upi'
    | 'cheque'
    | 'neft'
    | 'rtgs'
    | 'imps'
    | 'razorpay'
    | 'cashfree';
  bankAccountId?: string;
  referenceNo?: string;
  referenceDate?: string;
  totalAmountPaise: number;
  allocations: PaymentAllocation[];
  unappliedPaise: number;
  state: 'draft' | 'posted' | 'cancelled';
  brokerPartyId?: string;
  brokerCommissionPaise?: number;
  brokerCommissionPosted: boolean;
  onlinePaymentId?: string;
  onlinePaymentGateway?: 'razorpay' | 'cashfree';
  autoReconciled: boolean;
  postedAt?: string;
  postedBy?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentReceiptPayload {
  financialYear: string;
  receiptDate: string;
  partyId: string;
  paymentMode: PaymentReceipt['paymentMode'];
  bankAccountId?: string;
  referenceNo?: string;
  referenceDate?: string;
  totalAmountPaise: number;
  allocations: Omit<PaymentAllocation, 'runningDuePaise'>[];
  brokerPartyId?: string;
}

export interface PartyLedgerRow {
  _id: string;
  entryDate: string;
  entryType: string;
  sourceVoucherNumber: string;
  narration: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AgingPartyRow {
  partyId: string;
  partyName: string;
  current: number;
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90plus: number;
  totalDue: number;
}

export interface ReceivablesSummary {
  totalOutstanding: number;
  totalOverdue: number;
  collectedThisMonth: number;
}

export interface OutstandingInvoice {
  _id: string;
  voucherNumber: string;
  voucherDate: string;
  dueDate: string;
  grandTotalPaise: number;
  amountDuePaise: number;
  paymentStatus: string;
}

export interface LateFeeEntry {
  _id: string;
  invoiceId: string;
  invoiceNumber: string;
  partyId: string;
  accrualDate: string;
  feePaise: number;
  originalInvoiceAmountPaise: number;
  daysPastDue: number;
  financialYear: string;
  createdAt: string;
}

// ─── F-06: Expenses + Cash/Bank/Cheque/Loan ─────────────────────────────────

export type ItcEligibility = 'full' | 'blocked' | 'nil_rated';
export type TdsSection = 'sec_194c' | 'sec_194h' | 'sec_194j' | 'sec_194m';
export type ExpenseVoucherState = 'draft' | 'posted' | 'cancelled';
export type ExpensePaymentMode = 'cash' | 'bank' | 'cheque' | 'upi';

export interface ExpenseVoucherLine {
  expenseAccountId: string;
  expenseAccountCode: string;
  expenseAccountName: string;
  description?: string;
  amountPaise: number;
  gstRate?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  itcEligibility: ItcEligibility;
  lineTotalPaise: number;
  costCentre?: string;
}

export interface ExpenseVoucherTdsApplied {
  section: TdsSection;
  rate: number;
  basePaise: number;
  tdsPaise: number;
}

export interface ExpenseVoucher {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'expense';
  voucherNumber?: string;
  voucherDate: string; // ISO
  financialYear: string;
  state: ExpenseVoucherState;
  partyId?: string;
  partySnapshot?: Record<string, unknown>;
  paymentMode: ExpensePaymentMode;
  cashRegisterId?: string;
  bankAccountId?: string;
  chequeId?: string;
  utrReference?: string;
  lineItems: ExpenseVoucherLine[];
  taxableValuePaise: number;
  totalGstPaise: number;
  grandTotalPaise: number;
  totalItcEligiblePaise: number;
  totalItcBlockedPaise: number;
  tdsApplied?: ExpenseVoucherTdsApplied;
  netPayablePaise: number;
  narration: string;
  isIntraState: boolean;
  placeOfSupplyStateCode?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type JournalVoucherType = 'journal' | 'contra';

export interface JournalVoucherLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitPaise: number;
  creditPaise: number;
  partyId?: string;
  costCentre?: string;
}

export interface JournalVoucher {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: JournalVoucherType;
  voucherNumber?: string;
  voucherDate: string;
  financialYear: string;
  state: ExpenseVoucherState;
  narration: string;
  lines: JournalVoucherLine[];
  totalDebitPaise: number;
  totalCreditPaise: number;
  reference?: string;
  isRecurring: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DenominationCount {
  denomination: number; // 500, 200, 100, ...
  count: number;
}

// Extended CashRegisterExtended - has denomination + low-water fields (F-06-01 additions)
export interface CashRegisterExtended {
  _id: string;
  workspaceId: string;
  firmId: string;
  name: string;
  type: 'main' | 'petty_cash';
  imprestAmount?: number;
  currentBalance: number; // RUPEES (per A1) - NOT paise
  isDefault: boolean;
  isDeleted: boolean;
  denominationBreakdown: DenominationCount[];
  lowWaterThresholdPaise?: number;
  lastTallyAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type FinanceBankAccountType = 'current' | 'savings' | 'overdraft' | 'cash_credit';

export interface FinanceBankAccount {
  _id: string;
  workspaceId: string;
  firmId: string;
  name: string;
  bankName: string;
  accountNumber?: string; // masked: 'XXXX1234'
  ifscCode?: string;
  accountType: FinanceBankAccountType;
  openingBalancePaise: number;
  openingBalanceDate: string;
  currentBalancePaise: number;
  coaAccountCode: string;
  coaAccountId: string;
  isDefault: boolean;
  upiId?: string;
  isDeleted: boolean;
}

export type ChequeType = 'issued' | 'received';
export type ChequeStatus =
  | 'pending_maturity'
  | 'in_transit'
  | 'cleared'
  | 'bounced'
  | 'stopped'
  | 'void';

export interface FinanceCheque {
  _id: string;
  workspaceId: string;
  firmId: string;
  chequeType: ChequeType;
  chequeNumber: string;
  chequeDate: string;
  isPostDated: boolean;
  bankAccountId: string;
  bankAccountName: string;
  amount: number; // paise
  partyId?: string;
  partyName?: string;
  paymentVoucherId?: string;
  paymentVoucherNumber?: string;
  status: ChequeStatus;
  depositDate?: string;
  presentationDate?: string;
  clearingDate?: string;
  bounceDate?: string;
  bounceReason?: string;
  bounceChargesPaise?: number;
  bounceChargesRecoveredPaise?: number;
  stopPaymentDate?: string;
  ledgerEntryIds: string[];
  narration?: string;
}

// Finance loan account types (distinct from employer payroll loans above)
export type FinanceLoanType = 'term_loan' | 'overdraft' | 'cash_credit';
export type FinanceLoanStatus = 'active' | 'closed' | 'npa';

export interface LoanAccount {
  _id: string;
  workspaceId: string;
  firmId: string;
  loanCode: string;
  name: string;
  lenderPartyId?: string;
  lenderName: string;
  loanType: FinanceLoanType;
  sanctionedAmountPaise: number;
  disbursedAmountPaise: number;
  disbursementDate: string;
  interestRateAnnual: number;
  tenureMonths: number;
  repaymentStartDate: string;
  emiAmountPaise: number;
  processingFeePaise?: number;
  coaLiabilityAccountId: string;
  coaLiabilityAccountCode: string;
  principalOutstandingPaise: number;
  totalInterestPaidPaise: number;
  nextEmiMonth?: string;
  lastEmiMonth?: string;
  status: FinanceLoanStatus;
  closureDate?: string;
  closureType?: 'foreclosure' | 'full_repayment';
}

export interface LoanScheduleEntry {
  _id: string;
  workspaceId: string;
  firmId: string;
  loanAccountId: string;
  month: string; // YYYY-MM
  openingPrincipalPaise: number;
  emiAmountPaise: number;
  principalComponentPaise: number;
  interestComponentPaise: number;
  closingPrincipalPaise: number;
  status: 'pending' | 'paid' | 'prepaid' | 'overdue';
  paidOn?: string;
  ledgerEntryId?: string;
}

// ============================================================
// F-07 - Returns: Credit Notes, Debit Notes, GRN Returns
// ============================================================

export type CreditNoteState = 'draft' | 'posted' | 'cancelled';
export type CnType =
  | 'goods_return'
  | 'price_correction'
  | 'post_sale_discount'
  | 'deficiency'
  | 'other';
export type CnReasonCode =
  | 'sales_return'
  | 'post_sale_discount'
  | 'deficiency_in_services'
  | 'correction_in_invoice'
  | 'change_in_pos'
  | 'finalization_of_provisional_assessment'
  | 'others';
export type CdnrType = 'cdnr' | 'cdnur';
export type RecipientItcReversalStatus =
  | 'pending'
  | 'self_declared'
  | 'ca_certified'
  | 'not_applicable';

export interface CreditNoteLine {
  itemId?: string;
  itemName?: string;
  hsnSacCode?: string;
  qty?: number;
  unit?: string;
  ratePaise?: number;
  discountPct?: number;
  taxRate?: number;
  taxableValuePaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  lineTotalPaise?: number;
  reverseStock?: boolean;
}

export interface CreditNote {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'credit_note';
  voucherNumber?: string;
  voucherDate: string;
  financialYear: string;
  state: CreditNoteState;
  sourceInvoiceId: string;
  sourceInvoiceNumber: string;
  sourceInvoiceDate: string;
  sourceInvoiceGrandTotalPaise?: number;
  partyId?: string;
  partySnapshot?: Record<string, unknown>;
  placeOfSupplyStateCode?: string;
  isIntraState: boolean;
  cdnrType: CdnrType;
  cnType: CnType;
  reasonCode?: CnReasonCode;
  lineItems: CreditNoteLine[];
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grandTotalPaise: number;
  recipientItcReversalStatus: RecipientItcReversalStatus;
  recipientItcReversalDocUrl?: string;
  refundAmountPaise: number;
  narration?: string;
  notes?: string;
  attachments: string[];
  postedBy?: string;
  postedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  auditLog: unknown[];
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  // e-Invoice (IRN) for this credit note (CRN). Mirrors SaleInvoice.eInvoice; populated by
  // EInvoiceService.generateIrnForCreditNote, rendered by CreditNoteEInvoiceSection.
  eInvoice?: {
    status?: string;
    irn?: string;
    ackNo?: string;
    ackDate?: string;
    signedQrCode?: string;
  };
}

export type DebitNoteState = 'draft' | 'posted' | 'cancelled';
export type DnType =
  | 'goods_return'
  | 'price_correction'
  | 'excess_billing'
  | 'quality_rejection'
  | 'other';

export interface DebitNoteLine {
  itemId?: string;
  itemName?: string;
  hsnSacCode?: string;
  qty?: number;
  unit?: string;
  ratePaise?: number;
  taxRate?: number;
  isCapitalGoods?: boolean;
  taxableValuePaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  lineTotalPaise?: number;
}

export interface DebitNote {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'debit_note';
  voucherNumber?: string;
  voucherDate: string;
  financialYear: string;
  state: DebitNoteState;
  sourceBillId: string;
  sourceBillNumber: string;
  sourceBillDate: string;
  vendorBillRef?: string;
  sourceGrnReturnId?: string;
  sourceGrnReturnNumber?: string;
  partyId?: string;
  partySnapshot?: Record<string, unknown>;
  placeOfSupplyStateCode?: string;
  isIntraState: boolean;
  dnType: DnType;
  vendorAccepted: boolean;
  vendorAcceptedAt?: string;
  lineItems: DebitNoteLine[];
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grandTotalPaise: number;
  tdsAdjustmentNote?: {
    section: string;
    originalTdsPaise: number;
    reversibleTdsPaise: number;
    note: string;
  };
  vendorItcReversalStatus: 'pending' | 'vendor_confirmed' | 'not_applicable';
  narration?: string;
  attachments: string[];
  postedBy?: string;
  postedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  auditLog: unknown[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GrnReturnState = 'draft' | 'dispatched' | 'confirmed' | 'cancelled';

export interface GrnReturnLine {
  itemId?: string;
  itemName?: string;
  qtyReturned?: number;
  unit?: string;
  ratePaise?: number;
  reason?: string;
  batchNumber?: string;
  notes?: string;
}

export interface GrnReturn {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'grn_return';
  voucherNumber?: string;
  voucherDate: string;
  financialYear: string;
  state: GrnReturnState;
  sourceGrnId?: string;
  sourceGrnNumber?: string;
  sourceBillId?: string;
  sourceBillNumber?: string;
  linkedDebitNoteId?: string;
  linkedDebitNoteNumber?: string;
  partyId?: string;
  partySnapshot?: Record<string, unknown>;
  vendorRmaNumber?: string;
  transport?: { carrier?: string; lrNumber?: string; dispatchDate?: string };
  lineItems: GrnReturnLine[];
  notes?: string;
  dispatchedBy?: string;
  dispatchedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  auditLog: unknown[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Reminder Engine (F-08) ────────────────────────────────────

export type ReminderChannel = 'in_app' | 'email' | 'sms' | 'push' | 'whatsapp';
export type ReminderTriggerType = 'invoice_overdue' | 'invoice_due_soon' | 'service_maintenance';
export type ReminderEventType =
  | 'invoice_overdue'
  | 'invoice_due_soon'
  | 'service_maintenance'
  | 'final_notice';
export type ReminderStatus =
  | 'sent'
  | 'failed'
  | 'skipped_cooldown'
  | 'skipped_optout'
  | 'skipped_no_contact';
export type CallTodoStatus = 'pending' | 'in_progress' | 'done' | 'snoozed' | 'cancelled';
export type CallTodoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CallTodoCallType = 'payment_followup' | 'sales_followup' | 'service_reminder' | 'other';

export interface ReminderRule {
  _id: string;
  workspaceId: string;
  firmId: string;
  partyId?: string | null;
  name: string;
  description?: string;
  triggerType: ReminderTriggerType;
  daysOffset: number;
  escalationLevel: 1 | 2 | 3;
  cooldownHours: number;
  channelInApp: boolean;
  channelEmail: boolean;
  channelSms: boolean;
  channelPush: boolean;
  channelWhatsApp: boolean;
  emailTemplateKey?: string;
  smsTemplateKey?: string;
  whatsAppCampaignName?: string;
  priority: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderLog {
  _id: string;
  workspaceId: string;
  firmId: string;
  partyId: string;
  ruleId: string;
  invoiceId?: string;
  machineId?: string;
  channel: ReminderChannel;
  triggerDate: string;
  status: ReminderStatus;
  errorMessage?: string;
  recipient?: string;
  messageId?: string;
  escalationLevel?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderTemplate {
  _id: string;
  workspaceId: string;
  firmId?: string | null;
  channel: ReminderChannel;
  eventType: ReminderEventType;
  subject?: string;
  body: string;
  variables: string[];
  language: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface ReminderSettings {
  _id: string;
  workspaceId: string;
  firmId: string;
  enabled: boolean;
  dispatchTime: string;
  fromName?: string;
  minimumOutstandingPaise: number;
  maxRemindersPerDay: number;
  defaultChannelInApp: boolean;
  defaultChannelEmail: boolean;
  defaultChannelSms: boolean;
  defaultChannelPush: boolean;
  defaultChannelWhatsApp: boolean;
  optOutPartyIds: string[];
}

export interface CallTodo {
  _id: string;
  workspaceId: string;
  firmId: string;
  partyId: string;
  invoiceId?: string;
  invoiceIds?: string[];
  title: string;
  notes?: string;
  contactPhone?: string;
  contactName?: string;
  totalOverdueAmountPaise?: number;
  callType: CallTodoCallType;
  priority: CallTodoPriority;
  dueDate?: string;
  scheduledFor?: string;
  completedAt?: string;
  completedBy?: string;
  completionNote?: string;
  status: CallTodoStatus;
  assignedTo: string;
  createdBy?: string;
  snoozeDays: number;
  autoCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderRuleDto {
  name: string;
  description?: string;
  partyId?: string;
  triggerType: ReminderTriggerType;
  daysOffset: number;
  escalationLevel?: 1 | 2 | 3;
  cooldownHours?: number;
  channelInApp?: boolean;
  channelEmail?: boolean;
  channelSms?: boolean;
  channelPush?: boolean;
  channelWhatsApp?: boolean;
  emailTemplateKey?: string;
  smsTemplateKey?: string;
  whatsAppCampaignName?: string;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateReminderSettingsDto {
  enabled?: boolean;
  dispatchTime?: string;
  fromName?: string;
  minimumOutstandingPaise?: number;
  maxRemindersPerDay?: number;
  defaultChannelInApp?: boolean;
  defaultChannelEmail?: boolean;
  defaultChannelSms?: boolean;
  defaultChannelPush?: boolean;
  defaultChannelWhatsApp?: boolean;
  optOutPartyIds?: string[];
}

export interface CreateCallTodoDto {
  partyId: string;
  invoiceId?: string;
  invoiceIds?: string[];
  title: string;
  notes?: string;
  contactPhone?: string;
  contactName?: string;
  totalOverdueAmountPaise?: number;
  callType?: CallTodoCallType;
  priority?: CallTodoPriority;
  dueDate?: string;
  assignedTo: string;
}

export interface UpdateCallTodoDto extends Partial<CreateCallTodoDto> {
  status?: CallTodoStatus;
}

export interface CallTodoCount {
  pendingCount: number;
  urgentCount: number;
}

// ============ F-09 Inventory ============

export type StockMovementType =
  | 'purchase_in'
  | 'sale_out'
  | 'dc_out'
  | 'so_reserve'
  | 'so_release'
  | 'transfer_in'
  | 'transfer_out'
  | 'wastage_out'
  | 'sample_out'
  | 'sample_return_in'
  | 'consignment_out'
  | 'consignment_return_in'
  | 'opening_stock'
  | 'grn_in'
  | 'purchase_return_out'
  | 'credit_note_in'
  | 'debit_note_out'
  | 'manufacturing_in'
  | 'manufacturing_out';

export type InventoryBucketType = 'stock' | 'sample' | 'consignment';

export interface Godown {
  _id: string;
  workspaceId: string;
  firmId: string;
  name: string;
  code: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  isDefault: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GodownBalance {
  _id: string;
  workspaceId: string;
  firmId: string;
  itemId: string;
  godownId: string;
  bucketType: InventoryBucketType;
  qty: number;
  lastMovementAt?: string;
}

export interface StockMovement {
  _id: string;
  workspaceId: string;
  firmId: string;
  movementType: StockMovementType;
  itemId: string;
  godownId: string;
  lotId?: string;
  batchId?: string;
  serialNos?: string[];
  qty: number;
  costPaise: number;
  movingAvgCostPaise: number;
  sourceVoucherId?: string;
  sourceVoucherType?: string;
  sourceVoucherNumber?: string;
  narration?: string;
  createdBy: string;
  createdAt: string;
}

export interface ItemValuationLayer {
  _id: string;
  workspaceId: string;
  firmId: string;
  itemId: string;
  godownId: string;
  seq: number;
  qtyOriginal: number;
  qtyRemaining: number;
  costPaise: number;
  inDate: string;
  sourceMovementId: string;
  isExhausted: boolean;
}

export interface Lot {
  _id: string;
  workspaceId: string;
  firmId: string;
  itemId: string;
  lotNo: string;
  inwardDate: string;
  expiryDate?: string;
  mfgDate?: string;
  supplierId?: string;
  sourceVoucherId?: string;
  sourceVoucherType?: string;
  qtyInward: number;
  qtyRemaining: number;
  weight?: number;
  weightUnit?: 'g' | 'kg';
  godownId: string;
  remarks?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  _id: string;
  workspaceId: string;
  firmId: string;
  itemId: string;
  batchNo: string;
  mfgDate?: string;
  expiryDate?: string;
  bomId?: string;
  qtyProduced: number;
  qtyRemaining: number;
  godownId: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SerialStatus = 'in_stock' | 'sold' | 'sample_out' | 'returned' | 'scrapped';

export interface Serial {
  _id: string;
  workspaceId: string;
  firmId: string;
  itemId: string;
  serialNo: string;
  status: SerialStatus;
  purchasedAt?: string;
  soldAt?: string;
  currentGodownId?: string;
  lotId?: string;
  batchId?: string;
  sourceVoucherId?: string;
  isDeleted: boolean;
}

export interface StockTransferLine {
  itemId: string;
  lotId?: string;
  batchId?: string;
  serialNos?: string[];
  qty: number;
  narration?: string;
}
export interface StockTransfer {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherNo: string;
  date: string;
  fromGodownId: string;
  toGodownId: string;
  lines: StockTransferLine[];
  narration?: string;
  status: 'draft' | 'posted';
  postedBy?: string;
  postedAt?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WastageReasonCode =
  | 'manufacturing_damage'
  | 'transit_damage'
  | 'quality_rejection'
  | 'theft'
  | 'expiry'
  | 'processing_loss'
  | 'colour_bleeding'
  | 'cutting_loss'
  | 'fire_or_flood'
  | 'other';

export interface WastageEntryLine {
  itemId: string;
  lotId?: string;
  batchId?: string;
  qty: number;
  wastageType: 'own_goods' | 'job_work_material';
  reasonCode: WastageReasonCode;
  remarks?: string;
  costPaise: number;
}
export interface WastageEntry {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherNo: string;
  date: string;
  godownId: string;
  lines: WastageEntryLine[];
  totalCostPaise: number;
  narration?: string;
  ledgerEntryId?: string;
  status: 'draft' | 'posted';
  postedBy?: string;
  postedAt?: string;
  isDeleted: boolean;
}

export interface SampleVoucherLine {
  itemId: string;
  godownId: string;
  lotId?: string;
  batchId?: string;
  serialNos?: string[];
  qty: number;
  acceptedQty: number;
  returnedQty: number;
  rate?: number;
  remarks?: string;
}
export type SampleVoucherStatus =
  | 'draft'
  | 'sent'
  | 'partially_accepted'
  | 'fully_accepted'
  | 'rejected_returned'
  | 'overdue';
export interface SampleVoucher {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherNo: string;
  sampleType: 'sample' | 'consignment';
  date: string;
  partyId: string;
  deliveryAddress?: string;
  lines: SampleVoucherLine[];
  expectedReturnDate: string;
  autoAlarmDays: number;
  status: SampleVoucherStatus;
  acceptedInvoiceId?: string;
  returnedAt?: string;
  postedBy?: string;
  postedAt?: string;
  narration?: string;
}

export interface CessRule {
  _id: string;
  hsnCode: string;
  description: string;
  cessType: 'ad_valorem' | 'specific' | 'compound';
  adValoremRate?: number;
  specificRatePerUnit?: number;
  specificRateUnit?: 'piece' | 'kg' | 'ml' | 'liter' | 'tonne';
  applicableFrom: string;
  applicableTo?: string;
  isActive: boolean;
}

// ============ Stock Summary contract - matches backend stock-summary.service.ts (09-04) exactly ============

/**
 * One row returned by GET /inventory/stock-summary (list endpoint).
 * MUST match the StockSummaryRow interface in
 * manekhr-backend/src/modules/finance/inventory/stock-summary/stock-summary.service.ts
 *
 * IMPORTANT: This is the LIST row only. It does NOT include perGodownBalances.
 * The per-godown breakdown is fetched lazily via GET /inventory/stock-summary/:itemId
 * which returns PerGodownBalance[] (see below).
 */
export interface StockSummaryRow {
  itemId: string;
  itemCode: string;
  name: string; // NOT itemName - matches backend `name` field
  categoryName?: string; // backend field
  unitName?: string; // backend field
  godownId?: string; // optional, populated when list filtered to single godown
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  avgCostPaise: number;
  stockValuePaise: number;
  lotCount: number;
  belowReorder: boolean;
  expiringSoonCount: number;
}

/**
 * Envelope returned by GET /inventory/stock-summary.
 * MUST match StockSummaryResponse in backend service.
 * KPI block is server-computed - DO NOT recompute client-side.
 */
export interface StockSummaryResponse {
  kpi: {
    totalSkus: number;
    totalStockValuePaise: number;
    itemsBelowReorder: number;
    lotsExpiringSoon: number;
  };
  rows: StockSummaryRow[];
}

/**
 * One per-godown row returned by GET /inventory/stock-summary/:itemId.
 * Used for the lazy-loaded expandable row under StockSummaryTable.
 */
export interface PerGodownBalance {
  godownId: string;
  godownName: string;
  bucketType: InventoryBucketType;
  qty: number;
  lastMovementAt?: string;
}

// LineItem extension types (for use by line-items table)
export interface LineItemInventoryFields {
  godownId?: string;
  lotId?: string;
  batchId?: string;
  serialNos?: string[];
}

// ─── F-10 Manufacturing ──────────────────────────────────────────────────────

export interface BomComponent {
  itemId: string;
  qty: number;
  unit: string;
  wastageAllowedPct: number;
  isSubAssembly: boolean;
  subBomId?: string;
  sortOrder: number;
}

export interface BomByProduct {
  itemId: string;
  qty: number;
  unit: string;
  nrvPaisePerUnit: number;
}

export interface BomDefinition {
  _id: string;
  workspaceId: string;
  firmId: string;
  finishedItemId: string;
  outputQty: number;
  outputUnit: string;
  yieldPct: number;
  versionNo: number;
  isDefault: boolean;
  isActive: boolean;
  components: BomComponent[];
  byProducts: BomByProduct[];
  additionalCostEstimate?: number;
  standardCostPaise?: number;
  narration?: string;
  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BomExplodedComponent {
  itemId: string;
  requiredQty: number;
  unit: string;
  level: number;
  path: string;
}

export interface BomStandardCostBreakdownLine {
  itemId: string;
  qty: number;
  unitCostPaise: number;
  lineCostPaise: number;
}

export interface BomStandardCostResult {
  standardCostPaise: number;
  breakdown: BomStandardCostBreakdownLine[];
}

export type ManufacturingVoucherStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type ManufacturingCostMethod = 'actual' | 'standard';

export interface MvComponentLine {
  itemId: string;
  plannedQty: number;
  unit: string;
  wastageAllowedPct: number;
}

export interface MvComponentConsumed {
  itemId: string;
  qty: number;
  unit: string;
  godownId: string;
  lotId?: string;
  batchId?: string;
  serialNos?: string[];
  costAtConsumptionPaise: number;
}

export interface MvAdditionalCost {
  accountId: string;
  amountPaise: number;
  narration?: string;
}

export interface MvByProduct {
  itemId: string;
  qty: number;
  unit: string;
  godownId: string;
  costAllocatedPaise: number;
}

export interface ManufacturingVoucher {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherNumber: string;
  voucherDate: string;
  status: ManufacturingVoucherStatus;
  bomId: string;
  bomVersionNo: number;
  finishedItemId: string;
  finishedQty: number;
  finishedUnit: string;
  finishedGodownId: string;
  batchNo?: string;
  componentsPlanned: MvComponentLine[];
  componentsConsumed: MvComponentConsumed[];
  additionalCosts: MvAdditionalCost[];
  byProductsProduced: MvByProduct[];
  costMethod: ManufacturingCostMethod;
  totalInputCostPaise: number;
  standardFgCostPaise?: number;
  totalOutputCostPaise: number;
  variancePaise: number;
  actualFinishedQty: number;
  ledgerEntryIds: string[];
  batchRecordId?: string;
  issuedAt?: string;
  issuedBy?: string;
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  narration?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Transient - only populated on findById of a draft (D-06 lot suggestions)
  lotSuggestions?: Array<{
    itemId: string;
    suggestions: Array<{ lotId: string; batchId?: string; qty: number; inwardDate: string }>;
  }>;
}

export interface CreateBomInput {
  finishedItemId: string;
  outputQty: number;
  outputUnit: string;
  yieldPct?: number;
  isDefault?: boolean;
  components: Array<Omit<BomComponent, 'sortOrder'> & { sortOrder?: number }>;
  byProducts?: BomByProduct[];
  additionalCostEstimate?: number;
  narration?: string;
}

export interface CreateManufacturingVoucherInput {
  bomId: string;
  voucherDate: string;
  finishedQty: number;
  finishedGodownId: string;
  batchNo?: string;
  costMethod?: ManufacturingCostMethod;
  explodeSubAssemblies?: boolean;
  additionalCosts?: MvAdditionalCost[];
  narration?: string;
}

export interface IssueMaterialsInput {
  componentsConsumed: Array<{
    itemId: string;
    qty: number;
    unit: string;
    godownId: string;
    lotId?: string;
    batchId?: string;
    serialNos?: string[];
  }>;
}

export interface CompleteProductionInput {
  actualFinishedQty: number;
  byProductsProduced?: Array<Omit<MvByProduct, 'costAllocatedPaise'>>;
  narration?: string;
}

export interface ManufacturingRegisterRow {
  voucherNumber: string;
  voucherDate: string;
  finishedItemId: string;
  finishedItemName?: string;
  finishedQty: number;
  actualFinishedQty: number;
  status: ManufacturingVoucherStatus;
  totalInputCostPaise: number;
  variancePaise: number;
}

// ─── F-11 Job-Work and Karigar Linkage ───────────────────────────────────────

export type KarigarSkillType =
  | 'zari'
  | 'embroidery'
  | 'print'
  | 'dyeing'
  | 'cutting'
  | 'finishing'
  | 'other';
export type JobWorkLotStatus = 'pending' | 'partial' | 'closed' | 'deemed_supply';
export type JwiStatus = 'draft' | 'posted' | 'closed';
export type JwoStatus = 'draft' | 'posted' | 'cancelled';
export type JwInvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type JwInvoicePaymentStatus = 'unpaid' | 'partial' | 'paid';
export type JwoWastageReason =
  | 'cutting'
  | 'breakage'
  | 'color_damage'
  | 'machine_fault'
  | 'design_rework'
  | 'shrinkage'
  | 'other';

export interface JobWorkLot {
  _id: string;
  workspaceId: string;
  firmId: string;
  principalPartyId: string;
  inwardChallanId: string;
  challanLineIndex: number;
  lotNo: string;
  itemDescription: string;
  hsnCode?: string;
  unit: string;
  qtyInward: number;
  qtyReturnedGood: number;
  qtyWasted: number;
  qtyRemaining: number;
  godownId: string;
  inwardDate: string; // ISO
  dueReturnDate: string;
  status: JobWorkLotStatus;
  deemedSupplyFlaggedAt?: string;
  lastWarningSentAt?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JwiLine {
  lineNo: number;
  itemDescription: string;
  hsnCode?: string;
  qty: number;
  unit: string;
  vehicleNo?: string;
  jobWorkLotId?: string;
  narration?: string;
  karigarIds?: string[];
  machineIds?: string[];
}

export interface JobWorkInwardChallan {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'job_work_in';
  voucherNumber: string;
  voucherDate: string;
  status: JwiStatus;
  partyId: string | { _id: string; name: string; gstin?: string };
  partySnapshot?: Record<string, unknown>;
  vehicleNo?: string;
  transporterName?: string;
  transporterGSTIN?: string;
  lrNo?: string;
  lines: JwiLine[];
  karigarIds?: string[];
  machineIds?: string[];
  shiftId?: string;
  narration?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface JwoReturnLine {
  lineNo: number;
  jobWorkLotId: string;
  lotNo: string;
  itemDescription: string;
  qtyReturning: number;
  unit: string;
  karigarIds?: string[];
  machineIds?: string[];
}

export interface JwoWastageLine {
  lineNo: number;
  jobWorkLotId: string;
  itemDescription: string;
  qtyWasted: number;
  unit: string;
  reasonCode: JwoWastageReason;
  narration?: string;
}

export interface JobWorkOutwardChallan {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'job_work_out';
  voucherNumber: string;
  voucherDate: string;
  status: JwoStatus;
  partyId: string | { _id: string; name: string; gstin?: string; stateCode?: string };
  partySnapshot?: Record<string, unknown>;
  vehicleNo?: string;
  transporterName?: string;
  transporterGSTIN?: string;
  lrNo?: string;
  returnLines: JwoReturnLine[];
  wastageLines: JwoWastageLine[];
  karigarIds: string[];
  machineIds?: string[];
  shiftId?: string;
  jwInvoiceId?: string;
  narration?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Textile job-work GST classification (SAC 9988). general_textile + embroidery = 5%;
// dyeing_printing + printing + other (residuary) = 18%. Mirrors the backend JobWorkType.
// R5: printing/embroidery added so income posts to its own ledger (4022/4023);
// dyeing_printing kept as the legacy combined value for old documents (4021).
export type JobWorkType =
  | 'general_textile'
  | 'embroidery'
  | 'dyeing_printing'
  | 'printing'
  | 'other';

export interface JwInvoiceLine {
  lineNo: number;
  description: string;
  hsnCode: string; // always '9988'
  qty: number;
  unit: string;
  ratePaise: number;
  // 5 for general textile job-work, 18 for dyeing/printing + residuary.
  // Derived server-side from jobWorkType.
  taxRate: number;
  jobWorkType?: JobWorkType;
  amountPaise: number;
  jobWorkLotId?: string;
  karigarIds?: string[];
}

export interface JobWorkInvoice {
  _id: string;
  workspaceId: string;
  firmId: string;
  voucherType: 'job_work_invoice';
  voucherNumber: string;
  voucherDate: string;
  status: JwInvoiceStatus;
  partyId:
    | string
    | { _id: string; name: string; gstin?: string; address?: string; stateCode?: string };
  partySnapshot?: Record<string, unknown>;
  jwOutwardChallanId: string;
  jwOutwardChallanNo?: string;
  lines: JwInvoiceLine[];
  placeOfSupplyStateCode: string;
  reverseCharge: boolean;
  subTotalPaise: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  cessAmountPaise?: number;
  roundOffPaise?: number;
  totalPaise: number;
  karigarIds: string[];
  machineIds?: string[];
  ledgerEntryIds: string[];
  paymentStatus: JwInvoicePaymentStatus;
  paidAmountPaise: number;
  dueDate?: string;
  financialYear: string;
  narration?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KarigarLinkage {
  _id: string;
  workspaceId: string;
  firmId: string;
  sourceVoucherId: string;
  sourceVoucherType: 'job_work_in' | 'job_work_out' | 'job_work_invoice' | 'manufacturing_voucher';
  sourceLineIndex?: number;
  voucherDate: string;
  karigarId: string | { _id: string; name: string; karigarSkillType?: KarigarSkillType };
  machineId?: string;
  shiftId?: string;
  wageRateSnapshotPaise: number;
  estimatedHours?: number;
  estimatedCostPaise: number;
  jobWorkLotId?: string;
  createdAt: string;
}

export interface UpdateKarigarProfilePayload {
  isKarigar: boolean;
  karigarSkillType?: KarigarSkillType;
  karigarDailyRatePaise?: number;
}

export interface CreateJwInwardPayload {
  voucherDate: string;
  partyId: string;
  vehicleNo?: string;
  transporterName?: string;
  transporterGSTIN?: string;
  lrNo?: string;
  lines: Omit<JwiLine, 'lineNo' | 'jobWorkLotId'>[];
  karigarIds?: string[];
  machineIds?: string[];
  shiftId?: string;
  narration?: string;
}

export interface CreateJwOutwardPayload {
  voucherDate: string;
  partyId: string;
  vehicleNo?: string;
  transporterName?: string;
  transporterGSTIN?: string;
  lrNo?: string;
  returnLines: Omit<JwoReturnLine, 'lineNo'>[];
  wastageLines?: Omit<JwoWastageLine, 'lineNo'>[];
  karigarIds: string[];
  machineIds?: string[];
  shiftId?: string;
  narration?: string;
  placeOfSupplyStateCode?: string;
}

export interface CreateJwInvoicePayload {
  voucherDate: string;
  partyId: string;
  jwOutwardChallanId: string;
  placeOfSupplyStateCode?: string;
  reverseCharge?: boolean;
  dueDate?: string;
  lines: {
    description: string;
    qty: number;
    unit: string;
    ratePaise: number;
    jobWorkType?: JobWorkType;
    jobWorkLotId?: string;
    karigarIds?: string[];
  }[];
  karigarIds?: string[];
  machineIds?: string[];
  narration?: string;
}

export interface Itc04ReportRow {
  sno: number;
  challanNo: string;
  challanDate: string;
  principalGstin?: string;
  principalName?: string;
  description: string;
  uqc: string;
  qtySent?: number;
  qtyReceived?: number;
  qtyPending?: number;
  remarks?: string;
  lotNo?: string;
  valuePaise?: number;
}

export interface Itc04Report {
  table4a: Itc04ReportRow[];
  table4b: Itc04ReportRow[];
  pendingByLot: {
    lotNo: string;
    principalPartyId: string;
    qtyRemaining: number;
    isDeemedSupply: boolean;
  }[];
  period: { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; fy: string; startDate: string; endDate: string };
}

export interface Itc04ExportJson {
  gstin: string;
  fp: string;
  version: string;
  table4a: Record<string, unknown>[];
  table4b: Record<string, unknown>[];
  table5b: Record<string, unknown>[];
  hash: string;
  signature: string;
}

// ============ GST Compliance ============
export interface Gstr1HsnRow {
  num: number;
  ty: 'B2B' | 'B2C';
  hsn_sc: string;
  desc?: string;
  uqc: string;
  qty: number;
  rt: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface Gstr1Report {
  gstin: string;
  fp: string; // 'MMYYYY'
  b2b: any[];
  b2cl: any[];
  b2cs: any[];
  cdnr: any[];
  cdnur: any[];
  hsn: { data: Gstr1HsnRow[] };
  doc_issue: { doc_det: any[] };
  nil: { inv: any[] };
  at: any[];
  atadj: any[];
  exp: any[];
  _counts?: Record<string, number>;
}

export interface VerifyDataFinding {
  checkId: string;
  severity: 'error' | 'warning';
  message: string;
  affectedDocType: string;
  affectedDocId: string;
  affectedDocNo?: string;
  affectedPartyId?: string;
  fixRoute: string;
  scannedAt: string;
}

export interface VerifyDataResult {
  _id: string;
  workspaceId: string;
  firmId: string;
  period: string;
  scannedAt: string;
  triggerType: 'manual' | 'cron';
  findings: VerifyDataFinding[];
  errorCount: number;
  warningCount: number;
}

// A single GSTR-3B cell after merging auto-computed + manual-adjusted values.
// Mirrors the backend MergedCell (Gstr3bService).
export interface Gstr3bCellValue {
  autoValue: number;
  manualValue: number;
  isManual: boolean;
  nov2025Locked?: boolean;
}

// Raw auto-computed report (paise). Returned alongside finalValues; the page
// renders from finalValues, but the contract carries the nested source too.
export interface Gstr3bAutoReport {
  gstin: string;
  fp: string;
  sec_3_1_a: { txval: number; igst: number; cgst: number; sgst: number; cess: number };
  sec_3_1_b: { txval: number; igst: number; cess: number };
  sec_3_1_c: { txval: number };
  sec_3_1_d: { txval: number; igst: number; cgst: number; sgst: number; cess: number };
  sec_3_1_e: { txval: number };
  sec_3_2: { to_unreg: unknown[]; to_comp: unknown[]; to_uin: unknown[] };
  sec_4A_1: { igst: number; cess: number };
  sec_4A_3: { igst: number; cgst: number; sgst: number; cess: number };
  sec_4A_5: { igst: number; cgst: number; sgst: number; cess: number };
  sec_4B_1: { igst: number; cgst: number; sgst: number; cess: number };
  sec_4B_2: { igst: number; cgst: number; sgst: number; cess: number };
  sec_4D: { igst: number; cgst: number; sgst: number; cess: number };
  sec_5: {
    exempt_inter: number;
    exempt_intra: number;
    nil_inter: number;
    nil_intra: number;
    non_gst_inter: number;
    non_gst_intra: number;
    composition_inter: number;
    composition_intra: number;
  };
  sec_6_1: { igst: number; cgst: number; sgst: number; cess: number };
}

// Backend Gstr3bService.getReport response. finalValues is keyed by flat cell
// keys (e.g. '3.1.a.txval', '4A.5.igst', '5.exempt.inter', '6.1.igst').
export interface Gstr3bMergedReport {
  auto: Gstr3bAutoReport;
  adjustments: Record<string, number>;
  nov2025Locked: boolean;
  finalValues: Record<string, Gstr3bCellValue>;
}

export interface EInvoicePending {
  _id: string;
  voucherNumber: string;
  voucherDate: string;
  partyName: string;
  grandTotalPaise: number;
  eInvoice: { status: string; lastError?: string; attempts: number };
}

export interface EInvoiceGenerated {
  _id: string;
  voucherNumber: string;
  eInvoice: {
    status: 'generated' | 'cancelled';
    irn: string;
    ackNo: string;
    ackDate: string;
    signedQrCode: string;
    cancelledAt?: string;
    cancelReason?: number;
  };
}

export interface EwayBillFields {
  ewbNo: string;
  generatedAt: string;
  validUpto: string;
  vehicleNo?: string;
  status: 'active' | 'cancelled' | 'expired';
  lastError?: string;
}

export interface FirmIrpConfig {
  mode: 'gsp_surepass' | 'nic_direct';
  gspKey?: string;
  username?: string;
  // password never returned by API; only set on PATCH
}

// ============== F-13 Bank Reconciliation ==============

export type BankFormatKey =
  | 'hdfc'
  | 'icici'
  | 'sbi'
  | 'axis'
  | 'kotak'
  | 'yes_bank'
  | 'indusind'
  | 'pnb'
  | 'bob'
  | 'generic';

export type BankStatementStatus = 'imported' | 'in_progress' | 'reconciled' | 'locked';
export type BankStatementRowStatus =
  | 'unmatched'
  | 'matched'
  | 'excluded'
  | 'disputed'
  | 'new_voucher';
export type ReconciliationSessionStatus = 'draft' | 'in_progress' | 'completed' | 'locked';
export type MatchType =
  | 'exact'
  | 'fuzzy_amount_date'
  | 'fuzzy_narration'
  | 'manual'
  | 'auto'
  | 'reversal_pair'
  | 'bulk';

export interface BankStatement {
  _id: string;
  workspaceId: string;
  firmId: string;
  bankAccountId: string;
  bankName: BankFormatKey;
  detectedFormat: string;
  statementDateFrom: string;
  statementDateTo: string;
  financialYear: string;
  openingBalancePaise: number;
  closingBalancePaise: number;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  status: BankStatementStatus;
  importedBy: string;
  importedAt: string;
  lockedAt?: string;
  lockedBy?: string;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankStatementRow {
  _id: string;
  workspaceId: string;
  firmId: string;
  bankStatementId: string;
  bankAccountId: string;
  rowIndex: number;
  txnDate: string;
  valueDate?: string;
  narration: string;
  narrationNorm: string;
  refNumber?: string;
  refNumberNorm?: string;
  debitPaise: number;
  creditPaise: number;
  amountPaise: number;
  closingBalancePaise?: number;
  status: BankStatementRowStatus;
  matchedLedgerEntryIds: string[];
  matchedVoucherIds: string[];
  matchedVoucherTypes: string[];
  matchConfidence?: number;
  matchType?: MatchType;
  matchedBy?: string;
  matchedAt?: string;
  excludeReason?: string;
  newVoucherType?: string;
  topSuggestions: Array<{ ledgerEntryId: string; confidence: number; matchType: MatchType }>;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationSession {
  _id: string;
  workspaceId: string;
  firmId: string;
  bankAccountId: string;
  bankStatementId: string;
  sessionName: string;
  periodFrom: string;
  periodTo: string;
  financialYear: string;
  bookBalancePaise: number;
  statementClosingBalancePaise: number;
  differenceExplained: number;
  status: ReconciliationSessionStatus;
  autoMatchRun: boolean;
  autoMatchedCount: number;
  totalMatchedCount: number;
  totalUnmatchedCount: number;
  outstandingChequesPaise: number;
  depositsInTransitPaise: number;
  createdBy: string;
  completedBy?: string;
  completedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankStatementPreview {
  detectedFormat: BankFormatKey;
  rowCount: number;
  previewRows: Array<{
    rowIndex: number;
    txnDate: string;
    narration: string;
    refNumber?: string;
    debitPaise: number;
    creditPaise: number;
    amountPaise: number;
    closingBalancePaise?: number;
  }>;
  openingBalancePaise: number | null;
  closingBalancePaise: number | null;
  statementDateFrom: string | null;
  statementDateTo: string | null;
  warnings: string[];
  fyBoundaryWarning?: string;
  openingBalanceChainWarning?: string;
  durationFy: string;
}

export interface BrsReport {
  sessionId: string;
  bankAccountName: string;
  bankAccountNumberMasked: string;
  periodFrom: string;
  periodTo: string;
  financialYear: string;
  statementClosingBalancePaise: number;
  addItems: Array<{ label: string; amountPaise: number; rowIds: string[] }>;
  addSubtotalPaise: number;
  lessItems: Array<{ label: string; amountPaise: number; rowIds: string[] }>;
  lessSubtotalPaise: number;
  computedCashBookBalancePaise: number;
  ledgerCashBookBalancePaise: number;
  differencePaise: number;
  isFullyReconciled: boolean;
  outstandingCheques: Array<{ voucherNumber: string; entryDate: string; amountPaise: number }>;
  depositsInTransit: Array<{ voucherNumber: string; entryDate: string; amountPaise: number }>;
  bankChargesNotInBooks: Array<{
    rowId: string;
    txnDate: string;
    narration: string;
    amountPaise: number;
  }>;
}

export interface NarrationSuggestion {
  accountCode: string;
  accountName: string;
  entryType: string;
  matchedPattern: string;
}

export interface AutoMatchSummary {
  scanned: number;
  autoCleared: number;
  suggested: number;
  reversalPairs: number;
}

export interface BankReconciliationCandidate {
  _id: string;
  entryDate: string;
  sourceVoucherType: string;
  sourceVoucherNumber: string;
  entryType: string;
  narration: string;
  bankLineDebitPaise: number;
  bankLineCreditPaise: number;
  bankLineNetPaise: number;
}

// ─── Phase F-14: Reports and Dashboards ───────────────────────────────────────

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'capital' | 'income' | 'expense';
  accountGroup: string;
  accountSubGroup: string;
  totalDebitPaise: number;
  totalCreditPaise: number;
  closingDebitPaise: number;
  closingCreditPaise: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebitPaise: number;
  totalCreditPaise: number;
  isBalanced: boolean;
}

export interface PlSection {
  label: string;
  type: 'section_header' | 'account' | 'subtotal' | 'total';
  level: number;
  amountPaise: number;
}

export interface ProfitLossReport {
  tradingAccount: PlSection[];
  grossProfitPaise: number;
  indirectItems: PlSection[];
  otherIncome: PlSection[];
  netProfitPaise: number;
  isLoss: boolean;
  openingStockPaise: number;
  closingStockPaise: number;
  dateFrom: string;
  dateTo: string;
}

export interface ProfitLossComparisonMonth {
  period: string;
  label: string;
  revenuePaise: number;
  grossProfitPaise: number;
  netProfitPaise: number;
  grossProfitPct: number;
  netProfitPct: number;
}

export interface BalanceSheetEntry {
  code: string;
  name: string;
  group: string;
  subGroup: string;
  level: number;
  type: 'section_header' | 'account' | 'subtotal' | 'total';
  amountPaise: number;
}

export interface BalanceSheetReport {
  assets: BalanceSheetEntry[];
  totalAssetsPaise: number;
  liabilities: BalanceSheetEntry[];
  capital: BalanceSheetEntry[];
  totalLiabilitiesCapitalPaise: number;
  isBalanced: boolean;
  isUnaudited: boolean;
  asOfDate: string;
}

export interface CashFlowItem {
  label: string;
  amountPaise: number;
}

export interface CashFlowSection {
  label: string;
  items: CashFlowItem[];
  totalPaise: number;
}

export interface CashFlowReport {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netChangePaise: number;
  openingCashPaise: number;
  closingCashPaise: number;
  isIndicative: boolean;
}

export interface RatioAnalysisReport {
  gpPct: number;
  npPct: number;
  currentRatio: number;
  debtEquity: number;
  returnOnEquity: number;
  workingCapitalPaise: number;
}

// EbitdaReport - monthlyTrend required for EBITDA BarChart in Plan 07
export interface EbitdaReport {
  ebitdaPaise: number;
  depreciationPaise: number;
  interestPaise: number;
  taxPaise: number;
  netProfitPaise: number;
  ebitdaMarginPct: number;
  revenuePaise: number;
  cogsPaise: number;
  grossProfitPaise: number;
  operatingExpensesPaise: number;
  ebitPaise: number;
  ebtPaise: number;
  monthlyTrend: { month: string; ebitdaPaise: number }[];
}

export interface KpiValue {
  valuePaise: number;
  trendPct: number | null;
}

// R7: top-5 overdue receivable party row.
export interface OverduePartyRow {
  partyId: string;
  name: string;
  overduePaise: number;
}

// R7: deemed-supply early warning - lots at a job worker past 9 months.
export interface TakasWarning {
  count: number;
  oldestDays: number | null;
}

export interface DashboardKpiResponse {
  revenue: KpiValue;
  outstanding: KpiValue;
  payables: KpiValue;
  cashPosition: KpiValue;
  bankPosition: KpiValue;
  gstLiability: KpiValue;
  // R7 additions
  stockValue: KpiValue;
  brokerCommissionDue: KpiValue;
  topOverdueParties: OverduePartyRow[];
  takasAtJobWorker: TakasWarning;
}

export interface RevenueTrendMonth {
  month: string;
  period: string;
  revenuePaise: number;
  collectedPaise: number;
}

export interface RevenueTrendResponse {
  months: RevenueTrendMonth[];
  mode: 'current_fy' | 'last_12_months';
}

// ── PowerBI-style Accounting Dashboard (GET /reports/dashboard/accounting) ──
// One aggregate endpoint backing the finance dashboard's "Accounting Insights"
// section + the main workforce dashboard's compact KPI strip. Composes the
// existing per-report shapes above so the FE charts reuse the same money math
// (all *Paise are integer paise; render via fmtPaise / fmtPaiseCompact). The
// backend returns these in one round-trip — keep this shape in sync with
// crewroster-backend reports/dashboard/accounting controller.

// Monthly cash in/out movement powering the Cash Movement chart. Outflow already
// INCLUDES payroll on the backend, so the FE must not add salary separately.
export interface CashMovementMonth {
  month: string; // short label e.g. 'Apr'
  period: string; // 'MMYYYY' key for ordering
  inflowPaise: number;
  outflowPaise: number; // includes payroll outflow
  netPaise: number;
}

// Trimmed balance-sheet block carried inside the accounting dashboard. Reuses the
// existing BalanceSheetEntry type for its composition arrays (do NOT duplicate it).
// Distinct from the full BalanceSheetReport (which splits assets/liabilities/capital
// at the top level) — this variant nests them under *Composition for the chart.
export interface AccountingDashboardBalanceSheet {
  totalAssetsPaise: number;
  totalLiabilitiesCapitalPaise: number;
  isBalanced: boolean;
  isUnaudited: boolean;
  asOfDate: string;
  assetsComposition: BalanceSheetEntry[];
  liabilitiesComposition: BalanceSheetEntry[];
  capitalComposition: BalanceSheetEntry[];
}

// Top-level envelope for the accounting dashboard. Each field reuses a report
// shape already defined above (DashboardKpiResponse, ProfitLossComparisonMonth,
// CashFlowReport, RatioAnalysisReport, EbitdaReport, AgingReport) so the charts
// share one source of truth with the standalone report pages.
export interface AccountingDashboardResponse {
  kpis: DashboardKpiResponse;
  pnlTrend: ProfitLossComparisonMonth[];
  balanceSheet: AccountingDashboardBalanceSheet;
  cashFlow: CashFlowReport;
  ratios: RatioAnalysisReport;
  ebitda: EbitdaReport;
  receivablesAging: AgingReport;
  payablesAging: AgingReport;
  cashTrend: CashMovementMonth[];
  period: { from: string; to: string; asOfDate: string; label: 'current_fy' };
}

// Party and Ledger Reports
export interface PartyStatementRow {
  entryDate: string;
  voucherNumber: string;
  voucherType: string;
  narration: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  drOrCr: 'Dr' | 'Cr';
  sourceVoucherId: string;
  sourceVoucherType: string;
}

export interface PartyStatementReport {
  partyId: string;
  partyName: string;
  openingBalancePaise: number;
  openingDrOrCr: 'Dr' | 'Cr';
  rows: PartyStatementRow[];
  closingBalancePaise: number;
  closingDrOrCr: 'Dr' | 'Cr';
  dateFrom: string;
  dateTo: string;
}

export interface ReceivableAgingBucket {
  partyId: string;
  partyName: string;
  current: number;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90plus: number;
  total: number;
}

export interface AgingReport {
  rows: ReceivableAgingBucket[];
  summary: Record<string, number>;
}

export interface DaybookRow {
  entryDate: string;
  voucherNumber: string;
  voucherType: string;
  narration: string;
  totalDebitPaise: number;
  totalCreditPaise: number;
  sourceVoucherId: string;
  sourceVoucherType: string;
}

export interface RegisterRow {
  entryDate: string;
  voucherNumber: string;
  voucherType: string;
  narration: string;
  totalDebitPaise: number;
  totalCreditPaise: number;
  sourceVoucherId: string;
  sourceVoucherType: string;
}

// GST Registers
export interface GstOutputRegisterRow {
  entryDate: string;
  voucherNumber: string;
  partyName: string;
  partyGstin: string;
  hsnCode: string;
  taxableAmountPaise: number;
  igstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalGstPaise: number;
  totalPaise: number;
  sourceVoucherId: string;
  sourceVoucherType: string;
}

export interface ItcReconciliationRow {
  period: string;
  booksIgstPaise: number;
  booksCgstPaise: number;
  booksSgstPaise: number;
  gstr3bIgstPaise: number;
  gstr3bCgstPaise: number;
  gstr3bSgstPaise: number;
  deltaIgstPaise: number;
  deltaCgstPaise: number;
  deltaSgstPaise: number;
  hasDiscrepancy: boolean;
}

export interface EinvoiceRegisterRow {
  entryDate: string;
  voucherNumber: string;
  partyName: string;
  grandTotalPaise: number;
  irn: string;
  irnStatus: string;
  irnGeneratedAt: string | null;
  cancelledAt: string | null;
  sourceVoucherId: string;
}

// ─── Inventory row types (used by Plan 07 pages) ──────────────────────────────

export interface ItemLedgerRow {
  itemId: string;
  itemName: string;
  date: string;
  voucherNumber: string;
  voucherType: string;
  inQty: number;
  outQty: number;
  balanceQty: number;
  ratePaise: number;
  valuePaise: number;
  sourceVoucherId: string;
  sourceVoucherType: string;
}

export interface ItemProfitabilityRow {
  itemId: string;
  itemName: string;
  itemCode: string;
  hsn: string;
  qtyIn: number;
  qtySold: number;
  revenuePaise: number;
  cogsPaise: number;
  grossProfitPaise: number;
  grossMarginPct: number;
}

export interface GodownStockRow {
  godownId: string;
  godownName: string;
  itemId: string;
  itemName: string;
  qtyOnHand: number;
  valuationPaise: number;
}

export interface WastageRegisterRow {
  date: string;
  voucherNumber: string;
  itemId: string;
  itemName: string;
  qtyWasted: number;
  reason: string;
  costPaise: number;
}

// ─── Manufacturing row types (used by Plan 07 pages) ─────────────────────────

export interface MvRegisterRow {
  date: string;
  voucherNumber: string;
  finishedItemName: string;
  qtyProduced: number;
  bomId: string;
  standardCostPaise: number;
  actualCostPaise: number;
  variancePaise: number;
  sourceVoucherId: string;
}

export interface JobWorkPendingRow {
  lotNumber: string;
  karigarName: string;
  itemSent: string;
  qtySent: number;
  sentDate: string;
  expectedReturnDate: string;
  daysOverdue: number;
}

export interface KarigarProductivityRow {
  karigarId: string;
  karigarName: string;
  totalPiecesCompleted: number;
  totalAmountPaise: number;
  jobCount: number;
}

export interface MachineOutputRow {
  machineId: string;
  machineName: string;
  totalQtyProduced: number;
  totalMvs: number;
  avgCycleTimeMins: number;
}

// ─── Fixed asset row types (used by Plan 07 pages) ───────────────────────────

export interface FixedAssetRegisterRow {
  assetId: string;
  assetName: string;
  category: string;
  purchaseDate: string;
  purchaseCostPaise: number;
  accumulatedDepreciationPaise: number;
  netBookValuePaise: number;
  depreciationMethod: string;
  depreciationRate: number;
  disposedAt: string | null;
}

export interface DepreciationScheduleRow {
  assetId: string;
  assetName: string;
  period: string;
  openingNbvPaise: number;
  depreciationPaise: number;
  closingNbvPaise: number;
}

// ─── Party/GST extra row types (used by Plan 07 pages) ───────────────────────

export interface BrokerCommissionRow {
  date: string;
  voucherNumber: string;
  brokerName: string;
  relatedParty: string;
  commissionPaise: number;
  narration: string;
  sourceVoucherId: string;
  sourceVoucherType: string;
}

export interface PartyWisePlRow {
  partyId: string;
  partyName: string;
  partyType: string;
  salesPaise: number;
  purchasesPaise: number;
  netPaise: number;
}

export interface CapitalGoodsItcRow {
  assetName: string;
  purchaseDate: string;
  totalItcPaise: number;
  monthsElapsed: number;
  itcClaimedPaise: number;
  itcBalancePaise: number;
}

export interface EwbRegisterRow {
  date: string;
  ewbNumber: string;
  voucherNumber: string;
  partyName: string;
  fromPlace: string;
  toPlace: string;
  vehicleNumber: string;
  validUpto: string;
  status: 'active' | 'expired' | 'cancelled';
  sourceVoucherId: string;
}

export interface PlComparisonRow {
  accountName: string;
  accountType: string;
  months: Record<string, number>;
  total: number;
}

// ─── Phase 16 / FIN-15-01 - Tally Export ─────────────────────────────────────
export type ValidatorSeverity = 'BLOCKER' | 'WARNING';

export interface ValidatorIssue {
  severity: ValidatorSeverity;
  code: string;
  message: string;
  refType: 'ledger' | 'party' | 'voucher' | 'item';
  refId: string;
  refName: string;
}

export interface TallyValidatorReport {
  blockers: ValidatorIssue[];
  warnings: ValidatorIssue[];
}

export interface TallyExportResult {
  status: 'ready' | 'queued';
  downloadUrl?: string;
  voucherCount: number;
  fileSize?: number;
  jobId?: string;
}

export interface TallyRecentExport {
  at: string;
  fromDate: string;
  toDate: string;
  voucherCount: number;
  fileSizeBytes: number;
  downloadUrl?: string;
  expiresAt?: string;
}

export interface GenerateTallyExportInput {
  firmId: string;
  fromDate: string;
  toDate: string;
  voucherTypes?: string[];
  companyNameOverride?: string;
}

// ─── Phase 16 / FIN-15-02 - Fiscal Year Close ────────────────────────────────
export type FyStatus = 'OPEN' | 'CLOSED' | 'REOPENED';

export interface FyAuditEntry {
  at: string;
  by: string;
  action: 'CLOSE' | 'REOPEN' | string;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

export interface FiscalYearRow {
  _id: string;
  wsId: string;
  firmId: string;
  startDate: string;
  endDate: string;
  status: FyStatus;
  closedAt?: string;
  closedBy?: string;
  closingJournalId?: string;
  openingJournalId?: string;
  retainedEarningsAccountId?: string;
  auditTrail: FyAuditEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FyHealthCheck {
  name: string;
  passed: boolean;
  count: number;
  items?: Array<{ id: string; label: string }>;
}

export interface FyHealthChecksReport {
  checks: FyHealthCheck[];
  allPassed: boolean;
}

export interface CloseFyInput {
  effectiveCloseDate: string;
  firmNameConfirmation: string;
  skipHealthChecks?: boolean;
}

export interface ReopenFyInput {
  reason: string;
  confirmation: 'REOPEN';
}

// ============ Phase 16 / FIN-15-03 - Customer Portal Access types ============
// Mirrors backend PortalAccessToken schema (Plan 16-04). The raw JWT is
// returned ONLY on issuance - the schema persists `jti` only.

// View-only portal (owner decision 2026-06-06, feedback_no_payments_in_billing):
// 'pay' scope removed - the customer portal does no payment collection.
export type PortalScope = 'statement' | 'invoices' | 'receipts';

export type PortalExpiryDays = 1 | 7 | 30 | 90 | 180 | 365;

export interface PortalToken {
  _id: string;
  jti: string;
  workspaceId: string;
  firmId: string;
  partyId: string;
  scope: PortalScope[];
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  lastAccessedAt?: string;
  accessCount: number;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
}

export interface IssueTokenInput {
  scope: PortalScope[];
  expiresInDays: PortalExpiryDays;
}

export interface IssueTokenResult {
  token: string;
  jti: string;
  expiresAt: string;
  url: string;
}

export type PortalShareChannel = 'copy' | 'whatsapp' | 'email';

export interface SharePortalTokenInput {
  url: string;
  channel: PortalShareChannel;
  recipient?: string;
}

// ============================================================================
// Phase 17 / FIN-16 - Party Intelligence + CRM types
// Mirrors backend types from
//   manekhr-backend/src/modules/finance/party-intelligence/intelligence/intelligence.types.ts
//   manekhr-backend/src/modules/finance/party-intelligence/gstin-monitor/filing-status.types.ts
// ObjectId fields are typed `string` (web sees serialized JSON).
// ============================================================================

export type PartySegment = 'NEW' | 'REGULAR' | 'VIP' | 'DORMANT' | 'CHURNED' | 'BLACKLIST';

export type GstinRiskLevel = 'OK' | 'WATCH' | 'RISK' | 'CRITICAL';

export type GstinReturnKind = 'GSTR-1' | 'GSTR-3B' | 'GSTR-9';

export type GstinFilingStatus = 'FILED' | 'NOT_FILED' | 'OVERDUE';

/** D-10 - Per-period filing status. ISO date strings on the wire. */
export interface GstinFilingPeriod {
  return: GstinReturnKind;
  period: string; // 'MM-YYYY'
  dueDate: string; // ISO
  filedDate: string | null;
  status: GstinFilingStatus;
}

/** D-05 - Embedded sub-doc on Party. ALL fields optional (Pattern 4). */
export interface PartyIntelligence {
  rfmR?: 1 | 2 | 3 | 4 | 5;
  rfmF?: 1 | 2 | 3 | 4 | 5;
  rfmM?: 1 | 2 | 3 | 4 | 5;
  segment?: PartySegment;
  recencyDays?: number;
  frequency?: number;
  monetaryPaise?: number;
  lastInvoiceDate?: string;
  ltv12mPaise?: number;
  txCount12m?: number;
  segmentUpdatedAt?: string;
  manualSegment?: PartySegment | null;
  blacklisted?: boolean;
  blacklistedReason?: string;
  blacklistedAt?: string;
  blacklistedBy?: string;
  gstinFilings?: GstinFilingPeriod[];
  gstinRiskLevel?: GstinRiskLevel;
  gstinFilingsCheckedAt?: string;
  gstinFilingsLastError?: { at: string; message: string };
}

/** D-16 - Locked v1 enum. Additions need migration note. */
export type PartyTimelineEventType =
  | 'invoice.created'
  | 'invoice.paid'
  | 'payment.received'
  | 'payment.sent'
  | 'credit_note.created'
  | 'debit_note.created'
  | 'reminder.sent'
  | 'call.logged'
  | 'email.logged'
  | 'note.added'
  | 'segment.changed'
  | 'gstin.flag_changed'
  | 'greeting.sent';

/** D-15 - Append-only event row. */
export interface PartyTimelineEvent {
  _id: string;
  workspaceId: string;
  firmId: string;
  partyId: string;
  type: PartyTimelineEventType;
  refModel?: string;
  refId?: string;
  occurredAt: string; // ISO
  actorUserId?: string;
  summary: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

/** D-21 - Per-party direct-margin P&L report shape. */
export interface PartyPnlReport {
  partyId: string;
  partyName: string;
  periodFrom: string; // ISO
  periodTo: string; // ISO
  revenuePaise: number;
  cogsPaise: number;
  grossProfitPaise: number;
  grossMarginPct: number | null;
  invoiceCount: number;
  creditNoteCount: number;
  avgInvoiceValuePaise: number;
}

/** D-09 + D-29 - workspace-level Party Intelligence settings. */
export interface WorkspaceSettingsPartyIntelligence {
  rfmTuning?: {
    newWindowDays?: number;
    vipRfmFloor?: number;
    dormantMin?: number;
    dormantMax?: number;
    churnedCutoff?: number;
  };
  greetings?: {
    enabled: boolean;
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
  };
  gstinPollCadenceDays?: number;
}

// ============================================================
// Phase 25 - Production Utilisation Dashboard
// Mirrors manekhr-backend/src/modules/dashboard/production-utilisation/types.ts
// All date strings are YYYY-MM-DD in workspace timezone.
// ============================================================

export type UtilisationPrimaryMetric = 'stitches' | 'pieces' | 'hours';

export interface ByMetricSums {
  stitches: number;
  pieces: number;
  hours: number;
}

export type UptimeBand = 'green' | 'amber' | 'red';

export interface KpiUptime {
  actualPct: number;
  targetPct: number;
  deltaVsPriorMonthPct: number;
  band: UptimeBand;
}

export interface KpiTopMachine {
  machineId: string;
  machineName: string;
  output: number;
  metric: UtilisationPrimaryMetric;
}

export interface KpiTopReason {
  reasonCodeKey: string;
  reasonLabel: string;
  downMinutes: number;
}

export interface KpiFiltersEcho {
  from: string;
  to: string;
  machineIds?: string[];
  locationIds?: string[];
  shiftIds?: string[];
}

export interface KpiResponse {
  todayOutput: ByMetricSums;
  weekOutput: ByMetricSums;
  monthOutput: ByMetricSums;
  uptime: KpiUptime;
  topMachines: KpiTopMachine[];
  topReasons: KpiTopReason[];
  filtersEcho: KpiFiltersEcho;
}

export type TrendGranularity = 'daily' | 'weekly' | 'monthly';

export interface TrendPoint {
  period: string; // YYYY-MM-DD (daily) or ISO week / YYYY-MM (weekly/monthly)
  output: number;
  uptimePct: number;
  targetPct: number;
}

export interface TrendResponse {
  granularity: TrendGranularity;
  points: TrendPoint[];
}

export interface HeatmapCell {
  machineId: string;
  machineName: string;
  date: string; // YYYY-MM-DD
  utilisationPct: number;
  output: number;
  /**
   * CR-02 fix - Pitfall 5. Each machine has ONE primaryMetric snapshot, so
   * per-cell `output` is a single-metric sum (never mixes stitches/pieces/hours).
   * Render as `${output} ${outputMetric}` so users see unit-correct numbers.
   */
  outputMetric: UtilisationPrimaryMetric;
  downMinutes: number;
}

export interface HeatmapMachineRef {
  id: string;
  name: string;
}

export interface HeatmapResponse {
  month: string; // YYYY-MM
  locationId: string;
  cells: HeatmapCell[];
  machines: HeatmapMachineRef[];
  days: string[];
}

export interface UtilisationExportRow {
  machineCode: string;
  machineName: string;
  locationName: string;
  outputTotal: number;
  outputMetric: string;
  uptimePct: number;
  downtimeMinutes: number;
  topReasonLabel: string;
  scheduledMinutes: number;
  targetPct: number;
  periodFrom: string;
  periodTo: string;
}

export interface UtilisationFilterQuery {
  from?: string;
  to?: string;
  machineIds?: string[];
  locationIds?: string[];
  shiftIds?: string[];
}

// ── Mobile Classification ─────────────────────────────────────────────────────
// Mirrors `MobileClassification` from `crewroster-backend/src/modules/team/dto/check-identifier.dto.ts`.
// Returned by `GET /workspaces/:wsId/team/check-identifier?classify=true`.
// ── Commission / Incentive (Phase 3B) ─────────────────────────────────────────

export type CommissionCategory = 'commission' | 'incentive';

export type CommissionType = 'sales' | 'production_piece' | 'attendance' | 'referral' | 'other';

export type CommissionCalcBasis = 'flat' | 'percent_of_revenue' | 'per_unit' | 'formula_result';

export type CommissionFrequency = 'monthly' | 'quarterly' | 'annual';

export type CommissionScheduleStatus = 'active' | 'paused' | 'completed';

/** One entry in the bulk commission POST body (per-member line). */
export interface CommissionEntryItem {
  teamMemberId: string;
  category: CommissionCategory;
  commissionType: CommissionType;
  amount: number;
  reasonTitle: string;
  note?: string;
  reference?: string;
}

/** POST /salary/commission/entries body. */
export interface RecordCommissionPayload {
  month: number;
  year: number;
  entries: CommissionEntryItem[];
}

/** Response shape from POST /salary/commission/entries. */
export interface RecordCommissionResult {
  created: number;
  adjustmentIds: string[];
}

/**
 * Single commission/incentive SalaryAdjustment row returned by
 * GET /salary/commission/entries.
 */
export interface CommissionEntry {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  salaryId: string;
  month: number;
  year: number;
  type: 'addition';
  /** Member display name, resolved server-side from teamMemberId. */
  teamMemberName?: string;
  category: CommissionCategory;
  commissionType?: CommissionType;
  amount: number;
  reasonTitle: string;
  note?: string;
  reference?: string;
  source: 'manual' | 'payment_recording' | 'system';
  status: 'active' | 'reversed';
  pfExcluded: boolean;
  esiExcluded: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Query params for GET /salary/commission/entries. */
export interface ListCommissionEntriesParams {
  teamMemberId?: string;
  month?: number;
  year?: number;
  category?: CommissionCategory;
}

/** Per-month row inside a YTD member result. */
export interface CommissionYtdMonth {
  month: number;
  year: number;
  commission: number;
  incentive: number;
  total: number;
}

/** Per-member row in the YTD result. */
export interface CommissionYtdMemberRow {
  teamMemberId: string;
  /** Member display name, resolved server-side from teamMemberId. */
  teamMemberName?: string;
  months: CommissionYtdMonth[];
  totalCommission: number;
  totalIncentive: number;
  grandTotal: number;
}

/** GET /salary/commission/ytd response. */
export interface CommissionYtdResult {
  fyStartYear: number;
  rows: CommissionYtdMemberRow[];
  workspaceTotal: number;
}

/** Back-reference log entry on a CommissionSchedule. */
export interface CommissionDisbursementLogEntry {
  month: number;
  year: number;
  adjustmentId: string;
  amount: number;
  disbursedAt: string;
  disbursedBy: string;
}

/** CommissionSchedule document returned from the API. */
export interface CommissionSchedule {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  commissionType: CommissionType;
  calcBasis: CommissionCalcBasis;
  amount: number;
  frequency: CommissionFrequency;
  startMonth: number;
  startYear: number;
  endMonth?: number;
  endYear?: number;
  note?: string;
  status: CommissionScheduleStatus;
  nextDueMonth: number;
  nextDueYear: number;
  disbursementLog: CommissionDisbursementLogEntry[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** POST /salary/commission/schedules body. */
export interface CreateCommissionSchedulePayload {
  teamMemberId: string;
  commissionType: CommissionType;
  calcBasis: CommissionCalcBasis;
  amount: number;
  frequency: CommissionFrequency;
  startMonth: number;
  startYear: number;
  endMonth?: number;
  endYear?: number;
  note?: string;
}

/** PATCH /salary/commission/schedules/:id body. */
export interface UpdateCommissionSchedulePayload {
  amount?: number;
  commissionType?: CommissionType;
  endMonth?: number;
  endYear?: number;
  note?: string;
  status?: 'active' | 'paused';
}

/** POST /salary/commission/schedules/:id/disburse body. */
export interface DisburseSchedulePayload {
  month: number;
  year: number;
}

/** Response from POST /salary/commission/schedules/:id/disburse. */
export interface DisburseScheduleResult {
  adjustmentId: string;
  wasAlreadyDisbursed: boolean;
}

/** Query params for GET /salary/commission/schedules. */
export interface ListSchedulesParams {
  teamMemberId?: string;
  status?: CommissionScheduleStatus;
  commissionType?: CommissionType;
}

// ---------------------------------------------------------------------------
// Bonus Module (Phase 3A)
// ---------------------------------------------------------------------------

/** Workspace statutory bonus config returned by GET /salary/bonus/config */
export interface BonusConfig {
  eligibilityWageCeiling: number;
  calculationWageFloor: number;
  minimumWageMonthly: number | null;
  allocableSurplusPercent: number;
  minPercent: number;
  maxPercent: number;
  defaultPercent: number;
  clawbackMonthsDefault: number;
  newEstablishment: boolean;
}

/** PATCH /salary/bonus/config body */
export interface UpdateBonusConfigPayload {
  eligibilityWageCeiling?: number;
  calculationWageFloor?: number;
  minPercent?: number;
  maxPercent?: number;
  defaultPercent?: number;
  allocableSurplusPercent?: number;
  clawbackMonthsDefault?: number;
  newEstablishment?: boolean;
}

/** One member row returned by POST /salary/bonus/preview */
export interface BonusPreviewRow {
  teamMemberId: string;
  memberName: string;
  eligible: boolean;
  reason: string;
  lastMonthlyWage: number;
  calcWage: number;
  monthsWorked: number;
  applicablePercent: number;
  bonusAmount: number;
  existingFestivalBonusAmount: number | null;
}

/** Full result of POST /salary/bonus/preview */
export interface BonusPreviewResult {
  financialYear: number;
  rows: BonusPreviewRow[];
  totalEligibleAmount: number;
  configSnapshot: {
    eligibilityWageCeiling: number;
    calculationWageFloor: number;
    allocableSurplusPercent: number;
    applicablePercent: number;
    newEstablishment: boolean;
  };
}

/** POST /salary/bonus/preview body */
export interface PreviewBonusPayload {
  financialYear: number;
  teamMemberId?: string;
  disbursedMonth?: number;
  disbursedYear?: number;
}

/** POST /salary/bonus/run body */
export interface RunBonusPayload {
  financialYear: number;
  disbursedMonth: number;
  disbursedYear: number;
  teamMemberIds?: string[];
  note?: string;
}

/** POST /salary/bonus/run response */
export interface RunBonusResult {
  runId: string;
  created: number;
  skipped: number;
  adjustmentIds: string[];
}

/** One entry inside RecordFestivalBonusPayload.entries */
export interface FestivalBonusEntry {
  teamMemberId: string;
  amount: number;
  note?: string;
}

/** POST /salary/bonus/festival body */
export interface RecordFestivalBonusPayload {
  subType: string;
  financialYear: number;
  disbursedMonth: number;
  disbursedYear: number;
  countsAsStatutory?: boolean;
  entries: FestivalBonusEntry[];
  note?: string;
}

/** POST /salary/bonus/festival response */
export interface RecordFestivalBonusResult {
  runId: string;
  created: number;
  adjustmentIds: string[];
}

/** One member row in the bonus summary */
export interface BonusSummaryMemberRow {
  teamMemberId: string;
  statutory: number;
  discretionary: number;
  total: number;
}

/** GET /salary/bonus/summary response */
export interface BonusSummaryResult {
  financialYear: number;
  rows: BonusSummaryMemberRow[];
  workspaceStatutory: number;
  workspaceDiscretionary: number;
  workspaceTotal: number;
}

/** One member row inside a BonusRun */
export interface BonusRunMemberRow {
  teamMemberId: string;
  eligible: boolean;
  ineligibilityReason?: string;
  lastMonthlyWage?: number;
  calcWage?: number;
  monthsWorked?: number;
  applicablePercent?: number;
  computedAmount?: number;
  finalAmount: number;
  adjustmentId?: string;
  disbursedMonth?: number;
  disbursedYear?: number;
}

/** GET /salary/bonus/runs item and GET /salary/bonus/runs/:runId */
export interface BonusRun {
  _id: string;
  workspaceId: string;
  financialYear: number;
  bonusType: 'statutory' | 'discretionary';
  subType?: string;
  countsAsStatutory: boolean;
  configSnapshot?: Record<string, unknown>;
  memberRows: BonusRunMemberRow[];
  totalEligibleMembers: number;
  totalDisbursedMembers: number;
  totalDisbursedAmount: number;
  status: 'pending' | 'completed';
  note?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------

// Privacy contract (binding):
//  - registered: kind-only marker for ANY cross-tenant footprint (platform user, team member, or
//    pending invite in another workspace). Object.keys(result) MUST equal ['kind'] exactly. No
//    workspace counts, names, or owner/employee distinction is exposed, preventing cross-tenant
//    probing of the identity graph.
export type MobileClassification =
  /** Case 1: mobile is unknown to the platform. */
  | { kind: 'unregistered' }
  /** Case 8: mobile failed normalisation (not a valid Indian mobile). */
  | { kind: 'invalid_format' }
  /** Case 2: mobile belongs to THIS workspace's owner. */
  | { kind: 'workspace_owner_self'; ownerName: string }
  /** Case 5: mobile is already assigned to an active member in THIS workspace. */
  | { kind: 'active_member_this_ws'; memberId: string; memberName: string }
  /** Case 6: mobile is assigned to an archived member in THIS workspace. */
  | { kind: 'archived_member_this_ws'; memberId: string; memberName: string }
  /** Case 10a: mobile has a pending (unexpired) invite in THIS workspace. */
  | {
      kind: 'pending_invite_this_ws';
      memberId: string;
      memberName: string;
      inviteExpiresAt: string;
    }
  /** Cases 3+4+7+10b: mobile has SOME existing manekhr footprint (User, TeamMember, or pending invite)
   *  in another workspace. REDACTED to one neutral kind to prevent cross-tenant probing. */
  | { kind: 'registered' };

// ---------------------------------------------------------------------------
// Cash Ledger - Phase 3C: Daily-Wage Running Ledger (baki/udhaar)
// ---------------------------------------------------------------------------

/** Entry types callers can create. 'settlement' is internal (via settle endpoint). */
export type LedgerEntryType = 'earning' | 'draw' | 'adjustment' | 'settlement';

/** One entry row returned from the API. */
export interface CashLedgerEntry {
  _id: string;
  teamMemberId: string;
  date: string;
  type: LedgerEntryType;
  amount: number;
  note?: string;
  createdBy: string;
  settledInEntryId?: string;
  createdAt?: string;
  /** Running balance after this entry (computed, returned in list). */
  runningBalance?: number;
}

/** Per-member result from GET /salary/ledger/:memberId */
export interface MemberLedgerResult {
  teamMemberId: string;
  currentBalance: number;
  entries: CashLedgerEntry[];
  total: number;
  page: number;
  limit: number;
}

/** One row in the workspace balance board from GET /salary/ledger/balances */
export interface WorkspaceBalanceRow {
  teamMemberId: string;
  currentBalance: number;
  lastEntryDate?: string;
  openEarnings: number;
  openDraws: number;
}

export interface WorkspaceBalancesResult {
  rows: WorkspaceBalanceRow[];
}

/** One item inside RecordLedgerEntriesPayload.entries */
export interface LedgerEntryItem {
  teamMemberId: string;
  type: 'earning' | 'draw' | 'adjustment';
  amount: number;
  date?: string;
  note?: string;
}

/** POST /salary/ledger/entries */
export interface RecordLedgerEntriesPayload {
  entries: LedgerEntryItem[];
}

export interface RecordLedgerEntriesResult {
  created: number;
  entryIds: string[];
}

/** Minimum-wage flag detail inside settle result */
export interface MinWageFlagDetail {
  flag: boolean;
  effectiveMinWageMonthly: number | null;
  periodEarned: number;
  proratedMinWage: number | null;
  detail?: string;
}

/** Per-member result inside SettleResult */
export interface SettleMemberResult {
  teamMemberId: string;
  settled: boolean;
  settledAmount: number;
  settlementEntryId: string;
  entriesMarked: number;
  minimumWageFlag: MinWageFlagDetail;
}

/** POST /salary/ledger/settle */
export interface SettlePayload {
  teamMemberIds: string[];
  upToDate?: string;
  note?: string;
}

export interface SettleResult {
  results: SettleMemberResult[];
  totalSettled: number;
}

// ── Shop Floor - Work Orders (machines module) ─────────────────────────────
// Single source of truth for the Shop Floor Control page
// (app/dashboard/machines/shop-floor). Mirrors the BE WorkOrder schema in
// crewroster-backend src/modules/machines/work-orders. Steps are embedded
// subdocs forming a DAG via `deps`; CPM/PERT/schedule/wages on the web are
// all DERIVED from this shape (lib/shop-floor/cpm.ts).

export type WorkOrderStatus = 'active' | 'completed' | 'archived';

/** Manual progress entry on a step - who logged, qty done, progress %, when. */
export interface WorkOrderStepEntry {
  id: string;
  _id?: string;
  qty: number | null;
  progress: number | null;
  note?: string;
  byUserId: string;
  /** Display name snapshot of the logger (BE resolves from the user doc). */
  byName?: string;
  at: string;
}

export interface WorkOrderStep {
  id: string;
  _id?: string;
  name: string;
  /** Stage key - see lib/shop-floor/stages.ts STAGE_KEYS (BE-validated enum). */
  stage: string;
  /** Machines serving this step (2+ = parallel ∥). Same-workspace machine ids. */
  machineIds: string[];
  /** Team member doing the work (karigar). */
  assigneeId?: string | null;
  /** Step ids (same order) this step comes after. Empty = parallel START. */
  deps: string[];
  optimisticHrs: number;
  likelyHrs: number;
  pessimisticHrs: number;
  /** ₹ per piece - wages derive as Σ entry qty × rate. */
  wageRate: number;
  /** 0–100, kept in sync with the latest entry that carries a progress value. */
  progress: number;
  /** Process-canvas layout (persisted so the team shares one arrangement). */
  posX?: number | null;
  posY?: number | null;
  entries: WorkOrderStepEntry[];
}

export interface WorkOrder {
  id: string;
  _id?: string;
  workspaceId: string;
  code: string; // WO-001
  partyName: string;
  productType?: string;
  qty: number;
  ratePerUnit: number;
  colorHex: string;
  status: WorkOrderStatus;
  steps: WorkOrderStep[];
  isDeleted?: boolean;
  deletedAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkOrderPayload {
  partyName: string;
  productType?: string;
  qty: number;
  ratePerUnit: number;
  colorHex?: string;
}

export type UpdateWorkOrderPayload = Partial<CreateWorkOrderPayload> & {
  status?: WorkOrderStatus;
};

export interface CreateWorkOrderStepPayload {
  name: string;
  stage: string;
  machineIds?: string[];
  assigneeId?: string | null;
  deps?: string[];
  optimisticHrs: number;
  likelyHrs: number;
  pessimisticHrs: number;
  wageRate?: number;
  progress?: number;
  posX?: number | null;
  posY?: number | null;
}

export type UpdateWorkOrderStepPayload = Partial<CreateWorkOrderStepPayload>;

export interface CreateWorkOrderStepEntryPayload {
  qty?: number | null;
  progress?: number | null;
  note?: string;
}

// Shop Floor setup config - floors inside a physical Location + which team
// members are linked to each floor. Machine→floor stays on Machine.floorTag
// (machines module - the Setup wizard PATCHes machines directly); this only
// stores what has no home elsewhere. Mirrors BE ShopFloorConfig in
// crewroster-backend src/modules/work-orders.
export interface ShopFloorConfigPerson {
  teamMemberId: string;
  floor: string;
}

export interface ShopFloorConfig {
  id: string;
  _id?: string;
  workspaceId: string;
  locationId: string;
  floors: { name: string }[];
  people: ShopFloorConfigPerson[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertShopFloorConfigPayload {
  locationId: string;
  floors: { name: string }[];
  people: ShopFloorConfigPerson[];
}

// ─── Phase 26 - Salary Engine + Accounting Integration ───────────────────────

/** Salary disbursement rule settings (D-01).
 *  Mirrors PayrollConfig.disbursementRules on the backend.
 *  Used by disbursement-rules PATCH endpoint and settings UI (Plan 26-08). */
export interface DisbursementRules {
  salaryDate: number;
  payoutWindowDays: number;
  advanceRequestDay: number;
  advanceRequestPolicy?: {
    mode: 'any_day' | 'window' | 'fixed_day';
    fixedDay?: number;
    windowStartDay?: number;
    windowEndDay?: number;
  };
  /** Day of month (1-28) on which approved advances are disbursed. Null = no fixed payout day.
   *  Added Plan 2026-06-22 Task 1/6. Mirrors PayrollConfig.disbursementRules.advancePayoutDay
   *  (BE field is nullable; the settings panel sends null to clear it). */
  advancePayoutDay?: number | null;
  // Phase 3b: advance ELIGIBILITY CAPS (owner-configurable, OFF by default). All nullable.
  // Enforced server-side in advance-salary-request.service.ts createRequest; edited in
  // DisbursementRulesPanel.tsx. null = cap off.
  /** A single request may not exceed X% of the member's monthly figure (1-100). */
  advanceMaxPercentOfNet?: number | null;
  /** Max number of advance requests a member may make per calendar year (>=1). */
  advanceMaxPerYear?: number | null;
  /** Member must have at least N months of tenure (from join date) to request (>=0). */
  advanceMinTenureMonths?: number | null;
}

/** Worker-facing advance-request window response (Plan 2026-06-22).
 *  Returned by GET /salary/advance-requests/window.
 *  Used by AdvanceRequestDrawer to show the open/closed banner. */
export interface AdvanceWindowResponse {
  policy: {
    mode: 'any_day' | 'window' | 'fixed_day';
    fixedDay?: number;
    windowStartDay?: number;
    windowEndDay?: number;
  };
  isOpenToday: boolean;
  message: string;
}

/** Salary-loss (unpaid-leave deduction) configuration (D-03).
 *  Mirrors PayrollConfig.salaryLossConfig on the backend.
 *  Used by salary-loss-config PATCH endpoint and settings UI (Plan 26-08). */
export interface SalaryLossConfig {
  regularizationWindowDays: number;
  salaryLossEnabled: boolean;
}

/** Attendance calculation toggles (D-01).
 *  Mirrors PayrollConfig.attendanceCalcRules on the backend.
 *  Used by attendance-rules PATCH endpoint and settings UI (Plan 26-08). */
export interface AttendanceCalcRules {
  holidayCountsAsPresent: boolean;
  weekOffCountsAsPresent: boolean;
  lateMarkAsHalfDay: boolean;
}

/** A single advance salary request document (D-02).
 *  Mirrors the AdvanceSalaryRequest schema created in Plan 26-02.
 *  UI surfaces: advance request queue (Plan 26-09), member advance tab (Plan 26-10).
 *  Phase 3a: verifiedBy/verifiedAt/verifyNote are advisory fields stamped by a
 *  reporting-person reviewer (salary.review_advance@self). They do NOT affect the
 *  owner-approval flow; the owner can still approve/reject regardless. */
export interface AdvanceSalaryRequest {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  month: number;
  year: number;
  requestedAmount: number;
  approvedAmount?: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  requestedOn: string;
  reviewNote?: string;
  paymentId?: string;
  /** Phase 3a: id of the team member who verified this request (advisory). */
  verifiedBy?: string;
  /** Phase 3a: ISO timestamp when the review_advance holder verified this. */
  verifiedAt?: string;
  /** Phase 3a: optional note left by the reporting-person reviewer. */
  verifyNote?: string;
}

/**
 * Payload for PATCH advance-requests/:id/verify (Phase 3a).
 * Advisory verify by a reporting-person (salary.review_advance@self).
 * Links: TeamAdvanceReviewCard -> verifyAdvanceRequest -> BE /verify endpoint.
 */
export interface VerifyAdvancePayload {
  note?: string;
}

/**
 * Payload for POST advance-requests (D-02). Amounts in paise.
 * NOTE: no `teamMemberId` - the backend resolves the caller's own member id
 * from the JWT (IDOR-safe) and the DTO whitelist (forbidNonWhitelisted) REJECTS
 * any extra body field with a 400. Keep this in lockstep with the backend
 * CreateAdvanceRequestDto {requestedAmount, month, year}.
 */
export interface CreateAdvanceRequestPayload {
  requestedAmount: number;
  month: number;
  year: number;
}

/** Payload for PATCH advance-requests/:id/approve. Amounts in paise.
 *  Two-step flow (Plan 2026-06-22): APPROVE only sets the amount; recovery plan
 *  creation is moved to the DISBURSE step (PayAdvanceRequestPayload). Keep only
 *  amount + note here. Links: AdvanceApprovalQueue approve modal -> approve BE route. */
export interface ApproveAdvanceRequestPayload {
  approvedAmount: number;
  reviewNote?: string;
}

/** Payload for PATCH advance-requests/:id/pay (disburse step, Plan 2026-06-22).
 *  Captures HOW and WHEN the advance was disbursed, plus starts the recovery plan.
 *  Mirrors PayAdvanceRequestDto on the backend. Amounts in paise.
 *  Links: AdvanceDisburseDrawer -> payAdvanceRequest -> BE pay route. */
export interface PayAdvanceRequestPayload {
  paymentMode?: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'split' | 'other';
  paymentDate?: string;
  referenceNo?: string;
  note?: string;
  paidBy?: string;
  coaAccountId?: string;
  /** Reuses LedgerSplitLine - required when paymentMode==='split'. Must sum to approvedAmount. */
  splitLines?: LedgerSplitLine[];
  proofUrls?: string[];
  /** Free-text name of the person who physically handed over the cash/cheque. */
  disbursedByName?: string;
  /** Provide EITHER installmentCount OR installmentAmount; omit both for single lump recovery. */
  installmentCount?: number;
  installmentAmount?: number;
  startMonth?: number;
  startYear?: number;
  overrideCompliance?: boolean;
  overrideReason?: string;
}

/** Payload for PATCH advance-requests/:id/reject. */
export interface RejectAdvanceRequestPayload {
  reviewNote?: string;
}

// ─── Self-service 0% loan request (employee-originated) ──────────────────────
// Mirrors the advance-request self slice. The worker self-applies for a 0%
// installment loan; the owner later approves it (materializes a real
// EmployerLoan). Surfaces: MySalary loan card + LoanRequestDrawer + MyLoanRequests.
// Links: loan-request.controller.ts (BE), salary.api.ts loan-request functions.

/**
 * Payload for POST loan-requests (self-service apply). Amount in paise.
 * NOTE: no `teamMemberId` - the backend resolves the caller's own member id
 * from the JWT (IDOR-safe) and the DTO whitelist (forbidNonWhitelisted) REJECTS
 * any extra body field with a 400 (the exact bug fixed for advances). Keep this
 * in lockstep with the backend CreateLoanRequestDto {requestedAmount,
 * desiredTenorMonths, purpose?}.
 */
export interface CreateLoanRequestPayload {
  /** Amount requested in paise (integer, >= 1). */
  requestedAmount: number;
  /** Desired repayment timeline in months (1-120). Owner sets final terms at approval. */
  desiredTenorMonths: number;
  /** Optional free-text reason for the request. */
  purpose?: string;
}

/**
 * A single self-service loan request document. Mirrors the LoanRequest schema.
 * Approved rows carry a lean `loan` summary (id/status/remainingAmount) joined
 * from the materialized EmployerLoan so the worker app shows progress without a
 * second round-trip. Amounts are paise on the wire.
 */
export interface LoanRequest {
  _id: string;
  workspaceId: string;
  teamMemberId: string;
  requestedAmount: number;
  desiredTenorMonths: number;
  purpose?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  /** Reason shown to the employee when the request is rejected. */
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Present on approved rows: the EmployerLoan materialized from this request. */
  loan?: {
    id: string;
    status?: string;
    /** Remaining principal in paise. */
    remainingAmount?: number;
  };
}

/**
 * Response of GET loan-requests/eligibility (self). Drives the apply button:
 * `eligible` enables/disables submit, `maxAmount` (paise) shows the per-request
 * cap, `reasons` carries the stable codes (LOAN_FEATURE_DISABLED,
 * LOAN_SELF_APPLY_DISABLED, LOAN_TENURE_NOT_MET, LOAN_AMOUNT_EXCEEDS_CAP,
 * LOAN_LIMIT_EXCEEDED) so the drawer can show a friendly line per reason.
 */
export interface LoanRequestEligibility {
  enabled: boolean;
  maxAmount: number | null;
  minTenureMonths: number | null;
  eligible: boolean;
  reasons: string[];
}

/**
 * A pending loan request as returned by GET loan-requests/pending (owner queue).
 * Same shape as LoanRequest plus a decorated `member` summary the backend joins
 * from the TeamMember record (the request stores only the member id). Used by the
 * owner approval queue (LoanRequestsQueue). Links: loan-request.service.listPending.
 */
export interface PendingLoanRequest extends LoanRequest {
  member: {
    id: string;
    name?: string;
    employeeCode?: string;
  };
}

/**
 * Payload for PATCH loan-requests/:requestId/approve (owner). Sets the FINAL loan
 * terms; on success the backend materializes a real interest-free EmployerLoan via
 * the existing LoanService.createLoan. Mirrors the backend ApproveLoanRequestDto.
 * Amounts in paise. `interestType` defaults to 'zero' (the self-service loan is
 * always interest-free); `principalAmount` defaults to the request's requestedAmount
 * when omitted. Links: salary.api.ts approveLoanRequest, LoanRequestApproveDrawer.
 */
export interface ApproveLoanRequestPayload {
  /** Final repayment tenor in months (1-120). May differ from the requested timeline. */
  tenorMonths: number;
  /** Month (1-12) the first installment recovery lands in. */
  startMonth: number;
  /** Calendar year of the first installment. */
  startYear: number;
  /** Defaults to 'zero' server-side when omitted. */
  interestType?: InterestType;
  /** Final principal in paise. Defaults to the request's requestedAmount when omitted. */
  principalAmount?: number;
  /** Optional approval chain override; cloned into the materialized loan. */
  approvalChain?: Array<{ approverId: string; approverName: string }>;
}

/** Payload for PATCH loan-requests/:requestId/reject (owner). Reason is required. */
export interface RejectLoanRequestPayload {
  reason: string;
}

/** A single cash/bank account option returned by the COA picker (D-10).
 *  Rendered in the Pay drawer account selector (Plan 26-10). */
export interface CoaAccountOption {
  accountId: string;
  code: string;
  name: string;
}

/** Full response shape of GET coa-accounts (D-10).
 *  financeConfigured=false means no Finance module → picker hidden, posting silently skipped. */
export interface CoaAccountsResponse {
  accounts: CoaAccountOption[];
  lastUsedCoaAccountId: string | null;
  financeConfigured: boolean;
}
