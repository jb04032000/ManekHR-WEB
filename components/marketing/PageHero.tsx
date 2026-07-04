import type { ReactNode } from 'react';
import { ProductBadge } from './ProductBadge';
import { Container } from './ui/Container';
import { Eyebrow } from './ui/Eyebrow';
import { MarketingButton } from './ui/MarketingButton';

const HERO_BG =
  'radial-gradient(ellipse 70% 60% at 50% 0%, var(--cr-indigo-50) 0%, transparent 60%)';

/**
 * Page header for marketing sub-pages — two shapes from one component:
 *  - default (no `aside`, used by every current page): a centred text header
 *    (Pricing, ERP, About, Contact, Guides...).
 *  - with `aside`: a two-column hero (copy left, mock right), available for a
 *    future deep-dive page that wants a product visual beside the copy.
 * Above the fold, so NO entrance animation (LCP protection). Any mock passed as
 * `aside` must carry no looping highlight — the single allowed `.mkt-pulse`
 * lives only on the home hero (see mockups.tsx). Cross-module links:
 * ProductBadge tone; MarketingButton for the CTAs.
 */
export function PageHero({
  badge,
  eyebrow,
  title,
  sub,
  primary,
  secondary,
  tertiary,
  aside,
}: {
  badge?: { label: string; tone: 'connect' | 'erp' };
  eyebrow?: string;
  title: string;
  sub: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Third CTA in the same row (e.g. /erp's pricing link). Keeps every hero
   *  action together instead of orphaning one in a strip below the hero. */
  tertiary?: { label: string; href: string };
  aside?: ReactNode;
}) {
  // Shared header content; alignment comes from the wrapper (centred vs left).
  const header = (
    <>
      {badge ? <ProductBadge tone={badge.tone} label={badge.label} /> : null}
      {eyebrow && !badge ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1
        className={`pt-5 text-[clamp(2.25rem,1.4rem+3.2vw,3.75rem)] text-balance ${aside ? '' : 'max-w-[16ch]'}`}
      >
        {title}
      </h1>
      <p className="max-w-[58ch] pt-5 text-[1.12rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
        {sub}
      </p>
      {primary || secondary || tertiary ? (
        <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:justify-center">
          {primary ? (
            <MarketingButton href={primary.href} variant="solid-indigo" size="lg" arrow>
              {primary.label}
            </MarketingButton>
          ) : null}
          {secondary ? (
            <MarketingButton href={secondary.href} variant="outline" size="lg">
              {secondary.label}
            </MarketingButton>
          ) : null}
          {tertiary ? (
            <MarketingButton href={tertiary.href} variant="outline" size="lg">
              {tertiary.label}
            </MarketingButton>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (aside) {
    return (
      <section className="bg-white" style={{ background: HERO_BG }}>
        <Container className="grid grid-cols-1 items-center gap-10 py-14 sm:py-18 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
          <div className="flex flex-col items-start text-left">{header}</div>
          <div className="order-first lg:order-last">{aside}</div>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-white" style={{ background: HERO_BG }}>
      <Container className="flex flex-col items-center py-16 text-center sm:py-20 lg:py-[104px]">
        {header}
      </Container>
    </section>
  );
}
