/**
 * Wave 1 Permission-Gated UI (2026-05-15) - central permission map.
 *
 * Single source of truth for both:
 *   - the sidebar nav filter (`Sidebar.tsx` + dashboard tiles in
 *     `app/dashboard/page.tsx`), and
 *   - the deep-link guard in `DashboardLayout.tsx` (manual URL typing
 *     into a forbidden route → redirect to `/dashboard` + warning toast).
 *
 * Maps mirror the BE `AppModule` / `ModuleAction` enum *values* (lowercase
 * snake_case) from `crewroster-backend/src/common/enums/modules.enum.ts`.
 * Adjustments here should be diff-checked against the matching
 * `@RequirePermissions(...)` decorator on the BE route.
 *
 * Semantics (F2 - fail-closed):
 *   - Owners short-circuit (handled in `useMyPermissions().can`).
 *   - A nav item / route is reachable only when it is permission-gated
 *     here AND the caller satisfies it, OR it is explicitly open
 *     (`OPEN_NAV_KEYS`, or a `'open'` route entry). Anything else is
 *     denied by default - an unmapped, non-open entry is hidden / 403'd.
 */

import type { PermissionScope } from '@/lib/api/modules/me.api';

/**
 * A permission requirement on a nav item / route. Discriminated union - a
 * single entry is either FLAT (legacy `{module, action}` model - still used
 * by attendance / salary / finance / etc.) or PATH (Phase 1d hierarchical
 * model - used by Team and any future path-migrated module).
 *
 * Picking the right variant matters: a Team entry written in the flat form
 * (`{module: 'team', action: 'create'}`) silently denies every non-owner
 * because Phase 1d moved Team off the flat permissions array. Use the
 * `path` form for every Team-related entry.
 */
export type RequiredPerm =
  | {
      /** BE `AppModule` value, e.g. `'attendance'`, `'finance'`. */
      module: string;
      /** BE `ModuleAction` value, e.g. `'view'`, `'edit'`. */
      action: string;
      /** Optional scope: `'self'` requires `self|all`; `'all'` requires `all`. */
      scope?: PermissionScope;
      path?: never;
    }
  | {
      /** Hierarchical registry path, e.g. `'team.directory.view'`. */
      path: string;
      scope?: PermissionScope;
      module?: never;
      action?: never;
    };

/**
 * Sidebar / dashboard-tile permission map.
 *
 * Keys mirror the antd `Menu` item `key` field (the route path for
 * navigable entries; an arbitrary slug for submenu parents).
 */
export const NAV_PERMISSIONS: Record<string, RequiredPerm> = {
  // Core workforce modules.
  // Team + Attendance are scope-agnostic: each route composes itself by
  // the caller's resolved scope - `all` → the manager console, `self` →
  // the caller's own surface (own profile / own attendance). Self-scoped
  // members SHOULD see these nav entries; the page handles the split.
  // The manager sub-routes (attendance/overview, /devices, …) stay
  // `scope: 'all'` via ROUTE_PERMISSIONS below.
  // Phase 1d - Team is path-migrated; flat `team.view` is no longer
  // granted to anyone (the role's `permissions[]` row was retired in
  // favor of `permissionPaths[]`). Use the registry path.
  '/dashboard/team': { path: 'team.directory.view' },
  '/dashboard/attendance': { path: 'attendance.record.view' },
  '/dashboard/salary': { module: 'salary', action: 'view' },
  // S3 IA - shifts are the workspace SHIFT CATALOG (Morning, Day, Evening,
  // Night, Custom). Members consume their assigned shift's name + times via
  // team-member display + attendance views, not via this admin route. Gate
  // on `edit` (Manager/HR/Owner) so the sidebar entry is hidden from
  // Worker/Member and a deep-link redirects with the standard toast. Owner
  // bypass is automatic via useMyPermissions. Mirrors Holiday H3 IA.
  '/dashboard/shifts': { module: 'shifts', action: 'edit' },
  // H3 IA - holidays are workspace-global reference data; members consume
  // them via the leave calendar / attendance views, not a dedicated nav entry.
  // Gate on `edit` (Manager/HR/Owner) so the sidebar entry is hidden from
  // Worker/Member and a deep-link redirects with the standard toast. Owner
  // bypass is automatic via useMyPermissions.
  '/dashboard/holidays': { module: 'holidays', action: 'edit' },
  // Leave - visible to anyone with leave access (workers see self-service,
  // managers/HR see the admin surfaces). The index route redirects by role;
  // per-sub-route ROUTE_PERMISSIONS below enforce the actual gates.
  '/dashboard/leave': { path: 'leave.request.view' },

  // Finance hub + everything underneath. Finance sub-routes nested under
  // /dashboard/finance/firms/:firmId/* - the route-level guard handles
  // those via prefix match (see ROUTE_PERMISSIONS below).
  'finance-submenu': { module: 'finance', action: 'view' },
  '/dashboard/finance': { module: 'finance', action: 'view' },
  'finance-bank-reconciliation': { module: 'finance', action: 'view' },
  'portal-access-entry': { module: 'finance', action: 'view' },

  // Machines (parent + sub-pages each gated at BE).
  'machines-submenu': { module: 'machines', action: 'view' },
  '/dashboard/machines': { module: 'machines', action: 'view' },
  // Shop Floor Control - read surface; BE gates work-order writes on
  // machines.edit + machines_basic sub-feature.
  '/dashboard/machines/shop-floor': { module: 'machines', action: 'view' },
  '/dashboard/machines/locations': { module: 'locations', action: 'view' },
  '/dashboard/machines/resource-scopes': { module: 'resource_scopes', action: 'view' },
  '/dashboard/machines/production-logs/bulk': { module: 'machines', action: 'manage_production' },
  '/dashboard/production-utilisation': { module: 'machines', action: 'dashboard.production.view' },
  '/dashboard/settings/downtime-reasons': { module: 'downtime', action: 'view' },

  // Workspace settings sub-pages with explicit BE permission gates.
  '/dashboard/roles': { module: 'roles', action: 'view' },
  '/dashboard/workspace': { module: 'workspaces', action: 'view' },
  '/dashboard/settings/tally-export': { module: 'finance', action: 'export' },
  '/dashboard/settings/fy-close': { module: 'finance', action: 'edit' },
  '/dashboard/settings/party-intelligence': { module: 'finance', action: 'view' },
};

/**
 * F2 - nav keys reachable by any authenticated workspace member (the nav
 * equivalent of the backend `@AuthenticatedOnly`): account-shaped entries
 * and actions whose destination pages do their own gating. A leaf nav key
 * in neither `NAV_PERMISSIONS` nor this set is denied by default.
 */
export const OPEN_NAV_KEYS = new Set<string>([
  '/dashboard', // home - safe harbor
  'create', // quick-create action - its destinations gate themselves
  'pending-invites-group', // a member's own pending invites
  '/admin/localization', // conditionally added to nav for localization managers
]);

/**
 * Route permission map for the deep-link guard. Prefix-matched -
 * `/dashboard/team/[id]` inherits from `/dashboard/team`.
 *
 * `resolveRoutePerm()` returns the longest-prefix match so a more-specific
 * route can override a parent if ever needed. Today every entry is a
 * direct mirror of the BE `@RequirePermissions(...)` guard on the
 * corresponding controller method.
 */
export const ROUTE_PERMISSIONS: Array<{ prefix: string; perm: RequiredPerm | 'open' }> = [
  // Phase 1d - Team is path-migrated. Both list + detail routes gate on
  // the registry path; the more-specific `/dashboard/team/new` prefix
  // below overrides for the create flow.
  { prefix: '/dashboard/team', perm: { path: 'team.directory.view' } },
  // Attendance - path-migrated (FE slice 1). The index is scope-composed
  // (self → own attendance surface); each manager sub-route mirrors the BE
  // `@RequirePermission('<path>')` on its controller. Longest-prefix match
  // means each sub-route overrides the broad index entry.
  { prefix: '/dashboard/attendance', perm: { path: 'attendance.record.view' } },
  { prefix: '/dashboard/attendance/overview', perm: { path: 'attendance.analytics.view' } },
  { prefix: '/dashboard/attendance/live', perm: { path: 'attendance.analytics.view' } },
  { prefix: '/dashboard/attendance/grid', perm: { path: 'attendance.analytics.view' } },
  // Unified Reports page (overtime + compliance + patterns tabs).
  { prefix: '/dashboard/attendance/reports', perm: { path: 'attendance.analytics.view' } },
  // Legacy redirect stubs - keep so in-flight direct-URL visits pass the gate.
  { prefix: '/dashboard/attendance/overtime', perm: { path: 'attendance.analytics.view' } },
  { prefix: '/dashboard/attendance/compliance', perm: { path: 'attendance.analytics.view' } },
  { prefix: '/dashboard/attendance/patterns', perm: { path: 'attendance.analytics.view' } },
  { prefix: '/dashboard/attendance/devices', perm: { path: 'attendance.device.manage' } },
  { prefix: '/dashboard/attendance/unassigned', perm: { path: 'attendance.device.manage' } },
  { prefix: '/dashboard/attendance/kiosk-setup', perm: { path: 'attendance.device.manage' } },
  { prefix: '/dashboard/attendance/anomalies', perm: { path: 'attendance.anomaly.manage' } },
  {
    prefix: '/dashboard/attendance/regularizations',
    perm: { path: 'regularization.request.view', scope: 'all' },
  },
  // Unified Data page (import + statutory tabs) - export is the broader gate;
  // the import tab self-gates record.mark inside the page.
  { prefix: '/dashboard/attendance/data', perm: { path: 'attendance.export.export' } },
  // Legacy redirect stubs - keep so in-flight direct-URL visits pass the gate.
  {
    prefix: '/dashboard/attendance/import',
    perm: { path: 'attendance.record.mark', scope: 'all' },
  },
  { prefix: '/dashboard/attendance/statutory', perm: { path: 'attendance.export.export' } },
  { prefix: '/dashboard/attendance/settings', perm: { path: 'attendance.policy.manage' } },
  {
    // Mirrors @RequirePermission('attendance.policy.manage').
    prefix: '/dashboard/attendance/settings/policies',
    perm: { path: 'attendance.policy.manage' },
  },
  { prefix: '/dashboard/salary', perm: { module: 'salary', action: 'view' } },
  {
    prefix: '/dashboard/salary/run-payroll',
    perm: { module: 'salary', action: 'view', scope: 'all' },
  },
  {
    prefix: '/dashboard/salary/payments',
    perm: { module: 'salary', action: 'view', scope: 'all' },
  },
  { prefix: '/dashboard/salary/settings', perm: { module: 'salary', action: 'edit' } },
  {
    prefix: '/dashboard/salary/tds',
    perm: { module: 'salary', action: 'view', scope: 'all' },
  },
  // Advance-request approval queue. Mirrors the BE approve/reject guard
  // (@RequirePermissions(SALARY, EDIT, 'all')). Workers reach their own
  // requests via MySalary, never this route.
  {
    prefix: '/dashboard/salary/advance-requests',
    perm: { module: 'salary', action: 'edit', scope: 'all' },
  },
  // Leave - the index redirects by role; longest-prefix match gates each
  // surface. `/me` is worker self-service (`view`/self); the admin surfaces
  // mirror @RequirePermissions(LEAVE, MANAGE_LEAVE); `/calendar` is a team
  // read (`view`/all).
  { prefix: '/dashboard/leave', perm: { path: 'leave.request.view' } },
  { prefix: '/dashboard/leave/me', perm: { path: 'leave.request.view', scope: 'self' } },
  { prefix: '/dashboard/leave/approvals', perm: { path: 'leave.approval.decide' } },
  { prefix: '/dashboard/leave/config', perm: { path: 'leave.type.manage' } },
  { prefix: '/dashboard/leave/settings', perm: { path: 'leave.settings.manage' } },
  { prefix: '/dashboard/leave/balances', perm: { path: 'leave.balance.view', scope: 'all' } },
  { prefix: '/dashboard/leave/calendar', perm: { path: 'leave.request.view', scope: 'all' } },
  // S3 IA - same as the NAV_PERMISSIONS entry above; manager+ only. Workers
  // / Members never reach the admin route; their shift assignment is visible
  // in team + attendance contexts.
  { prefix: '/dashboard/shifts', perm: { module: 'shifts', action: 'edit' } },
  // H3 IA - same as the NAV_PERMISSIONS entry above; manager+ only.
  { prefix: '/dashboard/holidays', perm: { module: 'holidays', action: 'edit' } },
  { prefix: '/dashboard/finance', perm: { module: 'finance', action: 'view' } },
  { prefix: '/dashboard/machines/locations', perm: { module: 'locations', action: 'view' } },
  {
    prefix: '/dashboard/machines/resource-scopes',
    perm: { module: 'resource_scopes', action: 'view' },
  },
  { prefix: '/dashboard/machines', perm: { module: 'machines', action: 'view' } },
  {
    prefix: '/dashboard/maintenance',
    perm: { module: 'machines', action: 'machines.maintenance.schedule' },
  },
  {
    // Mirrors the BE @RequirePermissions(...) decorator action value.
    prefix: '/dashboard/production-utilisation',
    perm: { module: 'machines', action: 'dashboard.production.view' },
  },
  { prefix: '/dashboard/parties', perm: { module: 'finance', action: 'view' } },
  { prefix: '/dashboard/bills', perm: { module: 'bills', action: 'view' } },
  { prefix: '/dashboard/reports', perm: { module: 'finance', action: 'view' } },
  { prefix: '/dashboard/settings/firm', perm: { module: 'finance', action: 'edit' } },
  { prefix: '/dashboard/roles', perm: { module: 'roles', action: 'view' } },
  { prefix: '/dashboard/workspace', perm: { module: 'workspaces', action: 'view' } },
  // Notification settings sub-page - requires workspaces.edit (mirrors the BE
  // PATCH /workspaces/:id/notification-policy @RequirePermissions guard).
  {
    prefix: '/dashboard/workspace/notifications',
    perm: { module: 'workspaces', action: 'edit' },
  },
  {
    prefix: '/dashboard/settings/downtime-reasons',
    perm: { module: 'downtime', action: 'view' },
  },
  {
    prefix: '/dashboard/settings/tally-export',
    perm: { module: 'finance', action: 'export' },
  },
  { prefix: '/dashboard/settings/fy-close', perm: { module: 'finance', action: 'edit' } },
  {
    prefix: '/dashboard/settings/party-intelligence',
    perm: { module: 'finance', action: 'view' },
  },
  // F2 - precise gate for the create wizard. Audit §6: it was reachable
  // with only team.view via the coarse `/dashboard/team` prefix; the
  // longer prefix wins, so this requires team.create.
  // Phase 1d - Team is path-migrated. Member-creation gate is the
  // hierarchical path; `team.member.create` is `scoped: false` (no scope
  // axis), so no `scope` arg.
  { prefix: '/dashboard/team/new', perm: { path: 'team.member.create' } },
  // F2 - account-shaped routes open to any authenticated workspace member,
  // listed so deny-by-default does not 403 them. The gated
  // `/dashboard/settings/*` sub-routes above keep their longer-prefix
  // entries (longest-prefix wins).
  { prefix: '/dashboard/profile', perm: 'open' },
  { prefix: '/dashboard/invitations', perm: 'open' },
  { prefix: '/dashboard/settings', perm: 'open' },
  { prefix: '/dashboard/subscription', perm: 'open' },
];

/**
 * Resolve a route's permission. F2 (fail-closed) - three outcomes:
 *   - a `RequiredPerm` → the caller must satisfy it;
 *   - `'open'`         → reachable by any authenticated workspace member;
 *   - `null`           → no mapping → DENY (deny-by-default).
 * `/dashboard` (home) is the safe-harbor - always open.
 */
export function resolveRoutePerm(pathname: string): RequiredPerm | 'open' | null {
  if (pathname === '/dashboard') return 'open';
  let best: { prefix: string; perm: RequiredPerm | 'open' } | null = null;
  for (const row of ROUTE_PERMISSIONS) {
    if (pathname === row.prefix || pathname.startsWith(row.prefix + '/')) {
      if (!best || row.prefix.length > best.prefix.length) best = row;
    }
  }
  return best?.perm ?? null;
}

/**
 * Plan/subscription route -> module map for the central PLAN gate in
 * `DashboardLayout.tsx`. This is the entitlement (plan) twin of
 * `ROUTE_PERMISSIONS` above: that map answers "is the caller's ROLE allowed
 * here?", this one answers "does the workspace's PLAN include this module?".
 *
 * Why this exists: module (plan) locking used to be enforced ONLY per-page
 * via `<ModuleLockedPage>` (see app/dashboard/machines/page.tsx). Any page
 * that forgot that guard (the Team screens did) stayed reachable by typing
 * the URL even while the sidebar showed the module locked with a crown. The
 * central gate closes that whole class of gap in one chokepoint.
 *
 * Module keys mirror the entitlement keys in `entitlements.moduleAccess[].module`
 * (the same strings `Sidebar.tsx`'s `useModuleEnabled(...)` reads), NOT the BE
 * RBAC `AppModule` values used by `ROUTE_PERMISSIONS` - the two axes mostly
 * overlap but are not identical (e.g. workspace settings is RBAC `workspaces`
 * but entitlement `settings`).
 *
 * Semantics differ from ROUTE_PERMISSIONS on purpose:
 *   - FAIL-OPEN on no match: an unmapped route returns `null` -> the plan gate
 *     does nothing and the route's own per-page guard (still present on ~60
 *     pages) remains the backstop. We only hard-block routes we are certain
 *     map 1:1 to a plan module, so a mapping mistake can never lock a user out
 *     of an account/settings/subscription page.
 *   - Longest-prefix wins (same as resolveRoutePerm) so a deeper route can pin
 *     a more specific module (e.g. machines/locations -> `locations`).
 *   - Plan limits apply to OWNERS too, so the gate does NOT exempt owners
 *     (unlike the RBAC gate). Platform admins are excluded upstream via
 *     `permissionGate` (mode==='erp' && !user.isAdmin).
 *
 * Keep each entry's module in sync with the matching `useModuleEnabled(...)`
 * call in `Sidebar.tsx` so the gate and the crown badge never disagree.
 */
export const ROUTE_MODULES: Array<{ prefix: string; module: string }> = [
  { prefix: '/dashboard/team', module: 'team' },
  { prefix: '/dashboard/attendance', module: 'attendance' },
  { prefix: '/dashboard/leave', module: 'leave' },
  { prefix: '/dashboard/shifts', module: 'shifts' },
  { prefix: '/dashboard/holidays', module: 'holidays' },
  { prefix: '/dashboard/salary', module: 'salary' },
  // Finance hub + every firm-scoped sub-route (prefix match). Sub-MODULES
  // (inventory / manufacturing / job-work / gst) layer ON TOP of `finance`
  // and keep their own per-page sub-feature guards; the gate only ensures the
  // top-level Finance plan module is present.
  //
  // ManekHR (EXCLUDE enforcement): finance + all its sub-modules + machines +
  // its sub-modules are `enabled:false` in the ManekHR preset, so each prefix
  // below makes a typed-in deep link plan-locked (ModuleLockedPage). The
  // firm-scoped sub-module routes (`.../firms/[firmId]/inventory`, `/gst`,
  // `/manufacturing`, `/job-work`, `/reminders`) carry a DYNAMIC firmId
  // segment, so a static longer-prefix cannot pin them to their own module —
  // they are already blocked by this `/dashboard/finance` -> `finance` parent
  // entry (finance off => the whole subtree is locked). Mirrors Sidebar's
  // `useModuleEnabled` keys 1:1.
  { prefix: '/dashboard/finance', module: 'finance' },
  { prefix: '/dashboard/parties', module: 'finance' },
  { prefix: '/dashboard/reports', module: 'finance' },
  // Legacy AP/AR Bills tracker — a Finance surface (entitlement `finance`).
  // The BE controller gates only on RBAC (`finance.payable.*`), so this
  // deep-link entry is the web plan-gate twin that blocks owners too.
  { prefix: '/dashboard/bills', module: 'finance' },
  { prefix: '/dashboard/machines', module: 'machines' },
  // Longer prefixes override `/dashboard/machines` -> `machines` above.
  { prefix: '/dashboard/machines/locations', module: 'locations' },
  { prefix: '/dashboard/machines/resource-scopes', module: 'resource_scopes' },
  // Machines ops surfaces that live OUTSIDE the `/dashboard/machines` prefix —
  // each belongs to the `machines` plan module (mirrors the BE
  // @RequireSubscription({ module: MACHINES }) on maintenance /
  // production-utilisation).
  { prefix: '/dashboard/maintenance', module: 'machines' },
  { prefix: '/dashboard/production-utilisation', module: 'machines' },
  { prefix: '/dashboard/roles', module: 'roles' },
  // Settings sub-pages that belong to EXCLUDED modules. `/dashboard/settings`
  // itself is the ON `settings` module (intentionally UNMAPPED so it falls
  // through), but these specific sub-pages are Finance / Downtime surfaces —
  // longest-prefix-wins pins each to its disabled module so a deep link is
  // plan-locked while the rest of Settings stays open.
  { prefix: '/dashboard/settings/firm', module: 'finance' },
  { prefix: '/dashboard/settings/finance', module: 'finance' },
  { prefix: '/dashboard/settings/tally-export', module: 'finance' },
  { prefix: '/dashboard/settings/fy-close', module: 'finance' },
  { prefix: '/dashboard/settings/party-intelligence', module: 'finance' },
  { prefix: '/dashboard/settings/downtime-reasons', module: 'downtime' },
];

/**
 * Resolve the plan module a route belongs to, or `null` when the route is not
 * a plan-gated module route (fail-open - see ROUTE_MODULES doc). Longest-prefix
 * match mirrors `resolveRoutePerm`.
 */
export function resolveRouteModule(pathname: string): string | null {
  let best: { prefix: string; module: string } | null = null;
  for (const row of ROUTE_MODULES) {
    if (pathname === row.prefix || pathname.startsWith(row.prefix + '/')) {
      if (!best || row.prefix.length > best.prefix.length) best = row;
    }
  }
  return best?.module ?? null;
}

export type CanFn = (module: string, action: string, scope?: PermissionScope) => boolean;
/** Phase 1d - path-check companion for `CanFn`. Required for evaluating
 *  `RequiredPerm` entries that use the `path` variant. */
export type CanPathFn = (path: string, scope?: PermissionScope) => boolean;

/** Evaluate a `RequiredPerm` against the caller's permission checks.
 *  Branches on the discriminated union - `path` form uses `canPath`,
 *  flat form uses `can`. */
function checkRequiredPerm(perm: RequiredPerm, can: CanFn, canPath: CanPathFn): boolean {
  if ('path' in perm && perm.path !== undefined) {
    return canPath(perm.path, perm.scope);
  }
  return can(perm.module, perm.action, perm.scope);
}

/**
 * Decide whether a nav item / dashboard tile / quick-action keyed by
 * `key` should render for the current user.
 *
 * Behaviour:
 *   - Owners always see everything (`isOwner` short-circuits).
 *   - F1 (fail-closed): while the permission state is unresolved
 *     (loading / no workspace / fetch error) we DENY - never render
 *     through. `DashboardLayout` holds the whole shell behind a skeleton
 *     until `/me/permissions` resolves, so this deny is the
 *     belt-and-suspenders backstop, not the primary gate.
 *   - F2 (fail-closed): a leaf with no permission row is denied unless its
 *     key is in `OPEN_NAV_KEYS`. Submenu parents are NOT gated here -
 *     `filterNavItems` shows a parent iff it has >=1 visible child.
 */
export function isItemAllowed(
  key: string | undefined,
  can: CanFn,
  canPath: CanPathFn,
  isOwner: boolean,
  loading: boolean,
  hasData: boolean,
): boolean {
  if (!key) return true;
  if (isOwner) return true;
  // F1 (fail-closed) - permissions unresolved → deny, never render-through.
  if (loading) return false;
  if (!hasData) return false;
  const required = NAV_PERMISSIONS[key];
  if (required) return checkRequiredPerm(required, can, canPath);
  // F2 (fail-closed) - no permission row → deny, unless explicitly open.
  return OPEN_NAV_KEYS.has(key);
}

/**
 * Recursive filter for an antd `MenuProps['items']` tree. Drops items
 * keyed by `NAV_PERMISSIONS` that the caller lacks. Submenu parents
 * collapse if every child gates out.
 *
 * Dividers (`type: 'divider'`) pass through unchanged. We strip any
 * divider that ends up adjacent to another divider, or at the start/end
 * of a section, post-filter.
 *
 * Typed loosely on purpose - the helper runs over heterogeneous arrays
 * (the expanded antd `MenuProps['items']` tree, the bespoke
 * `collapsedNavItems` shape with `isSubmenu`/`submenuKind` fields, and
 * the antd popup-menu arrays). All three share a `{key?, type?,
 * children?}` shape under the hood; the generic preserves the caller's
 * concrete type so render call sites see no `any` leakage.
 */
type FilterableShape = {
  key?: unknown;
  type?: unknown;
  children?: unknown;
};

export function filterNavItems<T>(
  items: ReadonlyArray<T>,
  can: CanFn,
  canPath: CanPathFn,
  isOwner: boolean,
  loading: boolean,
  hasData: boolean,
): T[] {
  const filtered: T[] = [];
  for (const rawItem of items) {
    if (rawItem == null) continue;
    const item = rawItem as FilterableShape;

    if (item.type === 'divider') {
      filtered.push(rawItem);
      continue;
    }

    const keyStr = typeof item.key === 'string' ? item.key : undefined;

    // F2 - a submenu PARENT is shown when it has >=1 visible child; it is
    // NOT gated by `isItemAllowed` (a submenu slug usually has no
    // permission row, and deny-by-default would otherwise drop the whole
    // branch). Only LEAF items are permission-gated.
    if (Array.isArray(item.children) && item.children.length > 0) {
      const nextChildren = filterNavItems(
        item.children as ReadonlyArray<T>,
        can,
        canPath,
        isOwner,
        loading,
        hasData,
      );
      if (nextChildren.length === 0) continue;
      filtered.push({ ...(rawItem as object), children: nextChildren } as T);
      continue;
    }

    if (!isItemAllowed(keyStr, can, canPath, isOwner, loading, hasData)) continue;
    filtered.push(rawItem);
  }

  // Collapse adjacent dividers and trim divider edges.
  const cleaned: T[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const cur = filtered[i];
    const curType = (cur as FilterableShape | null)?.type;
    if (cur != null && curType === 'divider') {
      const isFirst = cleaned.length === 0;
      const isLast = i === filtered.length - 1;
      const prev = cleaned[cleaned.length - 1];
      const prevType = (prev as FilterableShape | null)?.type;
      const prevIsDivider = prev != null && prevType === 'divider';
      if (isFirst || isLast || prevIsDivider) continue;
    }
    cleaned.push(cur);
  }
  return cleaned;
}
