import { ASSIGNABLE_MODULES } from './modules.registry';

export type PermissionLevel = 'full' | 'view' | 'none' | 'custom';

/** Convert a level to an actions string[] (backend format) */
export function levelToActions(level: PermissionLevel, actions: string[]): string[] {
  if (level === 'full') return [...actions];
  if (level === 'view') return actions.length > 0 ? [actions[0]] : [];
  return [];
}

/** Infer level from a string[] of granted actions for a module */
export function inferLevel(granted: string[], allActions: string[]): PermissionLevel {
  if (!granted || granted.length === 0) return 'none';
  if (granted.length === allActions.length) return 'full';
  if (granted.length === 1 && granted[0] === allActions[0]) return 'view';
  return 'custom';
}

/**
 * Convert a RoleTemplate level map → Record<string, string[]> (backend permissions format).
 * This is what gets stored in the permissions state and sent to the API.
 */
export function applyTemplate(
  levelMap: Record<string, 'full' | 'view' | 'none'>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  ASSIGNABLE_MODULES.forEach((mod) => {
    const level = levelMap[mod.key] ?? 'none';
    result[mod.key] = levelToActions(level, mod.actions);
  });
  return result;
}

/** Create empty permissions (all none) */
export function createEmptyPermissions(): Record<string, string[]> {
  return Object.fromEntries(ASSIGNABLE_MODULES.map((m) => [m.key, []]));
}
