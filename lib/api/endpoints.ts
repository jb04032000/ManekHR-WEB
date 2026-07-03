/**
 * API Endpoints
 * Centralized endpoint definitions - mirrors mobile app's services/api/endpoints.ts
 */

export const ApiEndpoints = {
  // Authentication
  auth: {
    checkUser: 'auth/check-user',
    login: 'auth/login',
    register: 'auth/register',
    google: 'auth/google',
    refresh: 'auth/refresh',
    forgotPassword: 'auth/forgot-password',
    resetPassword: 'auth/reset-password',
    changePasswordAfterForgot: 'auth/change-password-after-forgot',
    sendVerificationEmail: 'auth/send-verification-email',
    verifyEmail: 'auth/verify-email',
    me: 'auth/me',
    logout: 'auth/logout',
    setupAdmin: 'auth/setup-admin',
    terminateAndLogin: 'auth/terminate-and-login',
    // App Lock (Quick PIN) endpoints - see crewroster-backend AuthController
    pinSet: 'auth/pin-set',
    pinChange: 'auth/pin-change',
    pinVerify: 'auth/pin-verify',
    pinStatus: 'auth/pin-status',
    // App Lock activity heartbeat - slides the BE unlock TTL on user input.
    // Unlike the other PIN routes it is NOT @SkipPinUnlock on the backend (the
    // guard must run to slide the key). See pinApi.touch / useIdle.onActivity.
    pinTouch: 'auth/pin-touch',
    forgotPinCredentialVerify: 'auth/forgot-pin-credential-verify',
    forgotPinReset: 'auth/forgot-pin-reset',
    lock: 'auth/lock',
    // Per-user App Lock idle-timeout override. Sits under /me/security so it
    // can be reached by Connect-only (workspace-less) accounts that the ERP
    // workspace-settings page is unreachable for.
    appLockIdleSet: 'me/security/app-lock-idle',
    // SMS-OTP endpoints (login / register / forgot / mobile-verify).
    sendOtp: 'auth/send-otp',
    verifyOtp: 'auth/verify-otp',
    resendOtp: 'auth/resend-otp',
    sendMobileVerifyOtp: 'auth/send-mobile-verify-otp',
    verifyMobile: 'auth/verify-mobile',
    terminateAndOtpLogin: 'auth/terminate-and-otp-login',
    // Email-OTP register flow (web combined-signup parity with SMS-OTP).
    sendEmailRegistrationOtp: 'auth/email-otp/send-register',
  },

  // User profile
  users: {
    profile: 'users/profile',
    changePassword: 'users/change-password',
    setPassword: 'users/set-password',
  },

  // Self-serve account deletion (DPDP, ACCOUNT-DELETION-AND-DPDP-PLAN.md).
  // All routes are JWT-only + throttled on the backend (account-deletion.controller.ts).
  // stepup -> issues the one-time confirm code; stepupVerify -> returns the single-use
  // proof token consumed by the schedule calls. connect/erp/account = the three scopes.
  // erpPreview powers the Delete-ERP confirm screen's impact summary.
  accountDeletion: {
    stepup: 'me/deletion/stepup',
    stepupVerify: 'me/deletion/stepup/verify',
    connect: 'me/deletion/connect',
    erp: 'me/deletion/erp',
    erpPreview: 'me/deletion/erp/preview',
    account: 'me/deletion/account',
  },

  // Workspaces
  workspaces: {
    list: 'workspaces',
    create: 'workspaces',
    // OQ-W3 (workspace-delete undo) - the caller's own recently soft-deleted,
    // still-restorable workspaces. Must sit BEFORE `get(:id)` on the BE; the
    // literal `deleted` path is matched ahead of the `:id` param there.
    deleted: 'workspaces/deleted',
    // OQ-W3 - restore a soft-deleted workspace within the 30-day window.
    // Service re-checks owner + window; 400 WORKSPACE_RESTORE_WINDOW_EXPIRED past it.
    restore: (id: string) => `workspaces/${id}/restore`,
    // OQ-W6 (auto-added consent) - self-serve "Leave workspace" for a non-owner
    // member. Owner is blocked server-side. Scopes the teardown to this workspace.
    leave: (id: string) => `workspaces/${id}/leave`,
    get: (id: string) => `workspaces/${id}`,
    update: (id: string) => `workspaces/${id}`,
    delete: (id: string) => `workspaces/${id}`,
    members: (id: string) => `workspaces/${id}/members`,
    member: (id: string, memberId: string) => `workspaces/${id}/members/${memberId}`,
    memberRole: (id: string, memberId: string) => `workspaces/${id}/members/${memberId}/role`,
    invite: (id: string) => `workspaces/${id}/invite`,
    join: (token: string) => `workspaces/join/${token}`,
    branding: (id: string) => `workspaces/${id}/branding`,
    exportPreferences: (id: string) => `workspaces/${id}/export-preferences`,
    employeeCodeSettings: (id: string) => `workspaces/${id}/employee-code-settings`,
    updateKiosk: (wsId: string) => `workspaces/${wsId}/kiosk`,
    regenerateKioskToken: (wsId: string) => `workspaces/${wsId}/kiosk/regenerate-token`,
    getKioskState: (wsId: string) => `workspaces/${wsId}`,
    defaulterAlerts: (id: string) => `workspaces/${id}/defaulter-alerts`,
    // Notification policy (Phase 2.4, 2026-05-21)
    notificationPolicy: (id: string) => `workspaces/${id}/notification-policy`,
    // Designations sub-resource (F1/F2, 2026-05-13)
    designations: (id: string) => `workspaces/${id}/designations`,
    designation: (id: string, canonical: string) =>
      `workspaces/${id}/designations/${encodeURIComponent(canonical)}`,
    designationUsage: (id: string, canonical: string) =>
      `workspaces/${id}/designations/${encodeURIComponent(canonical)}/usage`,
  },

  // Settings (public)
  settings: {
    defaultBranding: 'settings/default-branding',
  },

  // Team (workspace-scoped)
  team: {
    list: (wsId: string) => `workspaces/${wsId}/team`,
    create: (wsId: string) => `workspaces/${wsId}/team`,
    get: (wsId: string, memberId: string) => `workspaces/${wsId}/team/${memberId}`,
    update: (wsId: string, memberId: string) => `workspaces/${wsId}/team/${memberId}`,
    delete: (wsId: string, memberId: string) => `workspaces/${wsId}/team/${memberId}`,
    grantAccess: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/grant-access`,
    grantContext: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/grant-context`,
    revokeAccess: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/revoke-access`,
    resendInvite: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/resend-invite`,
    changeAccessRole: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/access-role`,
    permissionOverrides: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/permission-overrides`,
    acceptInvite: (token: string) => `team/accept-invite/${token}`,
    import: (wsId: string) => `workspaces/${wsId}/team/import`,
    // CSV bulk import (web import wizard -> team.service.bulkCreate). Distinct
    // from `import` above, which copies members between workspaces.
    bulkCreate: (wsId: string) => `workspaces/${wsId}/team/bulk-create`,
    offboard: (wsId: string, memberId: string) => `workspaces/${wsId}/team/${memberId}/offboard`,
    bulkStatus: (wsId: string) => `workspaces/${wsId}/team/bulk-status`,
    bulkDelete: (wsId: string) => `workspaces/${wsId}/team/bulk`,
    bulkRestore: (wsId: string) => `workspaces/${wsId}/team/bulk-restore`,
    restore: (wsId: string, memberId: string) => `workspaces/${wsId}/team/${memberId}/restore`,
    deletePermanent: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/permanent`,
    backfillEmployeeCodes: (wsId: string) => `workspaces/${wsId}/team/backfill-employee-codes`,
    pendingBackfillCount: (wsId: string) => `workspaces/${wsId}/team/pending-backfill-count`,
    statusCounts: (wsId: string) => `workspaces/${wsId}/team/status-counts`,
    checkIdentifier: (wsId: string) => `workspaces/${wsId}/team/check-identifier`,
    // Activity log (2026-05-22) - workspace-wide team feed + per-member feed.
    // Both gated on `team.appAccess.manage` BE-side; values redacted.
    teamActivity: (wsId: string) => `workspaces/${wsId}/team/activity`,
    memberActivity: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/activity`,
    // Phase 1f (2026-05-21) mobile-OTP verification at add-member time.
    // Both gated on `team.member.create` permission BE-side.
    verifyMobileStart: (wsId: string) => `workspaces/${wsId}/team/verify-mobile/start`,
    verifyMobileConfirm: (wsId: string) => `workspaces/${wsId}/team/verify-mobile/confirm`,
    // Phase 1f verify-later flow. Stamps mobileVerifiedAt on an already-saved
    // member when the owner verifies from the profile page after a skip.
    verifyMemberMobile: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/verify-mobile`,
    documents: (wsId: string, memberId: string) => `workspaces/${wsId}/team/${memberId}/documents`,
    deleteDocument: (wsId: string, memberId: string, docId: string) =>
      `workspaces/${wsId}/team/${memberId}/documents/${docId}`,
    setKioskPin: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/team/${memberId}/kiosk-pin`,
    // Phase 23 - Piece rate
    pieceRateConfig: (wsId: string, teamMemberId: string) =>
      `workspaces/${wsId}/team/${teamMemberId}/piece-rate-config`,
  },

  // Kiosk (public - no auth header)
  kiosk: {
    punch: () => `attendance/kiosk/punch`,
    lookup: () => `attendance/kiosk/lookup`,
  },

  // Attendance (workspace-scoped)
  attendance: {
    list: (wsId: string) => `workspaces/${wsId}/attendance`,
    mark: (wsId: string) => `workspaces/${wsId}/attendance`,
    bulkMark: (wsId: string) => `workspaces/${wsId}/attendance/bulk`,
    update: (wsId: string, recordId: string) => `workspaces/${wsId}/attendance/${recordId}`,
    delete: (wsId: string, memberId: string, date: string) =>
      `workspaces/${wsId}/attendance/member/${memberId}/date/${date}`,
    overview: (wsId: string) => `workspaces/${wsId}/attendance/overview`,
    summary: (wsId: string) => `workspaces/${wsId}/attendance/summary`,
    livePresence: (wsId: string) => `workspaces/${wsId}/attendance/live-presence`,
    grid: (wsId: string) => `workspaces/${wsId}/attendance/grid`,
    overtime: (wsId: string) => `workspaces/${wsId}/attendance/overtime`,
    compliance: (wsId: string) => `workspaces/${wsId}/attendance/compliance`,
    absencePatterns: (wsId: string) => `workspaces/${wsId}/attendance/absence-patterns`,
    export: (wsId: string) => `workspaces/${wsId}/attendance/export`,
    upcomingLeaves: (wsId: string) => `workspaces/${wsId}/attendance/upcoming-leaves`,
    events: (wsId: string) => `workspaces/${wsId}/attendance/events`,
    recompute: (wsId: string) => `workspaces/${wsId}/attendance/recompute`,
    selfPunch: (wsId: string) => `workspaces/${wsId}/me/attendance/punch`,
    myDay: (wsId: string) => `workspaces/${wsId}/me/attendance/day`,
    ingestToken: (wsId: string) => `workspaces/${wsId}/attendance/ingest-token`,
    rotateIngestToken: (wsId: string) => `workspaces/${wsId}/attendance/rotate-ingest-token`,
    unassignedPunches: (wsId: string) => `workspaces/${wsId}/attendance/unassigned-punches`,
    assignDeviceUser: (wsId: string) => `workspaces/${wsId}/attendance/assign-device-user`,
    importParse: (wsId: string) => `workspaces/${wsId}/attendance/import/parse`,
    importCommit: (wsId: string) => `workspaces/${wsId}/attendance/import/commit`,
    statutoryGenerate: (wsId: string) => `workspaces/${wsId}/attendance/statutory/generate`,
    voidEvent: (wsId: string, eventId: string) => `workspaces/${wsId}/attendance/events/${eventId}`,
    audit: (wsId: string, attendanceId: string) =>
      `workspaces/${wsId}/attendance/${attendanceId}/audit`,
    staleSessions: (wsId: string) => `workspaces/${wsId}/attendance/stale-sessions`,
  },

  // Attendance Policies (workspace-scoped) - Phase C policy engine
  attendancePolicies: {
    list: (wsId: string) => `workspaces/${wsId}/attendance-policies`,
    create: (wsId: string) => `workspaces/${wsId}/attendance-policies`,
    get: (wsId: string, id: string) => `workspaces/${wsId}/attendance-policies/${id}`,
    update: (wsId: string, id: string) => `workspaces/${wsId}/attendance-policies/${id}`,
    delete: (wsId: string, id: string) => `workspaces/${wsId}/attendance-policies/${id}`,
    dryRun: (wsId: string, id: string) => `workspaces/${wsId}/attendance-policies/${id}/dry-run`,
  },

  // Regularization (workspace-scoped) - Phase D
  regularization: {
    list: (wsId: string) => `workspaces/${wsId}/regularizations`,
    create: (wsId: string) => `workspaces/${wsId}/regularizations`,
    pendingForMe: (wsId: string) => `workspaces/${wsId}/regularizations/pending-for-me`,
    myRequests: (wsId: string) => `workspaces/${wsId}/regularizations/my-requests`,
    get: (wsId: string, id: string) => `workspaces/${wsId}/regularizations/${id}`,
    approve: (wsId: string, id: string) => `workspaces/${wsId}/regularizations/${id}/approve`,
    reject: (wsId: string, id: string) => `workspaces/${wsId}/regularizations/${id}/reject`,
    cancel: (wsId: string, id: string) => `workspaces/${wsId}/regularizations/${id}/cancel`,
    settings: (wsId: string) => `workspaces/${wsId}/regularizations/settings`,
  },

  // Leave Management (workspace-scoped) - Leave epic L5
  leave: {
    types: (wsId: string) => `workspaces/${wsId}/leave/types`,
    type: (wsId: string, id: string) => `workspaces/${wsId}/leave/types/${id}`,
    settings: (wsId: string) => `workspaces/${wsId}/leave/settings`,
    balances: (wsId: string) => `workspaces/${wsId}/leave/balances`,
    conflicts: (wsId: string) => `workspaces/${wsId}/leave/conflicts`,
    requests: (wsId: string) => `workspaces/${wsId}/leave/requests`,
    myRequests: (wsId: string) => `workspaces/${wsId}/leave/requests/mine`,
    request: (wsId: string, id: string) => `workspaces/${wsId}/leave/requests/${id}`,
    requestPreview: (wsId: string) => `workspaces/${wsId}/leave/requests/preview`,
    approveRequest: (wsId: string, id: string) => `workspaces/${wsId}/leave/requests/${id}/approve`,
    rejectRequest: (wsId: string, id: string) => `workspaces/${wsId}/leave/requests/${id}/reject`,
    cancelRequest: (wsId: string, id: string) => `workspaces/${wsId}/leave/requests/${id}/cancel`,
    withdrawRequest: (wsId: string, id: string) =>
      `workspaces/${wsId}/leave/requests/${id}/withdraw`,
    compOffRequests: (wsId: string) => `workspaces/${wsId}/leave/comp-off-requests`,
    myCompOffRequests: (wsId: string) => `workspaces/${wsId}/leave/comp-off-requests/mine`,
    compOffLots: (wsId: string) => `workspaces/${wsId}/leave/comp-off-requests/lots`,
    compOffRequest: (wsId: string, id: string) =>
      `workspaces/${wsId}/leave/comp-off-requests/${id}`,
    approveCompOff: (wsId: string, id: string) =>
      `workspaces/${wsId}/leave/comp-off-requests/${id}/approve`,
    rejectCompOff: (wsId: string, id: string) =>
      `workspaces/${wsId}/leave/comp-off-requests/${id}/reject`,
    cancelCompOff: (wsId: string, id: string) =>
      `workspaces/${wsId}/leave/comp-off-requests/${id}/cancel`,
    delegations: (wsId: string) => `workspaces/${wsId}/leave/delegations`,
    revokeDelegation: (wsId: string, id: string) =>
      `workspaces/${wsId}/leave/delegations/${id}/revoke`,
    allBalances: (wsId: string) => `workspaces/${wsId}/leave/balances/all`,
    adjustments: (wsId: string) => `workspaces/${wsId}/leave/adjustments`,
    calendar: (wsId: string) => `workspaces/${wsId}/leave/calendar`,
  },

  // Attendance Devices (workspace-scoped)
  attendanceDevices: {
    list: (wsId: string) => `workspaces/${wsId}/attendance-devices`,
    create: (wsId: string) => `workspaces/${wsId}/attendance-devices`,
    get: (wsId: string, id: string) => `workspaces/${wsId}/attendance-devices/${id}`,
    update: (wsId: string, id: string) => `workspaces/${wsId}/attendance-devices/${id}`,
    approve: (wsId: string, id: string) => `workspaces/${wsId}/attendance-devices/${id}/approve`,
    pause: (wsId: string, id: string) => `workspaces/${wsId}/attendance-devices/${id}/pause`,
    unpause: (wsId: string, id: string) => `workspaces/${wsId}/attendance-devices/${id}/unpause`,
    revoke: (wsId: string, id: string) => `workspaces/${wsId}/attendance-devices/${id}/revoke`,
  },

  // Salary (workspace-scoped)
  salary: {
    list: (wsId: string) => `workspaces/${wsId}/salary`,
    listPaginated: (wsId: string) => `workspaces/${wsId}/salary/paginated`,
    overview: (wsId: string) => `workspaces/${wsId}/salary/overview`,
    byShiftSummary: (wsId: string) => `workspaces/${wsId}/salary/by-shift-summary`,
    generate: (wsId: string) => `workspaces/${wsId}/salary/generate`,
    ensureRecord: (wsId: string) => `workspaces/${wsId}/salary/ensure-record`,
    setBasePay: (wsId: string) => `workspaces/${wsId}/salary/set-base-pay`,
    update: (wsId: string, recordId: string) => `workspaces/${wsId}/salary/${recordId}`,
    lock: (wsId: string, salaryId: string) => `workspaces/${wsId}/salary/${salaryId}/lock`,
    unlock: (wsId: string, salaryId: string) => `workspaces/${wsId}/salary/${salaryId}/unlock`,
    payrollConfig: (wsId: string) => `workspaces/${wsId}/salary/payroll-config`,
    adjustments: (wsId: string, salaryId: string) =>
      `workspaces/${wsId}/salary/${salaryId}/adjustments`,
    reverseAdjustment: (wsId: string, adjustmentId: string) =>
      `workspaces/${wsId}/salary/adjustments/${adjustmentId}/reverse`,
    adjustmentAudit: (wsId: string, adjustmentId: string) =>
      `workspaces/${wsId}/salary/adjustments/${adjustmentId}/audit`,
    payments: (wsId: string) => `workspaces/${wsId}/salary/payments`,
    paymentRegister: (wsId: string) => `workspaces/${wsId}/salary/payments/register`,
    payslipData: (wsId: string) => `workspaces/${wsId}/salary/payslip-data`,
    sendPayslipEmail: (wsId: string) => `workspaces/${wsId}/salary/send-payslip-email`,
    monthlyTaskStatus: (wsId: string) => `workspaces/${wsId}/salary/monthly-task-status`,
    sendBulkPayslipEmails: (wsId: string) => `workspaces/${wsId}/salary/send-payslip-email/bulk`,
    bulkEmailPayslips: (wsId: string) => `workspaces/${wsId}/salary/bulk-email-payslips`,
    bulkEmailPayslipsStatus: (wsId: string, jobId: string) =>
      `workspaces/${wsId}/salary/bulk-email-payslips/${jobId}/status`,
    bulkEmailPayslipsCancel: (wsId: string, jobId: string) =>
      `workspaces/${wsId}/salary/bulk-email-payslips/${jobId}/cancel`,
    advances: (wsId: string, teamMemberId: string) =>
      `workspaces/${wsId}/salary/advances/${teamMemberId}`,
    bulkPayment: (wsId: string) => `workspaces/${wsId}/salary/payments/bulk`,
    reversePayment: (wsId: string, paymentId: string) =>
      `workspaces/${wsId}/salary/payments/${paymentId}/reverse`,
    ledger: (wsId: string, memberId: string) => `workspaces/${wsId}/salary/history/${memberId}`,
    ownPayslip: (wsId: string, memberId: string, salaryId: string) =>
      `workspaces/${wsId}/salary/history/${memberId}/payslip/${salaryId}`,
    fnfList: (wsId: string) => `workspaces/${wsId}/salary/fnf`,
    fnfSettlement: (wsId: string, memberId: string) => `workspaces/${wsId}/salary/fnf/${memberId}`,
    fnfInitiate: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/salary/fnf/${memberId}/initiate`,
    fnfFinalise: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/salary/fnf/${memberId}/finalise`,
    gratuitySummary: (wsId: string) => `workspaces/${wsId}/salary/gratuity`,
    gratuityLedger: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/salary/gratuity/${memberId}`,
    form16: (wsId: string, memberId: string) => `workspaces/${wsId}/salary/form16/${memberId}`,
    taxDeclaration: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/salary/tax-declaration/${memberId}`,
    tdsPreview: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/salary/tax-declaration/${memberId}/tds-preview`,
    tdsChallans: (wsId: string) => `workspaces/${wsId}/salary/tds/challans`,
    tdsChallanById: (wsId: string, challanId: string) =>
      `workspaces/${wsId}/salary/tds/challans/${challanId}`,
    tdsChallansQuarter: (wsId: string) => `workspaces/${wsId}/salary/tds/challans/quarter`,
    tdsLiability: (wsId: string) => `workspaces/${wsId}/salary/tds/liability`,
    tdsSummary: (wsId: string) => `workspaces/${wsId}/salary/tds/summary`,
    tdsForm24Q: (wsId: string) => `workspaces/${wsId}/salary/tds/form24q`,
    complianceEcr: (wsId: string) => `workspaces/${wsId}/salary/compliance/ecr`,
    complianceEsiChallan: (wsId: string) => `workspaces/${wsId}/salary/compliance/esi-challan`,
    complianceBankFile: (wsId: string) => `workspaces/${wsId}/salary/compliance/bank-file`,
    bankFile: (wsId: string) => `workspaces/${wsId}/salary/bank-file`,
    increments: (wsId: string) => `workspaces/${wsId}/salary/increments`,
    incrementDelete: (wsId: string, id: string) => `workspaces/${wsId}/salary/increments/${id}`,
    componentTemplates: (wsId: string) => `workspaces/${wsId}/salary/component-templates`,
    componentTemplateSeed: (wsId: string) => `workspaces/${wsId}/salary/component-templates/seed`,
    componentTemplateById: (wsId: string, templateId: string) =>
      `workspaces/${wsId}/salary/component-templates/${templateId}`,
    // Phase 23 - Piece rate
    pieceRatePreview: (
      wsId: string,
      params: { teamMemberId: string; month: number; year: number },
    ) =>
      `workspaces/${wsId}/salary/piece-rate/preview?teamMemberId=${params.teamMemberId}&month=${params.month}&year=${params.year}`,
    // Advance recovery plans (EMI)
    advancePlansPreview: (wsId: string) => `workspaces/${wsId}/salary/advance-plans/preview`,
    advancePlans: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/salary/advance-plans/${memberId}`,
    advancePlanDetail: (wsId: string, planId: string) =>
      `workspaces/${wsId}/salary/advance-plans/detail/${planId}`,
    advancePlanEdit: (wsId: string, planId: string) =>
      `workspaces/${wsId}/salary/advance-plans/${planId}`,
    advancePlanEarlyPayoff: (wsId: string, planId: string) =>
      `workspaces/${wsId}/salary/advance-plans/${planId}/early-payoff`,
    // Bonus (Phase 3A)
    bonusConfig: (wsId: string) => `workspaces/${wsId}/salary/bonus/config`,
    bonusPreview: (wsId: string) => `workspaces/${wsId}/salary/bonus/preview`,
    bonusRun: (wsId: string) => `workspaces/${wsId}/salary/bonus/run`,
    bonusFestival: (wsId: string) => `workspaces/${wsId}/salary/bonus/festival`,
    bonusSummary: (wsId: string) => `workspaces/${wsId}/salary/bonus/summary`,
    bonusRuns: (wsId: string) => `workspaces/${wsId}/salary/bonus/runs`,
    bonusRunById: (wsId: string, runId: string) => `workspaces/${wsId}/salary/bonus/runs/${runId}`,
    // Commission / Incentive (Phase 3B)
    commissionEntries: (wsId: string) => `workspaces/${wsId}/salary/commission/entries`,
    commissionYtd: (wsId: string) => `workspaces/${wsId}/salary/commission/ytd`,
    commissionSchedules: (wsId: string) => `workspaces/${wsId}/salary/commission/schedules`,
    commissionScheduleById: (wsId: string, scheduleId: string) =>
      `workspaces/${wsId}/salary/commission/schedules/${scheduleId}`,
    commissionScheduleDisburse: (wsId: string, scheduleId: string) =>
      `workspaces/${wsId}/salary/commission/schedules/${scheduleId}/disburse`,
    // Employer Loans (Phase 2)
    // Static routes (preview, dashboard, detail) declared before param routes
    // to mirror the controller ordering at salary.controller.ts:1196.
    loansPreview: (wsId: string) => `workspaces/${wsId}/salary/loans/preview`,
    loansDashboard: (wsId: string) => `workspaces/${wsId}/salary/loans/dashboard`,
    loanDetail: (wsId: string, loanId: string) =>
      `workspaces/${wsId}/salary/loans/detail/${loanId}`,
    loans: (wsId: string) => `workspaces/${wsId}/salary/loans`,
    loansByMember: (wsId: string, teamMemberId: string) =>
      `workspaces/${wsId}/salary/loans/${teamMemberId}`,
    loanOutstanding: (wsId: string, teamMemberId: string) =>
      `workspaces/${wsId}/salary/loans/${teamMemberId}/outstanding`,
    // Lifecycle endpoints (Part B)
    loanApprove: (wsId: string, loanId: string) =>
      `workspaces/${wsId}/salary/loans/${loanId}/approve`,
    loanSkipInstallment: (wsId: string, loanId: string) =>
      `workspaces/${wsId}/salary/loans/${loanId}/skip-installment`,
    loanPauseResume: (wsId: string, loanId: string) =>
      `workspaces/${wsId}/salary/loans/${loanId}/pause-resume`,
    loanEarlyPayoff: (wsId: string, loanId: string) =>
      `workspaces/${wsId}/salary/loans/${loanId}/early-payoff`,
    loanTopUp: (wsId: string, loanId: string) => `workspaces/${wsId}/salary/loans/${loanId}/top-up`,
    loanWriteOff: (wsId: string, loanId: string) =>
      `workspaces/${wsId}/salary/loans/${loanId}/write-off`,
    // Cash Ledger (Phase 3C - Daily-Wage Running Ledger)
    cashLedgerEntries: (wsId: string) => `workspaces/${wsId}/salary/ledger/entries`,
    cashLedgerBalances: (wsId: string) => `workspaces/${wsId}/salary/ledger/balances`,
    cashLedgerSettle: (wsId: string) => `workspaces/${wsId}/salary/ledger/settle`,
    cashLedgerMember: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/salary/ledger/${memberId}`,
    cashLedgerEntryById: (wsId: string, entryId: string) =>
      `workspaces/${wsId}/salary/ledger/entries/${entryId}`,
    // Phase 26 - Salary Engine + Accounting Integration
    disbursementRules: (wsId: string) => `workspaces/${wsId}/salary/disbursement-rules`,
    salaryLossConfig: (wsId: string) => `workspaces/${wsId}/salary/salary-loss-config`,
    attendanceRules: (wsId: string) => `workspaces/${wsId}/salary/attendance-rules`,
    coaAccounts: (wsId: string) => `workspaces/${wsId}/salary/coa-accounts`,
    advanceRequests: (wsId: string) => `workspaces/${wsId}/salary/advance-requests`,
    advanceRequestsMine: (wsId: string) => `workspaces/${wsId}/salary/advance-requests/mine`,
    advanceRequestsWindow: (wsId: string) => `workspaces/${wsId}/salary/advance-requests/window`,
    approveAdvanceRequest: (wsId: string, id: string) =>
      `workspaces/${wsId}/salary/advance-requests/${id}/approve`,
    rejectAdvanceRequest: (wsId: string, id: string) =>
      `workspaces/${wsId}/salary/advance-requests/${id}/reject`,
    // Two-step disburse (Plan 2026-06-22): pay route moves to a separate PATCH endpoint.
    payAdvanceRequest: (wsId: string, id: string) =>
      `workspaces/${wsId}/salary/advance-requests/${id}/pay`,
    // Phase 3a (reporting-person review): advance requests for the caller's direct reports.
    // Requires salary.review_advance@self; backend filters by reportsTo == caller's teamMemberId.
    advanceRequestsForMyReports: (wsId: string) =>
      `workspaces/${wsId}/salary/advance-requests/for-my-reports`,
    // Phase 3a: advisory verify stamp; does NOT gate the owner approve/reject flow.
    verifyAdvanceRequest: (wsId: string, id: string) =>
      `workspaces/${wsId}/salary/advance-requests/${id}/verify`,
    // Self-service 0% loan requests (employee-originated). Gated on the
    // loan_management subscription sub-feature. Mirrors the advance-requests
    // self slice. Links: loan-request.controller.ts (BE), salary.api.ts loan fns.
    loanRequests: (wsId: string) => `workspaces/${wsId}/salary/loan-requests`,
    loanRequestsMine: (wsId: string) => `workspaces/${wsId}/salary/loan-requests/mine`,
    loanRequestsEligibility: (wsId: string) =>
      `workspaces/${wsId}/salary/loan-requests/eligibility`,
    // Owner-side queue + decisions (Task 5). Gated on loan_management + salary.edit@all.
    // pending -> queue rows (member-decorated); approve materializes the 0% EmployerLoan;
    // reject declines with a reason. Links: loan-request.controller.ts (BE), LoanRequestsQueue.
    loanRequestsPending: (wsId: string) => `workspaces/${wsId}/salary/loan-requests/pending`,
    approveLoanRequest: (wsId: string, requestId: string) =>
      `workspaces/${wsId}/salary/loan-requests/${requestId}/approve`,
    rejectLoanRequest: (wsId: string, requestId: string) =>
      `workspaces/${wsId}/salary/loan-requests/${requestId}/reject`,
  },

  // Shifts (workspace-scoped)
  shifts: {
    list: (wsId: string) => `workspaces/${wsId}/shifts`,
    create: (wsId: string) => `workspaces/${wsId}/shifts`,
    update: (wsId: string, shiftId: string) => `workspaces/${wsId}/shifts/${shiftId}`,
    delete: (wsId: string, shiftId: string) => `workspaces/${wsId}/shifts/${shiftId}`,
  },

  // Holidays (workspace-scoped)
  holidays: {
    list: (wsId: string) => `workspaces/${wsId}/holidays`,
    create: (wsId: string) => `workspaces/${wsId}/holidays`,
    // Bulk add several holidays in one request (partial success → {created,skipped}).
    bulk: (wsId: string) => `workspaces/${wsId}/holidays/bulk`,
    update: (wsId: string, holidayId: string) => `workspaces/${wsId}/holidays/${holidayId}`,
    delete: (wsId: string, holidayId: string) => `workspaces/${wsId}/holidays/${holidayId}`,
    byYear: (wsId: string, year: number) => `workspaces/${wsId}/holidays/year/${year}`,
    checkDate: (wsId: string, date: string) => `workspaces/${wsId}/holidays/check/${date}`,
  },

  // Bills (workspace-scoped)
  bills: {
    list: (wsId: string) => `workspaces/${wsId}/bills`,
    create: (wsId: string) => `workspaces/${wsId}/bills`,
    get: (wsId: string, billId: string) => `workspaces/${wsId}/bills/${billId}`,
    update: (wsId: string, billId: string) => `workspaces/${wsId}/bills/${billId}`,
    delete: (wsId: string, billId: string) => `workspaces/${wsId}/bills/${billId}`,
    recordPayment: (wsId: string, billId: string) => `workspaces/${wsId}/bills/${billId}/payments`,
  },

  // Roles / RBAC (workspace-scoped)
  roles: {
    list: (wsId: string) => `workspaces/${wsId}/roles`,
    templates: (wsId: string) => `workspaces/${wsId}/roles/templates`,
    create: (wsId: string) => `workspaces/${wsId}/roles`,
    get: (wsId: string, roleId: string) => `workspaces/${wsId}/roles/${roleId}`,
    update: (wsId: string, roleId: string) => `workspaces/${wsId}/roles/${roleId}`,
    delete: (wsId: string, roleId: string) => `workspaces/${wsId}/roles/${roleId}`,
  },

  // RBAC registry - Phase 1c permission matrix catalog (2026-05-20)
  // presets - Phase 1d one-click role preset fills (2026-05-20)
  rbac: {
    registry: (wsId: string) => `workspaces/${wsId}/rbac/registry`,
    presets: (wsId: string) => `workspaces/${wsId}/rbac/presets`,
  },

  // Wave 1+2 RBAC additions (2026-05-10) - me/permissions + invite consolidation
  me: {
    permissions: (wsId: string) => `workspaces/${wsId}/me/permissions`,
    dashboard: (wsId: string) => `workspaces/${wsId}/me/dashboard`,
    pendingInvites: 'me/invites/pending',
    acceptInvite: (inviteId: string) => `me/invites/${inviteId}/accept`,
    declineInvite: (inviteId: string) => `me/invites/${inviteId}`,
    // P2.0 (2026-05-15) - Sent + History tabs on /dashboard/invitations
    sentInvites: 'me/invites/sent',
    inviteHistory: 'me/invites/history',
    // P2.0 (2026-05-15) - cross-workspace user-scoped notifications
    notifications: 'me/notifications',
    notificationsUnreadCount: 'me/notifications/unread-count',
    notificationMarkRead: (id: string) => `me/notifications/${id}/read`,
    notificationsMarkAllRead: 'me/notifications/mark-all-read',
  },

  // Wave 2 invite consolidation - single canonical invite resource at /invites/:token
  invites: {
    preview: (token: string) => `invites/${token}`,
    accept: (token: string) => `invites/${token}/accept`,
    decline: (token: string) => `invites/${token}`,
  },

  // Statistics
  statistics: {
    dashboard: (wsId: string) => `workspaces/${wsId}/statistics/dashboard`,
    // HR OVERVIEW — ManekHR admin-landing people metrics (headcount, this-month
    // salary, designation breakdown). Backed by StatisticsController.getHrOverview;
    // gated on SALARY view scope=all. Consumed by getHrOverview() + the HR landing.
    hrOverview: (wsId: string) => `workspaces/${wsId}/statistics/hr-overview`,
  },

  // Subscriptions
  subscriptions: {
    plans: 'subscriptions/plans',
    tiers: 'subscriptions/tiers',
    // Public (no-auth) admin-controlled trial-promo banner config. Backed by
    // GET /subscriptions/public/trial-banner -> { enabled, headlineOverride, days }.
    // Consumed by lib/actions getTrialBannerConfig (TrialPromoBanner on the
    // plans hub + the marketing pricing page).
    publicTrialBanner: 'subscriptions/public/trial-banner',
    // Opt-in trial model (2026-06-24). Authed. trialState reads whether the
    // caller can start / is in / has used the trial; startTrial begins it.
    // Backed by GET /subscriptions/trial-state + POST /subscriptions/start-trial.
    // Consumed by lib/actions getTrialState/startTrial -> TrialStatusBanner on
    // the in-app plans hub. Keep in sync with the BE SubscriptionsController.
    trialState: 'subscriptions/trial-state',
    startTrial: 'subscriptions/start-trial',
    // Custom-plan lead capture (authed). POST { teamMembers, companiesOrFactories?,
    // mobile, note?, product? }. Backed by CustomPlanRequestsController; consumed by
    // lib/actions submitCustomPlanRequest -> the Plans-hub "Request a custom plan" form.
    customPlanRequest: 'subscriptions/custom-plan-request',
    // Plan-interest lead capture (authed). POST { planId, planTier?, planName?,
    // mobile, teamMembers?, ... }. Fired when a user clicks Subscribe on a
    // predefined paid plan while online payments are off. Backed by
    // CustomPlanRequestsController.createPlanInterest; consumed by
    // lib/actions submitPlanInterestRequest -> the Plans-hub PlanContactModal.
    planInterestRequest: 'subscriptions/custom-plan-request/plan-interest',
    my: 'subscriptions/my',
    myHistory: 'subscriptions/my/subscriptions',
    subscribe: 'subscriptions/subscribe',
    cancel: 'subscriptions/cancel',
    forceActivate: 'subscriptions/force-activate',
    cancelScheduled: 'subscriptions/cancel-scheduled',
    featureRegistry: 'subscriptions/feature-registry',
  },

  // Billing - D1 enterprise subscription stack
  billing: {
    // One-time checkout (Razorpay Orders API)
    checkoutCreate: 'subscriptions/checkout',
    checkoutConfirm: 'subscriptions/checkout/confirm',

    // Recurring auto-renew (Razorpay Subscriptions API)
    mandateCreate: 'subscriptions/checkout/mandate',
    mandateCancel: 'subscriptions/mandate/cancel',
    mandatePause: 'subscriptions/mandate/pause',
    mandateResume: 'subscriptions/mandate/resume',

    // Coupons
    couponValidate: 'subscriptions/coupons/validate',
    couponAutoApply: 'subscriptions/coupons/auto-apply',

    // Payments + invoices
    paymentsList: 'subscriptions/payments',
    invoiceMeta: (paymentId: string) => `subscriptions/payments/${paymentId}/invoice`,
    invoiceDownload: (paymentId: string) => `subscriptions/payments/${paymentId}/invoice/download`,
    invoiceRegenerate: (paymentId: string) =>
      `subscriptions/payments/${paymentId}/invoice/regenerate`,

    // Refunds (self-serve)
    refundRequest: (paymentId: string) => `subscriptions/payments/${paymentId}/refund-request`,
    refundList: 'subscriptions/payments/refund-requests',
    refundGet: (id: string) => `subscriptions/payments/refund-requests/${id}`,

    // Dunning
    dunningStatus: 'subscriptions/dunning/status',

    // Billing profile (GST B2B fields on User)
    billingProfile: 'users/me/billing',
  },

  // Notifications (workspace-scoped)
  notifications: {
    list: (wsId: string) => `workspaces/${wsId}/notifications`,
    markRead: (wsId: string, id: string) => `workspaces/${wsId}/notifications/${id}/read`,
    markAllRead: (wsId: string) => `workspaces/${wsId}/notifications/mark-all-read`,
    delete: (wsId: string, id: string) => `workspaces/${wsId}/notifications/${id}`,
  },

  // Feedback (workspace-scoped tenant POST + admin list/update)
  feedback: {
    submit: (wsId: string) => `workspaces/${wsId}/feedback`,
    adminList: 'admin/feedback',
    adminGetOne: (id: string) => `admin/feedback/${id}`,
    adminUpdateStatus: (id: string) => `admin/feedback/${id}/status`,
  },

  // Sessions
  sessions: {
    list: 'sessions',
    delete: (id: string) => `sessions/${id}`,
    deleteAll: 'sessions',
    terminateAndLogin: 'sessions/terminate-and-login',
  },

  // Localization (admin)
  localization: {
    languages: 'localization/languages',
    adminLanguages: 'localization/admin/languages',
    createLanguage: 'localization/languages',
    updateLanguage: (code: string) => `localization/languages/${code}`,
    deleteLanguage: (code: string) => `localization/languages/${code}`,
    hardDeleteLanguage: (code: string) => `localization/admin/languages/${code}/permanent`,
    bundle: (langCode: string) => `localization/${langCode}`,
    version: (langCode: string) => `localization/version/${langCode}`,
    adminTranslations: (langCode: string) => `localization/admin/${langCode}/translations`,
    adminTranslationsIndex: 'localization/admin/translations/index',
    adminNamespaces: 'localization/admin/namespaces',
    upsertTranslation: (langCode: string, ns: string, key: string) =>
      `localization/${langCode}/${ns}/${key}`,
    deleteTranslation: (langCode: string, ns: string, key: string) =>
      `localization/${langCode}/${ns}/${key}`,
    bulkImport: (langCode: string) => `localization/import/${langCode}`,
    exportBundle: (langCode: string) => `localization/export/${langCode}`,
    diff: (langCode: string) => `localization/diff/${langCode}`,
    copyFromDefault: (langCode: string) => `localization/copy/${langCode}`,
  },

  // Public, admin-managed legal/policy pages (Terms + Privacy). Published-only
  // read; backed by legal-pages.public.controller.ts (@Public GET /legal-pages/:slug).
  // Slugs: terms-connect | terms-erp | privacy-connect | privacy-erp.
  legalPages: {
    bySlug: (slug: string) => `legal-pages/${slug}`,
  },

  // Admin (requires admin role)
  admin: {
    settings: 'admin/settings',
    branding: 'admin/settings/branding',
    ptSlabs: 'admin/pt-slabs',
    ptSlabByState: (state: string) => `admin/pt-slabs/${encodeURIComponent(state)}`,
    stats: 'admin/stats',
    users: 'admin/users',
    createUser: 'admin/users',
    userDetails: (id: string) => `admin/users/${id}`,
    userStatus: (id: string) => `admin/users/${id}/status`,
    userSubscription: (id: string) => `admin/users/${id}/subscription`,
    userSubscriptionHistory: (id: string) => `admin/users/${id}/subscriptions`,
    userSessions: (id: string) => `admin/users/${id}/sessions`,
    userSessionLimit: (id: string) => `admin/users/${id}/session-limit`,
    deleteUser: (id: string) => `admin/users/${id}`,
    restoreUser: (id: string) => `admin/users/${id}/restore`,
    // DPDP self-serve deletion support (ACCOUNT-DELETION-AND-DPDP-PLAN.md §6).
    // userDeletion -> read a user's pending-deletion markers for the support view;
    // restoreDeletion -> admin-mediated recovery within the 30-day window (distinct
    // from restoreUser, which is the generic soft-delete undo and does NOT clear markers).
    userDeletion: (id: string) => `admin/users/${id}/deletion`,
    restoreDeletion: (id: string) => `admin/users/${id}/restore-deletion`,
    // Complete DPDP erase (Connect purge + identity scrub + vendor file delete).
    // The proper replacement for the legacy permanent hard-delete (deleteUser).
    eraseUser: (id: string) => `admin/users/${id}/erase`,
    workspaces: 'admin/workspaces',
    workspaceDetail: (id: string) => `admin/workspaces/${id}`,
    workspaceEmailConfig: (id: string) => `admin/workspaces/${id}/email-config`,
    workspaceTestSmtp: (id: string) => `admin/workspaces/${id}/test-smtp`,
    workspaceResetEmailUsage: (id: string) => `admin/workspaces/${id}/reset-email-usage`,
    subscriptions: 'admin/subscriptions',
    // Custom-plan lead triage (admin). GET list (?status&limit&offset) + PATCH
    // status/adminNote. Backed by AdminCustomPlanRequestsController; consumed by
    // features/admin/custom-plan-requests.
    customPlanRequests: 'admin/custom-plan-requests',
    updateCustomPlanRequest: (id: string) => `admin/custom-plan-requests/${id}`,
    plans: 'admin/plans',
    createPlan: 'admin/plans',
    updatePlan: (id: string) => `admin/plans/${id}`,
    deletePlan: (id: string) => `admin/plans/${id}`,
    tiers: 'admin/tiers',
    createTier: 'admin/tiers',
    updateTier: (id: string) => `admin/tiers/${id}`,
    deleteTier: (id: string) => `admin/tiers/${id}`,
    assignPlan: 'admin/subscriptions/assign',
    customAssignPlan: 'admin/subscriptions/custom-assign',
    // Assign the configured DEFAULT ERP plan to ONE user with no active plan
    // (admin-side counterpart to signup auto-assign). Backed by AdminController.
    assignDefaultPlan: (id: string) => `admin/users/${id}/assign-default-plan`,
    // Bulk backfill: assign the default ERP plan to every user without a plan.
    assignDefaultMissing: 'admin/subscriptions/assign-default-missing',
    updateSubscription: (id: string) => `admin/subscriptions/${id}`,
    cancelSubscription: (id: string) => `admin/subscriptions/${id}/cancel`,
    revokeSubscription: (id: string) => `admin/subscriptions/${id}`,
    addOnDefinitions: 'admin/add-ons/definitions',
    updateAddOnDefinition: (id: string) => `admin/add-ons/definitions/${id}`,
    deleteAddOnDefinition: (id: string) => `admin/add-ons/definitions/${id}`,
    userAddOns: (id: string) => `admin/users/${id}/add-ons`,
    assignAddOn: 'admin/add-ons/assign',
    revokeAddOn: (id: string) => `admin/add-ons/${id}/revoke`,
    // Per-user Connect entitlements console (plan defaults vs override vs
    // effective + usage). Backed by admin-connect-entitlements.controller.ts.
    connectEntitlements: (id: string) => `admin/connect/users/${id}/entitlements`,
    connectEntitlementsOverride: (id: string) => `admin/connect/users/${id}/entitlements/override`,
    // Per-user Connect ads wallet (boost credits). GET reads the balance;
    // POST adjusts it by a signed whole-rupee amount + reason. Backed by the
    // admin connect ads-wallet controller; surfaced in the unified Manage Plans
    // drawer (features/admin/users/ConnectWalletCard.tsx).
    adminWallet: (id: string) => `admin/connect/ads/wallet/${id}`,
    adminWalletAdjust: (id: string) => `admin/connect/ads/wallet/${id}/adjust`,
    // Connect demo manager (list / clear / delete / post-as). Backed by
    // admin-connect-demo.controller.ts.
    connectDemoUsers: 'admin/connect/demo/users',
    connectDemoClear: 'admin/connect/demo/clear',
    connectDemoUser: (id: string) => `admin/connect/demo/users/${id}`,
    connectDemoPost: (id: string) => `admin/connect/demo/users/${id}/post`,
    // Admin-managed legal/policy pages CMS (Terms + Privacy, per product).
    // Backed by legal-pages.admin.controller.ts (IsAdminGuard).
    legalPages: 'admin/legal-pages',
    createLegalPage: 'admin/legal-pages',
    legalPageById: (id: string) => `admin/legal-pages/${id}`,
    updateLegalPage: (id: string) => `admin/legal-pages/${id}`,
    publishLegalPage: (id: string) => `admin/legal-pages/${id}/publish`,
    deleteLegalPage: (id: string) => `admin/legal-pages/${id}`,
  },

  // Admin Billing - D1 admin surface (D3 web wiring)
  adminBilling: {
    // Subscription operations
    grant: 'admin/billing/grant',
    listUserSubscriptions: (userId: string) => `admin/billing/subscriptions/${userId}`,
    fetchSubscription: (id: string) => `admin/billing/subscriptions/by-id/${id}`,
    extendPeriod: (id: string) => `admin/billing/subscriptions/${id}/extend`,
    overrideEntitlements: (id: string) => `admin/billing/subscriptions/${id}/override`,
    pause: (id: string) => `admin/billing/subscriptions/${id}/pause`,
    resume: (id: string) => `admin/billing/subscriptions/${id}/resume`,
    forceCancel: (id: string) => `admin/billing/subscriptions/${id}/force-cancel`,

    // Manual payment + payment links
    manualPayment: 'admin/billing/manual-payment',
    paymentLinks: 'admin/billing/payment-links',
    cancelPaymentLink: (paymentId: string) => `admin/billing/payment-links/${paymentId}/cancel`,

    // Refund queue + direct refund + invoice regenerate
    refundsPending: 'admin/billing/refund-requests/pending',
    approveRefund: (id: string) => `admin/billing/refund-requests/${id}/approve`,
    rejectRefund: (id: string) => `admin/billing/refund-requests/${id}/reject`,
    directRefund: (paymentId: string) => `admin/billing/payments/${paymentId}/refund`,
    regenerateInvoice: (paymentId: string) =>
      `admin/billing/payments/${paymentId}/invoice/regenerate`,

    // Coupons
    coupons: 'admin/billing/coupons',
    couponDetail: (id: string) => `admin/billing/coupons/${id}`,
    couponStats: (id: string) => `admin/billing/coupons/${id}/stats`,
    couponAttribution: (id: string) => `admin/billing/coupons/${id}/attribution`,

    // Policies
    billingPolicy: 'admin/billing/policy',
    refundPolicy: 'admin/billing/refund-policy',

    // Audit log
    auditQuery: 'admin/billing/audit',

    // Custom plans (admin-curated)
    customPlans: 'admin/billing/plans',
    customPlanDetail: (id: string) => `admin/billing/plans/${id}`,

    // Mandate admin-on-behalf
    mandateCreate: 'admin/subscriptions/mandate/create',
    mandateCancel: 'admin/subscriptions/mandate/cancel',
    mandatePause: 'admin/subscriptions/mandate/pause',
    mandateResume: 'admin/subscriptions/mandate/resume',
  },

  // Add-ons
  addOns: {
    list: 'add-ons',
    my: 'add-ons/my',
    purchase: 'add-ons/purchase',
    preview: 'add-ons/preview',
    cancel: (id: string) => `add-ons/${id}/cancel`,
    // Wave 7 - credit-pack billing flow + auto-recharge config.
    creditPackOrder: 'add-ons/credit-pack/order',
    creditPackConfirm: 'add-ons/credit-pack/confirm',
    creditPackHistory: 'add-ons/credit-pack/history',
    autoRecharge: 'add-ons/credit-pack/auto-recharge',
  },

  // Wave 8 - MSG91 ops + cost reporting (admin-only).
  adminCommunications: {
    msg91Balance: 'admin/communications/msg91/balance',
    msg91TopUp: 'admin/communications/msg91/topup',
    msg91TopUps: 'admin/communications/msg91/topups',
    marginReport: 'admin/communications/msg91/margin-report',
    refundQueue: 'admin/communications/msg91/refund-queue',
    manualRefund: 'admin/communications/msg91/manual-refund',
    // Wave 8.2 - versioned cost-table CRUD.
    pricingList: 'admin/communications/pricing',
    pricingAdd: 'admin/communications/pricing',
    pricingClose: (id: string) => `admin/communications/pricing/${id}/close`,
    // Wave 8.2 - platform marketing pool + bulk send.
    marketingPools: 'admin/communications/marketing/pools',
    marketingTopUp: 'admin/communications/marketing/topup',
    marketingLedger: 'admin/communications/marketing/ledger',
    marketingSendBulk: 'admin/communications/marketing/send-bulk',
  },

  // Anomalies (workspace-scoped, Phase I)
  anomalies: {
    list: (wsId: string) => `workspaces/${wsId}/anomalies`,
    acknowledge: (wsId: string, id: string) => `workspaces/${wsId}/anomalies/${id}/acknowledge`,
    count: (wsId: string) => `workspaces/${wsId}/anomalies/count`,
    listRules: (wsId: string) => `workspaces/${wsId}/anomaly-rules`,
    toggleRule: (wsId: string, ruleType: string) => `workspaces/${wsId}/anomaly-rules/${ruleType}`,
  },

  // Locations (workspace-scoped) - operational sites where machines live.
  // Not to be confused with Workspace.location (legal address).
  locations: {
    list: (wsId: string) => `workspaces/${wsId}/locations`,
    create: (wsId: string) => `workspaces/${wsId}/locations`,
    get: (wsId: string, id: string) => `workspaces/${wsId}/locations/${id}`,
    update: (wsId: string, id: string) => `workspaces/${wsId}/locations/${id}`,
    delete: (wsId: string, id: string) => `workspaces/${wsId}/locations/${id}`,
    peekCode: (wsId: string) => `workspaces/${wsId}/locations/peek-next-code`,
  },

  // Machines + shift assignments (workspace-scoped)
  machines: {
    list: (wsId: string) => `workspaces/${wsId}/machines`,
    create: (wsId: string) => `workspaces/${wsId}/machines`,
    get: (wsId: string, id: string) => `workspaces/${wsId}/machines/${id}`,
    update: (wsId: string, id: string) => `workspaces/${wsId}/machines/${id}`,
    delete: (wsId: string, id: string) => `workspaces/${wsId}/machines/${id}`,
    statusCounts: (wsId: string) => `workspaces/${wsId}/machines/status-counts`,
    peekCode: (wsId: string) => `workspaces/${wsId}/machines/peek-next-code`,
    byMember: (wsId: string, memberId: string) =>
      `workspaces/${wsId}/machines/by-member/${memberId}`,
    assignments: (wsId: string, machineId: string) =>
      `workspaces/${wsId}/machines/${machineId}/assignments`,
    assignment: (wsId: string, machineId: string, assignmentId: string) =>
      `workspaces/${wsId}/machines/${machineId}/assignments/${assignmentId}`,
    productionLogs: {
      list: (wsId: string, machineId: string) =>
        `workspaces/${wsId}/machines/${machineId}/production-logs`,
      listWorkspace: (wsId: string) => `workspaces/${wsId}/machines/production-logs`,
      peekCode: (wsId: string) => `workspaces/${wsId}/machines/production-logs/peek-next-code`,
      create: (wsId: string, machineId: string) =>
        `workspaces/${wsId}/machines/${machineId}/production-logs`,
      bulkCreate: (wsId: string) => `workspaces/${wsId}/machines/production-logs/bulk`,
      update: (wsId: string, machineId: string, logId: string) =>
        `workspaces/${wsId}/machines/${machineId}/production-logs/${logId}`,
      delete: (wsId: string, machineId: string, logId: string) =>
        `workspaces/${wsId}/machines/${machineId}/production-logs/${logId}`,
    },
    downtime: {
      list: (wsId: string, machineId: string) =>
        `workspaces/${wsId}/machines/${machineId}/downtime`,
      listWorkspace: (wsId: string) => `workspaces/${wsId}/machines/downtime`,
      active: (wsId: string, machineId: string) =>
        `workspaces/${wsId}/machines/${machineId}/downtime/active`,
      peekCode: (wsId: string) => `workspaces/${wsId}/machines/downtime/peek-next-code`,
      create: (wsId: string, machineId: string) =>
        `workspaces/${wsId}/machines/${machineId}/downtime`,
      close: (wsId: string, machineId: string, entryId: string) =>
        `workspaces/${wsId}/machines/${machineId}/downtime/${entryId}/close`,
      update: (wsId: string, machineId: string, entryId: string) =>
        `workspaces/${wsId}/machines/${machineId}/downtime/${entryId}`,
      delete: (wsId: string, machineId: string, entryId: string) =>
        `workspaces/${wsId}/machines/${machineId}/downtime/${entryId}`,
      reasons: (wsId: string) => `workspaces/${wsId}/machines/downtime/reasons`,
    },
    maintenance: {
      schedules: {
        list: (wsId: string, mId: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/schedules`,
        create: (wsId: string, mId: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/schedules`,
        get: (wsId: string, mId: string, id: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/schedules/${id}`,
        update: (wsId: string, mId: string, id: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/schedules/${id}`,
        pause: (wsId: string, mId: string, id: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/schedules/${id}/pause`,
        delete: (wsId: string, mId: string, id: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/schedules/${id}`,
      },
      serviceLogs: {
        list: (wsId: string, mId: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/service-logs`,
        create: (wsId: string, mId: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/service-logs`,
        get: (wsId: string, mId: string, id: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/service-logs/${id}`,
        update: (wsId: string, mId: string, id: string) =>
          `workspaces/${wsId}/machines/${mId}/maintenance/service-logs/${id}`,
      },
      due: (wsId: string) => `workspaces/${wsId}/maintenance/due`,
      leadTime: (wsId: string) => `workspaces/${wsId}/maintenance/lead-time`,
    },
  },

  // Shop Floor - Work Orders (orders + process-step DAG, steps embedded).
  // All routes sit under `machines/shop-floor/...` (extra static segment) so
  // the BE `machines/:machineId` route can never shadow them - see the prefix
  // comment on WorkOrdersController in crewroster-backend. Consumed by
  // app/dashboard/machines/shop-floor via lib/actions/work-orders.actions.ts.
  workOrders: {
    // Floors-within-a-location + people links for the Setup wizard.
    configList: (wsId: string) => `workspaces/${wsId}/machines/shop-floor/config`,
    configUpsert: (wsId: string) => `workspaces/${wsId}/machines/shop-floor/config`,
    list: (wsId: string) => `workspaces/${wsId}/machines/shop-floor/work-orders`,
    create: (wsId: string) => `workspaces/${wsId}/machines/shop-floor/work-orders`,
    update: (wsId: string, orderId: string) =>
      `workspaces/${wsId}/machines/shop-floor/work-orders/${orderId}`,
    delete: (wsId: string, orderId: string) =>
      `workspaces/${wsId}/machines/shop-floor/work-orders/${orderId}`,
    addStep: (wsId: string, orderId: string) =>
      `workspaces/${wsId}/machines/shop-floor/work-orders/${orderId}/steps`,
    updateStep: (wsId: string, orderId: string, stepId: string) =>
      `workspaces/${wsId}/machines/shop-floor/work-orders/${orderId}/steps/${stepId}`,
    deleteStep: (wsId: string, orderId: string, stepId: string) =>
      `workspaces/${wsId}/machines/shop-floor/work-orders/${orderId}/steps/${stepId}`,
    addEntry: (wsId: string, orderId: string, stepId: string) =>
      `workspaces/${wsId}/machines/shop-floor/work-orders/${orderId}/steps/${stepId}/entries`,
    deleteEntry: (wsId: string, orderId: string, stepId: string, entryId: string) =>
      `workspaces/${wsId}/machines/shop-floor/work-orders/${orderId}/steps/${stepId}/entries/${entryId}`,
  },

  // Phase 25 - Production Utilisation Dashboard (read-only analytics)
  // Mirrors backend DashboardProductionUtilisationController routes.
  // Static routes declared before dynamic :machineId/trend (see controller invariant).
  utilisation: {
    kpis: (wsId: string) => `workspaces/${wsId}/dashboard/production-utilisation/kpis`,
    heatmap: (wsId: string) => `workspaces/${wsId}/dashboard/production-utilisation/heatmap`,
    export: (wsId: string) => `workspaces/${wsId}/dashboard/production-utilisation/export`,
    trend: (wsId: string, machineId: string) =>
      `workspaces/${wsId}/dashboard/production-utilisation/${machineId}/trend`,
  },

  // Resource Scopes - row-level filter layered on dynamic RBAC.
  resourceScopes: {
    list: (wsId: string) => `workspaces/${wsId}/resource-scopes`,
    create: (wsId: string) => `workspaces/${wsId}/resource-scopes`,
    get: (wsId: string, id: string) => `workspaces/${wsId}/resource-scopes/${id}`,
    update: (wsId: string, id: string) => `workspaces/${wsId}/resource-scopes/${id}`,
    delete: (wsId: string, id: string) => `workspaces/${wsId}/resource-scopes/${id}`,
    me: (wsId: string) => `workspaces/${wsId}/resource-scopes/me`,
  },

  // Finance Module
  finance: {
    firms: (wsId: string) => `workspaces/${wsId}/finance/firms`,
    currentFirm: (wsId: string) => `workspaces/${wsId}/finance/firms/current`,
    ensureFirm: (wsId: string) => `workspaces/${wsId}/finance/firms/ensure`,
    firm: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}`,
    firmBranding: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/branding`,
    firmInvoiceLayout: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/invoice-layout`,
    firmBooksLock: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/books-lock`,
    // D15 platform-global GST rate tables (national rates, not workspace-scoped).
    gstRateHistory: (hsnPrefix: string) =>
      `finance/gst-rate-history/${encodeURIComponent(hsnPrefix)}`,
    gstRateRevise: 'finance/gst-rate-history/revise',
    // R6: browse-all (paginated) rate registry for the admin editor's default table.
    gstRateList: 'finance/gst-rate-history',
    firmGstins: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/gstins`,
    firmWizardStep: (wsId: string, firmId: string, step: number) =>
      `workspaces/${wsId}/finance/firms/${firmId}/wizard/step${step}`,
    // 4a recurring expenses
    recurringExpenses: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/expenses/recurring`,
    recurringExpense: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/expenses/recurring/${id}`,
    recurringExpenseAction: (wsId: string, firmId: string, id: string, action: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/expenses/recurring/${id}/${action}`,
    accounts: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/accounts`,
    account: (wsId: string, firmId: string, accountId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/accounts/${accountId}`,
    accountOpeningBalance: (wsId: string, firmId: string, accountId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/accounts/${accountId}/opening-balance`,
    parties: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/parties`,
    party: (wsId: string, firmId: string, partyId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/parties/${partyId}`,
    items: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/items`,
    item: (wsId: string, firmId: string, itemId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/items/${itemId}`,
    voucherSeries: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/voucher-series`,
    voucherSeriesItem: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/voucher-series/${id}`,
    accountantInvites: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/accountant-invites`,
    accountantInvite: (wsId: string, firmId: string, inviteId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/accountant-invites/${inviteId}`,
    // Accept link from the invite email. Not workspace-scoped: the signed-in
    // user accepts via the token; the BE binds it to them (SEC-3, email-matched).
    acceptAccountantInvite: (token: string) =>
      `finance/accept-invite?token=${encodeURIComponent(token)}`,
    cashRegisters: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/cash-registers`,
    gstinLookup: (wsId: string) => `workspaces/${wsId}/finance/gstin-lookup`,
    recycleBin: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/recycle-bin`,
    recycleBinRestore: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/recycle-bin/${id}/restore`,
    recycleBinPermanent: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/recycle-bin/${id}/permanent`,
    setupChecklist: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/setup-checklist`,

    // Sales - F-02
    sales: {
      quotations: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations/${id}/cancel`,
        clone: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations/${id}/clone`,
        send: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations/${id}/send`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/quotations/${id}`,
      },
      orders: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders/${id}/cancel`,
        clone: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders/${id}/clone`,
        send: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders/${id}/send`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/orders/${id}`,
      },
      proforma: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma/${id}/cancel`,
        clone: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma/${id}/clone`,
        send: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma/${id}/send`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/proforma/${id}`,
      },
      deliveryChallans: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans/${id}/cancel`,
        clone: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans/${id}/clone`,
        send: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans/${id}/send`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/delivery-challans/${id}`,
        // e-Way bill for a posted challan -> BE EwaybillController POST
        // /ewaybill/challan/:challanId/generate (note: NOT under /finance/, like GST controllers).
        ewaybill: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/firms/${firmId}/ewaybill/challan/${id}/generate`,
      },
      invoices: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/cancel`,
        clone: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/clone`,
        send: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/send`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}`,
        // D-26: server-side KPI aggregation endpoint - returns totals + top 3 pending parties
        kpiSummary: (wsId: string, firmId: string, dateFrom?: string, dateTo?: string) => {
          const q = new URLSearchParams();
          if (dateFrom) q.set('dateFrom', dateFrom);
          if (dateTo) q.set('dateTo', dateTo);
          const qs = q.toString();
          return `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/kpi-summary${qs ? `?${qs}` : ''}`;
        },
        // 2b: HSN rate-master lookup to default/warn the tax rate at line entry.
        gstRate: (wsId: string, firmId: string, hsn: string, date?: string) => {
          const q = new URLSearchParams();
          q.set('hsn', hsn);
          if (date) q.set('date', date);
          return `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/gst-rate?${q.toString()}`;
        },
        // 1c: server-rendered Noto-font PDF for gu/hi script print/download.
        pdf: (wsId: string, firmId: string, id: string, locale?: string, theme?: string) => {
          const q = new URLSearchParams();
          if (locale) q.set('locale', locale);
          if (theme) q.set('theme', theme);
          const qs = q.toString();
          return `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/pdf${qs ? `?${qs}` : ''}`;
        },
        approve: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/approve`,
        reject: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/reject`,
        einvoice: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/einvoice`,
        ewaybill: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/ewaybill`,
        print: (wsId: string, firmId: string, id: string, template?: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/print${template ? `?template=${template}` : ''}`,
        lateFeeOverride: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/invoices/${id}/late-fee-override`,
      },
      recurring: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring/${id}`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring/${id}`,
        pause: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring/${id}/pause`,
        resume: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring/${id}/resume`,
        trigger: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/sales/recurring/${id}/trigger`,
      },
      convert: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/sales/convert`,
    },

    // Payments-In + Party Ledger - F-03
    payments: {
      receipts: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/payments/receipts`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/payments/receipts`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/payments/receipts/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/payments/receipts/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/payments/receipts/${id}/cancel`,
      },
      partyLedger: (wsId: string, firmId: string, partyId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/parties/${partyId}/ledger`,
      outstandingInvoices: (wsId: string, firmId: string, partyId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/parties/${partyId}/outstanding-invoices`,
      agingBuckets: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/receivables/aging`,
      receivablesSummary: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/receivables/summary`,
    },

    // Purchases - F-04
    purchases: {
      orders: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/orders`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/orders`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/orders/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/orders/${id}`,
        confirm: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/orders/${id}/confirm`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/orders/${id}/cancel`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/orders/${id}`,
      },
      grn: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/grn`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/grn`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/grn/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/grn/${id}`,
        confirm: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/grn/${id}/confirm`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/grn/${id}/cancel`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/grn/${id}`,
      },
      bills: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/bills`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/bills`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/bills/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/bills/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/bills/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/bills/${id}/cancel`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/bills/${id}`,
      },
      paymentsOut: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payments-out`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payments-out`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payments-out/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payments-out/${id}`,
        post: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payments-out/${id}/post`,
        cancel: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payments-out/${id}/cancel`,
      },
      capitalGoodsItc: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/capital-goods-itc`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/capital-goods-itc/${id}`,
      },
      payables: {
        aging: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payables/aging`,
        summary: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/purchases/payables/summary`,
      },
    },

    // OCR - F-04
    ocr: {
      uploadVendorBill: (wsId: string) => `workspaces/${wsId}/finance/ocr/upload-vendor-bill`,
    },

    // Fixed Assets - F-05
    fixedAssets: {
      categories: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/categories`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/categories`,
        seedDefaults: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/categories/seed-defaults`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/categories/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/categories/${id}`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/categories/${id}`,
      },
      assets: {
        list: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets`,
        create: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets`,
        get: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}`,
        update: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}`,
        delete: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}`,
        verify: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/verify`,
        fromPurchaseBill: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/from-purchase-bill`,
      },
      depreciation: {
        run: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/depreciation/run`,
        preview: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/depreciation/preview`,
        listRuns: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/depreciation/runs`,
        getRun: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/depreciation/runs/${id}`,
      },
      disposal: {
        preview: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/disposal/preview`,
        dispose: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/disposal`,
        transfer: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/transfer`,
      },
      links: {
        linkMachine: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/link-machine`,
        unlinkMachine: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/link-machine`,
        itcSchedule: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/itc-schedule`,
        machine: (wsId: string, firmId: string, id: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/${id}/machine`,
      },
      // Fixed Asset Reports - F-05-06
      reports: {
        assetRegister: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/reports/asset-register`,
        depreciationSchedule: (wsId: string, firmId: string, assetId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/reports/depreciation-schedule/${assetId}`,
        blockSummary: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/reports/block-summary`,
        additionsDisposals: (wsId: string, firmId: string) =>
          `workspaces/${wsId}/finance/firms/${firmId}/fixed-assets/reports/additions-disposals`,
      },
    },

    // Expenses - F-06
    expenses: {
      list: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/expenses`,
      get: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/expenses/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/expenses`,
      update: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/expenses/${id}`,
      post: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/expenses/${id}/post`,
      cancel: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/expenses/${id}/cancel`,
    },

    // Returns - F-07 (Credit Notes, Debit Notes, GRN Returns)
    creditNotes: {
      list: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/credit-notes`,
      detail: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/credit-notes/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/credit-notes`,
      update: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/credit-notes/${id}`,
      post: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/credit-notes/${id}/post`,
      cancel: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/credit-notes/${id}/cancel`,
      byInvoice: (wsId: string, firmId: string, invoiceId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/credit-notes/by-invoice/${invoiceId}`,
      // Credit-note IRN -> BE EInvoiceController (under /firms/ NOT /finance/, like GST controllers).
      einvoice: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/firms/${firmId}/einvoice/credit-note/${id}/generate`,
      einvoiceQr: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/firms/${firmId}/einvoice/credit-note/${id}/qr`,
      einvoiceCancel: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/firms/${firmId}/einvoice/credit-note/${id}/cancel`,
    },
    debitNotes: {
      list: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/debit-notes`,
      detail: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/debit-notes/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/debit-notes`,
      update: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/debit-notes/${id}`,
      post: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/debit-notes/${id}/post`,
      cancel: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/debit-notes/${id}/cancel`,
      byBill: (wsId: string, firmId: string, billId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/debit-notes/by-bill/${billId}`,
    },
    grnReturns: {
      list: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/grn-returns`,
      detail: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/grn-returns/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/grn-returns`,
      update: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/grn-returns/${id}`,
      dispatch: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/grn-returns/${id}/dispatch`,
      confirm: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/grn-returns/${id}/confirm`,
      cancel: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/grn-returns/${id}/cancel`,
    },

    // Journal Vouchers - F-06
    journalVouchers: {
      list: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/journal-vouchers`,
      get: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/journal-vouchers/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/journal-vouchers`,
      post: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/journal-vouchers/${id}/post`,
      cancel: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/journal-vouchers/${id}/cancel`,
    },

    // Contras - F-06
    contras: {
      list: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/contras`,
      get: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/contras/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/contras`,
    },

    // Cash Register extended actions - F-06
    cashRegisterActions: {
      dayEndTally: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cash-registers/${id}/day-end-tally`,
      replenish: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cash-registers/${id}/replenish`,
      lowWaterAlerts: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cash-registers/low-water-alerts`,
    },

    // Bank Accounts - F-06-07
    bankAccounts: {
      list: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts`,
      get: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts`,
      update: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${id}`,
      delete: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${id}`,
      statement: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${id}/statement`,
      setDefault: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${id}/set-default`,
      getDefault: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/default`,
    },

    // Cheques (PDC lifecycle) - F-06-07
    cheques: {
      list: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/cheques`,
      get: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques`,
      deposit: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/${id}/deposit`,
      present: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/${id}/deposit`,
      clear: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/${id}/clear`,
      bounce: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/${id}/bounce`,
      stop: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/${id}/stop`,
      voidCheque: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/${id}/void`,
      pdcMaturityAlerts: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/cheques/pdc-maturity-alerts`,
    },

    // Loan Accounts (term/OD/CC + amortisation) - F-06-07
    loans: {
      list: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts`,
      get: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts/${id}`,
      create: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts`,
      schedule: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts/${id}/schedule`,
      prepay: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts/${id}/prepay`,
      runEmi: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts/${id}/run-emi`,
      close: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts/${id}/close`,
      delete: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts/${id}`,
      previewSchedule: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/loan-accounts/preview-schedule`,
    },

    // Reminder Engine - F-08
    reminders: {
      base: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/reminders`,
      settings: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/reminder-settings`,
      rules: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/reminder-rules`,
      rule: (wsId: string, firmId: string, ruleId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/reminder-rules/${ruleId}`,
      templates: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/reminder-templates`,
      logs: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/reminder-logs`,
      trigger: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/reminders/trigger`,
    },

    // Call Todos - F-08
    callTodos: {
      list: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/call-todos`,
      todo: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/call-todos/${id}`,
      count: (wsId: string, firmId: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/call-todos/count`,
      snooze: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/call-todos/${id}/snooze`,
      complete: (wsId: string, firmId: string, id: string) =>
        `workspaces/${wsId}/finance/firms/${firmId}/call-todos/${id}/complete`,
    },
  },
} as const;

// ============ F-09 Inventory endpoints ============
export const inventory = {
  // Godowns
  godowns: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/godowns`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/godowns`,
    detail: (wsId: string, firmId: string, gId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/godowns/${gId}`,
    update: (wsId: string, firmId: string, gId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/godowns/${gId}`,
    remove: (wsId: string, firmId: string, gId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/godowns/${gId}`,
  },
  stockSummary: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/stock-summary`,
    forItem: (wsId: string, firmId: string, itemId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/stock-summary/${itemId}`,
  },
  movements: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/stock-movements`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/stock-movements/${id}`,
  },
  lots: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/lots`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/lots`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/lots/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/lots/${id}`,
    remove: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/lots/${id}`,
    movements: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/lots/${id}/movements`,
  },
  batches: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/batches`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/batches`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/batches/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/batches/${id}`,
    remove: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/batches/${id}`,
  },
  serials: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/serials`,
    detail: (wsId: string, firmId: string, serialNo: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/serials/${serialNo}`,
    update: (wsId: string, firmId: string, serialNo: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/serials/${serialNo}`,
  },
  transfers: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/transfers`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/transfers`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/transfers/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/transfers/${id}`,
    post: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/transfers/${id}/post`,
    remove: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/transfers/${id}`,
  },
  wastage: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/wastage`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/wastage`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/wastage/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/wastage/${id}`,
    post: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/wastage/${id}/post`,
    remove: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/wastage/${id}`,
  },
  samples: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples/${id}`,
    post: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples/${id}/post`,
    accept: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples/${id}/accept`,
    return: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples/${id}/return`,
    remove: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/inventory/samples/${id}`,
  },
  itemLabel: (wsId: string, firmId: string, itemId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/inventory/items/${itemId}/label`,
  cessRules: {
    list: () => `finance/cess-rules`,
    upsert: () => `finance/cess-rules`,
    deactivate: (id: string) => `finance/cess-rules/${id}`,
  },
};

// ============ F-11 Job-Work endpoints ============
export const jobWork = {
  inwardChallans: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/inward-challans`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/inward-challans`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/inward-challans/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/inward-challans/${id}`,
    post: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/inward-challans/${id}/post`,
    cancel: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/inward-challans/${id}/cancel`,
  },
  outwardChallans: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/outward-challans`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/outward-challans`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/outward-challans/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/outward-challans/${id}`,
    post: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/outward-challans/${id}/post`,
    cancel: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/outward-challans/${id}/cancel`,
  },
  invoices: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/invoices`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/invoices`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/invoices/${id}`,
    update: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/invoices/${id}`,
    post: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/invoices/${id}/post`,
    cancel: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/invoices/${id}/cancel`,
  },
  lots: {
    list: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/jw/lots`,
    detail: (wsId: string, firmId: string, id: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/lots/${id}`,
  },
  itc04: {
    report: (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/jw/itc04`,
    export: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/jw/itc04/export`,
  },
};

// Karigar profile patch endpoint (extends existing team endpoints)
export const karigarProfile = {
  update: (wsId: string, memberId: string) => `workspaces/${wsId}/team/${memberId}/karigar`,
};

// ============ F-12 GST Compliance endpoints ============
export const gst = {
  gstr1: {
    report: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/gstr1`,
    validate: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/gstr1/validate`,
    export: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/gstr1/export`,
  },
  gstr3b: {
    report: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/gstr3b`,
    adjustments: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/gstr3b/adjustments`,
    export: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/gstr3b/export`,
  },
  // GSTR-2B (ITC) reconciliation. Cross-link: BE Gstr2bController POST /reconcile.
  gstr2b: {
    reconcile: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/gstr2b/reconcile`,
  },
  einvoice: {
    prepareSession: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/prepare-session`,
    completeSession: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/complete-session`,
    generate: (wsId: string, firmId: string, invoiceId: string) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/${invoiceId}/generate`,
    cancel: (wsId: string, firmId: string, invoiceId: string) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/${invoiceId}/cancel`,
    batchGenerate: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/batch-generate`,
    pending: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/pending`,
    list: (wsId: string, firmId: string, status: string, page = 0, size = 50) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/list?status=${status}&page=${page}&size=${size}`,
    qr: (wsId: string, firmId: string, invoiceId: string) =>
      `workspaces/${wsId}/firms/${firmId}/einvoice/${invoiceId}/qr`,
  },
  ewaybill: {
    generate: (wsId: string, firmId: string, invoiceId: string) =>
      `workspaces/${wsId}/firms/${firmId}/ewaybill/${invoiceId}/generate`,
    extend: (wsId: string, firmId: string, invoiceId: string) =>
      `workspaces/${wsId}/firms/${firmId}/ewaybill/${invoiceId}/extend`,
    cancel: (wsId: string, firmId: string, invoiceId: string) =>
      `workspaces/${wsId}/firms/${firmId}/ewaybill/${invoiceId}/cancel`,
    expiring: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/ewaybill/expiring`,
    list: (wsId: string, firmId: string, status: string, page = 0, size = 50) =>
      `workspaces/${wsId}/firms/${firmId}/ewaybill/list?status=${status}&page=${page}&size=${size}`,
  },
  verifyData: {
    run: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/verify-data/run`,
    results: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/firms/${firmId}/verify-data/results`,
  },
  itc04: {
    report: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/itc04`,
    export: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/itc04/export`,
  },
  firmConfig: {
    updateGstConfig: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/gst-config`,
  },
};

// ============ F-13 Bank Reconciliation endpoints ============
export const financeBankReconciliation = {
  uploadStatement: (wsId: string, firmId: string, bankAccountId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/statements/upload`,
  confirmStatement: (wsId: string, firmId: string, bankAccountId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/statements/confirm`,
  listStatements: (wsId: string, firmId: string, bankAccountId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/statements`,
  getStatement: (wsId: string, firmId: string, bankAccountId: string, statementId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/statements/${statementId}`,
  deleteStatement: (wsId: string, firmId: string, bankAccountId: string, statementId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/statements/${statementId}`,
  listSessions: (wsId: string, firmId: string, bankAccountId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions`,
  getSession: (wsId: string, firmId: string, bankAccountId: string, sessionId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}`,
  listRows: (wsId: string, firmId: string, bankAccountId: string, sessionId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/rows`,
  autoMatch: (wsId: string, firmId: string, bankAccountId: string, sessionId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/auto-match`,
  manualMatch: (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/rows/${rowId}/match`,
  bulkMatch: (wsId: string, firmId: string, bankAccountId: string, sessionId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/bulk-match`,
  unmatch: (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/rows/${rowId}/unmatch`,
  createVoucher: (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/rows/${rowId}/create-voucher`,
  excludeRow: (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/rows/${rowId}/exclude`,
  unexcludeRow: (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/rows/${rowId}/unexclude`,
  candidates: (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/rows/${rowId}/candidates`,
  complete: (wsId: string, firmId: string, bankAccountId: string, sessionId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/complete`,
  report: (wsId: string, firmId: string, bankAccountId: string, sessionId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/bank-accounts/${bankAccountId}/reconciliation/sessions/${sessionId}/report`,
};

// ============ F-14 Finance Reports endpoints ============
export const financeReports = {
  // Statutory Financial Reports
  trialBalance: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/trial-balance?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  profitLoss: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/profit-loss?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  profitLossComparison: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/profit-loss-comparison?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  balanceSheet: (wsId: string, firmId: string, asOfDate: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/balance-sheet?asOfDate=${asOfDate}`,
  cashFlow: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/cash-flow?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  ratioAnalysis: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/ratio-analysis?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  ebitda: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/ebitda?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  // Dashboard
  dashboardKpis: (wsId: string, firmId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/dashboard/kpis`,
  revenueTrend: (wsId: string, firmId: string, mode = 'current_fy') =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/dashboard/revenue-trend?mode=${mode}`,
  // PowerBI-style accounting dashboard: one aggregate call backing AccountingInsights
  // (finance dashboard) + AccountingSummaryStrip (main dashboard). Params are all
  // optional; build the querystring only from provided keys so the BE applies its
  // current-FY defaults when omitted. Returns AccountingDashboardResponse.
  accountingDashboard: (
    wsId: string,
    firmId: string,
    params?: { dateFrom?: string; dateTo?: string; asOfDate?: string },
  ) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.asOfDate) qs.set('asOfDate', params.asOfDate);
    const query = qs.toString();
    return `workspaces/${wsId}/finance/firms/${firmId}/reports/dashboard/accounting${query ? `?${query}` : ''}`;
  },
  // GST Registers
  gstOutputRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/output-register?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  gstInputRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/input-register?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  itcReconciliation: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/itc-reconciliation?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  capitalGoodsItc: (wsId: string, firmId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/capital-goods-itc`,
  einvoiceRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/einvoice-register?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  ewbRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/ewb-register?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  lateFeeRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/late-fee-register?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  gstr1: (wsId: string, firmId: string, period: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/gstr1?period=${period}`,
  gstr3b: (wsId: string, firmId: string, period: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/gst/gstr3b?period=${period}`,
  // Party & Ledger
  partyStatement: (
    wsId: string,
    firmId: string,
    partyId: string,
    dateFrom: string,
    dateTo: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/party-statement?partyId=${partyId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  accountLedger: (
    wsId: string,
    firmId: string,
    accountCode: string,
    dateFrom: string,
    dateTo: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/account-ledger?accountCode=${accountCode}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  daybook: (
    wsId: string,
    firmId: string,
    dateFrom: string,
    dateTo: string,
    page = 1,
    limit = 100,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/daybook?dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page}&limit=${limit}`,
  receivablesAging: (wsId: string, firmId: string, asOfDate?: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/receivables-aging${asOfDate ? `?asOfDate=${asOfDate}` : ''}`,
  payablesAging: (wsId: string, firmId: string, asOfDate?: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/payables-aging${asOfDate ? `?asOfDate=${asOfDate}` : ''}`,
  partyPl: (wsId: string, firmId: string, partyId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/party-pl?partyId=${partyId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  brokerCommission: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/broker-commission?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  register: (
    wsId: string,
    firmId: string,
    type: string,
    dateFrom: string,
    dateTo: string,
    page = 1,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/registers/${type}?dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page}`,
  partyWisePl: (
    wsId: string,
    firmId: string,
    dateFrom: string,
    dateTo: string,
    partyType?: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/party-wise-pl?dateFrom=${dateFrom}&dateTo=${dateTo}${partyType ? `&partyType=${partyType}` : ''}`,
  // Inventory
  inventoryStockSummary: (wsId: string, firmId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/inventory/stock-summary`,
  itemLedger: (wsId: string, firmId: string, itemId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/inventory/item-ledger?itemId=${itemId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  itemProfitability: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/inventory/item-profitability?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  godownStock: (wsId: string, firmId: string, godownId?: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/inventory/godown-stock${godownId ? `?godownId=${godownId}` : ''}`,
  wastageRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/inventory/wastage?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  // Manufacturing
  mvRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/manufacturing/mv-register?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  jobWorkPending: (wsId: string, firmId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/manufacturing/job-work-pending`,
  karigarProductivity: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/manufacturing/karigar-productivity?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  machineOutput: (
    wsId: string,
    firmId: string,
    dateFrom: string,
    dateTo: string,
    machineId?: string,
  ) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/manufacturing/machine-output?dateFrom=${dateFrom}&dateTo=${dateTo}${machineId ? `&machineId=${machineId}` : ''}`,
  // Fixed Assets
  fixedAssetRegister: (wsId: string, firmId: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/fixed-assets/register`,
  depreciationSchedule: (wsId: string, firmId: string, assetId?: string) =>
    `workspaces/${wsId}/finance/firms/${firmId}/reports/fixed-assets/depreciation-schedule${assetId ? `?assetId=${assetId}` : ''}`,
};

// ============ Phase 16 / FIN-15-01 Tally Export endpoints ============
// Backend mounts the controller at `/workspaces/:wsId/tally-export` (per Plan 02
// rebase to the workspace-scoped pattern; firmId travels in the body / query).
export const tallyExport = {
  generate: (wsId: string) => `workspaces/${wsId}/tally-export`,
  validator: (wsId: string, firmId: string, fromDate: string, toDate: string) =>
    `workspaces/${wsId}/tally-export/validator-report?firmId=${firmId}&fromDate=${fromDate}&toDate=${toDate}`,
  recent: (wsId: string, firmId: string, limit = 10) =>
    `workspaces/${wsId}/tally-export/recent?firmId=${firmId}&limit=${limit}`,
};

// ============ F-10 Manufacturing endpoints ============
export const manufacturing = {
  bom: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/bom`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/bom`,
    detail: (wsId: string, firmId: string, bomId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/bom/${bomId}`,
    update: (wsId: string, firmId: string, bomId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/bom/${bomId}`,
    remove: (wsId: string, firmId: string, bomId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/bom/${bomId}`,
    explosion: (wsId: string, firmId: string, bomId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/bom/${bomId}/explosion`,
    stdCost: (wsId: string, firmId: string, bomId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/bom/${bomId}/standard-cost`,
  },
  vouchers: {
    list: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers`,
    create: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers`,
    detail: (wsId: string, firmId: string, mvId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers/${mvId}`,
    update: (wsId: string, firmId: string, mvId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers/${mvId}`,
    issue: (wsId: string, firmId: string, mvId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers/${mvId}/issue`,
    complete: (wsId: string, firmId: string, mvId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers/${mvId}/complete`,
    cancel: (wsId: string, firmId: string, mvId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers/${mvId}/cancel`,
    register: (wsId: string, firmId: string) =>
      `workspaces/${wsId}/finance/firms/${firmId}/manufacturing/manufacturing-vouchers/register`,
  },
};

// ============ Phase 16 / FIN-15-02 Fiscal Year Close endpoints ============
// Backend mounts the controller at
//   /workspaces/:wsId/firms/:firmId/fiscal-year
// (per Plan 03 - workspace + firm scoped per repo convention).
export const fiscalYear = {
  list: (wsId: string, firmId: string) => `workspaces/${wsId}/firms/${firmId}/fiscal-year`,
  current: (wsId: string, firmId: string) =>
    `workspaces/${wsId}/firms/${firmId}/fiscal-year/current`,
  health: (wsId: string, firmId: string, fyId: string) =>
    `workspaces/${wsId}/firms/${firmId}/fiscal-year/${fyId}/health-checks`,
  close: (wsId: string, firmId: string, fyId: string) =>
    `workspaces/${wsId}/firms/${firmId}/fiscal-year/${fyId}/close`,
  reopen: (wsId: string, firmId: string, fyId: string) =>
    `workspaces/${wsId}/firms/${firmId}/fiscal-year/${fyId}/reopen`,
};

// ============ Phase 16 / FIN-15-03 Customer Portal Tokens endpoints ============
// Backend mounts the controller at
//   /workspaces/:wsId/finance/parties/:partyId/portal-tokens
// (per Plan 04 SUMMARY deviation #1 - workspace-scoped per repo convention;
//  firmId derives from the loaded Party document inside the controller).
export const portalTokens = {
  list: (wsId: string, partyId: string) =>
    `workspaces/${wsId}/finance/parties/${partyId}/portal-tokens`,
  issue: (wsId: string, partyId: string) =>
    `workspaces/${wsId}/finance/parties/${partyId}/portal-tokens`,
  revoke: (wsId: string, partyId: string, jti: string) =>
    `workspaces/${wsId}/finance/parties/${partyId}/portal-tokens/${jti}`,
  revokeAll: (wsId: string, partyId: string) =>
    `workspaces/${wsId}/finance/parties/${partyId}/portal-tokens`,
  share: (wsId: string, partyId: string, jti: string) =>
    `workspaces/${wsId}/finance/parties/${partyId}/portal-tokens/${jti}/share`,
};

// ============ Phase 17 / FIN-16 Party Intelligence + CRM endpoints ============
// Workspace-scoped per repo convention. Wave-1 Plans 03/04/05/06 implement
// the controllers; this exports URL builders so web actions/api wrappers can
// reference them.

export const partyIntelligence = {
  get: (wsId: string, partyId: string) => `workspaces/${wsId}/parties/${partyId}/intelligence`,
  setBlacklist: (wsId: string, partyId: string) =>
    `workspaces/${wsId}/parties/${partyId}/intelligence/blacklist`,
  clearBlacklist: (wsId: string, partyId: string) =>
    `workspaces/${wsId}/parties/${partyId}/intelligence/blacklist`,
  manualSegment: (wsId: string, partyId: string) =>
    `workspaces/${wsId}/parties/${partyId}/intelligence/manual-segment`,
  recheckGstin: (wsId: string, partyId: string) =>
    `workspaces/${wsId}/parties/${partyId}/intelligence/recheck-gstin`,
  rerunRfm: (wsId: string) => `workspaces/${wsId}/parties/intelligence/rerun-rfm`,
};

export const partyTimeline = {
  list: (wsId: string, partyId: string) => `workspaces/${wsId}/parties/${partyId}/timeline`,
  create: (wsId: string, partyId: string) => `workspaces/${wsId}/parties/${partyId}/timeline`,
  update: (wsId: string, partyId: string, eventId: string) =>
    `workspaces/${wsId}/parties/${partyId}/timeline/${eventId}`,
  delete: (wsId: string, partyId: string, eventId: string) =>
    `workspaces/${wsId}/parties/${partyId}/timeline/${eventId}`,
};

export const partyPnlReport = {
  get: (wsId: string, partyId: string) => `workspaces/${wsId}/reports/parties/${partyId}/pnl`,
};

export const partyIntelligenceSettings = {
  get: (wsId: string) => `workspaces/${wsId}/settings/party-intelligence`,
  update: (wsId: string) => `workspaces/${wsId}/settings/party-intelligence`,
  upcomingGreetings: (wsId: string) =>
    `workspaces/${wsId}/settings/party-intelligence/upcoming-greetings`,
};
