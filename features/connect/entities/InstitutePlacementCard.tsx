'use client';

/**
 * InstitutePlacementCard - one employer tile on the institute Placement wall
 * ("where our students work", Institutes Phase 2, Feature 2). Built on the same
 * anatomy as the directory `CompanyCard` (a soft gradient cover band, an
 * overlapping logo, the company name + derived ERP-linked badge, a primary
 * "View page" CTA), but it carries ONLY the real fields the BE placement read
 * exposes - it does NOT fabricate the followers / products / open-jobs stat row
 * that CompanyCard shows for a directory listing, because the placement ref is a
 * deliberately small CompanyPage subset. The one real stat is `studentCount`:
 * how many of this institute's confirmed, opted-in students currently work here
 * (self-declared, display-only).
 *
 * Cross-module links:
 *  - Data: one row of `getInstitutePlacements` (company-page.actions) -> BE
 *    @Public() `connect/company-pages/public/:pageId/placements`.
 *  - Visual template is `components/connect/CompanyCard` (kept untouched - reused
 *    by the company directory with its full stat row); keep the cover/logo
 *    rhythm + ERP badge in sync with it. `categoryLabel`-style helpers are not
 *    needed here (no specialization tags on the placement ref).
 *  - Links to the in-app authenticated company view `/connect/company/[slug]`
 *    (the same target CompanyCard uses for a non-owned page).
 *
 * Watch: the company ref is `InstitutePlacementCompany` (id/name/slug/logo +
 * erpLinked), NOT `CompanyPageBrowseItem` - keep it that way so we never render
 * hollow zero stats. Self-declared, not a verified placement.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { DsAvatar } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
import { imageVariant } from '@/lib/media/imageUrl';
import type { InstitutePlacementEmployer } from './entities.types';

/** Decorative cover gradients (the canonical prototype palette, shared with
 *  CompanyCard). Picked deterministically per company so a tile's cover is stable
 *  across renders. */
const COVERS = [
  'linear-gradient(120deg,#2b3e86,#0B6E4F)',
  'linear-gradient(120deg,#dab94a,#b8901f)',
  'linear-gradient(120deg,#3aa0a0,#1f6f6f)',
  'linear-gradient(120deg,#8d6cc4,#5e3aa0)',
  'linear-gradient(120deg,#c4707f,#9a3d52)',
  'linear-gradient(120deg,#7c8497,#4a5266)',
];

function coverFor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i);
  return COVERS[sum % COVERS.length];
}

export default function InstitutePlacementCard({
  employer,
}: {
  employer: InstitutePlacementEmployer;
}) {
  const t = useTranslations('connect.companyPage');
  const tCompanies = useTranslations('connect.companies');
  const { company, studentCount } = employer;
  // In-app authenticated company view (the same target CompanyCard uses).
  const href = `/connect/company/${company.slug}`;

  return (
    <article
      className="flex h-full flex-col overflow-hidden transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)]"
      style={{
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border-light)',
      }}
    >
      {/* Decorative cover band (no banner on the placement ref). */}
      <div
        className="relative h-14 overflow-hidden"
        style={{ background: coverFor(company.id) }}
        aria-hidden
      />

      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4">
        {/* Overlapping logo tile. */}
        <Link
          href={href}
          aria-label={company.name}
          className="-mt-6 w-fit no-underline"
          style={{
            borderRadius: 'var(--cr-radius-lg)',
            padding: 3,
            background: 'var(--cr-surface)',
          }}
        >
          <DsAvatar
            name={company.name}
            src={imageVariant(company.logo || undefined, { w: 160 })}
            size={52}
          />
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-[15.5px] font-bold">
            <Link href={href} style={{ color: 'var(--cr-text)', textDecoration: 'none' }}>
              {company.name}
            </Link>
          </h3>
          {company.erpLinked && <TrustBadgeRow badges={['erp']} size="sm" />}
        </div>

        {/* The one real stat: students of this institute currently working here. */}
        <span
          className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold"
          style={{ color: 'var(--cr-text-3)', fontVariantNumeric: 'tabular-nums' }}
        >
          <GraduationCap size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
          {t('studentCount', { count: studentCount })}
        </span>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            href={href}
            icon={<ExternalLink size={14} aria-hidden />}
            className="flex-1"
            style={{ minWidth: 110 }}
          >
            {tCompanies('viewPage')}
          </DsButton>
        </div>
      </div>
    </article>
  );
}
