import { getTranslations } from 'next-intl/server';
import { CONNECT_HOW_STEPS } from '../content';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/**
 * /connect "how it works" — three steps. Cross-module links: copy under
 * marketing.pages.connect.how; CONNECT_HOW_STEPS in content.ts.
 */
export async function ConnectSteps() {
  const t = await getTranslations('marketing.pages.connect.how');
  return (
    <SectionView page="connect" section="how" className="bg-white py-16 sm:py-20 lg:py-24">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {CONNECT_HOW_STEPS.map((id, index) => (
            <Reveal key={id} delay={index * 70}>
              <div className="mkt-card h-full rounded-[16px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] p-7">
                <span className="mkt-mono grid h-10 w-10 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-[0.9rem] font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="pt-5 text-[1.24rem]">{t(`steps.${id}.title`)}</h3>
                <p className="pt-2.5 text-[1rem] leading-relaxed text-[var(--cr-neutral-600)]">
                  {t(`steps.${id}.body`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </SectionView>
  );
}
