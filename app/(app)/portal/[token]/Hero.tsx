'use client';
import { useTranslations } from 'next-intl';
import { formatINRPaise } from './portal-client-api';

interface HeroProps {
  firmName: string;
  partyName: string;
  logoUrl?: string;
  outstandingPaise: number;
}

/**
 * Branded portal hero - copy lives in i18n `finance.portal.hero`.
 * Mobile <768px stacks vertically (logo top -> party greeting -> outstanding).
 *
 * View-only portal (owner decision 2026-06-06, feedback_no_payments_in_billing):
 * no Pay button / UPI path. The hero shows the outstanding balance and a
 * neutral "contact the firm to settle" note - this module collects no payments.
 *
 * Accent color cascades from the wrapper's --cr-primary CSS var (set by
 * PortalShell to the firm's brandPrimary).
 */
export default function Hero({ firmName, partyName, logoUrl, outstandingPaise }: HeroProps) {
  const t = useTranslations('finance.portal');
  const outstandingLabel = formatINRPaise(outstandingPaise);

  return (
    <section
      className="w-full"
      style={{
        background: 'var(--cr-surface, #fff)',
        borderBottom: '1px solid var(--cr-border, var(--cr-border))',
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
          {/* Logo */}
          {logoUrl ? (
            <div className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={t('hero.logoAlt', { firmName })}
                className="h-16 w-16 rounded object-contain"
                style={{ background: 'var(--cr-bg, var(--cr-bg))' }}
              />
            </div>
          ) : null}

          {/* Greeting + firm line */}
          <div className="min-w-0 flex-1">
            <h1
              className="text-[22px] leading-tight md:text-[28px]"
              style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}
            >
              {t('hero.greeting', { partyName })}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--cr-text-2, var(--cr-text-4))' }}>
              {t('hero.statementFrom', { firmName })}
            </p>
          </div>

          {/* Outstanding (view-only - no payment CTA) */}
          <div className="md:text-right">
            <div
              className="mb-1 text-xs tracking-wide uppercase"
              style={{ color: 'var(--cr-text-3)', letterSpacing: '0.06em', fontWeight: 700 }}
            >
              {t('hero.outstanding')}
            </div>
            <div
              className="text-2xl md:text-3xl"
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                color: 'var(--cr-primary, var(--cr-primary))',
              }}
            >
              {outstandingLabel}
            </div>

            <p
              className="mt-2 text-xs md:mt-3"
              style={{ color: 'var(--cr-text-3)', maxWidth: 280 }}
            >
              {t('hero.settleNote', { firmName })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
