import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  RegularizationRequest,
  CreateRegularizationPayload,
  DecideRegularizationPayload,
  RegularizationListQuery,
  RegularizationConfig,
} from '@/types';

const E = ApiEndpoints.regularization;

export const regularizationApi = {
  listAll: (wsId: string, query?: RegularizationListQuery) =>
    http.get(E.list(wsId), { params: query }).then(unwrap<RegularizationRequest[]>),

  listPendingForMe: (wsId: string) =>
    http.get(E.pendingForMe(wsId)).then(unwrap<RegularizationRequest[]>),

  listMyRequests: (wsId: string) =>
    http.get(E.myRequests(wsId)).then(unwrap<RegularizationRequest[]>),

  get: (wsId: string, id: string) =>
    http.get(E.get(wsId, id)).then(unwrap<RegularizationRequest>),

  create: (wsId: string, payload: CreateRegularizationPayload) =>
    http.post(E.create(wsId), payload).then(unwrap<RegularizationRequest>),

  approve: (wsId: string, id: string, payload: DecideRegularizationPayload) =>
    http.post(E.approve(wsId, id), payload).then(unwrap<RegularizationRequest>),

  reject: (wsId: string, id: string, payload: DecideRegularizationPayload) =>
    http.post(E.reject(wsId, id), payload).then(unwrap<RegularizationRequest>),

  cancel: (wsId: string, id: string, payload: DecideRegularizationPayload) =>
    http.post(E.cancel(wsId, id), payload).then(unwrap<RegularizationRequest>),

  getSettings: (wsId: string) =>
    http.get(E.settings(wsId)).then(unwrap<RegularizationConfig>),

  updateSettings: (wsId: string, payload: RegularizationConfig) =>
    http.put(E.settings(wsId), payload).then(unwrap<RegularizationConfig>),
};

export const REGULARIZATION_ERROR_MESSAGES: Record<string, string> = {
  MAX_DAYS_BACK_EXCEEDED: 'This date is older than the allowed regularization window.',
  PAYROLL_LOCKED: 'Payroll for this month is locked. Unlock it before raising a regularization.',
  PAYROLL_LOCKED_SINCE_CREATE: 'Payroll was locked after the request was raised. Cannot approve.',
  PENDING_REGULARIZATION_EXISTS: 'A pending regularization already exists for this member and date.',
  SELF_APPROVAL_FORBIDDEN: 'You cannot appear in your own approval chain.',
  NOT_APPROVER: 'You are not the current-level approver for this request.',
  REQUEST_ALREADY_DECIDED: 'This request has already been decided.',
  CANCEL_FORBIDDEN: 'Only the raiser or an admin can cancel a pending request.',
  APPROVAL_CHAIN_INCOMPLETE: 'No approver found for this member. Go to Regularization Settings and set a fallback approver, or assign a "Reports To" manager on the member profile.',
};

export function getRegularizationErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { error?: { code?: string | number; message?: string } } } };
  const rawMessage = anyErr?.response?.data?.error?.message ?? '';

  // The HttpExceptionFilter puts the HTTP status (400) in error.code, not the semantic string.
  // The backend embeds the semantic code as the prefix: "CODE: description…"
  // So extract it from the message prefix first.
  const msgCode = rawMessage.split(':')[0].trim();
  if (msgCode && REGULARIZATION_ERROR_MESSAGES[msgCode]) return REGULARIZATION_ERROR_MESSAGES[msgCode];

  // Fallback: string code (if future backend versions send it properly)
  const code = anyErr?.response?.data?.error?.code;
  if (typeof code === 'string' && REGULARIZATION_ERROR_MESSAGES[code]) return REGULARIZATION_ERROR_MESSAGES[code];

  return rawMessage || 'Something went wrong. Please try again.';
}
