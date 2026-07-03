'use client';

import { useState } from 'react';
import { ConnectEvents, trackEvent, type MarketingPage } from '@/lib/analytics-events';
import { CloseIcon, PlusIcon } from '../icons';

/**
 * Accessible FAQ accordion. Single-open, first item open by default. The answer
 * text is always present in the DOM (the panel only clips height with a
 * grid-rows transition), so it stays crawlable for search + answer engines and
 * mirrors the FAQPage JSON-LD on the page.
 *
 * Fires `marketing.faq_opened` { page, question } the first time each question
 * is expanded. Cross-module links: trackEvent in lib/analytics-events.ts; the
 * page also emits a matching FAQPage JSON-LD via components/marketing/schema.ts.
 */
export function FaqAccordion({
  items,
  page,
}: {
  items: { q: string; a: string; id?: string }[];
  page?: MarketingPage;
}) {
  const [openIndex, setOpenIndex] = useState(0);

  function toggle(index: number) {
    const willOpen = openIndex !== index;
    setOpenIndex(willOpen ? index : -1);
    if (willOpen && page) {
      const item = items[index];
      trackEvent(ConnectEvents.marketingFaqOpened, { page, question: item.id ?? item.q });
    }
  }

  return (
    <div className="border-t border-[var(--cr-neutral-200)]">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.q} className="border-b border-[var(--cr-neutral-200)]">
            <h3 className="m-0">
              <button
                type="button"
                id={`faq-trigger-${index}`}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
                onClick={() => toggle(index)}
                className={`flex w-full items-center justify-between gap-6 py-6 text-left text-[1.2rem] font-semibold transition-colors ${
                  isOpen
                    ? 'text-[var(--cr-indigo-700)]'
                    : 'text-[var(--cr-charcoal)] hover:text-[var(--cr-indigo-700)]'
                }`}
              >
                <span>{item.q}</span>
                <span className="shrink-0 text-[var(--cr-indigo-600)]" aria-hidden="true">
                  {isOpen ? (
                    <CloseIcon className="h-[18px] w-[18px]" />
                  ) : (
                    <PlusIcon className="h-[18px] w-[18px]" />
                  )}
                </span>
              </button>
            </h3>
            <div
              id={`faq-panel-${index}`}
              role="region"
              aria-labelledby={`faq-trigger-${index}`}
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="max-w-[64ch] pr-10 pb-6 text-[1.02rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
