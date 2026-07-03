import type { ActivityEvent } from '@/types';

/**
 * Action presentation map for the team activity feed (2026-05-22).
 * Each audit action string maps to an i18n label key + a Tag tone. Unknown
 * actions fall back to a generic label so the feed never shows a raw action id.
 */
export interface ActivityActionDef {
  labelKey: string;
  tone: 'green' | 'blue' | 'orange' | 'red' | 'default';
}

export const TEAM_ACTIVITY_ACTIONS: Readonly<Record<string, ActivityActionDef>> = {
  'team.member_created': { labelKey: 'activity.action.member_created', tone: 'green' },
  'team.member_updated': { labelKey: 'activity.action.member_updated', tone: 'blue' },
  'team.member_archived': { labelKey: 'activity.action.member_archived', tone: 'orange' },
  'team.member_restored': { labelKey: 'activity.action.member_restored', tone: 'green' },
  'team.member_permanently_deleted': { labelKey: 'activity.action.member_deleted', tone: 'red' },
  'team.member_mobile_verified': { labelKey: 'activity.action.mobile_verified', tone: 'green' },
  'team.access_granted': { labelKey: 'activity.action.access_granted', tone: 'green' },
  'team.access_revoked': { labelKey: 'activity.action.access_revoked', tone: 'red' },
  'team.access_role_changed': { labelKey: 'activity.action.role_changed', tone: 'blue' },
  'team.permission_overrides_updated': {
    labelKey: 'activity.action.overrides_updated',
    tone: 'blue',
  },
  'team.invite_resent': { labelKey: 'activity.action.invite_resent', tone: 'default' },
  'team.invite_accepted': { labelKey: 'activity.action.invite_accepted', tone: 'green' },
  'team.offboarded': { labelKey: 'activity.action.offboarded', tone: 'orange' },
  'team.bulk_status_changed': { labelKey: 'activity.action.bulk_status', tone: 'blue' },
  'team.bulk_archived': { labelKey: 'activity.action.bulk_archived', tone: 'orange' },
  'team.bulk_restored': { labelKey: 'activity.action.bulk_restored', tone: 'green' },
  'team.karigar_profile_updated': { labelKey: 'activity.action.karigar_updated', tone: 'blue' },
  'team.kiosk_pin_set': { labelKey: 'activity.action.kiosk_pin_set', tone: 'default' },
};

export function activityActionDef(action: string): ActivityActionDef {
  return TEAM_ACTIVITY_ACTIONS[action] ?? { labelKey: 'activity.action.generic', tone: 'default' };
}

/** The filterable action list for the workspace activity table dropdown. */
export const TEAM_ACTIVITY_ACTION_KEYS: ReadonlyArray<string> = Object.keys(TEAM_ACTIVITY_ACTIONS);

/**
 * The coarse field-GROUP labels touched by an update event, if any. Returns
 * i18n key suffixes under `activity.group.*` (never raw field names/values).
 */
export function activityMetaGroups(event: ActivityEvent): string[] {
  const groups = (event.meta as { groups?: unknown })?.groups;
  return Array.isArray(groups) ? (groups as string[]) : [];
}
