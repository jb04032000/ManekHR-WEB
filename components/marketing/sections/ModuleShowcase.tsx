import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { CtaButton } from '../CtaButton';
import { ICONS } from '../icons';
import { ChatMock, RfqMock } from '../mockups';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/** One bento tool cell: icon chip + title + one-liner, optional live mock under it. */
function ToolCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: string;
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  const Icon = ICONS[icon];
  return (
    <article className="mkt-card mkt-elevate flex h-full flex-col rounded-[22px] p-6 sm:p-7">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
        {Icon ? <Icon className="h-[22px] w-[22px]" /> : null}
      </span>
      <h3 className="pt-5 text-[1.2rem]">{title}</h3>
      <p className="pt-2 text-[0.97rem] leading-relaxed text-[var(--cr-neutral-600)]">{desc}</p>
      {children ? <div className="mt-auto pt-6">{children}</div> : null}
    </article>
  );
}

/**
 * Landing five-tools showcase — bento (not a uniform 5-card row): the quote and
 * chat tools are the live-mock feature cells, the other three are tight text, so
 * the section ladders under the three pillars with hierarchy instead of
 * repetition. Uses RfqMock + ChatMock (the pillars already showed feed +
 * storefront, so no mock repeats on the page). Cross-module links: copy under
 * marketing.modules; deeper per-tool detail on /connect. Cards are borderless
 * `.mkt-elevate` surfaces that lift + glow on hover.
 */
export async function ModuleShowcase() {
  const t = await getTranslations('marketing.modules');
  return (
    <SectionView
      page="home"
      section="modules"
      className="bg-[var(--cr-surface)] py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Feature row — two live mocks at different sizes */}
          <Reveal className="h-full sm:col-span-2">
            <ToolCard icon="tag" title={t('items.rfq.title')} desc={t('items.rfq.desc')}>
              <RfqMock />
            </ToolCard>
          </Reveal>
          <Reveal className="h-full" delay={80}>
            <ToolCard icon="chat" title={t('items.chat.title')} desc={t('items.chat.desc')}>
              <ChatMock />
            </ToolCard>
          </Reveal>

          {/* Tight-text row — the remaining three tools */}
          <Reveal className="h-full" delay={60}>
            <ToolCard icon="spark" title={t('items.feed.title')} desc={t('items.feed.desc')} />
          </Reveal>
          <Reveal className="h-full" delay={120}>
            <ToolCard
              icon="store"
              title={t('items.storefront.title')}
              desc={t('items.storefront.desc')}
            />
          </Reveal>
          <Reveal className="h-full" delay={180}>
            <ToolCard icon="briefcase" title={t('items.jobs.title')} desc={t('items.jobs.desc')} />
          </Reveal>
        </div>

        <Reveal className="mt-12">
          <CtaButton href="/connect" page="home" position="modules_explore" variant="outline">
            {t('cta')}
          </CtaButton>
        </Reveal>
      </Container>
    </SectionView>
  );
}
