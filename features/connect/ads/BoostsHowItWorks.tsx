'use client';

/**
 * BoostsHowItWorks - the dismissible "how boosting works" explainer on the
 * Boosts hub. Three plain-language steps (pick -> budget & audience -> track)
 * for a first-time advertiser.
 *
 * Visibility:
 *   - No activity + not dismissed -> prominent 3-step strip (the teaching state).
 *   - Has activity OR dismissed    -> collapses to a small "How it works" link
 *                                     that expands the strip inline on demand.
 * The explicit dismiss persists in localStorage (per-device; server-side persist
 * is a noted follow-up for multi-device users). Auto-collapse on activity needs
 * no storage - it is derived from the caller's boost count.
 *
 * Fully i18n'd (connect.boosts.howItWorks); keyboard + screen-reader friendly.
 */

import { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  type LucideIcon,
  BarChart3,
  ChevronRight,
  HelpCircle,
  Target,
  Wallet,
  X,
} from 'lucide-react';

const DISMISS_KEY = 'connect.boosts.howItWorks.dismissed.v1';

interface Props {
  /** True when the caller already has at least one boost (any status). */
  hasActivity: boolean;
}

export default function BoostsHowItWorks({ hasActivity }: Props) {
  const t = useTranslations('connect.boosts.howItWorks');
  // First client render matches the server (dismissed=false); the stored value
  // is applied after mount, so there is no hydration mismatch.
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Private mode / storage disabled: just show the default (not dismissed).
    }
    // Deferred (startTransition) so this post-hydration read is a non-urgent
    // update, satisfying react-hooks/set-state-in-effect (mirrors usePersistedState).
    if (stored) startTransition(() => setDismissed(true));
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setExpanded(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Best-effort; the strip still collapses for this session.
    }
  };

  const collapsed = hasActivity || dismissed;

  const steps: Array<{ icon: LucideIcon; title: string; body: string }> = [
    { icon: Target, title: t('step1Title'), body: t('step1Body') },
    { icon: Wallet, title: t('step2Title'), body: t('step2Body') },
    { icon: BarChart3, title: t('step3Title'), body: t('step3Body') },
  ];

  // Collapsed + not expanded: just the small "How it works" link.
  if (collapsed && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mb-5 inline-flex items-center gap-1.5 rounded-[var(--cr-radius-full)] px-3 py-1.5 text-[12.5px] font-semibold"
        style={{
          border: '1px solid var(--cr-border)',
          background: 'var(--cr-surface)',
          color: 'var(--cr-text-3)',
          cursor: 'pointer',
        }}
        aria-expanded={false}
      >
        <HelpCircle size={14} aria-hidden /> {t('link')}
      </button>
    );
  }

  return (
    <section
      aria-label={t('title')}
      className="relative mb-5 rounded-[var(--cr-radius-lg)] p-4 sm:p-5"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="m-0 text-[15px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('title')}
        </h2>
        {/* When expanded from the collapsed link, the control re-collapses; in the
            prominent (teaching) state it dismisses + persists. */}
        <button
          type="button"
          onClick={collapsed ? () => setExpanded(false) : dismiss}
          aria-label={collapsed ? t('collapse') : t('dismiss')}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--cr-radius-md)]"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--cr-text-4)',
            cursor: 'pointer',
          }}
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li
              key={i}
              className="flex items-start gap-3 rounded-[var(--cr-radius-md)] p-3"
              style={{ background: 'var(--cr-surface-2)' }}
            >
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold"
                style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon size={14} aria-hidden style={{ color: 'var(--cr-primary)' }} />
                  <h3 className="m-0 text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
                    {s.title}
                  </h3>
                </div>
                <p
                  className="m-0 mt-1 text-[12px] leading-relaxed"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {s.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <p
        className="m-0 mt-3 flex items-center gap-1.5 text-[12px] font-medium"
        style={{ color: 'var(--cr-text-3)' }}
      >
        <ChevronRight size={13} aria-hidden style={{ color: 'var(--cr-success)' }} />
        {t('reassure')}
      </p>
    </section>
  );
}
