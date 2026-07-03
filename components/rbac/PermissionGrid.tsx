'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Collapse, Input, Segmented, Tag, Tooltip } from 'antd';
import type { CollapseProps } from 'antd';
import {
  LockOutlined,
  SafetyOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { GrantedPath, PermissionModuleDef, PermissionScope } from '@/types/rbac-registry';
import type { CellDraft, GridDraft, LeafPathRow } from '@/lib/rbac/permission-grid-payload';
import { isRegistryModule, leafPathsOfModule } from '@/lib/rbac/permission-grid-payload';
import { normaliseGridDraft } from '@/lib/rbac/grid-normalise';
import { InfoTooltip } from '@/components/ui';

/** Legacy module/action table - modules NOT yet in the registry render as
 *  flat rows here, exactly as the previous matrix did. As modules get
 *  path-classified backend-side (Phase 2+), they move out of this table
 *  and into the registry-driven section automatically. */
// Fix M2: per-action { name, scoped } objects replace parallel actions/scoped arrays.
const LEGACY_MODULES: ReadonlyArray<{
  module: string;
  actions: ReadonlyArray<{ name: string; scoped: boolean }>;
}> = [
  {
    module: 'attendance',
    actions: [
      { name: 'view', scoped: true },
      { name: 'mark', scoped: true },
      { name: 'edit', scoped: true },
      { name: 'export', scoped: false },
    ],
  },
  {
    module: 'salary',
    actions: [
      { name: 'view', scoped: true },
      { name: 'sensitive_view', scoped: false },
      { name: 'edit', scoped: true },
      { name: 'export', scoped: false },
      { name: 'add_payment', scoped: true },
      // Self-service salary advance: a worker grants this (self) to request an
      // advance on their own pay. Inert unless the workspace subscription
      // `advance_payments` + policy allow. Links: salary.request_advance backend
      // permission; MySalary "Request an advance" CTA.
      { name: 'request_advance', scoped: true },
      // Self-service 0% installment loan: a worker grants this (self) to apply
      // for an interest-free loan on their own salary. Inert unless the
      // workspace subscription `loan_management` + self-apply policy allow.
      // Links: salary.request_loan backend permission; MySalary "Apply for a
      // 0% loan" CTA. The humanized fallback in FlatActionRow renders the label
      // until `rbac.action.request_loan` is added natively.
      { name: 'request_loan', scoped: true },
      // Phase 3a (reporting-person review): lets a manager see and advisory-verify
      // their direct reports' advance requests (reportsTo-filtered). Does NOT gate
      // the owner's approve/reject; purely advisory. Links: salary.review_advance
      // BE permission; MySalary TeamAdvanceReviewCard.
      { name: 'review_advance', scoped: true },
      // Self-service tax declaration (OQ-S6): a worker grants this (self) to file
      // their OWN 80C/HRA investment declaration without a salary-edit grant.
      // Inert unless the workspace subscription `statutory_tds` allows. Links:
      // salary.declare_tax backend permission (salary.controller.ts
      // upsertTaxDeclaration); MySalary tax-declaration form.
      { name: 'declare_tax', scoped: true },
    ],
  },
  {
    module: 'shifts',
    actions: [
      { name: 'view', scoped: false },
      { name: 'create', scoped: false },
      { name: 'edit', scoped: false },
      { name: 'remove', scoped: false },
    ],
  },
  {
    module: 'holidays',
    actions: [
      { name: 'view', scoped: false },
      { name: 'create', scoped: false },
      { name: 'edit', scoped: false },
      { name: 'remove', scoped: false },
    ],
  },
  {
    module: 'machines',
    actions: [
      { name: 'view', scoped: false },
      { name: 'create', scoped: false },
      { name: 'edit', scoped: false },
      { name: 'remove', scoped: false },
      { name: 'assign', scoped: false },
    ],
  },
  {
    module: 'finance',
    actions: [
      { name: 'view', scoped: true },
      { name: 'create', scoped: false },
      { name: 'edit', scoped: true },
      { name: 'remove', scoped: false },
    ],
  },
  {
    module: 'inventory',
    actions: [
      { name: 'view', scoped: true },
      { name: 'create', scoped: false },
      { name: 'edit', scoped: true },
      { name: 'remove', scoped: false },
    ],
  },
  {
    module: 'reminders',
    actions: [
      { name: 'view', scoped: true },
      { name: 'create', scoped: false },
      { name: 'edit', scoped: true },
      { name: 'remove', scoped: false },
    ],
  },
  {
    module: 'settings',
    actions: [
      { name: 'view', scoped: false },
      { name: 'edit', scoped: false },
    ],
  },
];

export type PermissionGridMode = 'override' | 'role';

interface RoleGrantContextOverride {
  /** The assigned role's flat permissions - drives the inherit-state tag on flat rows. */
  roleFlat: ReadonlyArray<{ module: string; actions: string[]; actionScopes?: PermissionScope[] }>;
  /** The assigned role's path grants - drives the inherit-state tag on path rows. */
  rolePaths: ReadonlyArray<GrantedPath>;
}

export interface PermissionGridProps {
  /** Registry catalog (from `GET /rbac/registry`). Path-classified modules
   *  render as leaf-path rows; everything else falls through to `LEGACY_MODULES`. */
  registry: PermissionModuleDef[];
  /** Override mode adds the inherit tri-state + role-grant tag.
   *  Role mode is grant/no-grant only. */
  mode: PermissionGridMode;
  /** Required when `mode === 'override'` - drives the inherit-state display. */
  roleContext?: RoleGrantContextOverride;
  /** Current draft (controlled). */
  value: GridDraft;
  /** Draft changes - the consumer translates this into a save payload via
   *  `buildOverridesPayload` / `buildRolePayload`. */
  onChange: (next: GridDraft) => void;
  disabled?: boolean;
  /** When true, sensitive rows (registry nodes with `sensitive: true`)
   *  are visible. Default: false. The matrix surfaces a "Show sensitive"
   *  toggle that drives this prop. */
  showSensitive?: boolean;
}

export default function PermissionGrid(props: PermissionGridProps) {
  const { registry, mode, roleContext, value, onChange, disabled, showSensitive } = props;
  const t = useTranslations();

  // Search state - shared across all registry modules
  const [searchTerm, setSearchTerm] = useState('');
  const normalised = searchTerm.trim().toLowerCase();

  // Legacy modules that are NOT in the registry - rendered as the existing flat rows.
  const legacyModules = useMemo(
    () => LEGACY_MODULES.filter((m) => !isRegistryModule(m.module, registry)),
    [registry],
  );

  // Registry modules - rendered as leaf-path rows.
  const registryModules = useMemo(
    () => registry.map((m) => ({ mod: m, leaves: leafPathsOfModule(m) })),
    [registry],
  );

  // Auto-normalise reasons - re-computed whenever value, registry, or roleContext changes.
  // rolePaths is passed so deny-cascade auto-reasons (I-1) are surfaced in override mode.
  const { autoReasons } = useMemo(
    () => normaliseGridDraft(value, registry, roleContext?.rolePaths ?? []),
    [value, registry, roleContext?.rolePaths],
  );

  // Wrap onChange so every emitted draft is first normalised (view-edit
  // coherence + dep propagation + deny-cascade in override mode). Explicit
  // denies inside the raw draft are always preserved by normaliseGridDraft -
  // they are never auto-overridden.
  const handlePathCellChange = (path: string, cell: CellDraft | null) => {
    const nextRaw: GridDraft = {
      ...value,
      pathByCell: cell ? { ...value.pathByCell, [path]: cell } : omit(value.pathByCell, path),
    };
    const { draft } = normaliseGridDraft(nextRaw, registry, roleContext?.rolePaths ?? []);
    onChange(draft);
  };

  // Pre-filter registry leaves at the module level so the outer Collapse
  // can skip empty panels (search hides modules with zero matching leaves).
  const registryModulesVisible = registryModules
    .map(({ mod, leaves }) => ({
      mod,
      visibleLeaves: visibleLeavesForModule(leaves, normalised, !!showSensitive, t),
    }))
    .filter(({ visibleLeaves }) => visibleLeaves.length > 0 || !normalised);

  // Module-level Collapse - every module collapses to a panel. All open by
  // default; user can collapse modules they aren't editing. Scales naturally
  // for Phase 2+ when more modules join the registry.
  const moduleItems: CollapseProps['items'] = [
    ...registryModulesVisible.map(({ mod, visibleLeaves }) => ({
      key: `mod:${mod.module}`,
      label: (
        <span className="text-charcoal text-sm font-semibold">
          {safeLabel(t, mod.labelKey, mod.module)}
        </span>
      ),
      children: (
        <RegistryModuleBody
          visibleLeaves={visibleLeaves}
          mode={mode}
          rolePaths={roleContext?.rolePaths ?? []}
          draft={value.pathByCell}
          autoReasons={autoReasons}
          onCellChange={handlePathCellChange}
          disabled={disabled}
        />
      ),
    })),
    ...legacyModules.map((m) => ({
      key: `mod:${m.module}`,
      label: (
        <span className="text-charcoal text-sm font-semibold">
          {safeLabel(t, `rbac.module.${m.module}`, m.module)}
        </span>
      ),
      children: (
        <LegacyModuleBody
          moduleKey={m.module}
          actions={m.actions}
          mode={mode}
          roleFlat={roleContext?.roleFlat ?? []}
          draft={value.flatByCell}
          onCellChange={(action, cell) =>
            onChange({
              ...value,
              flatByCell: cell
                ? { ...value.flatByCell, [`${m.module}.${action}`]: cell }
                : omit(value.flatByCell, `${m.module}.${action}`),
            })
          }
          disabled={disabled}
        />
      ),
    })),
  ];

  // Presentational sectioning (Attendance rollout 2026-05-23): the matrix is
  // organised into labelled sections so related modules read as one area -
  // People (Team), Time & Attendance (attendance / leave / regularization /
  // holidays / shifts), Payroll (salary), and Other Modules (everything else).
  // Enforcement + subscription gating are unchanged; this is matrix
  // presentation only.
  const collapseClass =
    'rounded-xl border border-neutral-200 bg-white [&_.ant-collapse-content-box]:p-0 [&_.ant-collapse-header]:px-4 [&_.ant-collapse-header]:py-3 [&_.ant-collapse-item]:border-b [&_.ant-collapse-item]:border-neutral-100 [&_.ant-collapse-item:last-child]:border-b-0';
  const moduleKeyOf = (k: string) => k.replace(/^mod:/, '');
  const PEOPLE_MODULES = new Set(['team']);
  const TIME_MODULES = new Set(['attendance', 'leave', 'regularization', 'holidays', 'shifts']);
  const PAYROLL_MODULES = new Set(['salary']);
  const sectionOf = (key: string): 'people' | 'time' | 'payroll' | 'other' => {
    const m = moduleKeyOf(key);
    if (PEOPLE_MODULES.has(m)) return 'people';
    if (TIME_MODULES.has(m)) return 'time';
    if (PAYROLL_MODULES.has(m)) return 'payroll';
    return 'other';
  };
  const matrixSections = (
    [
      { key: 'people', labelKey: 'rbac.moduleGroup.people', fallback: 'People' },
      { key: 'time', labelKey: 'rbac.moduleGroup.timeAttendance', fallback: 'Time & Attendance' },
      { key: 'payroll', labelKey: 'rbac.moduleGroup.payroll', fallback: 'Payroll' },
      { key: 'other', labelKey: 'rbac.moduleGroup.other', fallback: 'Other Modules' },
    ] as const
  )
    .map((s) => ({
      ...s,
      items: moduleItems.filter((it) => sectionOf(it.key as string) === s.key),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Search input - applies only to registry-driven sections.
          Plain `<Input prefix={...}>` (NOT `<Input.Search>`) because the
          Search variant injects a separate button that detaches visually
          inside a narrow container; single-box prefix-icon is cleaner UX.
          Explicit `style.width` - `<Input>` with prefix-only collapses to
          icon-width (~48px) inside an inline-flex wrapper without it. */}
      {registryModules.length > 0 && (
        <Input
          aria-label={t('rbac.matrix.searchPlaceholder')}
          placeholder={t('rbac.matrix.searchPlaceholder')}
          prefix={<SearchOutlined className="text-neutral-400" />}
          allowClear
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: 360 }}
        />
      )}
      {matrixSections.map((section) => (
        <section key={section.key} className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5 px-0.5">
            <span aria-hidden className="h-3.5 w-1 rounded-full bg-[var(--cr-primary)]" />
            <h3 className="text-charcoal m-0 text-[11px] font-semibold tracking-[0.08em] uppercase">
              {safeLabel(t, section.labelKey, section.fallback)}
            </h3>
            <span aria-hidden className="h-px flex-1 bg-neutral-200" />
          </div>
          <Collapse
            defaultActiveKey={section.items.map((i) => i.key as string)}
            items={section.items}
            className={collapseClass}
          />
        </section>
      ))}
    </div>
  );
}

/** Pure helper - returns a shallow copy of `obj` without `key`. Does not mutate. */
function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next: Record<string, unknown> = { ...obj };
  delete next[key];
  return next as T;
}

/**
 * Defensive translation lookup. `t(key)` throws AND logs to `console.error`
 * via next-intl's default `onError` handler when the key resolves to an
 * object (`INSUFFICIENT_PATH`) - happens any time the BE registry is stale
 * relative to the FE i18n schema (e.g. `rbac.team.profile` was a label
 * before Phase 1d, now an object container under `rbac.team.profileGroup`).
 *
 * `t.raw(key)` does NOT log/throw on object values - it returns the raw
 * message (string OR object OR undefined) as-is. We inspect the result
 * type and only treat strings as renderable labels; everything else falls
 * back. This keeps the dev console clean during registry drift.
 */
function safeLabel(t: ReturnType<typeof useTranslations>, key: string, fallback: string): string {
  try {
    const raw = t.raw(key);
    return typeof raw === 'string' ? raw : fallback;
  } catch {
    return fallback;
  }
}

/** Like `safeLabel` but returns `null` when the key is missing / not a string,
 *  so a caller can conditionally render (e.g. a feature info icon only when
 *  help text actually exists for that feature). */
function optionalLabel(t: ReturnType<typeof useTranslations>, key: string): string | null {
  try {
    const raw = t.raw(key);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Pure - filter a module's leaves by sensitive-toggle + search term. */
function visibleLeavesForModule(
  leaves: LeafPathRow[],
  searchNormalised: string,
  showSensitive: boolean,
  t: ReturnType<typeof useTranslations>,
): LeafPathRow[] {
  const sensFiltered = leaves.filter((l) => showSensitive || !l.sensitive);
  if (!searchNormalised) return sensFiltered;
  return sensFiltered.filter((l) => {
    const leafLabelKey = l.labelKeyChain[l.labelKeyChain.length - 1];
    const label =
      `${safeLabel(t, leafLabelKey, l.path)} ${safeLabel(t, `rbac.action.${l.action}`, l.action)}`.toLowerCase();
    return label.includes(searchNormalised);
  });
}

// Fix M1: shared helper - avoids duplicating the tristate/allowScope derivation
// in PathLeafRow and FlatActionRow.
function resolveCellState(cell: CellDraft | null): {
  tristate: 'inherit' | 'allow' | 'deny';
  allowScope: PermissionScope;
} {
  const tristate: 'inherit' | 'allow' | 'deny' =
    cell == null ? 'inherit' : cell.allowed ? 'allow' : 'deny';
  const allowScope: PermissionScope = cell?.allowed ? (cell.scope ?? 'self') : 'self';
  return { tristate, allowScope };
}

// ── Registry module (Team) - leaf-path rows ──────────────────────────────

/** Group leaf rows by their feature key for the Collapse accordion. */
interface FeatureGroup {
  featureKey: string;
  featureLabelKey: string;
  sensitive: boolean;
  leaves: LeafPathRow[];
}

function groupByFeature(leaves: LeafPathRow[]): FeatureGroup[] {
  const map = new Map<string, FeatureGroup>();
  for (const leaf of leaves) {
    if (!map.has(leaf.feature)) {
      // First labelKey in the chain is the feature node's own labelKey
      const featureLabelKey = leaf.labelKeyChain[0] ?? '';
      map.set(leaf.feature, {
        featureKey: leaf.feature,
        featureLabelKey,
        sensitive: !!leaf.sensitive,
        leaves: [],
      });
    }
    map.get(leaf.feature)!.leaves.push(leaf);
  }
  return [...map.values()];
}

/** Registry modules whose features carry `rbac.help.*` popover text. Probing
 *  a missing help key via `t.raw` logs a MISSING_MESSAGE to the console, so the
 *  matrix only looks up help for these modules. Extend when more modules get
 *  help text. */
const HELP_FEATURE_MODULES = new Set(['attendance', 'leave', 'regularization', 'holidays']);

/** Renders the inner feature-Collapse for one registry module. Receives
 *  already-filtered visible leaves; renders null when empty so the outer
 *  module-Collapse can skip the panel entirely. */
function RegistryModuleBody(props: {
  visibleLeaves: LeafPathRow[];
  mode: PermissionGridMode;
  rolePaths: ReadonlyArray<GrantedPath>;
  draft: Record<string, CellDraft>;
  autoReasons: Map<string, string>;
  onCellChange: (path: string, cell: CellDraft | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const { visibleLeaves, mode, rolePaths, draft, autoReasons, onCellChange, disabled } = props;

  if (visibleLeaves.length === 0) return null;

  const featureGroups = groupByFeature(visibleLeaves);

  // Non-sensitive features default open; sensitive features start collapsed.
  const defaultActiveKeys = featureGroups.filter((g) => !g.sensitive).map((g) => g.featureKey);

  const collapseItems: CollapseProps['items'] = featureGroups.map((group) => {
    const featureLabel = safeLabel(t, group.featureLabelKey, group.featureKey);
    // Optional per-feature help popover. Gate on the module first so we never
    // probe a non-existent `rbac.help.*` key (which next-intl logs to the
    // console). Derives `rbac.<module>.<feature>` → `rbac.help.<module>.<feature>`.
    const featureModule = group.featureLabelKey.split('.')[1] ?? '';
    const helpText = HELP_FEATURE_MODULES.has(featureModule)
      ? optionalLabel(t, group.featureLabelKey.replace(/^rbac\./, 'rbac.help.'))
      : null;
    return {
      key: group.featureKey,
      label: (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-neutral-500 uppercase">
          {featureLabel}
          {helpText && (
            <InfoTooltip
              text={featureLabel}
              body={<span className="normal-case">{helpText}</span>}
            />
          )}
        </span>
      ),
      children: (
        <ul className="divide-y divide-neutral-100">
          {group.leaves.map((leaf) => (
            <PathLeafRow
              key={leaf.path}
              leaf={leaf}
              mode={mode}
              roleGrant={rolePaths.find((g) => g.path === leaf.path) ?? null}
              cell={draft[leaf.path] ?? null}
              autoReason={autoReasons.get(leaf.path) ?? null}
              onChange={(cell) => onCellChange(leaf.path, cell)}
              disabled={disabled}
            />
          ))}
        </ul>
      ),
    };
  });

  return (
    <Collapse
      defaultActiveKey={defaultActiveKeys}
      ghost
      items={collapseItems}
      className="[&_.ant-collapse-content-box]:p-0 [&_.ant-collapse-header]:px-4 [&_.ant-collapse-header]:py-2.5"
    />
  );
}

function PathLeafRow(props: {
  leaf: LeafPathRow;
  mode: PermissionGridMode;
  roleGrant: GrantedPath | null;
  cell: CellDraft | null;
  /** When non-null, this path was auto-set by normalisation - show `auto` badge. */
  autoReason: string | null;
  onChange: (cell: CellDraft | null) => void;
  disabled?: boolean;
}) {
  // Fix M4: call useTranslations directly.
  const t = useTranslations();
  const { leaf, mode, roleGrant, cell, autoReason, onChange, disabled } = props;

  // Fix M1: use shared helper instead of inline derivation.
  const { tristate, allowScope } = resolveCellState(cell);

  const leafLabelKey = leaf.labelKeyChain[leaf.labelKeyChain.length - 1];
  const label = `${t(leafLabelKey)} · ${t(`rbac.action.${leaf.action}`)}`;

  const autoTooltip = autoReason
    ? autoReason === 'view-widened-by-edit'
      ? t('rbac.matrix.autoViewWidened')
      : autoReason.startsWith('required-by:')
        ? t('rbac.matrix.autoRequiredBy', {
            requirer: autoReason.slice('required-by:'.length),
          })
        : autoReason.startsWith('auto-denied-by-view-deny:')
          ? t('rbac.matrix.autoDeniedByViewDeny')
          : autoReason.startsWith('auto-denied-by-dep-deny:')
            ? t('rbac.matrix.autoDeniedByDepDeny')
            : t('rbac.matrix.auto')
    : null;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-charcoal truncate text-sm">{label}</span>
        {mode === 'override' && tristate === 'inherit' && roleGrant ? (
          <Tag color="default" className="mt-0.5 w-fit">
            {t('rbac.matrix.inheritRoleAllow', { scope: t(`rbac.scope.${roleGrant.scope}`) })}
          </Tag>
        ) : null}
        {leaf.sensitive ? (
          <Tooltip title={t('rbac.matrix.sensitiveTooltip')}>
            <Tag
              color="gold"
              className="mt-0.5 w-fit cursor-help"
              aria-label={t('rbac.matrix.sensitiveAriaLabel')}
            >
              <LockOutlined /> {t('rbac.matrix.sensitive')}
            </Tag>
          </Tooltip>
        ) : null}
        {leaf.sodOwnerOnlyOnSelf ? (
          <Tooltip title={t('rbac.matrix.sodTooltip')}>
            <Tag
              color="purple"
              className="mt-0.5 w-fit cursor-help"
              aria-label={t('rbac.matrix.sodAriaLabel')}
            >
              <SafetyOutlined /> {t('rbac.matrix.sodBadge')}
            </Tag>
          </Tooltip>
        ) : null}
        {autoTooltip ? (
          <Tooltip title={autoTooltip}>
            <Tag color="blue" className="mt-0.5 w-fit cursor-help">
              <ThunderboltOutlined /> {t('rbac.matrix.autoBadge')}
            </Tag>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {mode === 'override' ? (
          <Segmented
            value={tristate}
            disabled={disabled}
            onChange={(next) => {
              if (next === 'inherit') return onChange(null);
              if (next === 'allow') return onChange({ allowed: true, scope: allowScope });
              return onChange({ allowed: false });
            }}
            options={[
              { value: 'inherit', label: t('rbac.matrix.inherit') },
              { value: 'allow', label: t('rbac.matrix.allow') },
              { value: 'deny', label: t('rbac.matrix.deny') },
            ]}
          />
        ) : (
          <Segmented
            value={cell?.allowed ? 'grant' : 'no'}
            disabled={disabled}
            onChange={(next) =>
              next === 'grant' ? onChange({ allowed: true, scope: allowScope }) : onChange(null)
            }
            options={[
              { value: 'no', label: t('rbac.matrix.no') },
              { value: 'grant', label: t('rbac.matrix.grant') },
            ]}
          />
        )}
        {tristate === 'allow' && leaf.scoped ? (
          <Segmented
            value={allowScope}
            disabled={disabled}
            onChange={(next) => onChange({ allowed: true, scope: next as PermissionScope })}
            options={[
              { value: 'self', label: t('rbac.scope.self') },
              { value: 'all', label: t('rbac.scope.all') },
            ]}
          />
        ) : null}
      </div>
    </li>
  );
}

// ── Legacy module (Attendance/Salary/etc.) - flat rows ────────────────────

/** Renders the inner action list for one legacy (non-registry) module -
 *  flat rows. Returns the bare `<ul>`; the outer module-Collapse provides
 *  the panel chrome (header, border). */
function LegacyModuleBody(props: {
  moduleKey: string;
  actions: ReadonlyArray<{ name: string; scoped: boolean }>;
  mode: PermissionGridMode;
  roleFlat: ReadonlyArray<{ module: string; actions: string[]; actionScopes?: PermissionScope[] }>;
  draft: Record<string, CellDraft>;
  onCellChange: (action: string, cell: CellDraft | null) => void;
  disabled?: boolean;
}) {
  const { moduleKey, actions, mode, roleFlat, draft, onCellChange, disabled } = props;
  const roleRow = roleFlat.find((r) => r.module === moduleKey);

  const roleActionIndex = useMemo(() => {
    if (!roleRow) return new Map<string, number>();
    return new Map(roleRow.actions.map((a, i) => [a, i]));
  }, [roleRow]);

  return (
    <ul className="divide-y divide-neutral-100">
      {actions.map(({ name, scoped }) => {
        const cellKey = `${moduleKey}.${name}`;
        const cell = draft[cellKey] ?? null;
        const roleIdx = roleActionIndex.get(name) ?? -1;
        const roleScope: PermissionScope | null =
          roleIdx >= 0 ? (roleRow!.actionScopes?.[roleIdx] ?? 'self') : null;
        return (
          <FlatActionRow
            key={cellKey}
            action={name}
            scoped={scoped}
            mode={mode}
            roleScope={roleScope}
            cell={cell}
            onChange={(next) => onCellChange(name, next)}
            disabled={disabled}
          />
        );
      })}
    </ul>
  );
}

function FlatActionRow(props: {
  // Fix I1: `module` prop removed - it was declared but never used in the body.
  action: string;
  scoped: boolean;
  mode: PermissionGridMode;
  roleScope: PermissionScope | null;
  cell: CellDraft | null;
  onChange: (cell: CellDraft | null) => void;
  disabled?: boolean;
}) {
  // Fix M4: call useTranslations directly.
  const t = useTranslations();
  const { action, scoped, mode, roleScope, cell, onChange, disabled } = props;

  // Fix M1: use shared helper instead of inline derivation.
  const { tristate, allowScope } = resolveCellState(cell);

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-col">
        {/* defaultValue humanizes any action whose `rbac.action.*` key is not yet
            in the message catalog (e.g. review_advance pending native i18n) so the
            row never shows a raw key. Existing actions keep their translated label. */}
        <span className="text-charcoal truncate text-sm">
          {t(`rbac.action.${action}`, {
            defaultValue: action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
          })}
        </span>
        {mode === 'override' && tristate === 'inherit' && roleScope ? (
          <Tag color="default" className="mt-0.5 w-fit">
            {t('rbac.matrix.inheritRoleAllow', { scope: t(`rbac.scope.${roleScope}`) })}
          </Tag>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {mode === 'override' ? (
          <Segmented
            value={tristate}
            disabled={disabled}
            onChange={(next) => {
              if (next === 'inherit') return onChange(null);
              if (next === 'allow') return onChange({ allowed: true, scope: allowScope });
              return onChange({ allowed: false });
            }}
            options={[
              { value: 'inherit', label: t('rbac.matrix.inherit') },
              { value: 'allow', label: t('rbac.matrix.allow') },
              { value: 'deny', label: t('rbac.matrix.deny') },
            ]}
          />
        ) : (
          <Segmented
            value={cell?.allowed ? 'grant' : 'no'}
            disabled={disabled}
            onChange={(next) =>
              next === 'grant' ? onChange({ allowed: true, scope: allowScope }) : onChange(null)
            }
            options={[
              { value: 'no', label: t('rbac.matrix.no') },
              { value: 'grant', label: t('rbac.matrix.grant') },
            ]}
          />
        )}
        {tristate === 'allow' && scoped ? (
          <Segmented
            value={allowScope}
            disabled={disabled}
            onChange={(next) => onChange({ allowed: true, scope: next as PermissionScope })}
            options={[
              { value: 'self', label: t('rbac.scope.self') },
              { value: 'all', label: t('rbac.scope.all') },
            ]}
          />
        ) : null}
      </div>
    </li>
  );
}
