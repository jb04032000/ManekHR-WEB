import { getTranslations } from 'next-intl/server';
import type { MarketingPage } from '@/lib/analytics-events';
import { AUTH } from '../content';
import { CtaButton } from '../CtaButton';
import { SectionView } from '../motion/SectionView';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';

/**
 * Dark closing CTA, shared by every marketing page. Takes a `page` prop so its
 * CtaButtons emit marketing.cta_clicked with the right page slug. Secondary CTA
 * goes to /contact. No WhatsApp CTA: there is no WhatsApp business number
 * configured (env-gated), so we show no placeholder wa.me link here.
 */
export async function FinalCta({
  page = 'home',
  signupIntent,
}: {
  page?: MarketingPage;
  /**
   * Explicit signup-intent override for pages whose analytics `page` slug is
   * neutral but whose AUDIENCE is product-specific. The Connect-flavored SEO
   * pages (textile-jobs, textile-marketplace, saree-wholesalers, ...) pass
   * 'connect' so their visitors skip the IntentPicker; the picker had been
   * asking them a question their entry page already answered. Keeps the
   * analytics `page` slug untouched (no fake page='connect').
   */
  signupIntent?: 'connect' | 'erp';
}) {
  const t = await getTranslations('marketing.finalCta');
  // The shared copy sells Connect ("Be found by the whole trade... a profile
  // and a shop"), which read as the wrong product at the end of /erp. ERP-intent
  // pages get their own closing story + trial CTA via marketing.finalCta.erp.*.
  const isErp = (signupIntent ?? page) === 'erp';
  // ctaSecondary ("Talk to us") stays shared; only the story keys fork.
  const k = (key: 'eyebrow' | 'headline' | 'sub' | 'ctaPrimary') =>
    isErp ? t(`erp.${key}`) : t(key);
  // Pin signup intent by page so dedicated product pages skip the IntentPicker
  // (see AuthClient.tsx `urlIntent`): /erp -> ERP intent, /connect -> Connect
  // intent, every other page (incl. home + pricing) stays neutral so a new user
  // still picks. `signupIntent` overrides the page-derived choice for
  // Connect-audience SEO pages. Neutral keeps existing ERP-workspace users out
  // of the ERP dashboard when they join from a Connect surface (redirect=/connect).
  const effectiveIntent = signupIntent ?? (page === 'erp' || page === 'connect' ? page : null);
  const signupHref =
    effectiveIntent === 'erp'
      ? AUTH.getStartedErp
      : effectiveIntent === 'connect'
        ? AUTH.getStartedConnect
        : AUTH.getStarted;
  return (
    <SectionView page={page} section="final" className="mkt-on-dark relative overflow-hidden">
      <div
        style={{ background: 'var(--cr-indigo-800)' }}
        className="absolute inset-0"
        aria-hidden="true"
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 380"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle
          cx="160"
          cy="70"
          r="130"
          fill="none"
          stroke="white"
          strokeWidth="1.1"
          opacity="0.16"
        />
        <circle
          cx="1050"
          cy="320"
          r="160"
          fill="none"
          stroke="white"
          strokeWidth="1.1"
          opacity="0.16"
        />
        <circle
          cx="600"
          cy="190"
          r="248"
          fill="none"
          stroke="var(--cr-gold-500)"
          strokeWidth="1.2"
          opacity="0.5"
        />
        <circle
          cx="600"
          cy="190"
          r="150"
          fill="none"
          stroke="var(--cr-gold-500)"
          strokeWidth="1.2"
          opacity="0.32"
        />
      </svg>
      <Container className="relative py-20 sm:py-24 lg:py-[118px]">
        <div className="mx-auto flex max-w-[640px] flex-col items-center text-center">
          <Eyebrow tone="dark">{k('eyebrow')}</Eyebrow>
          <h2 className="pt-[18px] text-[clamp(2.1rem,1.4rem+2.8vw,3.2rem)] text-balance">
            {k('headline')}
          </h2>
          <p className="pt-5 text-[1.14rem] leading-relaxed text-pretty text-white/70">
            {k('sub')}
          </p>
          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
            <CtaButton
              href={signupHref}
              page={page}
              position="final"
              variant="solid-gold"
              size="lg"
              arrow
            >
              {k('ctaPrimary')}
            </CtaButton>
            <CtaButton
              href="/contact"
              page={page}
              position="final_contact"
              variant="outline-dark"
              size="lg"
            >
              {t('ctaSecondary')}
            </CtaButton>
          </div>
        </div>
      </Container>
    </SectionView>
  );
}
