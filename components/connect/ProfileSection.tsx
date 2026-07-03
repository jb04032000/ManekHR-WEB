'use client';

/**
 * ProfileSection - the shared editable-section primitive for every Connect
 * profile (and adjacent surfaces). One card chrome, five slots:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │ [icon] {title} {titleAside}           {actions}│  ← header
 *   ├────────────────────────────────────────────────┤
 *   │ {children}                                     │  ← body
 *   ├────────────────────────────────────────────────┤
 *   │              {footer}                          │  ← optional footer
 *   └────────────────────────────────────────────────┘
 *
 *  - `icon` - small decorative glyph shown in a brand-tinted chip before the
 *    title, giving each section a scannable identity. Optional; the chip is
 *    `aria-hidden` (the `title` carries the meaning).
 *  - `title` - section heading (rendered as `<h2>`).
 *  - `titleAside` - small inline node next to the title (e.g. an
 *    `InfoTooltip` explainer or a `PrivacyBadge`).
 *  - `actions` - right-aligned header cluster - edit pencil, add (+),
 *    overflow menu. Caller owns the affordance; primitive just slots them.
 *  - `footer` - bottom-of-card slot, full-width with a divider above
 *    (matches LinkedIn's "Show all →" pattern).
 *
 * Use this for every editable / structured section in profile, company-page
 * (Phase 6), settings cards in Connect (when added). Replaces the per-file
 * inline `<section style={{ background, border, radius }}>` chrome that was
 * scattered across `ProfileView` and similar.
 */

import type { ReactNode } from 'react';

interface ProfileSectionProps {
  /** Decorative glyph for the brand-tinted header chip (e.g. a lucide icon). */
  icon?: ReactNode;
  /** Heading text - rendered as `<h2>`. */
  title: string;
  /** Inline content next to the title (e.g. `InfoTooltip`, `PrivacyBadge`). */
  titleAside?: ReactNode;
  /** Right-aligned header cluster - edit / add / overflow / etc. */
  actions?: ReactNode;
  /** Body content. The primitive applies its own padding around this slot. */
  children: ReactNode;
  /** Optional footer slot - full-width row above the card's bottom edge with
   *  a divider on top. Use for "Show all →" or similar global per-section
   *  actions. */
  footer?: ReactNode;
  /** Extra classes merged onto the outer `<section>`. */
  className?: string;
}

export default function ProfileSection({
  icon,
  title,
  titleAside,
  actions,
  children,
  footer,
  className,
}: ProfileSectionProps) {
  return (
    <section
      className={['transition-shadow duration-200 hover:shadow-md', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border-light)',
        borderRadius: 'var(--cr-radius-lg)',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '13px var(--cr-space-md)',
          borderBottom: '1px solid var(--cr-border-light)',
        }}
      >
        {icon && (
          <span
            aria-hidden
            className="inline-flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 'var(--cr-radius-md)',
              background: 'var(--cr-primary-light)',
              color: 'var(--cr-primary)',
            }}
          >
            {icon}
          </span>
        )}
        <h2
          style={{
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--cr-text)',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          {titleAside}
        </h2>
        {actions && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {actions}
          </div>
        )}
      </header>
      <div style={{ padding: 'var(--cr-space-md)' }}>{children}</div>
      {footer && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px var(--cr-space-md)',
            borderTop: '1px solid var(--cr-border-light)',
            background: 'var(--cr-surface-2)',
          }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}
