import { getTranslations } from 'next-intl/server';
import { CtaButton } from '../CtaButton';
import { LANDING_MODULES } from '../content';
import { ICONS } from '../icons';
import { NetworkHeroMock } from '../NetworkHeroMock';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/** One tour capability card: icon chip + title + one-liner. */
function ToolCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const Icon = ICONS[icon];
  return (
    <article className="mkt-card mkt-elevate flex flex-col rounded-[20px] p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
          {Icon ? <Icon className="h-[22px] w-[22px]" /> : null}
        </span>
        <h3 className="text-[1.2rem]">{title}</h3>
      </div>
      <p className="pt-2.5 text-[0.97rem] leading-relaxed text-[var(--cr-neutral-600)]">{desc}</p>
    </article>
  );
}

/**
 * Home "product tour" — the page's anchor scene. Tours ManekHR's four real
 * modules (team/staff directory, attendance, salary/payroll, roles &
 * permissions) — driven by LANDING_MODULES in content.ts so ids/icons/copy stay
 * in one place. LEFT is a sticky anchor (heading + the living NetworkHeroMock
 * window + CTA) pinned on lg while the RIGHT column of capability cards scrolls
 * past — the eye keeps ONE subject while the product reveals itself module by
 * module.
 *
 * Cross-module links: LANDING_MODULES + marketing.modules.* i18n in content.ts;
 * NetworkHeroMock for the anchor visual; carries id="tour" (Hero's secondary
 * CTA targets it). Watch: keep the anchor SHORTER than the card rail or the pin
 * won't travel; sticky is lg-only (mobile = single column, anchor first, mock
 * hidden so the hero's NetworkHeroMock is not repeated on a phone); scroll-mt
 * clears the 76px sticky navbar on anchor-jump; per-card delay stays 0 (a
 * vertical scroll list must NOT use cumulative stagger).
 */
export async function ProductTour() {
  const t = await getTranslations('marketing.modules');
  return (
    <SectionView
      page="home"
      section="tour"
      id="tour"
      className="scroll-mt-[96px] bg-[var(--cr-surface)] py-20 sm:py-24 lg:py-28"
    >
      <Container>
        {/* `grid-cols-1` base (not the implicit `auto` column) so the mobile track
            is `minmax(0,1fr)` and CANNOT blow out to a child's min-content - that
            implicit-column blowout was the page's horizontal-scroll bug on phones.
            min-w-0 on both children lets them shrink inside the fr tracks too. */}
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* LEFT — the persistent anchor (pinned on lg, normal flow on mobile). */}
          <div className="min-w-0 lg:sticky lg:top-[96px] lg:self-start">
            <Reveal>
              <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
            </Reveal>
            {/* The mock anchors the scroll on desktop; hidden on mobile (the hero
                already shows it, and a phone leads with the cards). */}
            <Reveal className="mt-9 hidden lg:block">
              <div className="[filter:drop-shadow(0_24px_48px_rgba(14,24,68,0.16))]">
                <NetworkHeroMock />
              </div>
            </Reveal>
            <Reveal className="mt-8">
              <CtaButton href="/erp" page="home" position="tour_explore" variant="outline">
                {t('cta')}
              </CtaButton>
            </Reveal>
          </div>

          {/* RIGHT — the scrolling capability stack. Each card reveals on its own
              (delay 0); a vertical scroll list must not use cumulative stagger. */}
          <ol className="flex min-w-0 flex-col gap-6 lg:gap-8">
            {LANDING_MODULES.map((mod) => (
              <li key={mod.id}>
                <Reveal>
                  <ToolCard
                    icon={mod.icon}
                    title={t(`items.${mod.id}.title`)}
                    desc={t(`items.${mod.id}.desc`)}
                  />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </SectionView>
  );
}
