'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';

export type FeedbackCategory = 'feature_request' | 'bug_report' | 'general';
export type FeedbackScope = 'page' | 'general';

// Auto-captured page/device diagnostics sent with feedback (no extra PII).
export interface FeedbackContext {
  path?: string;
  locale?: string;
  userAgent?: string;
  viewport?: string;
  appVersion?: string;
}

export interface FeedbackPayload {
  module: string;
  rating?: number; // optional: mood is not required to send feedback
  message: string;
  category?: FeedbackCategory;
  scope?: FeedbackScope; // 'page' (default) | 'general'
  attachments?: string[]; // r2-private:// refs from uploadService
  context?: FeedbackContext;
}

export interface FeedbackRecord {
  _id: string;
  workspaceId: string;
  userId: string;
  module: string;
  rating: number;
  message: string;
  category: FeedbackCategory;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const E = ApiEndpoints.feedback;

export async function submitFeedback(workspaceId: string, payload: FeedbackPayload) {
  const http = await serverHttp();
  return http.post(E.submit(workspaceId), payload).then(unwrapServer<FeedbackRecord>);
}
