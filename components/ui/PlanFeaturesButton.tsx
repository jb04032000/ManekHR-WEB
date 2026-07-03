'use client';

import { useState, type ReactNode } from 'react';
import { Drawer, Tooltip } from 'antd';
import {
  CheckCircleFilled,
  LockFilled,
  MinusCircleFilled,
  InfoCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { FEATURE_ACCESS_MAP } from '@/lib/constants/feature-access.registry';
import { useSubscriptionStore } from '@/lib/store';
import type { FeatureAccessLevel } from '@/types';

export interface PlanFeaturesButtonProps {
  /** FEATURE_ACCESS_MAP key (e.g. `attendance`, `team`, `salary`). */
  module: string;
  /** Visual variant. `icon` shows just the info icon; `icon-text` adds the "Plan Features" label. */
  variant?: 'icon' | 'icon-text';
}

interface AccessConfigEntry {
  color: string;
  bg: string;
  border: string;
  label: string;
  icon: ReactNode;
}

const ACCESS_CONFIG: Record<FeatureAccessLevel, AccessConfigEntry> = {
  full: {
    color: 'var(--cr-success-700)',
    bg: 'var(--cr-success-50)',
    border: 'var(--cr-success-50)',
    label: 'Full',
    icon: <CheckCircleFilled style={{ color: 'var(--cr-success-700)', fontSize: 14 }} />,
  },
  limited: {
    color: 'var(--cr-warning-700)',
    bg: 'var(--cr-warning-50)',
    border: 'var(--cr-warning-50)',
    label: 'Limited',
    icon: <MinusCircleFilled style={{ color: 'var(--cr-warning-700)', fontSize: 14 }} />,
  },
  locked: {
    color: 'var(--cr-text-5)',
    bg: 'var(--cr-bg)',
    border: 'var(--cr-border)',
    label: 'Locked',
    icon: <LockFilled style={{ color: 'var(--cr-text-5)', fontSize: 14 }} />,
  },
};

export function PlanFeaturesButton({ module, variant = 'icon-text' }: PlanFeaturesButtonProps) {
  const [open, setOpen] = useState(false);
  const entitlements = useSubscriptionStore((s) => s.entitlements);

  const moduleDef = FEATURE_ACCESS_MAP[module];
  if (!moduleDef) return null;

  const moduleAccess = entitlements?.moduleAccess?.find((m) => m.module === module);

  const getAccess = (key: string): FeatureAccessLevel =>
    (moduleAccess?.subFeatures?.find((sf) => sf.key === key)?.access as FeatureAccessLevel) ??
    'locked';

  const lockedCount = moduleDef.subFeatures.filter((sf) => getAccess(sf.key) === 'locked').length;
  const tooltip = `See which ${moduleDef.label.toLowerCase()} features are included in your plan`;

  return (
    <>
      <Tooltip title={tooltip}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tooltip}
          className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-gray-700 transition-colors hover:text-blue-700"
        >
          <InfoCircleOutlined />
          {/* Label hidden on mobile (icon-only) to keep the action cluster compact. */}
          {variant === 'icon-text' && <span className="hidden md:inline">Plan Features</span>}
        </button>
      </Tooltip>

      <Drawer
        title={
          <div className="flex items-center gap-2">
            <RocketOutlined style={{ color: 'var(--cr-primary)' }} />
            <span className="font-display font-bold">{moduleDef.label} Plan Features</span>
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
        size="default"
        footer={
          lockedCount > 0 ? (
            <div className="py-1 text-center">
              <span className="text-xs text-gray-700">
                {lockedCount} feature{lockedCount > 1 ? 's' : ''} locked on your current plan.{' '}
              </span>
              <Link
                href="/dashboard/billing"
                className="text-xs font-semibold hover:underline"
                style={{ color: 'var(--cr-primary)' }}
              >
                Upgrade to unlock →
              </Link>
            </div>
          ) : (
            <div
              className="py-1 text-center text-xs font-semibold"
              style={{ color: 'var(--cr-success-700)' }}
            >
              All {moduleDef.label.toLowerCase()} features are unlocked on your plan!
            </div>
          )
        }
      >
        <div className="flex flex-col gap-2">
          {moduleDef.subFeatures.map((sf) => {
            const access = getAccess(sf.key);
            const cfg = ACCESS_CONFIG[access];
            return (
              <div
                key={sf.key}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: access === 'locked' ? 'var(--cr-text-3)' : cfg.color }}
                  >
                    {sf.label}
                  </div>
                  {sf.description && (
                    <div className="mt-0.5 text-xs leading-relaxed text-gray-700">
                      {sf.description}
                    </div>
                  )}
                </div>
                <span
                  className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: cfg.border, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </Drawer>
    </>
  );
}

export default PlanFeaturesButton;
