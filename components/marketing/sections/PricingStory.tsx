import { getTranslations } from 'next-intl/server';
import { LANDING_PRICING_POINTS } from '../content';
import { CtaButton } from '../CtaButton';
import { CheckIcon } from '../icons';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';

/**
 * Landing free-pricing story — "free to use, pay only for more reach". No prices,
 * no invented tiers. Cross-module links: copy under marketing.pricingStory;
 * LANDING_PRICING_POINTS in content.ts; full story on /pricing.
 */
export async function PricingStory() {
  const t = await getTranslations('marketing.pricingStory');
  return (
    <SectionView
      page="home"
      section="pricing"
      className="bg-[var(--cr-surface)] py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <Reveal className="mx-auto max-w-[820px] text-center">
          <div className="flex justify-center">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
          </div>
          <h2 className="mkt-anchor pt-[18px] text-[clamp(2rem,1.3rem+2.5vw,3.1rem)] text-balance">
            {t('title')}
          </h2>
          {/* mx-auto on a <p> is reset by the app base, so the centering +
              max-width live on a wrapper <div> (not reset). */}
          <div className="mx-auto max-w-[60ch] pt-5">
            <p className="text-[1.08rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
              {t('body')}
            </p>
          </div>
        </Reveal>

        <div className="mx-auto mt-9 grid max-w-[820px] grid-cols-1 gap-3 sm:grid-cols-3">
          {LANDING_PRICING_POINTS.map((id, index) => (
            <Reveal key={id} delay={index * 60}>
              <div className="mkt-card mkt-elevate flex h-full items-start gap-2.5 rounded-[14px] px-4 py-3.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-white">
                  <CheckIcon className="h-3 w-3" />
                </span>
                <span className="text-[0.95rem] font-medium text-[var(--cr-neutral-700)]">
                  {t(`points.${id}`)}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-9 flex justify-center">
          <CtaButton href="/pricing" page="home" position="pricing_story" variant="outline">
            {t('cta')}
          </CtaButton>
        </Reveal>
      </Container>
    </SectionView>
  );
}
