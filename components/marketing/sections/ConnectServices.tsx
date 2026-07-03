import { getTranslations } from 'next-intl/server';
import { CONNECT_SERVICES } from '../content';
import { ICONS } from '../icons';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/**
 * /connect services + experts directory band: the now-live feature where members
 * list the services they offer (consulting, maintenance, machine repair, testing,
 * installation, transport, logistics, contractor, dyeing, printing, job-work,
 * embroidery) and buyers/suppliers browse by type + location. Honest framing: the
 * browse is in-app at /connect/services; the public per-service pages live at
 * /products/[id]. Mirrors ConnectInstitutes' icon-card grid (extend, do not
 * redesign); sits on a cream band between ConnectBuiltFor (cream) and
 * ConnectInstitutes (white) so the run alternates. Four cards render 3-up; the
 * lone trailing card centres via the last-card rule below.
 * Cross-module links: copy under marketing.pages.connect.services; CONNECT_SERVICES
 * in content.ts; icons (wrench / search / globe / spark) in icons.tsx.
 */
export async function ConnectServices() {
  const t = await getTranslations('marketing.pages.connect.services');
  return (
    <SectionView
      page="connect"
      section="services"
      className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECT_SERVICES.map((item, index) => {
            const Icon = ICONS[item.icon];
            // Four cards on a 3-up grid leave a lone fourth card; centre it so the
            // last row stays balanced (matches the lone-last-card pattern used on
            // the other Connect grids).
            const isLoneLast =
              index === CONNECT_SERVICES.length - 1 && CONNECT_SERVICES.length % 3 === 1;
            return (
              <Reveal key={item.id} delay={(index % 3) * 60}>
                <div
                  className={
                    isLoneLast
                      ? 'mkt-card flex h-full items-start gap-4 rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-6 lg:col-start-2'
                      : 'mkt-card flex h-full items-start gap-4 rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-6'
                  }
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
                    {Icon ? <Icon className="h-[21px] w-[21px]" /> : null}
                  </span>
                  <div>
                    <h3 className="text-[1.12rem]">{t(`items.${item.id}.title`)}</h3>
                    <p className="pt-1.5 text-[0.96rem] leading-relaxed text-[var(--cr-neutral-600)]">
                      {t(`items.${item.id}.body`)}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </SectionView>
  );
}
