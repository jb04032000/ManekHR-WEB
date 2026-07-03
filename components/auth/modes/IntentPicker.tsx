'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeftOutlined, ArrowRightOutlined, StarFilled } from '@ant-design/icons';
import { Factory, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { track } from '@/lib/analytics';
import type { Mode } from './types';

/**
 * Product picker - the first sub-step of `<SignupMode>` when the URL carries
 * no `?for=` intent. Two compact cards (Connect + ERP); picking one calls
 * `onPick(product)` so the parent hands off to the signup form with that
 * product's T&C checkbox. Carries no own state (the parent owns
 * `pickedIntent`); a refresh re-renders this picker by design - there is no
 * silent default.
 *
 * 2026-07-02 redesign (confusion fix). The old screen asked users to choose
 * between two PRODUCT NAMES ("Connect" vs "ERP") behind a 150+ word wall:
 * poetic headline, 11-noun subtitle, per-card preview graphics with fake
 * rupee figures that read as prices, and identical icons on both cards. On
 * mobile the stacked cards pushed the second option 2 screens down. New
 * anatomy, in reading order:
 *   1. Plain user-language question ("What do you want to do first?").
 *   2. The low-stakes reassurance ("use both later, account carries across")
 *      promoted from 12px footer text to the subtitle, BEFORE the decision.
 *   3. Two compact verb-first cards ("Find work, buyers and people" /
 *      "Run your workshop") with the product name demoted to a caption,
 *      distinct icons (Users vs Factory), one description line, four pills.
 *      No preview blocks, no fake metrics. Both options fit one phone screen.
 *   4. The gold badge carries a REASON ("Most people start here"), not a
 *      bare "Recommended".
 *
 * Funnel analytics (this screen previously had none, so confusion could not
 * be measured): fires `auth.intent_picker_viewed` on mount (with the
 * `?redirect=` route slug, never PII), `auth.intent_picked` on any pick
 * (product + method 'card'|'not_sure' + msSinceView), and
 * `auth.intent_picker_back` on the back affordance. Sink: lib/analytics
 * `track` (PostHog + GA4), same helper AuthClient uses for auth.* events.
 *
 * Caller contract is unchanged: `onPick(product)` + `setMode(m)`. The
 * "Not sure" affordance reuses `onPick('connect')` so SignupMode wiring
 * stays untouched. Cross-module: AuthClient.tsx widens the form panel to
 * 880px while mode='signup' for the 2-col grid; SignupMode's "Starting in X"
 * pill reads `intent.{product}.productName` (NOT `.title`, which is now a
 * verb phrase). Watch: keep the four message files (en/gu/gu-en/hi-en) in
 * sync, locale-parity.vitest.ts enforces it.
 *
 * Design spec lineage: docs/connect/specs/2026-05-20-intent-routed-policy-flow-design.md §3.2.
 */
interface IntentPickerProps {
  onPick: (product: 'connect' | 'erp') => void;
  setMode: (m: Mode) => void;
}

interface CardProps {
  product: 'connect' | 'erp';
  title: string;
  caption: string;
  description: string;
  pills: readonly string[];
  recommendedLabel?: string;
  descId: string;
  onPick: (product: 'connect' | 'erp') => void;
}

/**
 * One compact choice card. The whole card is a single button (44px+ target,
 * keyboard focus ring). Distinct icon + tint per product so the two options
 * are tellable apart at a glance without reading: Connect = indigo Users,
 * ERP = gold Factory. `h-full` so both grid cells match height even though
 * only Connect carries the badge row.
 */
function ProductCard({
  product,
  title,
  caption,
  description,
  pills,
  recommendedLabel,
  descId,
  onPick,
}: CardProps) {
  const isConnect = product === 'connect';
  return (
    <button
      type="button"
      onClick={() => onPick(product)}
      aria-describedby={descId}
      className="group relative flex h-full w-full cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition select-none hover:-translate-y-px hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
    >
      {recommendedLabel ? (
        <span
          className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
          style={{
            background: 'var(--cr-gold-100)',
            color: 'var(--cr-gold-700)',
          }}
        >
          <StarFilled style={{ fontSize: 9 }} />
          {recommendedLabel}
        </span>
      ) : null}

      {/* Verb-first title is the primary anchor; the product name is demoted
          to the small caption below it. Users know what they want to DO
          before they know the product line. A subtle arrow signals "this is
          the action" and nudges right on hover. */}
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl"
          style={{
            background: isConnect ? 'var(--cr-primary-light)' : 'var(--cr-gold-100)',
            color: isConnect ? 'var(--cr-primary)' : 'var(--cr-gold-700)',
          }}
          aria-hidden
        >
          {isConnect ? (
            <Users size={22} strokeWidth={1.75} />
          ) : (
            <Factory size={22} strokeWidth={1.75} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-display text-[19px] leading-tight font-bold text-heading">
            {title}
          </p>
          <p className="m-0 mt-1 text-[11px] font-medium tracking-[0.1em] text-subtle uppercase">
            {caption}
          </p>
        </div>
        <ArrowRightOutlined
          className="mt-1.5 flex-shrink-0 text-[14px] text-subtle opacity-50 transition group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100"
          aria-hidden
        />
      </div>

      <p id={descId} className="m-0 text-[13px] leading-relaxed text-muted">
        {description}
      </p>

      <div className="mt-auto flex flex-wrap gap-1.5">
        {pills.map((pill) => (
          <span
            key={pill}
            className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-body"
          >
            {pill}
          </span>
        ))}
      </div>
    </button>
  );
}

export function IntentPicker({ onPick, setMode }: IntentPickerProps) {
  const t = useTranslations('auth.signup.intent');

  // View timestamp for msSinceView on the pick events. Set once on mount so a
  // re-render never resets the clock.
  const viewTsRef = useRef<number>(0);
  useEffect(() => {
    viewTsRef.current = Date.now();
    // `?redirect=` is an internal route slug (e.g. /connect), never PII.
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    track('auth.intent_picker_viewed', { redirect: redirect ?? null });
  }, []);

  const pick = (product: 'connect' | 'erp', method: 'card' | 'not_sure') => {
    track('auth.intent_picked', {
      product,
      method,
      msSinceView: viewTsRef.current ? Date.now() - viewTsRef.current : null,
    });
    onPick(product);
  };

  const connectPills: readonly string[] = [
    t('connect.pills.profile'),
    t('connect.pills.network'),
    t('connect.pills.marketplace'),
    t('connect.pills.jobs'),
  ];
  // Four pills to mirror the Connect card's weight; the desc line already
  // names manufacturing + finance, so the pills stick to the four most
  // universally understood modules.
  const erpPills: readonly string[] = [
    t('erp.pills.attendance'),
    t('erp.pills.payroll'),
    t('erp.pills.gst'),
    t('erp.pills.inventory'),
  ];

  return (
    <section aria-labelledby="signup-intent-heading">
      <button
        type="button"
        onClick={() => {
          track('auth.intent_picker_back', {});
          setMode('check');
        }}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('back')}
      </button>

      {/* Header prose capped at ~640px for line length; the card grid below
          still uses the full 880px parent. Reassurance sits directly under
          the question so the decision reads low-stakes BEFORE the user
          starts comparing. */}
      <div className="max-w-[640px]">
        <p
          className="m-0 mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.18em] uppercase select-none"
          style={{ color: 'var(--cr-primary)' }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--cr-primary)' }}
          />
          {t('eyebrow')}
        </p>

        <h1
          id="signup-intent-heading"
          className="m-0 mb-3 font-display leading-tight font-extrabold text-heading"
          style={{ fontSize: 'clamp(1.5rem, 1.3rem + 0.8vw, 2rem)' }}
        >
          {t.rich('title', {
            em: (chunks) => (
              <em
                className="font-display italic"
                style={{ color: 'var(--cr-gold-500)', fontStyle: 'italic' }}
              >
                {chunks}
              </em>
            ),
          })}
        </h1>
        <p className="m-0 mb-6 text-[14px] leading-relaxed text-muted">{t('subtitle')}</p>
      </div>

      {/* Two compact cards side-by-side at >=640px, stacked below. Each card
          is ~200px tall so on a phone BOTH options plus the header fit one
          viewport, the old 450px cards hid the ERP option 2 screens down. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ProductCard
          product="connect"
          title={t('connect.title')}
          caption={t('connect.meta')}
          description={t('connect.desc')}
          pills={connectPills}
          recommendedLabel={t('connect.recommended')}
          descId="intent-card-desc-connect"
          onPick={(p) => pick(p, 'card')}
        />
        <ProductCard
          product="erp"
          title={t('erp.title')}
          caption={t('erp.meta')}
          description={t('erp.desc')}
          pills={erpPills}
          descId="intent-card-desc-erp"
          onPick={(p) => pick(p, 'card')}
        />
      </div>

      {/* Escape hatch for the undecided, routes to Connect (the free,
          recommended entry). Tracked as method='not_sure'. */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => pick('connect', 'not_sure')}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-1.5 text-[13px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          {t('notSure')}
        </button>
      </div>

      <div className="mt-6 flex justify-center text-center">
        <p className="m-0 text-[13px] text-muted">
          {t.rich('signIn.alreadyHaveAccount', {
            link: (chunks) => (
              <button
                type="button"
                onClick={() => setMode('check')}
                className="cursor-pointer border-0 bg-transparent p-0 font-medium text-primary hover:underline"
              >
                {chunks}
              </button>
            ),
          })}
        </p>
      </div>
    </section>
  );
}
