import { getTranslations } from 'next-intl/server';
import { AUDIENCE_STRIP } from '../content';
import { ICONS } from '../icons';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/**
 * Landing audience strip: one sentence to each trade persona (weaver/karigar,
 * trader, mill owner, job seeker, training institute, student, service
 * provider). Cross-module links: copy under marketing.audience; AUDIENCE_STRIP
 * in content.ts. The grid is 3-up on desktop; with seven personas the lone last
 * card is centred (sm: span both cols, capped to one-column width + mx-auto;
 * lg: placed in the middle column) so no row reads as broken.
 */
export async function AudienceStrip() {
  const t = await getTranslations('marketing.audience');
  return (
    <SectionView
      page="home"
      section="audience"
      className="bg-[var(--cr-cream)] py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCE_STRIP.map((audience, index) => {
            const Icon = ICONS[audience.icon];
            // Centre the lone trailing card (7 personas leave one alone in the
            // last row) so the grid never reads as broken at sm/lg.
            const isLast = index === AUDIENCE_STRIP.length - 1;
            const lastCardCentering = isLast
              ? 'sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.5rem)] lg:col-span-1 lg:col-start-2 lg:w-auto'
              : '';
            return (
              <Reveal key={audience.id} delay={(index % 3) * 60} className={lastCardCentering}>
                <div className="mkt-card mkt-elevate flex h-full flex-col rounded-[20px] p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
                    {Icon ? <Icon className="h-[21px] w-[21px]" /> : null}
                  </span>
                  <h3 className="pt-5 text-[1.12rem]">{t(`items.${audience.id}.title`)}</h3>
                  <p className="pt-2 text-[0.96rem] leading-relaxed text-[var(--cr-neutral-600)]">
                    {t(`items.${audience.id}.body`)}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </SectionView>
  );
}
