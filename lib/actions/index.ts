/**
 * Server Actions - Public barrel export
 *
 * Usage in client components:
 *   import { login, register } from '@/lib/actions';
 *   import { listTeam, createTeamMember } from '@/lib/actions';
 *
 * All functions run server-side - backend URL never reaches the browser.
 */
export { syncAuthCookie, clearAuthCookie } from './cookies';

export {
  checkUser,
  login,
  register,
  googleAuth,
  forgotPassword,
  resetPassword,
  changePasswordAfterForgot,
  sendVerificationEmail,
  verifyEmail,
  getMe,
  logout,
  setupAdmin,
  terminateAndLoginUnauth,
  sendOtp,
  sendEmailRegistrationOtp,
  verifyOtp,
  resendOtp,
  terminateAndOtpLogin,
  sendMobileVerifyOtp,
  verifyMobile,
} from './auth.actions';
export type { OtpFlowType, SendOtpResponse } from './auth.actions';

export { getProfile, updateProfile, changePassword, setPassword } from './users.actions';

export {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  // OQ-W3 (workspace-delete undo) + OQ-W6 (auto-added leave) recovery actions.
  listDeletedWorkspaces,
  restoreWorkspace,
  leaveWorkspace,
  getWorkspaceMembers,
  inviteMember,
  inviteTeamMember,
  joinWorkspace,
  removeMember,
  changeMemberRole,
  getPendingInvitations,
  resendInvite,
  cancelInvite,
  declineWorkspaceInvite,
} from './workspaces.actions';

export {
  listTeam,
  createTeamMember,
  bulkCreateTeamMembers,
  getTeamMember,
  updateTeamMember,
  deleteTeamMember,
  grantAccess,
  getGrantContext,
  revokeTeamAccess,
  resendTeamInvite,
  changeTeamAccessRole,
  setTeamPermissionOverrides,
  acceptTeamInvite,
  offboardMember,
  bulkUpdateTeamStatus,
  bulkArchiveTeamMembers,
  bulkRestoreTeamMembers,
  restoreTeamMember,
  deleteTeamMemberPermanent,
  listMemberDocuments,
  deleteMemberDocument,
  createMemberDocument,
  getPendingBackfillCount,
  getTeamStatusCounts,
  checkTeamIdentifier,
  startMobileVerification,
  confirmMobileVerification,
} from './team.actions';
export type { TeamStatusCounts, CheckTeamIdentifierResult } from './team.actions';

export {
  listAttendance,
  getAttendanceSummary,
  markAttendance,
  bulkMarkAttendance,
  updateAttendance,
  removeAttendance,
  exportAttendance,
  listUpcomingLeaves,
  listAttendanceEvents,
  voidAttendanceEvent,
  listStaleSessions,
} from './attendance.actions';
export type { StaleSession } from './attendance.actions';

export {
  getSalaryRecords,
  generateSalary,
  ensureSalaryRecord,
  updateSalary,
  setBasePay,
  getEcrExport,
  getEsiChallanExport,
  getBankFileExport,
  getForm16Data,
  getGratuityLedger,
  getGratuitySummary,
  getSalaryAdjustments,
  createSalaryAdjustment,
  reverseSalaryAdjustment,
  lockSalaryRecord,
  unlockSalaryRecord,
  reverseSalaryPayment,
  getSalaryAdjustmentAudit,
  recordSalaryPayment,
  getSalaryPayments,
  getSalaryLedger,
  addSalaryIncrement,
  getSalaryIncrements,
  deleteSalaryIncrement,
} from './salary.actions';

export { listShifts, createShift, updateShift, deleteShift } from './shifts.actions';

export {
  listHolidays,
  listHolidaysByYear,
  createHoliday,
  createHolidaysBulk,
  updateHoliday,
  deleteHoliday,
  checkHoliday,
} from './holidays.actions';

export {
  listBills,
  createBill,
  getBill,
  updateBill,
  deleteBill,
  recordBillPayment,
} from './bills.actions';

export {
  listRoles,
  getRoleTemplates,
  createRole,
  getRole,
  updateRole,
  deleteRole,
} from './roles.actions';

export { getDashboardStats } from './stats.actions';

export {
  getPlans,
  getMySubscription,
  subscribeToPlan,
  cancelSubscription,
  getMySubscriptionHistory,
  getTiers,
  forceActivateSubscription,
  cancelScheduledSubscription,
  getTrialBannerConfig,
  getTrialState,
  startTrial,
  submitCustomPlanRequest,
  submitPlanInterestRequest,
  createPlanCheckoutOrder,
  confirmPlanCheckout,
} from './subscriptions.actions';
export type {
  TrialBannerConfig,
  TrialState,
  CustomPlanRequestPayload,
  PlanInterestRequestPayload,
  PlanCheckoutOrder,
  PlanCheckoutConfirmResult,
} from './subscriptions.actions';

export {
  // Subscription ops
  adminGrantSubscription,
  adminListUserSubscriptions,
  adminFetchSubscription,
  adminExtendPeriod,
  adminOverrideEntitlements,
  adminPauseSubscription,
  adminResumeSubscription,
  adminForceCancelSubscription,
  // Manual + payment links
  adminRecordManualPayment,
  adminIssuePaymentLink,
  adminListPaymentLinks,
  adminCancelPaymentLink,
  // Refunds
  adminListPendingRefunds,
  adminApproveRefund,
  adminRejectRefund,
  adminDirectRefund,
  adminRegenerateInvoice,
  // Coupons
  adminCreateCoupon,
  adminListCoupons,
  adminFetchCoupon,
  adminUpdateCoupon,
  adminArchiveCoupon,
  adminCouponStats,
  adminCouponAttribution,
  // Policies
  adminGetBillingPolicy,
  adminUpdateBillingPolicy,
  adminGetRefundPolicy,
  adminUpdateRefundPolicy,
  // Audit
  adminQueryAuditLog,
  // Custom plans
  adminCreateCustomPlan,
  adminListCustomPlans,
  adminFetchCustomPlan,
  adminUpdateCustomPlan,
  adminArchiveCustomPlan,
  // Mandate admin
  adminCreateMandate,
  adminCancelMandate,
  adminPauseMandate,
  adminResumeMandate,
} from './admin-billing.actions';

export {
  createCheckoutOrder,
  confirmCheckoutPayment,
  createMandate,
  cancelMandate,
  pauseMandate,
  resumeMandate,
  validateCoupons,
  autoApplyCoupon,
  listPayments,
  getInvoiceMeta,
  regenerateInvoice,
  downloadInvoice,
  requestRefund,
  listMyRefundRequests,
  getRefundRequest,
  getDunningStatus,
  getBillingProfile,
  updateBillingProfile,
} from './billing.actions';

export {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  // P2.0 - cross-workspace, user-scoped surface for bell + invitations page.
  listMyNotifications,
  getMyUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
} from './notifications.actions';

// P2.0 - /dashboard/invitations Sent + History data.
export { listMySentInvites, listMyInviteHistory } from './invites.actions';

export { submitFeedback } from './feedback.actions';
export type { FeedbackPayload, FeedbackCategory, FeedbackRecord } from './feedback.actions';

export {
  getActiveSessions,
  deleteSession,
  invalidateAllOtherSessions,
  terminateAndLogin,
} from './sessions.actions';

export {
  getAdminStats,
  getAdminUsers,
  getAdminUserDetails,
  updateUserStatus,
  deleteAdminUser,
  eraseAdminUser,
  restoreAdminUser,
  restoreUserDeletion,
  createAdminUser,
  getAdminWorkspaces,
  getAdminSubscriptions,
  getAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  deleteAdminPlan,
  getAdminUserSubscription,
  getUserSubscriptionHistory,
  adminAssignPlan,
  adminCustomAssignPlan,
  adminAssignDefaultPlan,
  adminAssignDefaultPlanToMissing,
  adminUpdateSubscription,
  adminCancelSubscription,
  adminRevokeSubscription,
  getAdminWallet,
  adminAdjustWallet,
  getUserSessions,
  adminTerminateUserSession,
  updateUserSessionLimit,
  getAdminSettings,
  updateAdminSettings,
  createTier,
  updateTier,
  deleteTier,
  getAdminWorkspaceDetail,
  updateAdminWorkspaceEmailConfig,
  testAdminWorkspaceSmtp,
  resetAdminWorkspaceEmailUsage,
  getAdminBranding,
  updateAdminBranding,
} from './admin.actions';

export {
  getAdminLanguages,
  getAdminNamespaces,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  hardDeleteLanguage,
  getAdminTranslations,
  upsertTranslation,
  deleteTranslation,
  bulkImportTranslations,
  exportTranslations,
  getTranslationDiff,
  copyFromDefault,
  getAdminPtSlabs,
  getAdminPtSlab,
  createAdminPtSlab,
  updateAdminPtSlab,
  deleteAdminPtSlab,
} from './localization.actions';
export type { Language as LocalizationLanguage, TranslationEntry } from './localization.actions';

export {
  getLegalPages,
  getLegalPage,
  createLegalPage,
  updateLegalPage,
  publishLegalPage,
  deleteLegalPage,
  getPublishedLegalPage,
} from './legal-pages.actions';
export type {
  LegalPage,
  CreateLegalPagePayload,
  UpdateLegalPagePayload,
} from './legal-pages.actions';

export {
  submitContentReport,
  listContentReports,
  actionContentReport,
  dismissContentReport,
} from './content-reports.actions';
export type {
  ContentReport,
  CreateContentReportPayload,
  ContentReportTargetType,
  ContentReportReason,
} from './content-reports.actions';

export {
  getAvailableAddOns,
  getMyAddOns,
  previewAddOnPurchase,
  purchaseAddOn,
  cancelAddOn,
  getAddOnDefinitions,
  createAddOnDefinition,
  updateAddOnDefinition,
  deleteAddOnDefinition,
  getUserAddOns,
  adminAssignAddOn,
  adminRevokeAddOn,
  // Wave 7 - credit-pack billing flow + auto-recharge config.
  createCreditPackOrder,
  confirmCreditPackPayment,
  getCreditPackHistory,
  updateAutoRechargeConfig,
} from './add-ons.actions';

// Wave 8 - admin-only MSG91 ops + cost reporting.
export {
  getMsg91Balance,
  recordMsg91TopUp,
  listMsg91TopUps,
  getMsg91MarginReport,
  getMsg91RefundQueue,
  // Wave 8.1 - manual refund
  manualRefundMsg91,
  // Wave 8.2 - pricing CRUD
  listMsg91Pricing,
  addMsg91PricingRow,
  closeMsg91PricingRow,
  // Wave 8.2 - marketing pool + bulk send
  getMarketingPools,
  topUpMarketingPool,
  getMarketingLedger,
  sendMarketingBulk,
} from './admin-communications.actions';
export type {
  Msg91BalanceStatus,
  Msg91TopUpRecord,
  Msg91MarginRow,
  Msg91RefundQueueRow,
  Msg91PricingRow,
  MarketingPoolBalances,
  MarketingLedgerRow,
  MarketingBulkSendResult,
} from './admin-communications.actions';
export type {
  CreditPackOrderResponse,
  CreditPackConfirmResponse,
  CreditPackPaymentRecord,
  AutoRechargeConfigPayload,
  AutoRechargeConfigResponse,
} from './add-ons.actions';

export {
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  peekNextLocationCode,
} from './locations.actions';

export {
  listJwInwardChallans,
  createJwInwardChallan,
  getJwInwardChallan,
  updateJwInwardChallan,
  postJwInwardChallan,
  cancelJwInwardChallan,
  listJwOutwardChallans,
  createJwOutwardChallan,
  getJwOutwardChallan,
  updateJwOutwardChallan,
  postJwOutwardChallan,
  cancelJwOutwardChallan,
  listJwInvoices,
  createJwInvoice,
  getJwInvoice,
  updateJwInvoice,
  postJwInvoice,
  cancelJwInvoice,
  listJwLots,
  getJwLot,
  getItc04Report,
  getItc04Export,
  updateKarigarProfile,
} from './finance/job-work.actions';

export {
  listMachines,
  getMachine,
  createMachine,
  updateMachine,
  deleteMachine,
  getMachineStatusCounts,
  peekNextMachineCode,
  listMachinesForMember,
  listMachineAssignments,
  createMachineAssignment,
  updateMachineAssignment,
  deleteMachineAssignment,
} from './machines.actions';

export {
  listResourceScopes,
  getResourceScope,
  getMyResourceScope,
  createResourceScope,
  updateResourceScope,
  deleteResourceScope,
} from './resource-scopes.actions';

// Shop Floor - work orders + process steps + floor setup config (machines module).
export {
  listShopFloorConfigs,
  upsertShopFloorConfig,
  listWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  addWorkOrderStep,
  updateWorkOrderStep,
  deleteWorkOrderStep,
  addWorkOrderStepEntry,
  deleteWorkOrderStepEntry,
} from './work-orders.actions';
