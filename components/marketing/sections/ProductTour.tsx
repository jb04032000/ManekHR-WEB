import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { CtaButton } from '../CtaButton';
import { ICONS } from '../icons';
import { ChatMock, FeedMock, JobsMock, RfqMock, StorefrontMock } from '../mockups';
import { NetworkHeroMock } from '../NetworkHeroMock';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/** One tour capability card: icon chip + title + one-liner + its live product mock. */
function ToolCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: string;
  title: string;
  desc: string;
  children: ReactNode;
}) {
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
      <div className="pt-5">{children}</div>
    </article>
  );
}

/** The five tools, in narrative order: show work -> your shop -> get quotes ->
 *  hire/find work -> close the deal. Each carries its own live mock so the tour
 *  reveals the real product UI card by card. Keep in sync with marketing.modules.items. */
const TOUR_CARDS = [
  { id: 'feed', icon: 'spark', mock: <FeedMock /> },
  { id: 'storefront', icon: 'store', mock: <StorefrontMock /> },
  { id: 'rfq', icon: 'tag', mock: <RfqMock /> },
  { id: 'jobs', icon: 'briefcase', mock: <JobsMock /> },
  { id: 'chat', icon: 'chat', mock: <ChatMock /> },
] as const;

/**
 * Home "product tour" — the page's anchor scene, and the fix for "the context
 * keeps changing". Replaces the old ThreePillars + ModuleShowcase pair (which
 * told the "what's inside" story twice). LEFT is a sticky anchor (heading + the
 * living NetworkHeroMock window + CTA) pinned on lg while the RIGHT column of 5
 * capability cards (feed / storefront / quotations / jobs / chat, each its own
 * live mock) scrolls past — the eye keeps ONE subject while the product reveals
 * itself tool by tool (the aletheia.events pattern). Reuses marketing.modules.*
 * (zero net-new i18n keys).
 *
 * Cross-module links: mocks in mockups.tsx + NetworkHeroMock; the /connect deep
 * dive shows each tool in full; carries id="tour" (Hero's secondary CTA targets
 * it). Watch: keep the anchor SHORTER than the 5-card rail or the pin won't
 * travel; sticky is lg-only (mobile = single column, anchor first, mock hidden so
 * the hero's NetworkHeroMock is not repeated on a phone); scroll-mt clears the
 * 76px sticky navbar on anchor-jump; per-card delay stays 0 (a vertical scroll
 * list must NOT use cumulative stagger or late cards animate after you reach them).
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
                <NetworkHeroMock variant="home" />
              </div>
            </Reveal>
            <Reveal className="mt-8">
              <CtaButton href="/connect" page="home" position="tour_explore" variant="outline">
                {t('cta')}
              </CtaButton>
            </Reveal>
          </div>

          {/* RIGHT — the scrolling capability stack. Each card reveals on its own
              (delay 0); a vertical scroll list must not use cumulative stagger. */}
          <ol className="flex min-w-0 flex-col gap-6 lg:gap-8">
            {TOUR_CARDS.map((card) => (
              <li key={card.id}>
                <Reveal>
                  <ToolCard
                    icon={card.icon}
                    title={t(`items.${card.id}.title`)}
                    desc={t(`items.${card.id}.desc`)}
                  >
                    {card.mock}
                  </ToolCard>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </SectionView>
  );
}
