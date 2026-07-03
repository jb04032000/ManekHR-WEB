import { getTranslations } from 'next-intl/server';
import type { MarketingPage } from '@/lib/analytics-events';
import { Reveal } from '../motion/Reveal';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { FaqAccordion } from './FaqAccordion';

/**
 * Shared FAQ section (landing + /connect). Renders the visible, crawlable Q&A
 * accordion; the page also emits a matching FAQPage JSON-LD (English) so answer
 * engines can quote self-contained answers. Cross-module links: FaqAccordion
 * fires marketing.faq_opened; copy under the given `ns` namespace.
 */
export async function FaqBlock({
  page,
  ns,
  items,
  titleKey = 'title',
  id,
}: {
  page: MarketingPage;
  ns: string;
  items: readonly string[];
  titleKey?: string;
  id?: string;
}) {
  const t = await getTranslations(ns);
  return (
    <SectionView page={page} section="faq" id={id} className="bg-white py-16 sm:py-20 lg:py-24">
      <Container>
        <Reveal>
          <SectionHeading id={`${page}-faq`} eyebrow={t('eyebrow')} title={t(titleKey)} />
        </Reveal>
        <Reveal className="mt-11">
          <FaqAccordion
            page={page}
            items={items.map((iid) => ({
              id: iid,
              q: t(`items.${iid}.q`),
              a: t(`items.${iid}.a`),
            }))}
          />
        </Reveal>
      </Container>
    </SectionView>
  );
}
