'use client';

/**
 * ContactPreferenceSelector - how a person wants to be reached (design-decisions
 * doc §4.1). WhatsApp / Call / on-platform DM.
 *
 * Two render modes:
 *  - **Edit (`readOnly={false}`)** - three pill buttons in a radio group. The
 *    user picks one; clicking persists via the surrounding form. This is the
 *    selector used inside the per-section edit modal (`EditSectionModal`).
 *  - **Read (`readOnly={true}`)** - a single static "Prefers <channel>" pill
 *    showing the active preference, NOT a row of clickable buttons. Earlier
 *    iterations rendered all three pills with the active one highlighted; on
 *    the public profile this read as a CTA row that did nothing on click -
 *    UX dishonesty. The single-pill read form is informational only (no
 *    pointer cursor, no hover state, no `button` semantics).
 *
 * The actual contact channel is established through Connect's DM flow (Phase 7)
 * - these pills only signal the person's preferred channel, never reveal
 * private contact details directly.
 */

import type { ReactNode } from 'react';
import { Phone, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import WhatsAppIcon from './WhatsAppIcon';

export const CONTACT_PREFERENCES = ['whatsapp', 'phone', 'dm'] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

const ICON: Record<ContactPreference, ReactNode> = {
  whatsapp: <WhatsAppIcon size={15} />,
  phone: <Phone size={15} />,
  dm: <Send size={15} />,
};

interface ContactPreferenceSelectorProps {
  value: ContactPreference;
  onChange?: (value: ContactPreference) => void;
  /** Display-only (public + own profile view). Default false (editable). */
  readOnly?: boolean;
}

export default function ContactPreferenceSelector({
  value,
  onChange,
  readOnly = false,
}: ContactPreferenceSelectorProps) {
  const t = useTranslations('connect.contactPref');

  // ── Read mode - single informational pill. No button semantics; the
  //    earlier 3-button radio row read as CTAs that did nothing.
  if (readOnly) {
    const isWhatsApp = value === 'whatsapp';
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--cr-space-sm)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-3)',
          }}
        >
          {t('title')}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 'var(--cr-radius-full)',
            background: isWhatsApp ? 'rgba(37, 211, 102, 0.12)' : 'var(--cr-primary-light)',
            color: isWhatsApp ? 'var(--cn-whatsapp-hover)' : 'var(--cr-primary)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {ICON[value]}
          {t(value)}
        </span>
      </div>
    );
  }

  // ── Edit mode - the existing 3-button radio group. Stays unchanged so the
  //    profile edit form's behaviour is identical to before.
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--cr-space-sm)', flexWrap: 'wrap' }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--cr-text-3)',
        }}
      >
        {t('title')}
      </span>

      <div
        role="radiogroup"
        aria-label={t('title')}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {CONTACT_PREFERENCES.map((pref) => {
          const selected = pref === value;
          const isWhatsApp = pref === 'whatsapp';
          return (
            <button
              key={pref}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange?.(pref)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--cr-radius-full)',
                border: `1px solid ${selected ? 'var(--cr-primary-border)' : 'var(--cr-border)'}`,
                background: selected ? 'var(--cr-primary-light)' : 'var(--cr-surface)',
                color: selected
                  ? isWhatsApp
                    ? 'var(--cn-whatsapp-hover)'
                    : 'var(--cr-primary)'
                  : 'var(--cr-text-3)',
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {ICON[pref]}
              {t(pref)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
