import { getTranslations } from 'next-intl/server';
import { LANDING_TRUST_ITEMS } from '../content';
import { ICONS } from '../icons';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/**
 * Landing trust wedge — the differentiation hook AND the page's dark contrast
 * peak: a full-bleed deep-indigo band that breaks the light/tinted rhythm so the
 * "talk to real, verified businesses" message lands. Every signal is an honest
 * product mechanic (self-verification, ERP-linked pages, ratings only after a
 * real deal, direct dealing), never an invented count, logo, or testimonial.
 * Cross-module links: copy under marketing.trust; LANDING_TRUST_ITEMS in
 * content.ts. Cards are frosted `.mkt-elevate` panels (on-dark variant) that
 * lift + glow gold on hover.
 *
 * Layout: 5 cards on a 6-col grid render as a balanced 3 + 2 (top row of three,
 * bottom pair centred by offsetting card 4 to col-start-2) so no card is left
 * orphaned. Card width matches the 3-up grids elsewhere (AudienceStrip). On sm it
 * is 2-up with the lone 5th card centred (same lone-last-card idiom as
 * AudienceStrip). Keep this in sync if LANDING_TRUST_ITEMS changes count.
 */
export async function TrustWedge() {
  const t = await getTranslations('marketing.trust');
  return (
    <SectionView
      page="home"
      section="trust"
      className="mkt-on-dark relative overflow-hidden py-20 sm:py-24 lg:py-28"
    >
      <div
        className="absolute inset-0"
        style={{ background: 'var(--cr-indigo-800)' }}
        aria-hidden="true"
      />
      <Container className="relative">
        <Reveal>
          <SectionHeading
            align="center"
            tone="dark"
            eyebrow={t('eyebrow')}
            title={t('title')}
            sub={t('sub')}
          />
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {LANDING_TRUST_ITEMS.map((item, index) => {
            const Icon = ICONS[item.icon];
            // Balance the bottom row: every card spans 2 of 6 cols (3 per row);
            // card 4 starts the centred pair (col-start-2) so the trailing two sit
            // in the middle. On sm the lone 5th card is span-2 + width-capped +
            // mx-auto so it centres instead of orphaning bottom-left.
            const isFourth = index === 3;
            const isLast = index === LANDING_TRUST_ITEMS.length - 1;
            const placement = [
              'lg:col-span-2',
              isFourth ? 'lg:col-start-2' : '',
              isLast ? 'sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.625rem)] lg:mx-0 lg:w-auto' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Reveal key={item.id} delay={(index % 3) * 60} className={placement}>
                <div className="mkt-card mkt-elevate flex h-full flex-col rounded-[20px] p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-white/10 text-[var(--cr-gold-400)] ring-1 ring-white/10">
                    {Icon ? <Icon className="h-[21px] w-[21px]" /> : null}
                  </span>
                  <h3 className="pt-5 text-[1.12rem] text-white">{t(`items.${item.id}.title`)}</h3>
                  <p className="pt-2 text-[0.95rem] leading-relaxed text-white/70">
                    {t(`items.${item.id}.body`)}
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
