'use server';

import axios from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { type ActionResult, success, failure, extractError } from '@/lib/common';

/**
 * Self-serve account-deletion server actions (DPDP, ACCOUNT-DELETION-AND-DPDP-PLAN.md
 * Phase 5). Thin mappers over the `me/deletion/*` backend routes (account-deletion
 * module, Phases 1-4). Cross-link: components/account-deletion/DangerDeleteModal.tsx
 * drives the step-up + schedule flow; the Delete-ERP confirm screen reads the preview.
 *
 * Watch: the backend uses `forbidNonWhitelisted` on the schedule DTO, so the body must
 * carry ONLY { otpProof, confirm, reauth? } - never spread extra UI state into it.
 */

const E = ApiEndpoints.accountDeletion;

/** Re-auth factor at delete time. Password if the account has one, else a fresh Google
 *  id-token; OTP-only (password-less, no Google) accounts omit `reauth` entirely. */
export interface DeletionReauth {
  kind: 'password' | 'google';
  password?: string;
  googleIdToken?: string;
}

export interface ScheduleDeletionInput {
  reauth?: DeletionReauth;
  /** Single-use proof minted by verifyDeletionStepupOtp. */
  otpProof: string;
  /** Type-to-confirm phrase; must equal 'DELETE' (enforced server-side). */
  confirm: string;
}

/** The impact summary the Delete-ERP confirm screen renders (GET .../erp/preview). */
export interface ErpDeletionImpact {
  ownedWorkspaces: { workspaceId: string; name: string; memberCount: number }[];
  memberWorkspaces: { workspaceId: string; name: string }[];
  teamLosesAccess: boolean;
  memberWorkspacesNeedReinvite: boolean;
  openEmployerLoans: number;
  unpaidAdvances: number;
}

export interface StepupSendData {
  ok: boolean;
  sent: boolean;
  expiresAt: string;
  resendCooldownSec: number;
  mockMode: boolean;
  idempotent?: boolean;
}

export interface StepupVerifyData {
  ok: boolean;
  proofToken: string;
  expiresAt: string;
}

/**
 * Schedule result. Success carries the recover-by date (`purgeAfter`); the ERP scope
 * also echoes the impact. Failure carries the BE `code` so the modal can special-case
 * the sole-admin block / invalid-proof / confirm-required cases without parsing strings.
 */
export type ScheduleDeletionResult =
  | {
      ok: true;
      state: 'pending';
      purgeAfter: string;
      alreadyPending?: boolean;
      impact?: ErpDeletionImpact;
    }
  | { ok: false; error: string; code?: string };

/** Pull the structured BE error code (if any) alongside the friendly message. */
function extractCoded(e: unknown): { error: string; code?: string } {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { code?: string } | undefined;
    return { error: extractError(e), code: typeof data?.code === 'string' ? data.code : undefined };
  }
  return { error: extractError(e) };
}

/** Build the whitelisted schedule body - reauth is included only when present. */
function buildScheduleBody(input: ScheduleDeletionInput): Record<string, unknown> {
  const body: Record<string, unknown> = { otpProof: input.otpProof, confirm: input.confirm };
  if (input.reauth) body.reauth = input.reauth;
  return body;
}

/** Send the one-time step-up code to the user's verified mobile. */
export async function sendDeletionStepupOtp(): Promise<ActionResult<StepupSendData>> {
  try {
    const http = await serverHttp();
    const data = await http.post(E.stepup, {}).then(unwrapServer<StepupSendData>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/** Verify the step-up code and return the single-use proof token for the schedule call. */
export async function verifyDeletionStepupOtp(
  otp: string,
): Promise<ActionResult<StepupVerifyData>> {
  try {
    const http = await serverHttp();
    const data = await http.post(E.stepupVerify, { otp }).then(unwrapServer<StepupVerifyData>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/** Read the Delete-ERP impact (affected workspaces, team-loses-access, open loans/advances). */
export async function getErpDeletionPreview(): Promise<ActionResult<ErpDeletionImpact>> {
  try {
    const http = await serverHttp();
    const data = await http.get(E.erpPreview).then(unwrapServer<ErpDeletionImpact>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

async function schedule(
  endpoint: string,
  input: ScheduleDeletionInput,
): Promise<ScheduleDeletionResult> {
  try {
    const http = await serverHttp();
    const data = await http.post(endpoint, buildScheduleBody(input)).then(
      unwrapServer<{
        state: 'pending';
        purgeAfter: string;
        alreadyPending?: boolean;
        impact?: ErpDeletionImpact;
      }>,
    );
    return {
      ok: true,
      state: 'pending',
      purgeAfter: data.purgeAfter,
      alreadyPending: data.alreadyPending,
      impact: data.impact,
    };
  } catch (e) {
    return { ok: false, ...extractCoded(e) };
  }
}

/** Scope 1 - delete the Connect profile (account + ERP stay). */
export async function scheduleConnectDeletion(
  input: ScheduleDeletionInput,
): Promise<ScheduleDeletionResult> {
  return schedule(E.connect, input);
}

/** Scope 2 - delete ERP workspaces (account + Connect stay). */
export async function scheduleErpDeletion(
  input: ScheduleDeletionInput,
): Promise<ScheduleDeletionResult> {
  return schedule(E.erp, input);
}

/** Scope 3 - delete the whole account (suspends + logs the user out). */
export async function scheduleAccountDeletion(
  input: ScheduleDeletionInput,
): Promise<ScheduleDeletionResult> {
  return schedule(E.account, input);
}
