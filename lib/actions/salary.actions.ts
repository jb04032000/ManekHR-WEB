'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  SalaryRecord,
  Payment,
  LedgerRecord,
  UpdateSalaryPayload,
  RecordSalaryPaymentPayload,
  SalaryIncrement,
  SalaryAdjustment,
  CreateSalaryAdjustmentPayload,
  ReverseSalaryAdjustmentPayload,
  SalaryAdjustmentAuditEvent,
  TeamMember,
  SetBasePaySalaryConfigPayload,
  EcrExportResponse,
  EsiChallanExportResponse,
  BankFileExportResponse,
  GratuityLedger,
  GratuitySummary,
  Form16Data,
  PieceRatePreviewResponse,
  PieceRateConfig,
  SetPieceRateConfigPayload,
  // Phase 26 - Salary Engine + Accounting Integration
  AdvanceSalaryRequest,
  CreateAdvanceRequestPayload,
  ApproveAdvanceRequestPayload,
  PayAdvanceRequestPayload,
  RejectAdvanceRequestPayload,
  DisbursementRules,
  SalaryLossConfig,
  AttendanceCalcRules,
} from '@/types';

const E = ApiEndpoints.salary;
const TE = ApiEndpoints.team;

// Phase 23 - ensureSalaryRecord canonical signature (Plan 23-08 Task 4):
//   ensureSalaryRecord(wsId, teamMemberId, month, year, token?) → SalaryRecord
// Verified at line ~175 in this file. Plan 23-11 should call positionally.

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function isValidObjectId(id: string): boolean {
  return OBJECT_ID_REGEX.test(id);
}

function getServerActionErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (
      error as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            error?: {
              message?: string;
            };
          };
        };
      }
    ).response;

    return response?.data?.error?.message || response?.data?.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function getSalaryRecords(wsId: string, month: number, year: number) {
  try {
    const http = await serverHttp();
    const result = await http.get(E.list(wsId), { params: { month, year } });
    return unwrapServer<SalaryRecord[]>(result);
  } catch (error) {
    return [];
  }
}

export async function getEcrExport(wsId: string, month: number, year: number, token?: string) {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.complianceEcr(wsId), {
      params: { month, year },
    });
    return unwrapServer<EcrExportResponse>(result);
  } catch (error) {
    throw error;
  }
}

export async function getEsiChallanExport(
  wsId: string,
  month: number,
  year: number,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.complianceEsiChallan(wsId), {
      params: { month, year },
    });
    return unwrapServer<EsiChallanExportResponse>(result);
  } catch (error) {
    throw error;
  }
}

export async function getBankFileExport(wsId: string, month: number, year: number, token?: string) {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.complianceBankFile(wsId), {
      params: { month, year },
    });
    return unwrapServer<BankFileExportResponse>(result);
  } catch (error) {
    throw error;
  }
}

export async function getForm16Data(
  wsId: string,
  memberId: string,
  financialYear: number,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.form16(wsId, memberId), {
      params: { financialYear },
    });
    return unwrapServer<Form16Data>(result);
  } catch (error) {
    throw error;
  }
}

export async function getGratuityLedger(wsId: string, memberId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.gratuityLedger(wsId, memberId));
    return unwrapServer<GratuityLedger | null>(result);
  } catch (error) {
    throw error;
  }
}

export async function getGratuitySummary(wsId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.gratuitySummary(wsId));
    return unwrapServer<GratuitySummary>(result);
  } catch (error) {
    throw error;
  }
}

export async function generateSalary(wsId: string, month: number, year: number, token?: string) {
  try {
    const http = await serverHttp(token);
    const url = `${E.generate(wsId)}?month=${month}&year=${year}`;
    const result = await http.post(url);
    return unwrapServer<SalaryRecord[]>(result);
  } catch (error) {
    throw error;
  }
}

export async function ensureSalaryRecord(
  wsId: string,
  teamMemberId: string,
  month: number,
  year: number,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    const result = await http.post(E.ensureRecord(wsId), {
      teamMemberId,
      month,
      year,
    });
    return unwrapServer<SalaryRecord>(result);
  } catch (error) {
    throw error;
  }
}

export async function updateSalary(
  wsId: string,
  recordId: string,
  data: UpdateSalaryPayload,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http.patch(E.update(wsId, recordId), data).then(unwrapServer<SalaryRecord>);
  } catch (error) {
    throw error;
  }
}

export async function setBasePay(
  wsId: string,
  teamMemberId: string,
  salaryConfig: SetBasePaySalaryConfigPayload,
  salaryRecordUpdate?: {
    salaryId: string;
    baseSalary: number;
  },
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    const result = await http.patch(E.setBasePay(wsId), {
      teamMemberId,
      salaryConfig,
      salaryRecordUpdate,
    });
    return unwrapServer<{ member: TeamMember; salaryRecord: SalaryRecord | null }>(result);
  } catch (error) {
    throw error;
  }
}

export async function lockSalaryRecord(wsId: string, salaryId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    const result = await http.patch(E.lock(wsId, salaryId));
    return unwrapServer<SalaryRecord>(result);
  } catch (error) {
    const e = error as { response?: { data?: { message?: string } } };
    const msg = e.response?.data?.message || 'Failed to lock salary record';
    throw new Error(msg);
  }
}

export async function unlockSalaryRecord(wsId: string, salaryId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    const result = await http.patch(E.unlock(wsId, salaryId));
    return unwrapServer<SalaryRecord>(result);
  } catch (error) {
    const e = error as { response?: { data?: { message?: string } } };
    const msg = e.response?.data?.message || 'Failed to unlock salary record';
    throw new Error(msg);
  }
}

export async function getSalaryAdjustments(wsId: string, salaryId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    return await http.get(E.adjustments(wsId, salaryId)).then(unwrapServer<SalaryAdjustment[]>);
  } catch (error) {
    return [];
  }
}

export async function createSalaryAdjustment(
  wsId: string,
  salaryId: string,
  data: CreateSalaryAdjustmentPayload,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http
      .post(E.adjustments(wsId, salaryId), data)
      .then(unwrapServer<SalaryAdjustment>);
  } catch (error) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to create salary adjustment'));
  }
}

export async function reverseSalaryAdjustment(
  wsId: string,
  adjustmentId: string,
  data: ReverseSalaryAdjustmentPayload,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http
      .post(E.reverseAdjustment(wsId, adjustmentId), data)
      .then(unwrapServer<SalaryAdjustment>);
  } catch (error) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to reverse salary adjustment'));
  }
}

export async function reverseSalaryPayment(
  wsId: string,
  paymentId: string,
  payload: { reversalReason: string },
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http.post(E.reversePayment(wsId, paymentId), payload).then(unwrapServer<Payment>);
  } catch (error) {
    throw error;
  }
}

export async function getSalaryAdjustmentAudit(wsId: string, adjustmentId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    return await http
      .get(E.adjustmentAudit(wsId, adjustmentId))
      .then(unwrapServer<SalaryAdjustmentAuditEvent[]>);
  } catch (error) {
    return [];
  }
}

export async function recordSalaryPayment(
  wsId: string,
  data: RecordSalaryPaymentPayload,
  token?: string,
) {
  if (!wsId) throw new Error(`workspaceId is required but got: "${wsId}"`);
  if (!isValidObjectId(wsId))
    throw new Error(`workspaceId "${wsId}" is not a valid ObjectId (must be 24 hex chars)`);
  try {
    const http = await serverHttp(token);
    const url = E.payments(wsId);
    const result = await http.post(url, data);
    return unwrapServer<Payment>(result);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (
        error as {
          response?: {
            status?: number;
            data?: {
              error?: { message?: string };
              message?: string;
            };
          };
        }
      ).response;
      const message =
        response?.data?.error?.message ||
        response?.data?.message ||
        `Backend ${response?.status ?? 'unknown'} error`;
      throw new Error(message);
    }
    throw error;
  }
}

export async function getSalaryPayments(wsId: string, salaryId?: string) {
  try {
    const http = await serverHttp();
    return await http
      .get(E.payments(wsId), { params: salaryId ? { salaryId } : {} })
      .then(unwrapServer<Payment[]>);
  } catch (error) {
    return [];
  }
}

export async function getSalaryLedger(wsId: string, memberId: string) {
  if (!wsId) {
    throw new Error('Workspace ID is required');
  }
  if (!memberId) {
    throw new Error('Member ID is required');
  }
  if (!isValidObjectId(wsId)) {
    throw new Error(`Invalid workspace ID format: ${wsId}`);
  }
  if (!isValidObjectId(memberId)) {
    throw new Error(`Invalid member ID format: ${memberId}`);
  }

  try {
    const http = await serverHttp();
    const endpoint = E.ledger(wsId, memberId);
    const result = await http.get(endpoint);
    return unwrapServer<LedgerRecord>(result);
  } catch (error: unknown) {
    const response =
      typeof error === 'object' && error !== null && 'response' in error
        ? (
            error as {
              response?: {
                status?: number;
                statusText?: string;
                data?: { message?: string };
              };
              config?: { url?: string; baseURL?: string };
              code?: string;
            }
          ).response
        : undefined;
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: string }).code)
        : undefined;

    if (response) {
      const status = response.status;
      const message = response.data?.message || response.statusText;

      if (status === 404) {
        const errorMsg = response.data?.message || '';
        if (errorMsg.includes('Cannot GET') || errorMsg.includes('Not Found')) {
          throw new Error(
            `Backend endpoint not found. Please ensure the backend server is running on the correct port and the salary history endpoint is properly configured.`,
          );
        }
        throw new Error(
          `No salary history found for this employee. The employee may not have any salary records yet.`,
        );
      } else if (status === 403) {
        throw new Error(`You don't have permission to view salary history.`);
      } else if (status === 401) {
        throw new Error(`Authentication required. Please log in again.`);
      } else {
        throw new Error(`Failed to fetch ledger: ${message}`);
      }
    }

    if (code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to backend server. Please ensure the backend is running.');
    }

    throw error;
  }
}

export async function addSalaryIncrement(
  wsId: string,
  data: {
    teamMemberId: string;
    effectiveMonth: number;
    effectiveYear: number;
    type: 'fixed_amount' | 'percentage';
    value: number;
    note?: string;
  },
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    const url = E.increments(wsId);
    const result = await http.post(url, data);
    return unwrapServer<SalaryIncrement>(result);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (
        error as {
          response?: { status?: number; data?: { message?: string } };
        }
      ).response;
      const msg = response?.data?.message || JSON.stringify(response?.data);
      throw new Error(`Failed to add increment: ${msg}`);
    }
    throw error;
  }
}

export async function getSalaryIncrements(wsId: string, teamMemberId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.increments(wsId), { params: { teamMemberId } });
    return unwrapServer<SalaryIncrement[]>(result);
  } catch (error) {
    return [];
  }
}

// Phase 23 - Piece rate server actions
export async function previewPieceRateEarnings(
  wsId: string,
  params: { teamMemberId: string; month: number; year: number },
  token?: string,
): Promise<PieceRatePreviewResponse> {
  try {
    const http = await serverHttp(token);
    const result = await http.get(E.pieceRatePreview(wsId, params));
    return unwrapServer<PieceRatePreviewResponse>(result);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { code?: string; message?: string } } };
    const code = err.response?.data?.code;
    const msg = err.response?.data?.message || 'Failed to preview piece-rate earnings';
    throw new Error(JSON.stringify({ code, message: msg }));
  }
}

export async function setPieceRateConfig(
  wsId: string,
  teamMemberId: string,
  payload: SetPieceRateConfigPayload,
  token?: string,
): Promise<PieceRateConfig> {
  try {
    const http = await serverHttp(token);
    const result = await http.patch(TE.pieceRateConfig(wsId, teamMemberId), payload);
    return unwrapServer<PieceRateConfig>(result);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { code?: string; message?: string } } };
    const code = err.response?.data?.code;
    const msg = err.response?.data?.message || 'Failed to save piece-rate configuration';
    throw new Error(JSON.stringify({ code, message: msg }));
  }
}

export async function clearPieceRateConfig(
  wsId: string,
  teamMemberId: string,
  downgradeTo?: 'monthly' | 'hourly',
  token?: string,
): Promise<{ cleared: true }> {
  try {
    const http = await serverHttp(token);
    const result = await http.delete(TE.pieceRateConfig(wsId, teamMemberId), {
      data: { downgradeTo: downgradeTo ?? 'monthly' },
    });
    return unwrapServer<{ cleared: true }>(result);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { code?: string; message?: string } } };
    const code = err.response?.data?.code;
    const msg = err.response?.data?.message || 'Failed to clear piece-rate configuration';
    throw new Error(JSON.stringify({ code, message: msg }));
  }
}

export async function deleteSalaryIncrement(wsId: string, incrementId: string, token?: string) {
  try {
    const http = await serverHttp(token);
    const url = E.incrementDelete(wsId, incrementId);
    const result = await http.delete(url);
    return unwrapServer<{ success: boolean }>(result);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (
        error as {
          response?: { status?: number; data?: { message?: string } };
        }
      ).response;
      const msg = response?.data?.message || JSON.stringify(response?.data);
      throw new Error(`Failed to delete increment: ${msg}`);
    }
    throw error;
  }
}

// ─── Phase 26 - Salary Engine + Accounting Integration ───────────────────────
// Server Actions for write operations called by owner-facing settings and
// advance request pages (Plans 26-08, 26-09, 26-10).
//
// Read operations (listCoaAccounts, listAdvanceRequests, listMyAdvanceRequests)
// are intentionally client-only via salary.api.ts - they are used in Client
// Components with React Query / SWR and do not require server-side token
// injection. Adding server-action equivalents here would duplicate logic
// without benefit. Decision: client-only reads, server-action writes only.

/**
 * Server Action: create an advance salary request (D-02). Member-facing.
 * Backend enforces D-08 IST day-of-month gate (ADVANCE_REQUEST_DAY_CLOSED),
 * D-02 current-month guard (ADVANCE_NOT_CURRENT_MONTH), and D-09 duplicate
 * 409 (ADVANCE_DUPLICATE). Surfaces typed backend error codes to the UI.
 * Links: salary.api.ts createAdvanceRequest (client mirror); Plan 26-10.
 */
export async function createAdvanceRequestAction(
  wsId: string,
  payload: CreateAdvanceRequestPayload,
  token?: string,
): Promise<AdvanceSalaryRequest> {
  try {
    const http = await serverHttp(token);
    const result = await http.post(E.advanceRequests(wsId), payload);
    return unwrapServer<AdvanceSalaryRequest>(result);
  } catch (error: unknown) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to submit advance request'));
  }
}

/**
 * Server Action: approve an advance salary request (D-02). Owner-facing. Two-step flow (2026-06-22):
 * APPROVE only - transitions pending -> approved; sets approvedAmount + reviewNote. No disbursement.
 * Backend error code: ADVANCE_NOT_PENDING when status is not pending.
 * Links: salary.api.ts approveAdvanceRequest (client mirror); Plan 26-09.
 */
export async function approveAdvanceRequestAction(
  wsId: string,
  id: string,
  payload: ApproveAdvanceRequestPayload,
  token?: string,
): Promise<AdvanceSalaryRequest> {
  try {
    const http = await serverHttp(token);
    const result = await http.patch(E.approveAdvanceRequest(wsId, id), payload);
    return unwrapServer<AdvanceSalaryRequest>(result);
  } catch (error: unknown) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to approve advance request'));
  }
}

/**
 * Server Action: disburse an approved advance salary request (Plan 2026-06-22 two-step).
 * Transitions approved -> paid; captures payment method/split/proof/who-disbursed; creates recovery plan.
 * Links: salary.api.ts payAdvanceRequest (client mirror); AdvanceDisburseDrawer.
 */
export async function payAdvanceRequestAction(
  wsId: string,
  id: string,
  payload: PayAdvanceRequestPayload,
  token?: string,
): Promise<AdvanceSalaryRequest> {
  try {
    const http = await serverHttp(token);
    const result = await http.patch(E.payAdvanceRequest(wsId, id), payload);
    return unwrapServer<AdvanceSalaryRequest>(result);
  } catch (error: unknown) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to disburse advance request'));
  }
}

/**
 * Server Action: reject an advance salary request (D-02). Owner-facing.
 * Transitions status pending → rejected with optional reviewNote.
 * Backend error code: ADVANCE_NOT_PENDING when status is not pending.
 * Links: salary.api.ts rejectAdvanceRequest (client mirror); Plan 26-09.
 */
export async function rejectAdvanceRequestAction(
  wsId: string,
  id: string,
  payload: RejectAdvanceRequestPayload,
  token?: string,
): Promise<AdvanceSalaryRequest> {
  try {
    const http = await serverHttp(token);
    const result = await http.patch(E.rejectAdvanceRequest(wsId, id), payload);
    return unwrapServer<AdvanceSalaryRequest>(result);
  } catch (error: unknown) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to reject advance request'));
  }
}

/**
 * Server Action: update disbursement rules (D-01).
 * Covers salaryDate, payoutWindowDays, advanceRequestDay.
 * Links: salary.api.ts updateDisbursementRules (client mirror); Plan 26-08 settings page.
 */
export async function updateDisbursementRulesAction(
  wsId: string,
  payload: Partial<DisbursementRules>,
  token?: string,
): Promise<void> {
  try {
    const http = await serverHttp(token);
    await http.patch(E.disbursementRules(wsId), payload);
  } catch (error: unknown) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to update disbursement rules'));
  }
}

/**
 * Server Action: update salary-loss config (D-03).
 * Covers regularizationWindowDays and salaryLossEnabled toggle.
 * Links: salary.api.ts updateSalaryLossConfig (client mirror); Plan 26-08 settings page.
 */
export async function updateSalaryLossConfigAction(
  wsId: string,
  payload: Partial<SalaryLossConfig>,
  token?: string,
): Promise<void> {
  try {
    const http = await serverHttp(token);
    await http.patch(E.salaryLossConfig(wsId), payload);
  } catch (error: unknown) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to update salary loss config'));
  }
}

/**
 * Server Action: update attendance calculation rules (D-01).
 * Covers holidayCountsAsPresent, weekOffCountsAsPresent, lateMarkAsHalfDay.
 * Links: salary.api.ts updateAttendanceRules (client mirror); Plan 26-08 settings page.
 */
export async function updateAttendanceRulesAction(
  wsId: string,
  payload: Partial<AttendanceCalcRules>,
  token?: string,
): Promise<void> {
  try {
    const http = await serverHttp(token);
    await http.patch(E.attendanceRules(wsId), payload);
  } catch (error: unknown) {
    throw new Error(getServerActionErrorMessage(error, 'Failed to update attendance rules'));
  }
}
