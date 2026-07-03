import { getTranslations } from 'next-intl/server';
import { BriefcaseIcon, NetworkIcon, StoreIcon } from '../icons';
import { FeedMock, StorefrontMock } from '../mockups';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/** Pillar header: icon chip + monospace kicker. */
function PillarHead({ Icon, kicker }: { Icon: typeof NetworkIcon; kicker: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="mkt-mono text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--cr-neutral-500)] uppercase">
        {kicker}
      </span>
    </div>
  );
}

/**
 * Landing "three things, one place" — bento layout (not a uniform card row) so
 * the three jobs read with hierarchy: Network is the big featured cell with a
 * live feed mock, Marketplace stacks a live storefront mock beside it, and
 * Hiring is the tight-text cell. Sets the mental model before the five-tool
 * grid. Cross-module links: copy under marketing.pillars; mocks reuse FeedMock +
 * StorefrontMock (the /connect deep dive shows all). Surfaces are borderless
 * `.mkt-elevate` cards that lift + glow on hover (.mkt-card).
 */
export async function ThreePillars() {
  const t = await getTranslations('marketing.pillars');
  return (
    <SectionView
      page="home"
      section="pillars"
      className="bg-[var(--cr-surface)] py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_1fr]">
          {/* Network — the large featured cell */}
          <Reveal>
            <article className="mkt-card mkt-elevate flex h-full flex-col rounded-[24px] p-7 sm:p-9">
              <PillarHead Icon={NetworkIcon} kicker={t('items.network.kicker')} />
              <h3 className="pt-6 text-[1.6rem]">{t('items.network.title')}</h3>
              <p className="max-w-[44ch] pt-3 text-[1.04rem] leading-relaxed text-[var(--cr-neutral-600)]">
                {t('items.network.body')}
              </p>
              <div className="mt-auto pt-8">
                <FeedMock />
              </div>
            </article>
          </Reveal>

          {/* Right column: Marketplace (with mock) + Hiring (tight text) stacked */}
          <div className="flex flex-col gap-5">
            <Reveal delay={80}>
              <article className="mkt-card mkt-elevate flex h-full flex-col rounded-[24px] p-6 sm:p-7">
                <PillarHead Icon={StoreIcon} kicker={t('items.marketplace.kicker')} />
                <h3 className="pt-5 text-[1.28rem]">{t('items.marketplace.title')}</h3>
                <p className="pt-2.5 text-[0.98rem] leading-relaxed text-[var(--cr-neutral-600)]">
                  {t('items.marketplace.body')}
                </p>
                <div className="mt-5">
                  <StorefrontMock />
                </div>
              </article>
            </Reveal>

            <Reveal delay={140}>
              <article className="mkt-card mkt-elevate flex h-full flex-col justify-center rounded-[24px] p-6 sm:p-7">
                <PillarHead Icon={BriefcaseIcon} kicker={t('items.hiring.kicker')} />
                <h3 className="pt-5 text-[1.28rem]">{t('items.hiring.title')}</h3>
                <p className="pt-2.5 text-[0.98rem] leading-relaxed text-[var(--cr-neutral-600)]">
                  {t('items.hiring.body')}
                </p>
              </article>
            </Reveal>
          </div>
        </div>
      </Container>
    </SectionView>
  );
}
