/**
 * Web mirror of the backend `AppModule` enum at
 * crewroster-backend/src/common/enums/modules.enum.ts.
 *
 * Drives the role-builder UI (`/dashboard/roles`) and the future `<Can>`
 * component. Entries marked `assignable: false` are excluded from the role
 * builder (auth + feedback are not workspace-permission gateable).
 *
 * Kept in lockstep with backend enum values (lowercase snake_case keys); BE
 * is source-of-truth - when adding a new module BE-side, mirror here.
 */
export type ModuleDomain = 'operations' | 'finance' | 'machines' | 'admin' | 'system';

export interface ModuleDef {
  key: string;
  label: string;
  /** UI grouping in role builder; not used by RolesGuard. */
  domain: ModuleDomain;
  /** Lowercase snake_case action keys matching `ModuleAction` enum on BE. */
  actions: string[];
  /** True for modules that show up in role-builder UI. False for infra-only. */
  assignable: boolean;
  /** True for legacy / deprecated modules - kept for backward-compat with old roles. */
  deprecated?: boolean;
  /**
   * Wave 5 W5.4 (2026-05-10) - actions that are workspace-OWNER only at
   * runtime via RolesGuard owner-bypass. They surface in the role builder
   * with a locked badge (display-only) so owners see what's reserved; the
   * toggles are not assignable to custom roles. Mirrors the F-15 / F-16
   * permission lists at
   * `crewroster-backend/src/modules/rbac/permissions.constants.ts:75-107`.
   */
  ownerOnlyActions?: string[];
}

export const MODULES: ModuleDef[] = [
  // ─── Operations (HR / floor) ────────────────────────────────────────────
  {
    key: 'attendance',
    label: 'Attendance',
    domain: 'operations',
    actions: [
      'view',
      'mark',
      'edit',
      'export',
      'manage_devices',
      'manage_policies',
      'manage_regularizations',
      'manage_anomalies',
    ],
    assignable: true,
  },
  {
    key: 'team',
    label: 'Team',
    domain: 'operations',
    actions: ['view', 'add', 'edit', 'remove'],
    assignable: true,
  },
  {
    key: 'salary',
    label: 'Salary',
    domain: 'operations',
    actions: ['view', 'add_payment', 'edit', 'export'],
    assignable: true,
  },
  {
    key: 'shifts',
    label: 'Shifts',
    domain: 'operations',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
  },
  {
    key: 'holidays',
    label: 'Holidays',
    domain: 'operations',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
  },
  {
    key: 'regularization',
    label: 'Regularization',
    domain: 'operations',
    actions: ['view', 'manage_regularizations'],
    assignable: true,
  },
  // ─── Machines / production floor ────────────────────────────────────────
  {
    key: 'machines',
    label: 'Machines',
    domain: 'machines',
    actions: ['view', 'create', 'edit', 'remove', 'assign', 'manage_production'],
    assignable: true,
  },
  {
    key: 'locations',
    label: 'Locations',
    domain: 'machines',
    actions: ['view', 'create', 'edit', 'remove'],
    assignable: true,
  },
  {
    key: 'downtime',
    label: 'Downtime',
    domain: 'machines',
    actions: ['view', 'create', 'edit'],
    assignable: true,
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    domain: 'machines',
    actions: ['view', 'create', 'edit'],
    assignable: true,
  },
  // ─── Finance ────────────────────────────────────────────────────────────
  // NOTE: the FINANCE BILLING surface (invoices, credit notes, expenses,
  // payments) is migrating onto the new path-RBAC model (design spec
  // 2026-06-01 SS6.B). Its hierarchical leaves (`finance.invoice.*`,
  // `finance.creditNote.create`, etc.) are served at runtime by the BE
  // `GET /rbac/registry` endpoint and rendered by `<PermissionGrid>` from
  // that catalog - they do NOT live in this flat mirror. This flat entry
  // remains the legacy `AppModule.FINANCE` action surface for the non-billing
  // finance sub-modules still on `@RequirePermissions`; the billing-specific
  // actions (post / send / record_payment) are listed here too so any flat
  // rendering of finance is complete.
  {
    key: 'finance',
    label: 'Finance',
    domain: 'finance',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'post', 'send', 'record_payment'],
    assignable: true,
  },
  {
    key: 'finance:admin',
    label: 'Finance - Admin',
    domain: 'finance',
    actions: ['view', 'edit'],
    // F-15 (Phase 16) - owner-only finance admin actions. Bypass RBAC via
    // RolesGuard owner check; non-owners 403 even if the role grants them.
    // Surfaced here for visibility; toggles are display-only.
    ownerOnlyActions: ['tally_export', 'fy_close', 'fy_reopen', 'party_portal_manage'],
    assignable: true,
  },
  {
    key: 'finance:accountant',
    label: 'Finance - Accountant',
    domain: 'finance',
    actions: ['view', 'edit'],
    // F-16 (Phase 17) - owner-only party-intelligence + RFM tuning actions.
    // Same display-only treatment as F-15.
    ownerOnlyActions: [
      'manage_party_intelligence',
      'set_blacklist',
      'edit_rfm_thresholds',
      'manage_greeting_templates',
      'recheck_gstin',
    ],
    assignable: true,
  },
  {
    key: 'gst_compliance',
    label: 'GST Compliance',
    domain: 'finance',
    actions: ['view', 'create', 'edit', 'export'],
    assignable: true,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    domain: 'finance',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
  },
  {
    key: 'manufacturing',
    label: 'Manufacturing',
    domain: 'finance',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
  },
  {
    key: 'job_work',
    label: 'Job Work',
    domain: 'finance',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
  },
  {
    key: 'bills',
    label: 'Bills (legacy)',
    domain: 'finance',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
    deprecated: true,
  },
  {
    key: 'reminders',
    label: 'Reminders',
    domain: 'finance',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
  },
  // ─── Admin / workspace ─────────────────────────────────────────────────
  {
    key: 'roles',
    label: 'Roles',
    domain: 'admin',
    actions: ['view', 'create', 'edit', 'delete'],
    assignable: true,
  },
  {
    key: 'settings',
    label: 'Workspace Settings',
    domain: 'admin',
    actions: ['view', 'edit'],
    assignable: true,
  },
  {
    key: 'workspaces',
    label: 'Workspace Management',
    domain: 'admin',
    actions: ['view', 'edit'],
    assignable: true,
  },
  // ─── System / infra (not assignable in role builder) ────────────────────
  {
    key: 'auth',
    label: 'Authentication',
    domain: 'system',
    actions: [],
    assignable: false,
  },
  {
    key: 'feedback',
    label: 'Feedback',
    domain: 'system',
    actions: [],
    assignable: false,
  },
  {
    key: 'resource_scopes',
    label: 'Resource Scopes',
    domain: 'system',
    actions: [],
    assignable: false,
  },
];

export const MODULE_MAP = Object.fromEntries(MODULES.map((m) => [m.key, m]));

/** Modules that show up in the role-builder UI (excludes auth/feedback/etc). */
export const ASSIGNABLE_MODULES = MODULES.filter((m) => m.assignable);

/** Group assignable modules by domain for UI rendering. */
export const ASSIGNABLE_MODULES_BY_DOMAIN: Record<ModuleDomain, ModuleDef[]> = {
  operations: [],
  finance: [],
  machines: [],
  admin: [],
  system: [],
};
ASSIGNABLE_MODULES.forEach((m) => {
  ASSIGNABLE_MODULES_BY_DOMAIN[m.domain].push(m);
});

export const DOMAIN_LABELS: Record<ModuleDomain, string> = {
  operations: 'Operations',
  finance: 'Finance',
  machines: 'Production',
  admin: 'Admin',
  system: 'System',
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  mark: 'Mark',
  edit: 'Edit',
  export: 'Export',
  add: 'Add',
  remove: 'Remove',
  add_payment: 'Add Payment',
  create: 'Create',
  delete: 'Delete',
  post: 'Post',
  send: 'Send',
  record_payment: 'Record Payment',
  assign: 'Assign',
  manage_devices: 'Manage Devices',
  manage_policies: 'Manage Policies',
  manage_regularizations: 'Manage Regularizations',
  manage_anomalies: 'Manage Anomalies',
  manage_production: 'Manage Production',
  // F-15 owner-only finance admin actions
  tally_export: 'Tally Export',
  fy_close: 'Close Financial Year',
  fy_reopen: 'Reopen Financial Year',
  party_portal_manage: 'Manage Party Portal',
  // F-16 owner-only party-intelligence actions
  manage_party_intelligence: 'Manage Party Intelligence',
  set_blacklist: 'Toggle Party Blacklist',
  edit_rfm_thresholds: 'Edit RFM Thresholds',
  manage_greeting_templates: 'Manage Greeting Templates',
  recheck_gstin: 'Recheck GSTIN Status',
};
