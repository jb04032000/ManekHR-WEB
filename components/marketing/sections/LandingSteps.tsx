import { getTranslations } from 'next-intl/server';
import { LANDING_STEPS } from '../content';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { StepsProgress } from '../motion/StepsProgress';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/**
 * Landing "how it works" — three steps connected by a scroll-linked progress
 * line (StepsProgress) instead of three static boxes: each numbered badge sits
 * on the line, with an elevated card below. Target of the hero's #how anchor.
 * Cross-module links: copy under marketing.how; steps in content.ts; the rail
 * fill uses .mkt-steps-fill in globals.css. SectionView fires
 * page_section_viewed; Reveal staggers the columns.
 */
export async function LandingSteps() {
  const t = await getTranslations('marketing.how');
  return (
    <SectionView
      page="home"
      section="how"
      id="how"
      className="scroll-mt-[96px] bg-[var(--cr-cream)] py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>

        <div className="relative mt-16">
          <StepsProgress />
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            {LANDING_STEPS.map((id, index) => (
              <Reveal key={id} delay={index * 70}>
                <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  {/* Numbered badge sits ON the progress line; the cream ring
                      masks the rail behind it so it reads as a node on the line. */}
                  <span className="mkt-mono relative z-10 grid h-10 w-10 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-[0.9rem] font-bold text-white ring-4 ring-[var(--cr-cream)]">
                    {index + 1}
                  </span>
                  <div className="mkt-card mkt-elevate mt-6 w-full rounded-[20px] p-6 sm:p-7">
                    <h3 className="text-[1.26rem]">{t(`steps.${id}.title`)}</h3>
                    <p className="pt-2.5 text-[1rem] leading-relaxed text-[var(--cr-neutral-600)]">
                      {t(`steps.${id}.body`)}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </SectionView>
  );
}
