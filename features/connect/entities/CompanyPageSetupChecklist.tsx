'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight, Check, Circle, Rocket } from 'lucide-react';
import type { CompanyPage } from './entities.types';

/** One computed setup step. `done` is derived from real page data only. */
export interface SetupStep {
  key: string;
  done: boolean;
  /** A `/connect/pages/[id]/edit` deep-link, or undefined when the action is an
   *  in-page callback (jump to a tab / open the share panel). */
  href?: string;
  onAction?: () => void;
}

/**
 * Compute the honest setup checklist for a company page. Every step reflects a
 * real field on the page object (logo, banner, about, specialization) or a real
 * signal (at least one open job, the owner having shared the link). No fabricated
 * progress: an unchecked step is genuinely empty data.
 */
export function buildSetupSteps({
  page,
  openJobs,
  hasShared,
  editHref,
  onGoToJobs,
  onShare,
}: {
  page: CompanyPage;
  openJobs: number;
  hasShared: boolean;
  editHref: string;
  onGoToJobs: () => void;
  onShare: () => void;
}): SetupStep[] {
  return [
    { key: 'stepLogo', done: !!page.logo, href: editHref },
    { key: 'stepCover', done: !!page.banner, href: editHref },
    { key: 'stepAbout', done: !!page.about?.trim(), href: editHref },
    {
      key: 'stepSpecialization',
      done: (page.industryPanel?.specialization?.length ?? 0) > 0,
      href: editHref,
    },
    { key: 'stepJob', done: openJobs > 0, onAction: onGoToJobs },
    { key: 'stepShare', done: hasShared, onAction: onShare },
  ];
}

/**
 * CompanyPageSetupChecklist - the Overview "get established" card. A complete
 * page earns trust, so each gap is a one-tap fix that deep-links to the edit
 * page, the Jobs tab, or the share panel. The progress count is honest
 * (done / total of real steps); the card hides itself once every step is done.
 */
export default function CompanyPageSetupChecklist({
  steps,
  cardStyle,
}: {
  steps: SetupStep[];
  cardStyle: React.CSSProperties;
}) {
  const t = useTranslations('connect.companyPageAdmin');
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  if (done >= total) return null;

  return (
    <section style={cardStyle}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center"
          style={{
            borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr-primary-light)',
            color: 'var(--cr-primary)',
          }}
        >
          <Rocket size={17} aria-hidden />
        </span>
        <div>
          <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {t('setupTitle')}
          </h2>
          <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('setupProgress', { done, total })}
          </p>
        </div>
      </div>

      <p className="m-0 mt-3 text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
        {t('setupBody')}
      </p>

      <ul className="m-0 mt-3 flex list-none flex-col p-0">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className="flex items-center gap-3 py-2.5"
            style={{ borderTop: i > 0 ? '1px solid var(--cr-border-light)' : undefined }}
          >
            <span aria-hidden className="shrink-0">
              {s.done ? (
                <span
                  className="grid place-items-center"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: 'var(--cr-success)',
                    color: '#fff',
                  }}
                >
                  <Check size={12} />
                </span>
              ) : (
                <Circle size={20} style={{ color: 'var(--cr-text-4)' }} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[13.5px] font-semibold"
                style={{
                  color: s.done ? 'var(--cr-text-4)' : 'var(--cr-text-2)',
                  textDecoration: s.done ? 'line-through' : 'none',
                }}
              >
                {t(`${s.key}.title`)}
              </span>
              <span className="block text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                {t(`${s.key}.hint`)}
              </span>
            </span>
            {!s.done &&
              (s.href ? (
                <Link
                  href={s.href}
                  className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold no-underline"
                  style={{ color: 'var(--cr-primary)' }}
                >
                  {t('setupFix')} <ArrowRight size={13} aria-hidden />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={s.onAction}
                  className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--cr-primary)',
                  }}
                >
                  {t('setupFix')} <ArrowRight size={13} aria-hidden />
                </button>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
