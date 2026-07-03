/**
 * notification-presentation - pure mapping helpers for the notifications center.
 * Keeps category -> group / tag / primary-action logic out of the React tree so
 * it is unit-testable. Consumed by NotificationsScreen + NotificationRow.
 * Cross-links: BE category keys in notification-categories.ts; deep-link targets
 * mirror the old NotificationsScreen.notificationHref.
 */
import type { NotificationItem } from './notifications.actions';

export type TopicGroup = 'network' | 'feed' | 'jobs' | 'marketplace' | 'messages' | 'system';
export const TOPIC_GROUPS: TopicGroup[] = [
  'network',
  'feed',
  'jobs',
  'marketplace',
  'messages',
  'system',
];

export function categoryOf(n: NotificationItem): string {
  return n.category ?? (n.metadata as { category?: string } | null)?.category ?? '';
}

/** Map a notification to its tab group. Returns null only for truly unknown
 *  rows (shown under All / Unread but no topic tab). */
export function groupOf(n: NotificationItem): TopicGroup | null {
  const cat = categoryOf(n);
  if (cat.startsWith('connect.post_')) return 'feed';
  if (cat === 'connect.message_received') return 'messages';
  if (
    cat === 'connect.followed' ||
    cat === 'connect.page_followed' ||
    cat.startsWith('connect.connection_')
  ) {
    return 'network';
  }
  if (cat === 'connect.inquiry_received') return 'marketplace';
  if (cat.includes('job')) return 'jobs';
  if (cat === 'INVITE_RECEIVED' || cat === 'INVITE_ACCEPTED') return 'system';
  return null;
}

/** Per-row category tag key (i18n under connect.notifications.tag.*). */
export function tagKeyOf(n: NotificationItem): string {
  const cat = categoryOf(n);
  switch (cat) {
    case 'connect.post_reacted':
      return 'reaction';
    case 'connect.post_commented':
      return 'comment';
    case 'connect.post_reposted':
      return 'repost';
    case 'connect.post_replied':
      return 'reply';
    case 'connect.post_mentioned':
      return 'mention';
    case 'connect.followed':
      return 'follow';
    case 'connect.page_followed':
      return 'pageFollow';
    case 'connect.inquiry_received':
      return 'inquiry';
    case 'connect.message_received':
      return 'message';
    case 'connect.job_application_received':
    case 'connect.job_application_accepted':
    case 'connect.job_application_declined':
      return 'job';
    case 'connect.connection_requested':
    case 'connect.connection_accepted':
      return 'connection';
    case 'INVITE_RECEIVED':
    case 'INVITE_ACCEPTED':
      return 'system';
    default:
      return 'connection';
  }
}

export interface PrimaryAction {
  labelKey: string; // i18n key under connect.notifications
  href: string;
}

/** Resolve a row's primary action (label + deep link). Null = no button. */
export function primaryAction(n: NotificationItem): PrimaryAction | null {
  const cat = categoryOf(n);
  const meta = (n.metadata ?? {}) as { threadId?: string; pageId?: string };
  switch (cat) {
    case 'connect.connection_requested':
      return { labelKey: 'actions.viewRequest', href: '/connect/network?tab=invitations' };
    case 'connect.connection_accepted':
    case 'connect.followed':
      return { labelKey: 'actions.message', href: '/connect/network' };
    case 'connect.page_followed':
      return {
        labelKey: 'actions.viewPage',
        href: n.entityId ? `/connect/pages/${n.entityId}` : '/connect/pages',
      };
    case 'connect.post_reacted':
    case 'connect.post_reposted':
      return {
        labelKey: 'actions.viewPost',
        href: n.entityId ? `/connect/posts/${n.entityId}` : '/connect/feed',
      };
    case 'connect.post_commented':
    case 'connect.post_replied':
      return {
        labelKey: 'actions.reply',
        href: n.entityId ? `/connect/posts/${n.entityId}` : '/connect/feed',
      };
    // @mention (tag) alert -> open the tagging post. Links: backend
    // connect.post_mentioned (FeedService.notifyMentioned + comment dispatch).
    case 'connect.post_mentioned':
      return {
        labelKey: 'actions.viewPost',
        href: n.entityId ? `/connect/posts/${n.entityId}` : '/connect/feed',
      };
    case 'connect.inquiry_received':
      return {
        labelKey: 'actions.viewInquiries',
        href: meta.threadId
          ? `/connect/inbox?thread=${meta.threadId}`
          : '/connect/inbox?channel=inquiry',
      };
    case 'connect.job_application_received':
      return {
        labelKey: 'actions.viewApplicants',
        href: n.entityId ? `/connect/jobs/${n.entityId}` : '/connect/jobs',
      };
    case 'connect.job_application_accepted':
    case 'connect.job_application_declined':
      return {
        labelKey: 'actions.viewJob',
        href: n.entityId ? `/connect/jobs/${n.entityId}` : '/connect/jobs',
      };
    case 'connect.message_received':
      return {
        labelKey: 'actions.message',
        href: meta.threadId ? `/connect/inbox?thread=${meta.threadId}` : '/connect/inbox',
      };
    case 'INVITE_RECEIVED':
    case 'INVITE_ACCEPTED':
      return { labelKey: 'actions.view', href: '/dashboard/invitations' };
    default:
      return null;
  }
}

/** Whole-row navigation target (used for mark-read + click). Falls back to the
 *  primary action href; null = no navigation. */
export function rowHref(n: NotificationItem): string | null {
  return primaryAction(n)?.href ?? null;
}

export function dayBucket(iso: string, now: number): 'today' | 'week' | 'earlier' {
  const day = 24 * 60 * 60 * 1000;
  const diff = now - new Date(iso).getTime();
  if (diff < day && new Date(iso).getDate() === new Date(now).getDate()) return 'today';
  return diff < 7 * day ? 'week' : 'earlier';
}
