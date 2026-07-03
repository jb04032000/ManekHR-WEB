import { getTranslations } from 'next-intl/server';
import { CONNECT_TRUST_ITEMS } from '../content';
import { ICONS } from '../icons';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/**
 * /connect trust + safety dark band. Trust signals come from real product
 * features (ERP-linked pages, buyer ratings, direct dealing, block/report), not
 * claims. Cross-module links: copy under marketing.pages.connect.trust;
 * CONNECT_TRUST_ITEMS in content.ts.
 */
export async function ConnectTrust() {
  const t = await getTranslations('marketing.pages.connect.trust');
  return (
    <SectionView
      page="connect"
      section="trust"
      className="mkt-on-dark relative overflow-hidden py-16 sm:py-20 lg:py-24"
    >
      <div
        className="absolute inset-0"
        style={{ background: 'var(--cr-indigo-800)' }}
        aria-hidden="true"
      />
      <Container className="relative">
        <Reveal>
          <SectionHeading tone="dark" eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONNECT_TRUST_ITEMS.map((item, index) => {
            const Icon = ICONS[item.icon];
            return (
              <Reveal key={item.id} delay={(index % 4) * 60}>
                <div className="h-full rounded-[16px] border border-white/12 bg-white/[0.06] p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-white/10 text-[var(--cr-gold-400)]">
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
