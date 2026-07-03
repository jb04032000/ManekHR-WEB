import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  ApplyCompOffPayload,
  ApplyLeavePayload,
  CompOffLotView,
  CompOffRequest,
  CreateDelegationPayload,
  CreateLeaveTypePayload,
  DecideLeavePayload,
  LeaveApproverDelegation,
  LeaveBalance,
  LeaveLedgerEntry,
  LeavePreviewResult,
  LeaveRequest,
  LeaveRequestSettings,
  LeaveType,
  PostAdjustmentPayload,
  UpdateLeaveSettingsPayload,
  UpdateLeaveTypePayload,
} from '@/types';

const E = ApiEndpoints.leave;

/**
 * Leave Management API client.
 *
 * L5a - leave-type catalogue CRUD (admin configuration page).
 * L5b - leave + comp-off approval inbox (workspace request queue, decide).
 * L5c - request-settings panel (approver chain) + approver delegations.
 * L5d - workspace balances admin table + HR manual adjustments.
 * L5e - team who's-on-leave calendar.
 * L6a - worker self-service: own balances, apply (live preview), history.
 * L6b - worker comp-off self-service: active lots, claim, claim history.
 */
export const leaveApi = {
  // ── Leave-type catalogue (L5a) ───────────────────────────────
  listTypes: (wsId: string, includeInactive = false) =>
    http
      .get(E.types(wsId), { params: { includeInactive: String(includeInactive) } })
      .then(unwrap<LeaveType[]>),

  createType: (wsId: string, payload: CreateLeaveTypePayload) =>
    http.post(E.types(wsId), payload).then(unwrap<LeaveType>),

  updateType: (wsId: string, id: string, payload: UpdateLeaveTypePayload) =>
    http.put(E.type(wsId, id), payload).then(unwrap<LeaveType>),

  /** Archive a leave type - soft delete (BE sets `isActive: false`). */
  deleteType: (wsId: string, id: string) => http.delete(E.type(wsId, id)).then(unwrap<LeaveType>),

  // ── Leave-request approval inbox (L5b) ───────────────────────
  listRequests: (wsId: string, status?: string) =>
    http.get(E.requests(wsId), { params: status ? { status } : {} }).then(unwrap<LeaveRequest[]>),

  getRequest: (wsId: string, id: string) =>
    http.get(E.request(wsId, id)).then(unwrap<LeaveRequest>),

  approveRequest: (wsId: string, id: string, payload: DecideLeavePayload) =>
    http.post(E.approveRequest(wsId, id), payload).then(unwrap<LeaveRequest>),

  rejectRequest: (wsId: string, id: string, payload: DecideLeavePayload) =>
    http.post(E.rejectRequest(wsId, id), payload).then(unwrap<LeaveRequest>),

  // ── Comp-off-request approval inbox (L5b) ────────────────────
  listCompOffRequests: (wsId: string, status?: string) =>
    http
      .get(E.compOffRequests(wsId), { params: status ? { status } : {} })
      .then(unwrap<CompOffRequest[]>),

  getCompOffRequest: (wsId: string, id: string) =>
    http.get(E.compOffRequest(wsId, id)).then(unwrap<CompOffRequest>),

  approveCompOffRequest: (wsId: string, id: string, payload: DecideLeavePayload) =>
    http.post(E.approveCompOff(wsId, id), payload).then(unwrap<CompOffRequest>),

  rejectCompOffRequest: (wsId: string, id: string, payload: DecideLeavePayload) =>
    http.post(E.rejectCompOff(wsId, id), payload).then(unwrap<CompOffRequest>),

  // ── Request settings + approver delegations (L5c) ────────────
  getSettings: (wsId: string) => http.get(E.settings(wsId)).then(unwrap<LeaveRequestSettings>),

  updateSettings: (wsId: string, payload: UpdateLeaveSettingsPayload) =>
    http.put(E.settings(wsId), payload).then(unwrap<LeaveRequestSettings>),

  listDelegations: (wsId: string, includeInactive = false) =>
    http
      .get(E.delegations(wsId), {
        params: includeInactive ? { includeInactive: 'true' } : {},
      })
      .then(unwrap<LeaveApproverDelegation[]>),

  createDelegation: (wsId: string, payload: CreateDelegationPayload) =>
    http.post(E.delegations(wsId), payload).then(unwrap<LeaveApproverDelegation>),

  revokeDelegation: (wsId: string, id: string) =>
    http.post(E.revokeDelegation(wsId, id), {}).then(unwrap<LeaveApproverDelegation>),

  // ── Balances admin (L5d) ─────────────────────────────────────
  listWorkspaceBalances: (wsId: string, year: number) =>
    http.get(E.allBalances(wsId), { params: { year: String(year) } }).then(unwrap<LeaveBalance[]>),

  postAdjustment: (wsId: string, payload: PostAdjustmentPayload) =>
    http.post(E.adjustments(wsId), payload).then(unwrap<LeaveLedgerEntry>),

  // ── Who's-on-leave calendar (L5e) ────────────────────────────
  listCalendar: (wsId: string, from: string, to: string) =>
    http.get(E.calendar(wsId), { params: { from, to } }).then(unwrap<LeaveRequest[]>),

  // ── Worker self-service (L6a) ────────────────────────────────
  /** The caller's own balances - self-scoped; the BE resolves the member. */
  myBalances: (wsId: string, year?: number) =>
    http
      .get(E.balances(wsId), { params: year ? { year: String(year) } : {} })
      .then(unwrap<LeaveBalance[]>),

  myRequests: (wsId: string) => http.get(E.myRequests(wsId)).then(unwrap<LeaveRequest[]>),

  /** Dry-run the paid-vs-LWP split for a candidate leave - nothing persisted. */
  previewLeave: (wsId: string, payload: ApplyLeavePayload) =>
    http.post(E.requestPreview(wsId), payload).then(unwrap<LeavePreviewResult>),

  applyLeave: (wsId: string, payload: ApplyLeavePayload) =>
    http.post(E.requests(wsId), payload).then(unwrap<LeaveRequest>),

  cancelRequest: (wsId: string, id: string) =>
    http.post(E.cancelRequest(wsId, id), {}).then(unwrap<LeaveRequest>),

  withdrawRequest: (wsId: string, id: string) =>
    http.post(E.withdrawRequest(wsId, id), {}).then(unwrap<LeaveRequest>),

  // ── Worker comp-off self-service (L6b) ───────────────────────
  /** The caller's own active comp-off lots - non-expired, unspent. */
  myCompOffLots: (wsId: string) => http.get(E.compOffLots(wsId)).then(unwrap<CompOffLotView[]>),

  /** The caller's own comp-off claim history, most recent first. */
  myCompOffRequests: (wsId: string) =>
    http.get(E.myCompOffRequests(wsId)).then(unwrap<CompOffRequest[]>),

  /** Claim a worked holiday / weekly-off as comp-off. */
  applyCompOff: (wsId: string, payload: ApplyCompOffPayload) =>
    http.post(E.compOffRequests(wsId), payload).then(unwrap<CompOffRequest>),

  cancelCompOffRequest: (wsId: string, id: string) =>
    http.post(E.cancelCompOff(wsId, id), {}).then(unwrap<CompOffRequest>),
};
