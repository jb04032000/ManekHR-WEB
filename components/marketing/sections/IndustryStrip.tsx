import { getTranslations } from 'next-intl/server';
import { LANDING_INDUSTRY_STATS } from '../content';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';

/**
 * Home industry-context strip. Frames ManekHR as built specifically for Surat's
 * diamond-polishing units, favoring honest qualitative framing over invented
 * statistics (we publish no user counts, and the diamond-polishing trade does
 * not have the kind of widely-cited public figures a mass-market industry
 * would). A small caption makes the "industry context" framing explicit so the
 * copy can never be misread as platform metrics. Visual style matches the rest
 * of the site (cream band, gold-accented serif stat, neutral label).
 *
 * Cross-module links: LANDING_INDUSTRY_STATS in content.ts; copy under
 * marketing.industry.* in every locale. Watch: keep claims qualitative and
 * conservative; never restate them as ManekHR's own metrics.
 */
export async function IndustryStrip() {
  const t = await getTranslations('marketing.industry');
  return (
    <SectionView page="home" section="industry" className="bg-[var(--cr-cream)] py-14 sm:py-16">
      <Container>
        <Reveal>
          <p className="text-center text-[0.78rem] font-semibold tracking-[0.12em] text-[var(--cr-gold-700)] uppercase">
            {t('caption')}
          </p>
        </Reveal>
        <div className="mt-9 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
          {LANDING_INDUSTRY_STATS.map((id, index) => (
            <Reveal key={id} delay={(index % 3) * 70}>
              <div className="text-center">
                <p className="text-[clamp(2rem,1.3rem+2.2vw,2.9rem)] font-semibold text-[var(--cr-indigo-700)]">
                  {t(`items.${id}.stat`)}
                </p>
                <p className="mt-1.5 text-[0.96rem] leading-relaxed text-[var(--cr-neutral-600)]">
                  {t(`items.${id}.label`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </SectionView>
  );
}
