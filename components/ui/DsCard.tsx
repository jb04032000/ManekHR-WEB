'use client';
import { Card } from 'antd';
import type { CardProps } from 'antd';
import React, { CSSProperties, ReactNode } from 'react';

type DsVariant  = 'default' | 'flat' | 'elevated';
type DsGradient = 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'teal' | 'indigo';

const GRADIENTS: Record<DsGradient, string> = {
  blue:   'var(--cr-grad-blue)',
  green:  'var(--cr-grad-green)',
  purple: 'var(--cr-grad-purple)',
  amber:  'var(--cr-grad-amber)',
  red:    'var(--cr-grad-red)',
  teal:   'var(--cr-grad-teal)',
  indigo: 'var(--cr-grad-indigo)',
};

interface DsCardProps extends CardProps {
  dsVariant?: DsVariant;
  gradient?:  DsGradient;
  hover?:     boolean;
  noPad?:     boolean;
}

export default function DsCard({
  dsVariant = 'default',
  gradient,
  hover = false,
  noPad = false,
  style,
  children,
  bordered,
  variant,
  ...rest
}: DsCardProps) {
  const isGrad = !!gradient;
  const resolvedVariant =
    variant ??
    (bordered === false || dsVariant === 'flat' || isGrad
      ? 'borderless'
      : 'outlined');
  const showBorder = resolvedVariant === 'outlined' && !isGrad;
  return (
    <Card
      variant={resolvedVariant}
      style={{
        borderRadius: 'var(--cr-radius-xl)' as unknown as number,
        border: showBorder ? '1px solid var(--cr-border)' : 'none',
        boxShadow:
          dsVariant === 'elevated'
            ? 'var(--cr-shadow-md)'
            : resolvedVariant === 'borderless'
              ? 'none'
              : 'var(--cr-shadow-card)',
        ...(isGrad && { background: GRADIENTS[gradient!], border: 'none', color: 'var(--cr-surface)' }),
        transition: hover ? 'box-shadow 0.2s ease, transform 0.2s ease' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Card>
  );
}

// ── Stat card ───────────────────────────────────────────────
interface StatCardProps {
  label: string; value: string | number; icon?: ReactNode;
  gradient?: DsGradient; trend?: { value: number; label?: string };
  sub?: string; style?: CSSProperties;
}
export function DsStatCard({ label, value, icon, gradient, trend, sub, style }: StatCardProps) {
  const isGrad = !!gradient;
  const bg     = isGrad ? GRADIENTS[gradient!] : 'var(--cr-surface)';
  const tc     = isGrad ? 'var(--cr-surface)' : 'var(--cr-text)';
  const sc     = isGrad ? 'rgba(255,255,255,.7)' : 'var(--cr-text-3)';
  return (
    <div style={{ borderRadius: 'var(--cr-radius-xl)', padding: '18px 20px', background: bg, border: isGrad ? 'none' : '1px solid var(--cr-border)', boxShadow: 'var(--cr-shadow-card)', display: 'flex', flexDirection: 'column', gap: 4, ...style } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: sc, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        {icon && <div style={{ width: 32, height: 32, borderRadius: 'var(--cr-radius-md)', background: isGrad ? 'rgba(255,255,255,0.2)' : 'var(--cr-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isGrad ? 'var(--cr-surface)' : 'var(--cr-primary)', fontSize: 15 } as React.CSSProperties}>{icon}</div>}
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: tc, margin: '4px 0 0', lineHeight: 1 }}>{value}</p>
      {(sub || trend) && (
        <p style={{ fontSize: 12, color: sc, margin: '4px 0 0' }}>
          {trend && <span style={{ color: isGrad ? 'rgba(255,255,255,0.9)' : (trend.value >= 0 ? 'var(--cr-success)' : 'var(--cr-error)'), fontWeight: 600, marginRight: 4 }}>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>}
          {sub}
        </p>
      )}
    </div>
  );
}
