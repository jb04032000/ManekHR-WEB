'use client';

import { Button, Collapse, Switch, Tag } from 'antd';
import { ClockCircleOutlined, CrownOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { FEATURE_ACCESS_REGISTRY } from '@/lib/constants/feature-access.registry';
import { TIME_ATTENDANCE_GROUP, MODULE_COLORS } from './module-access-editor';

// Same cards hidden from the plan module-access editor. Machines + Finance
// products removed (2026-07-04) — their module cards are hidden too;
// `locations` is NOT hidden, it survived as its own real feature.
const HIDDEN_AVAILABILITY_MODULES = [
  'bills',
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

interface ModuleAvailabilityEditorProps {
  /** Modules currently flagged "Coming Soon" (AppSettings.comingSoonModules). */
  comingSoonModules: string[];
  onChange: (updated: string[]) => void;
  disabled?: boolean;
}

/**
 * Admin editor for the platform "Coming Soon" module flags. Each LOCKED
 * module either shows customers a Coming Soon notice (flag ON - module not
 * built yet) or the plan-upgrade prompt (flag OFF - module for sale).
 * Presentation-only: flags never unlock anything (SubscriptionGuard 403s
 * regardless). Groups mirror the plan module-access editor (Accounting /
 * Time & Attendance / Machines) so both admin surfaces read the same.
 * Cross-module: saved via PATCH /admin/settings { comingSoonModules },
 * served publicly by GET /subscriptions/public/module-availability, consumed
 * by useFeatureAccess (ComingSoonPrompt) + the Sidebar badge.
 */
export function ModuleAvailabilityEditor({
  comingSoonModules,
  onChange,
  disabled = false,
}: ModuleAvailabilityEditorProps) {
  const t = useTranslations('admin.moduleAvailability');

  const isComingSoon = (module: string) => comingSoonModules.includes(module);

  const setModule = (module: string, comingSoon: boolean) => {
    const without = comingSoonModules.filter((m) => m !== module);
    onChange(comingSoon ? [...without, module] : without);
  };

  // Group set-all: replace ONLY this group's membership, keep everything else.
  const setGroup = (modules: string[], comingSoon: boolean) => {
    const without = comingSoonModules.filter((m) => !modules.includes(m));
    onChange(comingSoon ? [...without, ...modules] : without);
  };

  const visibleModules = FEATURE_ACCESS_REGISTRY.filter(
    (m) => !HIDDEN_AVAILABILITY_MODULES.includes(m.module),
  );

  const renderRow = (mod: (typeof FEATURE_ACCESS_REGISTRY)[number]) => (
    <div
      key={mod.module}
      className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Tag color={MODULE_COLORS[mod.module]}>{mod.module}</Tag>
        <span className="truncate text-sm font-medium">{mod.label}</span>
      </div>
      <Switch
        checked={isComingSoon(mod.module)}
        onChange={(checked) => setModule(mod.module, checked)}
        checkedChildren={
          <span>
            <ClockCircleOutlined /> {t('comingSoon')}
          </span>
        }
        unCheckedChildren={
          <span>
            <CrownOutlined /> {t('upgrade')}
          </span>
        }
        disabled={disabled}
        aria-label={`${mod.label}: ${isComingSoon(mod.module) ? t('comingSoon') : t('upgrade')}`}
      />
    </div>
  );

  // One collapsible panel per group, mirroring the plan editor's group
  // pattern; the header carries the two set-all shortcuts.
  const buildGroupPanel = (key: string, title: string, moduleKeys: string[]) => {
    const mods = moduleKeys
      .map((k) => visibleModules.find((m) => m.module === k))
      .filter((m): m is (typeof FEATURE_ACCESS_REGISTRY)[number] => Boolean(m));

    return {
      key,
      label: (
        <div className="flex w-full items-center justify-between pr-4">
          <span className="font-medium">{title}</span>
          <span className="flex gap-1">
            <Button
              type="text"
              size="small"
              className="text-xs text-blue-700"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                setGroup(
                  mods.map((m) => m.module),
                  true,
                );
              }}
            >
              {t('allComingSoon')}
            </Button>
            <Button
              type="text"
              size="small"
              className="text-xs text-blue-700"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                setGroup(
                  mods.map((m) => m.module),
                  false,
                );
              }}
            >
              {t('allUpgrade')}
            </Button>
          </span>
        </div>
      ),
      children: <div className="flex flex-col gap-2">{mods.map(renderRow)}</div>,
    };
  };

  const grouped = [...TIME_ATTENDANCE_GROUP];
  const flatModules = visibleModules.filter((m) => !grouped.includes(m.module));

  return (
    <div className="flex flex-col gap-3">
      {/* Accounting + Machines groups removed (2026-07-04) — both products are
          gone, so their group headers no longer render (would be empty). */}
      <Collapse
        defaultActiveKey={['time-attendance', 'other']}
        items={[
          buildGroupPanel('time-attendance', t('groupTimeAttendance'), TIME_ATTENDANCE_GROUP),
          {
            key: 'other',
            label: <span className="font-medium">{t('otherModules')}</span>,
            children: (
              <div className="flex flex-col gap-2">{flatModules.map(renderRow)}</div>
            ),
          },
        ]}
      />
    </div>
  );
}
