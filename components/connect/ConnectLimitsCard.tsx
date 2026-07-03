'use client';

/**
 * "Your limits" - the one consolidated view of every Connect cap, for the
 * owner's own profile (/connect/profile). Lists each kind's used-vs-limit meter
 * (products, storefronts, company pages, open jobs, storage) in one calm card.
 *
 * It reads the usage roll-up through the shared hook, so even though it mounts
 * several meters they all come from ONE fetch per page. Each meter is scoped to
 * the `limits` surface, so the near_limit demand signal here is counted apart
 * from the inline meters on the stores / pages / jobs / products surfaces.
 *
 * The footer carries a calm "View plans" CTA -> /account/subscription (the
 * product-neutral plan page reachable by Connect-only users). Honest, not a fake
 * instant-buy. Kept in sync with LimitReachedDialog + the UsageMeter at-cap popover.
 *
 * Links: features/connect/useConnectUsage.ts (shared fetch),
 * components/connect/ConnectUsageMeter.tsx (each row),
 * app/connect/profile/OwnProfileClient.tsx (mount point).
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useConnectUsage } from '@/features/connect/useConnectUsage';
import type { ConnectUsageKind } from '@/features/connect/usage.types';
import { ConnectUsageMeter } from './ConnectUsageMeter';

/** Canonical display order; only kinds the roll-up returns are rendered. */
const KIND_ORDER: ConnectUsageKind[] = ['listing', 'storefront', 'company_page', 'job', 'storage'];

export function ConnectLimitsCard({ className }: { className?: string }) {
  const t = useTranslations('connect.usage');
  const { rows, loading } = useConnectUsage();

  // Loading: a titled card with a few meter skeletons, so the profile column
  // does not jump when the data resolves.
  if (loading) {
    return (
      <section className={className} style={cardStyle} aria-hidden>
        <div className="skeleton mb-4 h-4 w-28 rounded" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="skeleton mb-1 h-3 w-24 rounded" />
              <div className="skeleton h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Fetch failed or returned nothing: render nothing rather than an empty card.
  if (!rows || rows.length === 0) return null;

  const present = KIND_ORDER.filter((k) => rows.some((r) => r.kind === k));

  return (
    <section className={className} style={cardStyle} aria-labelledby="cn-limits-title">
      <header className="mb-3">
        <h2
          id="cn-limits-title"
          className="m-0 text-[15px] font-bold"
          style={{ color: 'var(--cr-text)' }}
        >
          {t('your.title')}
        </h2>
        <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('your.subtitle')}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {present.map((kind) => (
          <ConnectUsageMeter key={kind} kind={kind} surface="limits" />
        ))}
      </div>

      {/* Calm "view plans" CTA - the product-neutral plan page, reachable by
          Connect-only users. Honest path, not a fake instant-buy. A plain Link
          styled as a ghost button (no useRouter dependency, so it renders in any
          context); points at /account/subscription, in sync with the UsageMeter
          at-cap popover. */}
      <div className="mt-4">
        <Link
          href="/account/subscription"
          className="inline-flex items-center justify-center rounded-[var(--cr-radius-md)] px-3.5 text-[13px] font-semibold no-underline"
          style={{
            height: 30,
            border: '1px solid var(--cr-border)',
            color: 'var(--cr-text-2)',
            background: 'transparent',
          }}
        >
          {t('your.viewPlans')}
        </Link>
      </div>
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-border)',
  borderRadius: 'var(--cr-radius-lg)',
  padding: 16,
};
