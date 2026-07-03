import { getTranslations } from 'next-intl/server';
import { CONNECT_INSTITUTES } from '../content';
import { ICONS } from '../icons';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

/**
 * /connect institutes + students band: the now-live Institutes feature on the
 * deep product page. Institutes list courses (enquire to enrol, no checkout) and
 * place students; students carry an institute-confirmed "Trained at" credential.
 * Mirrors ConnectBuiltFor's icon-card grid (extend, do not redesign); sits on a
 * white band so it breaks the cream run above it (BoostExplainer + ConnectBuiltFor).
 * Cross-module links: copy under marketing.pages.connect.institutes;
 * CONNECT_INSTITUTES in content.ts; icons (graduationCap / award) in icons.tsx.
 */
export async function ConnectInstitutes() {
  const t = await getTranslations('marketing.pages.connect.institutes');
  return (
    <SectionView page="connect" section="institutes" className="bg-white py-16 sm:py-20 lg:py-24">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={t('eyebrow')} title={t('title')} sub={t('sub')} />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECT_INSTITUTES.map((item, index) => {
            const Icon = ICONS[item.icon];
            return (
              <Reveal key={item.id} delay={(index % 3) * 60}>
                <div className="mkt-card flex h-full items-start gap-4 rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-6">
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
