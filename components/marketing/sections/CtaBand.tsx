import { getTranslations } from 'next-intl/server';
import { AUTH } from '../content';
import { CtaButton } from '../CtaButton';
import { Reveal } from '../motion/Reveal';
import { Container } from '../ui/Container';

/**
 * Mid-page CTA band for /connect, placed between module sections to keep the
 * "join free" action close at hand. `band` selects the copy + accent (shop =
 * indigo, hire = gold). Cross-module links: copy under
 * marketing.pages.connect.ctaBand.{band}; CtaButton fires marketing.cta_clicked.
 */
export async function CtaBand({ band }: { band: 'shop' | 'hire' }) {
  const t = await getTranslations('marketing.pages.connect.ctaBand');
  const gold = band === 'hire';
  return (
    <section className="bg-white py-4 sm:py-6">
      <Container>
        <Reveal>
          <div
            className="flex flex-col items-start justify-between gap-4 rounded-[18px] px-6 py-7 sm:flex-row sm:items-center sm:px-9"
            style={{
              background: gold
                ? 'linear-gradient(120deg, var(--cr-gold-100), #fff)'
                : 'linear-gradient(120deg, var(--cr-indigo-50), #fff)',
              border: '1px solid var(--cr-neutral-200)',
            }}
          >
            <h2 className="max-w-[40ch] text-[1.32rem] leading-snug text-balance sm:text-[1.5rem]">
              {t(`${band}.title`)}
            </h2>
            {/* Connect-intent entry (for=connect): this band is /connect-only,
                so its CTA skips the IntentPicker and lands in Connect signup. */}
            <CtaButton
              href={AUTH.getStartedConnect}
              page="connect"
              position={`band_${band}`}
              variant={gold ? 'solid-gold' : 'solid-indigo'}
              arrow
              className="shrink-0"
            >
              {t(`${band}.cta`)}
            </CtaButton>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
