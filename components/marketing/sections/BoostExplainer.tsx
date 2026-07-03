import { getTranslations } from 'next-intl/server';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';

/**
 * The one honest paragraph about boosts — the only thing members pay for today.
 * Cross-module links: copy under marketing.pages.connect.boost. Verified against
 * docs/connect/PRODUCT-OVERVIEW.md (prepaid wallet, 1 rupee = 1 credit, you set
 * the budget, stops at budget/duration).
 */
export async function BoostExplainer() {
  const t = await getTranslations('marketing.pages.connect.boost');
  return (
    <SectionView
      page="connect"
      section="boost"
      className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <Reveal className="mx-auto max-w-[760px]">
          <div className="rounded-[20px] border border-[var(--cr-neutral-200)] bg-white p-7 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <Eyebrow>{t('eyebrow')}</Eyebrow>
              <span className="mkt-mono rounded-full bg-[var(--cr-neutral-100)] px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.08em] text-[var(--cr-neutral-500)] uppercase">
                Sponsored
              </span>
            </div>
            <h2 className="mkt-anchor pt-4 text-[clamp(1.6rem,1.2rem+1.6vw,2.3rem)] text-balance">
              {t('title')}
            </h2>
            <p className="pt-4 text-[1.06rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
              {t('body')}
            </p>
          </div>
        </Reveal>
      </Container>
    </SectionView>
  );
}
