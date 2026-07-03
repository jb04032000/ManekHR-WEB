// Admin feedback console types. Backed by admin/feedback (feedback-admin.controller.ts).
import type {
  FeedbackCategory,
  FeedbackScope,
  FeedbackContext,
} from '@/lib/actions/feedback.actions';

export type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix';

export interface AdminFeedbackRow {
  _id: string;
  workspaceId: string;
  userId: string;
  module: string;
  rating: number | null;
  message: string;
  category: FeedbackCategory;
  scope: FeedbackScope;
  status: FeedbackStatus;
  attachmentCount: number;
  adminNotes: string | null;
  createdAt: string;
}

// getOne returns the full row with attachments already signed (https URLs).
export interface AdminFeedbackDetail extends AdminFeedbackRow {
  attachments: string[];
  context: FeedbackContext | null;
}

export interface AdminFeedbackListResult {
  items: AdminFeedbackRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
