import { getTranslations } from 'next-intl/server';
import { AUTH } from '../content';
import { CtaButton } from '../CtaButton';
import { NetworkHeroMock } from '../NetworkHeroMock';
import { ProductBadge } from '../ProductBadge';
import { Container } from '../ui/Container';

const HERO_BG =
  'radial-gradient(ellipse 58% 70% at 86% 12%, var(--cr-indigo-50) 0%, transparent 60%), radial-gradient(ellipse 46% 56% at 4% 98%, var(--cr-gold-100) 0%, transparent 52%)';

/**
 * /connect hero. Above the fold, renders instantly with no entrance animation
 * (LCP protection); the only motion is the ambient aurora + the in-mock cycling
 * highlight (both reduced-motion-safe). Uses the `connect` mock variant so this
 * page does not share the home hero visual. Cross-module links: copy under
 * marketing.pages.connect.hero; secondary CTA anchors to #modules.
 */
export async function ConnectHero() {
  const t = await getTranslations('marketing.pages.connect.hero');
  return (
    <section className="relative overflow-hidden" style={{ background: HERO_BG }}>
      <div className="mkt-aurora" aria-hidden="true" />
      <Container className="relative z-10 grid grid-cols-1 items-center gap-10 py-14 sm:py-18 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
        <div>
          <ProductBadge label={t('badge')} tone="connect" />
          <h1 className="pt-5 text-[clamp(2.3rem,1.5rem+3vw,3.75rem)] text-balance">
            {t('title')}
          </h1>
          <p className="max-w-[42ch] pt-6 text-[1.14rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
            {t('sub')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            {/* Connect-intent entry (for=connect) so this dedicated-page CTA
                skips the IntentPicker and goes straight into Connect signup. */}
            <CtaButton
              href={AUTH.getStartedConnect}
              page="connect"
              position="hero"
              variant="solid-indigo"
              size="lg"
              arrow
            >
              {t('ctaPrimary')}
            </CtaButton>
            <CtaButton
              href="#modules"
              page="connect"
              position="hero_modules"
              variant="outline"
              size="lg"
            >
              {t('ctaSecondary')}
            </CtaButton>
          </div>
        </div>
        <div className="order-first [filter:drop-shadow(0_24px_48px_rgba(14,24,68,0.16))] lg:order-last">
          <NetworkHeroMock variant="connect" />
        </div>
      </Container>
    </section>
  );
}
