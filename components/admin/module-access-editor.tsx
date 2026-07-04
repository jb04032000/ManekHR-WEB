'use client';

import { Collapse, Switch, Radio, Tag, Alert, Button, Space } from 'antd';
import { LockOutlined, UnlockOutlined, ThunderboltOutlined, StopOutlined } from '@ant-design/icons';
import { FEATURE_ACCESS_REGISTRY } from '@/lib/constants/feature-access.registry';
import type { ModuleAccessEntry, FeatureAccessLevel } from '@/types';

const MODULE_COLORS: Record<string, string> = {
  attendance: 'blue',
  team: 'green',
  salary: 'gold',
  shifts: 'purple',
  roles: 'cyan',
  settings: 'orange',
};

// Machines/Finance products removed (2026-07-04, owner directive) — ManekHR is
// ERP-only. Both groups are now empty (kept as exported constants + Collapse
// panels for minimal diff / easy revert). `locations` was moved OUT of the old
// Machines group into the flat card list below — it survives as its own real,
// standalone feature (Workspace Settings), unlike the rest of that cluster.
const MACHINES_GROUP: string[] = [];

// Time & attendance modules, grouped under one collapsible "Time & Attendance"
// parent (mirrors the Machines Group pattern + the RBAC matrix's Time &
// Attendance section). Order here is the render order inside the group.
const TIME_ATTENDANCE_GROUP = ['attendance', 'leave', 'regularization', 'shifts', 'holidays'];

// Finance product removed (2026-07-04) — this group is now empty.
const ACCOUNTING_GROUP: string[] = [];

// Lending cluster inside the Salary card: advance salary requests + employer/0%
// loans. Rendered as a labelled subsection so the two assign together visually
// (they are sub-features of `salary`, not standalone modules like Machines).
const SALARY_LENDING_GROUP = ['advance_payments', 'loan_management'];

// DEAD standalone module cards - nothing in the app gates on {module:'downtime'}
// or {module:'maintenance'}. The real controls are the `machines` sub-features
// machines_downtime / machines_maintenance (inside the Machines card), so these
// two cards control nothing and only cause confusion. Hidden from the editor.
// NOTE: we only hide the CARDS - any pre-existing moduleAccess entries for these
// stay in the array and pass through on save (see filter below), so no data loss.
// Machines + Finance products removed (2026-07-04) — their module cards are
// hidden too (machines/resource_scopes/manufacturing/finance/inventory/
// gst_compliance/job_work); `locations` is NOT in this list — it survived as
// its own real feature and still gets an editable card.
const HIDDEN_PLAN_EDITOR_MODULES = [
  'downtime',
  'maintenance',
  'machines',
  'resource_scopes',
  'manufacturing',
  'finance',
  'inventory',
  'gst_compliance',
  'job_work',
];

interface ModuleAccessEditorProps {
  moduleAccess: ModuleAccessEntry[];
  onChange: (updated: ModuleAccessEntry[]) => void;
  disabled?: boolean;
  errors?: string[];
}

export function ModuleAccessEditor({
  moduleAccess,
  onChange,
  disabled = false,
  errors = [],
}: ModuleAccessEditorProps) {
  const handleModuleToggle = (moduleKey: string, enabled: boolean) => {
    const updated = moduleAccess.map((m) =>
      m.module === moduleKey
        ? {
            ...m,
            enabled,
            subFeatures: m.subFeatures.map((sf) => ({
              ...sf,
              access: enabled ? 'full' : 'locked',
            })),
          }
        : m,
    );
    onChange(updated as ModuleAccessEntry[]);
  };

  const handleSubFeatureChange = (
    moduleKey: string,
    subFeatureKey: string,
    access: FeatureAccessLevel,
  ) => {
    const updated = moduleAccess.map((m) =>
      m.module === moduleKey
        ? {
            ...m,
            subFeatures: m.subFeatures.map((sf) =>
              sf.key === subFeatureKey ? { ...sf, access } : sf,
            ),
          }
        : m,
    );
    onChange(updated as ModuleAccessEntry[]);
  };

  const handleEnableAll = () => {
    onChange(
      moduleAccess.map((m) => ({
        ...m,
        enabled: true,
        subFeatures: m.subFeatures.map((sf) => ({ ...sf, access: 'full' as const })),
      })),
    );
  };

  const handleDisableAll = () => {
    onChange(
      moduleAccess.map((m) => ({
        ...m,
        enabled: false,
        subFeatures: m.subFeatures.map((sf) => ({ ...sf, access: 'locked' as const })),
      })),
    );
  };

  const handleSetAllFull = (moduleKey: string) => {
    onChange(
      moduleAccess.map((m) =>
        m.module === moduleKey
          ? { ...m, subFeatures: m.subFeatures.map((sf) => ({ ...sf, access: 'full' as const })) }
          : m,
      ),
    );
  };

  // Build one Collapse panel for a single registry module. Extracted so the same
  // card renders both flat (regular modules) and nested (inside the Machines
  // group). Handlers still map over the full `moduleAccess` array, so hidden /
  // grouped modules are unaffected here.
  const buildModulePanel = (mod: (typeof FEATURE_ACCESS_REGISTRY)[number]) => {
    const currentEntry = moduleAccess.find((m) => m.module === mod.module);
    const isEnabled = currentEntry?.enabled ?? false;

    return {
      key: mod.module,
      label: (
        <div className="flex w-full items-center justify-between pr-4">
          <div className="flex items-center gap-2">
            <Tag color={MODULE_COLORS[mod.module]}>{mod.module}</Tag>
            <span className="font-medium">{mod.label}</span>
          </div>
          <Space size={4}>
            {isEnabled && (
              <Button
                type="text"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetAllFull(mod.module);
                }}
                disabled={disabled}
                className="text-xs text-blue-700"
              >
                Set All Full
              </Button>
            )}
            <Switch
              checked={isEnabled}
              onChange={(checked) => handleModuleToggle(mod.module, checked)}
              onClick={(_checked, event) => event.stopPropagation()}
              size="small"
              checkedChildren={<UnlockOutlined />}
              unCheckedChildren={<LockOutlined />}
              disabled={disabled}
            />
          </Space>
        </div>
      ),
      className: !isEnabled ? 'opacity-60' : '',
      children: (() => {
        // One sub-feature row; shared by the plain list and the Lending group.
        const renderSfRow = (sf: (typeof mod.subFeatures)[number]) => {
          const currentAccess =
            currentEntry?.subFeatures.find((s) => s.key === sf.key)?.access || 'locked';
          const supportsLimited = sf.supportsLimited;

          return (
            <div
              key={sf.key}
              className={`flex items-center justify-between rounded bg-gray-50 px-3 py-2 ${
                !isEnabled ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{sf.label}</span>
                {sf.description && <span className="text-xs text-gray-700">{sf.description}</span>}
                {sf.supportsLimited && (
                  <span className="mt-0.5 text-xs text-blue-700">
                    Supports limited mode (watermarked export)
                  </span>
                )}
              </div>
              <Radio.Group
                value={currentAccess}
                onChange={(e) => handleSubFeatureChange(mod.module, sf.key, e.target.value)}
                disabled={disabled || !isEnabled}
              >
                <Radio.Button value="locked">
                  <LockOutlined /> Locked
                </Radio.Button>
                {supportsLimited && (
                  <Radio.Button value="limited">
                    <UnlockOutlined /> Limited
                  </Radio.Button>
                )}
                <Radio.Button value="full">
                  <UnlockOutlined /> Full
                </Radio.Button>
              </Radio.Group>
            </div>
          );
        };

        // Salary card: pull the lending sub-features (advances + loans) into a
        // labelled subsection so they read/assign as one cluster. Other modules
        // keep the plain flat list.
        const lending =
          mod.module === 'salary'
            ? mod.subFeatures.filter((sf) => SALARY_LENDING_GROUP.includes(sf.key))
            : [];
        const plain =
          lending.length > 0
            ? mod.subFeatures.filter((sf) => !SALARY_LENDING_GROUP.includes(sf.key))
            : mod.subFeatures;

        return (
          <div className="flex flex-col gap-3">
            {plain.map(renderSfRow)}
            {lending.length > 0 && (
              <div className="flex flex-col gap-3 rounded border border-gray-200 p-3">
                <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Lending — advance salary & loans
                </span>
                {lending.map(renderSfRow)}
              </div>
            )}
          </div>
        );
      })(),
    };
  };

  // Editor-visible registry modules: drop `bills` (never shown) + the dead
  // downtime/maintenance cards. The underlying moduleAccess array still carries
  // any stored entries for the hidden modules, so save preserves them.
  const visibleModules = FEATURE_ACCESS_REGISTRY.filter(
    (m) => m.module !== 'bills' && !HIDDEN_PLAN_EDITOR_MODULES.includes(m.module),
  );

  // Flat cards: every visible module NOT claimed by a group, in registry order.
  const flatItems = visibleModules
    .filter(
      (m) =>
        !MACHINES_GROUP.includes(m.module) &&
        !TIME_ATTENDANCE_GROUP.includes(m.module) &&
        !ACCOUNTING_GROUP.includes(m.module),
    )
    .map(buildModulePanel);

  // Build a group's inner module cards in the group's declared order.
  const groupItems = (keys: string[]) =>
    keys
      .map((key) => visibleModules.find((m) => m.module === key))
      .filter((m): m is (typeof FEATURE_ACCESS_REGISTRY)[number] => Boolean(m))
      .map(buildModulePanel);

  const timeGroupItems = groupItems(TIME_ATTENDANCE_GROUP);

  const flatDefaultKeys = flatItems.map((i) => i.key);

  return (
    <div className="flex flex-col gap-3">
      {errors.length > 0 && <Alert type="error" title={errors.join('. ')} showIcon />}
      <div className="mb-2 flex gap-2">
        <Button
          type="primary"
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={handleEnableAll}
          disabled={disabled}
        >
          Enable All (Full Access)
        </Button>
        <Button
          danger
          size="small"
          icon={<StopOutlined />}
          onClick={handleDisableAll}
          disabled={disabled}
        >
          Disable All
        </Button>
      </div>
      <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-2">
        <Collapse defaultActiveKey={flatDefaultKeys} items={flatItems} />
        {/* Accounting + Machines groups removed (2026-07-04) — both products are
            gone, so their group headers no longer render (would be empty). */}
        {/* Time & Attendance parent group: attendance / leave / regularization /
            shifts / holidays under one collapsible header, mirroring the RBAC
            matrix's Time & Attendance section. */}
        <Collapse
          defaultActiveKey={['time-attendance-group']}
          items={[
            {
              key: 'time-attendance-group',
              label: <span className="font-medium">Time & Attendance Group</span>,
              children: (
                <Collapse defaultActiveKey={TIME_ATTENDANCE_GROUP} items={timeGroupItems} />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

export { getDefaultModuleAccessEntries } from '@/lib/utils/subscription.utils';

export { MODULE_COLORS };

// Group membership reused by the admin Module Availability editor
// (module-availability-editor.tsx) so both admin surfaces group identically.
export { ACCOUNTING_GROUP, TIME_ATTENDANCE_GROUP, MACHINES_GROUP };
