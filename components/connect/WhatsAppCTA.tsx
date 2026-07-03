'use client';

/**
 * WhatsAppCTA - the always-green WhatsApp action (design-decisions doc §8).
 *
 * Builds a `wa.me` deep link with pre-filled context. This is the FREE handoff
 * (no WhatsApp Business API / BSP) - the wireframe-critical path. Outbound
 * WhatsApp *notifications* (a paid BSP) are a separate, later concern.
 */

import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import { useTranslations } from 'next-intl';

function WhatsAppGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.83 9.83 0 0 0-2.91-7.01zM12.04 20.15a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.26-8.25 2.2 0 4.28.86 5.83 2.42a8.18 8.18 0 0 1 2.42 5.84c0 4.55-3.7 8.23-8.26 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01a.91.91 0 0 0-.66.31c-.23.25-.86.85-.86 2.07s.88 2.4 1 2.56c.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
}

/** Builds a wa.me deep link. Strips non-digits from `phone`; URL-encodes `prefill`. */
export function buildWhatsAppHref(phone?: string, prefill?: string): string {
  const base = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : 'https://wa.me/';
  return prefill ? `${base}?text=${encodeURIComponent(prefill)}` : base;
}

interface WhatsAppCTAProps extends Omit<ButtonProps, 'type' | 'href' | 'icon'> {
  /** Recipient phone, international format (e.g. "919876543210"). Non-digits stripped. */
  phone?: string;
  /** Pre-filled message body - the context handoff (design-decisions doc §8.2). */
  prefill?: string;
  /** Label preset: `continue` after an inquiry, `message` on a page/profile. */
  label?: 'continue' | 'message';
  /** Icon-only - for mobile sticky CTA bars. */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export default function WhatsAppCTA({
  phone,
  prefill,
  label = 'message',
  iconOnly = false,
  fullWidth,
  children,
  ...rest
}: WhatsAppCTAProps) {
  const t = useTranslations('connect.whatsapp');
  const text = children ?? t(label);

  return (
    <Button
      className="cn-wa-cta"
      href={buildWhatsAppHref(phone, prefill)}
      target="_blank"
      rel="noopener noreferrer"
      block={fullWidth}
      icon={<WhatsAppGlyph />}
      aria-label={typeof text === 'string' ? text : t(label)}
      {...rest}
    >
      {!iconOnly && text}
    </Button>
  );
}
