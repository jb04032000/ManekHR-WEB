import { getTranslations } from 'next-intl/server';
import { CONNECT_MODULES } from '../content';
import { CheckIcon, ICONS } from '../icons';
import { MODULE_MOCKS } from '../mockups';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/** Per-module bullet keys (storefront carries an extra point + a note). */
const MODULE_BULLETS: Record<string, string[]> = {
  feed: ['b1', 'b2', 'b3'],
  storefront: ['b1', 'b2', 'b3', 'b4'],
  rfq: ['b1', 'b2', 'b3'],
  jobs: ['b1', 'b2', 'b3'],
  chat: ['b1', 'b2', 'b3'],
};
const MODULE_NOTE = new Set(['storefront']);

/**
 * /connect deep module sections — one per shipped module (feed, storefront,
 * quote requests, jobs, chat) with a concrete flow, bullets, and a stylized
 * mockup. The mockup alternates side by index; backgrounds alternate for rhythm.
 * Cross-module links: copy under marketing.pages.connect.modules.*; mocks in
 * mockups.tsx (MODULE_MOCKS); CONNECT_MODULES in content.ts.
 */
export async function ConnectModules() {
  const t = await getTranslations('marketing.pages.connect.modules');

  return (
    <div id="modules">
      <section className="mkt-anchor bg-white pt-16 sm:pt-20 lg:pt-24">
        <Container>
          <Reveal className="mx-auto max-w-[680px] text-center">
            <SectionHeading
              align="center"
              eyebrow={t('eyebrow')}
              title={t('title')}
              sub={t('sub')}
            />
          </Reveal>
        </Container>
      </section>
      {CONNECT_MODULES.map((module, index) => {
        const Icon = ICONS[module.icon];
        const Mock = MODULE_MOCKS[module.id];
        const mockRight = index % 2 === 0;
        const bg = index % 2 === 0 ? 'bg-white' : 'bg-[var(--cr-cream)]';
        return (
          <SectionView
            key={module.id}
            page="connect"
            section={`module_${module.id}`}
            className={`${bg} py-16 sm:py-18 lg:py-22`}
          >
            <Container>
              <div className="grid grid-cols-1 items-center gap-9 lg:grid-cols-2 lg:gap-14">
                <Reveal className={mockRight ? 'lg:order-1' : 'lg:order-2'}>
                  <span className="mkt-mono inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.14em] text-[var(--cr-indigo-700)] uppercase">
                    <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[var(--cr-indigo-50)]">
                      {Icon ? <Icon className="h-[15px] w-[15px]" /> : null}
                    </span>
                    {t(`${module.id}.kicker`)}
                  </span>
                  <h2 className="mkt-anchor pt-4 text-[clamp(1.7rem,1.2rem+1.8vw,2.5rem)] text-balance">
                    {t(`${module.id}.title`)}
                  </h2>
                  <p className="max-w-[54ch] pt-4 text-[1.04rem] leading-relaxed text-[var(--cr-neutral-600)]">
                    {t(`${module.id}.body`)}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {MODULE_BULLETS[module.id].map((bk) => (
                      <li key={bk} className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-white">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                        <span className="text-[0.98rem] text-[var(--cr-neutral-700)]">
                          {t(`${module.id}.${bk}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {MODULE_NOTE.has(module.id) ? (
                    // Margin on a <p> is reset by the app base; the gap lives on a
                    // wrapper <div> (not reset) so it sits ABOVE the bordered note,
                    // not inside it.
                    <div className="mt-4">
                      <p className="rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-3.5 py-2.5 text-[0.88rem] text-[var(--cr-neutral-600)]">
                        {t(`${module.id}.note`)}
                      </p>
                    </div>
                  ) : null}
                </Reveal>
                <Reveal delay={80} className={mockRight ? 'lg:order-2' : 'lg:order-1'}>
                  {Mock ? <Mock /> : null}
                </Reveal>
              </div>
            </Container>
          </SectionView>
        );
      })}
    </div>
  );
}
