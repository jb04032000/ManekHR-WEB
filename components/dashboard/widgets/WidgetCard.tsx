'use client';
/**
 * WidgetCard — shared chrome for the enriched dashboard widgets
 * (app/dashboard/page.tsx). One place for the canonical card style (radius 16,
 * 1px var(--cr-border), soft shadow, font-display bold title + icon chip, optional
 * "view all →" link) so the seven enrichment cards stay visually identical to the
 * existing dashboard cards.
 *
 * Cross-module: used by AttendanceTrendCard / PayrollTrendCard / MoneyMovementCard
 * / WorkforceBreakdownCard / PeopleRadarCard / UpcomingLeaveCard / WhosInNowCard.
 * Watch: keep the style tokens in sync with the inline cards in page.tsx.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card } from 'antd';

interface WidgetCardProps {
  title: ReactNode;
  icon?: ReactNode;
  iconColor?: string;
  /** In-app route for the header "view all" link; omit to hide it. */
  viewAllHref?: string;
  viewAllLabel?: string;
  bodyPadding?: number;
  className?: string;
  children: ReactNode;
}

export function WidgetCard({
  title,
  icon,
  iconColor = 'var(--cr-info-500)',
  viewAllHref,
  viewAllLabel,
  bodyPadding = 20,
  className = 'h-full',
  children,
}: WidgetCardProps) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2 font-display font-bold">
          {icon && <span style={{ color: iconColor, display: 'inline-flex' }}>{icon}</span>}
          {title}
        </span>
      }
      extra={
        viewAllHref ? (
          <Link href={viewAllHref} className="text-xs font-semibold" style={{ color: iconColor }}>
            {viewAllLabel} →
          </Link>
        ) : null
      }
      className={className}
      style={{
        borderRadius: 16,
        border: '1px solid var(--cr-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      styles={{ body: { padding: bodyPadding } }}
    >
      {children}
    </Card>
  );
}

export default WidgetCard;
