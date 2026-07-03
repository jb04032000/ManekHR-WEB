/**
 * DsBadge, DsTag, DsAvatar, DsStatusDot
 * Unified status/display components matching mobile app design tokens.
 */
'use client';
import { Tag, Avatar } from 'antd';
import type { TagProps } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { CSSProperties, ReactNode } from 'react';
import { getInitials, avatarColor } from '@/lib/utils';

// ── Attendance / status colour map (mirrors mobile app) ──────
export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  present: {
    bg: 'var(--cr-success-50)',
    text: 'var(--cr-success-700)',
    dot: 'var(--cr-success-500)',
  },
  absent: { bg: 'var(--cr-danger-50)', text: 'var(--cr-danger-700)', dot: 'var(--cr-danger-500)' },
  half_day: {
    bg: 'var(--cr-warning-50)',
    text: 'var(--cr-warning-700)',
    dot: 'var(--cr-warning-500)',
  },
  late: { bg: 'var(--cr-warning-50)', text: 'var(--cr-warning-700)', dot: 'var(--cr-warning-500)' },
  on_leave: {
    bg: 'var(--cr-indigo-50)',
    text: 'var(--cr-primary-hover)',
    dot: 'var(--cr-indigo-400)',
  },
  holiday: { bg: 'var(--cr-info-50)', text: 'var(--cr-info-700)', dot: 'var(--cr-info-500)' },
  week_off: {
    bg: 'var(--cr-border-light)',
    text: 'var(--cr-text-3)',
    dot: 'var(--cr-neutral-400)',
  },
  unmarked: { bg: 'var(--cr-bg)', text: 'var(--cr-text-4)', dot: 'var(--cr-neutral-300)' },
  // billing
  pending: {
    bg: 'var(--cr-warning-50)',
    text: 'var(--cr-warning-700)',
    dot: 'var(--cr-warning-500)',
  },
  paid: { bg: 'var(--cr-success-50)', text: 'var(--cr-success-700)', dot: 'var(--cr-success-500)' },
  partial: {
    bg: 'var(--cr-warning-50)',
    text: 'var(--cr-warning-700)',
    dot: 'var(--cr-warning-500)',
  },
  overdue: { bg: 'var(--cr-danger-50)', text: 'var(--cr-danger-700)', dot: 'var(--cr-danger-500)' },
  // member
  active: {
    bg: 'var(--cr-success-50)',
    text: 'var(--cr-success-700)',
    dot: 'var(--cr-success-500)',
  },
  inactive: {
    bg: 'var(--cr-danger-50)',
    text: 'var(--cr-danger-700)',
    dot: 'var(--cr-danger-500)',
  },
  // subscription
  trial: {
    bg: 'var(--cr-indigo-50)',
    text: 'var(--cr-primary-hover)',
    dot: 'var(--cr-indigo-400)',
  },
  cancelled: { bg: 'var(--cr-bg)', text: 'var(--cr-text-4)', dot: 'var(--cr-neutral-300)' },
  // salary
  advance: {
    bg: 'var(--cr-indigo-50)',
    text: 'var(--cr-primary-hover)',
    dot: 'var(--cr-indigo-400)',
  },
  // notice period
  warning: {
    bg: 'var(--cr-warning-50)',
    text: 'var(--cr-warning-700)',
    dot: 'var(--cr-warning-500)',
  },
};

// ── DsTag - styled status/label tag ─────────────────────────
interface DsTagProps extends TagProps {
  status?: string; // maps to STATUS_COLORS
  label?: string;
}

export function DsTag({ status, label, children, style, ...rest }: DsTagProps) {
  const colors = status ? STATUS_COLORS[status] : null;
  const text = label ?? (status ? status.replace(/_/g, ' ') : undefined);

  return (
    <Tag
      style={{
        textTransform: 'capitalize',
        ...(colors && { background: colors.bg, color: colors.text }),
        ...style,
      }}
      {...rest}
    >
      {children ?? text}
    </Tag>
  );
}

// ── DsStatusDot - inline coloured dot ───────────────────────
export function DsStatusDot({ status, size = 8 }: { status: string; size?: number }) {
  const color = STATUS_COLORS[status]?.dot ?? 'var(--cr-text-5)';
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

// ── DsAvatar - named avatar with generated bg colour ─────────
interface DsAvatarProps {
  name?: string;
  size?: number;
  src?: string;
  style?: CSSProperties;
}

export function DsAvatar({ name = '', size = 36, src, style }: DsAvatarProps) {
  // When there's no image and no usable name, AntD's `icon` prop renders a
  // generic person glyph - far better than the literal "?" that the
  // `getInitials` text fallback would print. Real initials still win whenever
  // a name is present.
  const trimmed = name.trim();
  const useGlyph = !src && !trimmed;
  return (
    <Avatar
      size={size}
      src={src}
      alt={name || undefined}
      icon={useGlyph ? <UserOutlined aria-hidden /> : undefined}
      style={{
        background: avatarColor(name),
        fontSize: Math.max(10, Math.round(size * 0.35)),
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        flexShrink: 0,
        ...style,
      }}
    >
      {!src && !useGlyph && getInitials(name)}
    </Avatar>
  );
}

// ── DsMemberRow - avatar + name + sub (used in team lists) ───
interface DsMemberRowProps {
  name: string;
  sub?: string;
  size?: number;
  onClick?: () => void;
  style?: CSSProperties;
}

export function DsMemberRow({ name, sub, size = 36, onClick, style }: DsMemberRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <DsAvatar name={name} size={size} />
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--cr-text)',
            lineHeight: 1.3,
          }}
        >
          {name}
        </p>
        {sub && (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--cr-text-4)', lineHeight: 1.3 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── DsPageHeader - consistent page section headers ───────────
// `titleAside` renders inline immediately after the title text - use for
// info-tooltips / explainers that belong WITH the title (Apple HIG: explainers
// attach to label, not float as separate header action). Use `right` only for
// real header actions (Export / CTA / overflow menu).
interface DsPageHeaderProps {
  title: string;
  sub?: string;
  icon?: ReactNode;
  right?: ReactNode;
  titleAside?: ReactNode;
  style?: CSSProperties;
}

export function DsPageHeader({ title, sub, icon, right, titleAside, style }: DsPageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--cr-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cr-primary)',
              fontSize: 18,
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--cr-text)',
                margin: 0,
              }}
            >
              {title}
            </h1>
            {titleAside}
          </div>
          {sub && <p style={{ fontSize: 13, color: 'var(--cr-text-3)', margin: 0 }}>{sub}</p>}
        </div>
      </div>
      {right && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {right}
        </div>
      )}
    </div>
  );
}

// ── DsCardTitle - proper heading for Card titles ─────────────
// Use as: <Card title={<DsCardTitle>My Section</DsCardTitle>}>
// Renders an <h2> with display typography so screen readers see the
// section as a real heading instead of a generic <span>.
export function DsCardTitle({
  level = 2,
  children,
  className = '',
}: {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
}) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <Tag className={`m-0 font-display text-base font-bold ${className}`.trim()}>{children}</Tag>
  );
}

// ── DsEmptyState - consistent empty state ───────────────────
export function DsEmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>}
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--cr-text)',
          margin: '0 0 6px',
        }}
      >
        {title}
      </p>
      {sub && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--cr-text-4)',
            margin: '0 0 20px',
            maxWidth: 300,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {sub}
        </p>
      )}
      {action}
    </div>
  );
}
