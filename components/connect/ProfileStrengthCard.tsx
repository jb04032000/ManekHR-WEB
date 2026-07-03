'use client';

/**
 * ProfileStrengthCard - completion meter + an actionable checklist
 * (design-decisions doc §1.2 - "not just a percentage"). Each incomplete item
 * carries its own Add/Ask CTA. Info icon explains what raises the score.
 */

import { Progress } from 'antd';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';
import PrivacyBadge from './PrivacyBadge';

export interface StrengthItem {
  key: string;
  label: string;
  done: boolean;
  /** CTA shown for an incomplete item. */
  action?: { label: string; href?: string; onClick?: () => void };
}

interface ProfileStrengthCardProps {
  /** 0–100. */
  strength: number;
  items: StrengthItem[];
  /**
   * Reserve space at the header's right edge for a dismiss control that the
   * parent overlays in the top-right corner (FeedProfileCard's absolute X).
   * Without it the X overlaps the `PrivacyBadge` pill. Off by default so the
   * rail usage (no dismiss button) is unchanged.
   */
  reserveDismissSpace?: boolean;
}

export default function ProfileStrengthCard({
  strength,
  items,
  reserveDismissSpace = false,
}: ProfileStrengthCardProps) {
  const t = useTranslations('connect.profileStrength');

  return (
    <div
      style={{
        padding: 'var(--cr-space-md)',
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          // Clear the parent's overlaid dismiss X (16px glyph + padding) so the
          // PrivacyBadge never sits under it.
          paddingInlineEnd: reserveDismissSpace ? 28 : undefined,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--cr-text)' }}>
            {t('title')}
          </h3>
          <InfoTooltip text={t('helpTitle')} body={t('help')} />
        </div>
        {/* Profile-strength data is computed for the owner's eyes only - never
            shown to public viewers. Surface the privacy semantic explicitly
            so the owner trusts what's visible to others. */}
        <PrivacyBadge />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--cr-space-sm)',
          marginTop: 'var(--cr-space-sm)',
        }}
      >
        <Progress
          percent={strength}
          showInfo={false}
          strokeColor="var(--cr-primary)"
          style={{ flex: 1, margin: 0 }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cr-primary)' }}>
          {t('percent', { value: strength })}
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 'var(--cr-space-md) 0 0',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cr-space-sm)',
        }}
      >
        {items.map((item) => (
          <li
            key={item.key}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--cr-space-sm)' }}
          >
            <span
              aria-hidden
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 18,
                height: 18,
                flexShrink: 0,
                borderRadius: '50%',
                background: item.done ? 'var(--cr-success-bg)' : 'var(--cr-surface-2)',
                color: item.done ? 'var(--cr-success)' : 'var(--cr-text-4)',
                border: item.done ? 'none' : '1px dashed var(--cr-border-strong)',
              }}
            >
              {item.done && <Check size={12} />}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: item.done ? 'var(--cr-text-4)' : 'var(--cr-text-2)',
              }}
            >
              {item.label}
            </span>
            {!item.done && item.action && (
              <span style={{ flexShrink: 0 }}>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  href={item.action.href}
                  onClick={item.action.onClick}
                >
                  {item.action.label}
                </DsButton>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
