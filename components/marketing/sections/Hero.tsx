import { getTranslations } from 'next-intl/server';
import { AUTH } from '../content';
import { CtaButton } from '../CtaButton';
import { CheckIcon } from '../icons';
import { NetworkHeroMock } from '../NetworkHeroMock';
import { Container } from '../ui/Container';

const HERO_BG =
  'radial-gradient(ellipse 60% 70% at 84% 14%, var(--cr-indigo-50) 0%, transparent 62%), radial-gradient(ellipse 50% 60% at 6% 96%, var(--cr-gold-100) 0%, transparent 55%)';

// The honest above-the-fold trust chips (real signals, no invented numbers).
const HERO_CHIPS = ['verified', 'free', 'languages'] as const;

/**
 * Landing hero. Above the fold, so it renders instantly with NO entrance
 * animation (LCP protection). The only motion is ambient + reduced-motion-safe:
 * a slow aurora wash behind the content and the in-mock cycling highlight; the
 * hero itself never animates in. Cross-module links: CtaButton fires
 * marketing.cta_clicked; the secondary CTA anchors to the #tour section (smooth
 * scroll via CSS); the network-led mock telegraphs all three jobs at a glance.
 */
export async function Hero() {
  const t = await getTranslations('marketing.hero');
  return (
    <section className="relative overflow-hidden" style={{ background: HERO_BG }}>
      <div className="mkt-aurora" aria-hidden="true" />
      <Container className="relative z-10 grid grid-cols-1 items-center gap-10 py-14 sm:py-18 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
        <div>
          <span className="mkt-mono inline-flex items-center gap-2 rounded-full border border-[var(--cr-neutral-200)] bg-white px-3 py-1.5 text-[0.7rem] font-semibold tracking-[0.1em] text-[var(--cr-indigo-700)] uppercase shadow-[var(--cr-shadow-sm)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--cr-gold-500)]" aria-hidden="true" />
            {t('eyebrow')}
          </span>
          <h1 className="pt-6 text-[clamp(2.4rem,1.5rem+3.2vw,3.95rem)] text-balance">
            {t('headline')}
          </h1>
          <p className="max-w-[40ch] pt-6 text-[1.16rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
            {t('sub')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <CtaButton
              href={AUTH.getStarted}
              page="home"
              position="hero"
              variant="solid-indigo"
              size="lg"
              arrow
            >
              {t('ctaPrimary')}
            </CtaButton>
            <CtaButton href="#tour" page="home" position="hero_tour" variant="outline" size="lg">
              {t('ctaSecondary')}
            </CtaButton>
          </div>
          <div className="pt-7">
            <p className="inline-flex items-center gap-2 text-[0.94rem] font-medium text-[var(--cr-neutral-700)]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--cr-gold-500)]"
                aria-hidden="true"
              />
              {t('trustLine')}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {HERO_CHIPS.map((id) => (
                <li
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cr-neutral-200)] bg-white px-3 py-1 text-[0.82rem] text-[var(--cr-neutral-600)] shadow-[var(--cr-shadow-sm)]"
                >
                  <CheckIcon className="h-3.5 w-3.5 text-[var(--cr-indigo-600)]" />
                  {t(`chips.${id}`)}
                </li>
              ))}
            </ul>
            {/* Quiet dual-product pointer: routes ERP-intent visitors (factory /
                shop owners) to /erp from the fold instead of making them find
                the tiny nav link or scroll to the ErpCompanion band. A text
                link on purpose - Connect stays the product this page sells.
                Gold dot mirrors the navbar's ERP dot; CtaButton fires
                marketing.cta_clicked { position: 'hero_erp' }. */}
            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.92rem] text-[var(--cr-neutral-600)]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--cr-gold-500)]"
                aria-hidden="true"
              />
              {t('erpQ')}
              <CtaButton href="/erp" page="home" position="hero_erp" variant="link" arrow>
                {t('erpCta')}
              </CtaButton>
            </p>
          </div>
        </div>

        {/* Mockup is 2nd in the DOM: on desktop the 2-col grid puts it in the
            right column; on mobile it follows the headline + CTA (no order-first)
            so the value prop + primary CTA lead the fold and the mock rewards the
            scroll. The tall mock previously pushed both below the fold on phones. */}
        <div className="[filter:drop-shadow(0_24px_48px_rgba(14,24,68,0.16))]">
          <NetworkHeroMock variant="home" />
        </div>
      </Container>
    </section>
  );
}
