import { getTranslations } from 'next-intl/server';
import { ERP_CHIPS } from '../content';
import { CtaButton } from '../CtaButton';
import { ICONS } from '../icons';
import { ErpMock } from '../mockups';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';

/**
 * ERP companion band — Connect is the product sold on this page, so ERP sits as
 * a polished but VISUALLY SECONDARY sibling: a single contained panel (not a
 * full section), smaller heading, gold (ERP) accent, one link to /erp. Content
 * is verified against the /erp page. Cross-module links: copy under marketing.erp;
 * ERP_CHIPS in content.ts; ErpMock illustration.
 */
export async function ErpCompanion() {
  const t = await getTranslations('marketing.erp');
  return (
    <SectionView page="home" section="erp" className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
      <Container>
        <Reveal>
          <div className="mkt-elevate overflow-hidden rounded-[24px] p-7 sm:p-9 lg:p-11">
            <div className="grid grid-cols-1 items-center gap-9 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <Eyebrow>{t('eyebrow')}</Eyebrow>
                <h2 className="mkt-anchor pt-4 text-[clamp(1.55rem,1.1rem+1.6vw,2.2rem)] text-balance">
                  {t('title')}
                </h2>
                <p className="max-w-[52ch] pt-4 text-[1.02rem] leading-relaxed text-[var(--cr-neutral-600)]">
                  {t('sub')}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {ERP_CHIPS.map((chip) => {
                    const Icon = ICONS[chip.icon];
                    return (
                      <span
                        key={chip.id}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--cr-neutral-200)] bg-white px-3 py-1.5 text-[0.84rem] font-medium text-[var(--cr-neutral-700)]"
                      >
                        <span className="text-[var(--cr-gold-700)]">
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                        </span>
                        {t(`chips.${chip.id}`)}
                      </span>
                    );
                  })}
                </div>
                {/* Risk-reversal next to the CTA: the ERP's real trial offer
                    (full access, no card - verified against /pricing copy).
                    Keep in sync with marketing.pages.pricing trial wording. */}
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <CtaButton
                    href="/erp"
                    page="home"
                    position="erp_learn"
                    variant="solid-gold"
                    arrow
                  >
                    {t('cta')}
                  </CtaButton>
                  <p className="text-[0.92rem] font-medium text-[var(--cr-neutral-600)]">
                    {t('trialNote')}
                  </p>
                </div>
              </div>
              <div className="lg:pl-4">
                <ErpMock />
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </SectionView>
  );
}
