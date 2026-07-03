'use client';

/**
 * CompanyCardRow - the list-view row for `/connect/companies`. A robust, fixed-
 * rhythm row: avatar, an identity block (name + ERP badge on line 1, a single-
 * line location + specialization meta on line 2 that truncates rather than
 * wrapping), a number-over-caption stat group (followers / products / open jobs,
 * hidden on small screens), and a compact action cluster. Same real data and
 * follow contract as the grid `CompanyCard`.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Briefcase,
  Check,
  ExternalLink,
  MapPin,
  Package,
  Plus,
  Settings2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { DsAvatar } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
import StartConversationButton from '@/features/connect/inbox/StartConversationButton';
import { categoryLabel } from '../search.types';
import type { CompanyPageBrowseItem } from './entities.types';

interface CompanyCardRowProps {
  company: CompanyPageBrowseItem;
  isOwn?: boolean;
  following?: boolean;
  onToggleFollow?: (company: CompanyPageBrowseItem) => void;
  /** The active specialization filter -> highlights the matching tag. */
  activeSpecialization?: string;
}

function locationLine(loc: CompanyPageBrowseItem['location']): string {
  return [loc.city, loc.district, loc.state]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}

/** One compact stat: a bold number over a tiny caption (tabular numerics). */
function RowStat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex w-[52px] flex-col items-center gap-0.5">
      <span
        className="inline-flex items-center gap-1 text-[14px] font-bold"
        style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
      >
        <Icon size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
        {value}
      </span>
      <span className="text-[10.5px]" style={{ color: 'var(--cr-text-4)' }}>
        {label}
      </span>
    </div>
  );
}

export default function CompanyCardRow({
  company,
  isOwn = false,
  following = false,
  onToggleFollow,
  activeSpecialization,
}: CompanyCardRowProps) {
  const t = useTranslations('connect.companies');
  const tCat = useTranslations('connect.search.listing.category');
  const href = `/connect/company/${company.slug}`;
  const place = locationLine(company.location);
  const tags = company.specialization.slice(0, 3);

  return (
    <article
      className="relative flex cursor-pointer items-start gap-3.5 px-4 py-3.5 transition-colors"
      style={{ borderBottom: '1px solid var(--cr-divider)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cr-hover-bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar is covered by the name's stretched link (below), so it needs no
          link of its own - clicking it opens the page via the overlay. */}
      <span className="shrink-0">
        <DsAvatar name={company.name} src={company.logo || undefined} size={48} />
      </span>

      {/* Identity: name + trust on line 1, a single-line location + tags meta on
          line 2 (truncates, never wraps into a tall column). */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="m-0 min-w-0 truncate text-[14.5px] font-bold">
            {/* Stretched link: `after:absolute after:inset-0` makes this anchor
                cover the whole row, so a click anywhere (except the layered action
                controls) opens the page - one real, focusable link, no nesting. */}
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-['']"
              style={{ color: 'var(--cr-text)', textDecoration: 'none' }}
            >
              {company.name}
            </Link>
          </h3>
          {company.erpLinked && (
            <span className="shrink-0">
              <TrustBadgeRow badges={['erp']} size="sm" />
            </span>
          )}
        </div>

        {(place || tags.length > 0) && (
          <div
            className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {place && (
              <span className="inline-flex max-w-full min-w-0 items-center gap-1">
                <MapPin size={12} aria-hidden className="shrink-0" />
                <span className="truncate">{place}</span>
              </span>
            )}
            {/* Tags are whole pills: they wrap to the next line when narrow and
                hide entirely below a comfortable row width - never clipped
                mid-word. Gated on the CONTAINER, not the viewport. */}
            {tags.length > 0 && (
              <span className="hidden flex-wrap items-center gap-1 @min-[480px]:flex">
                {tags.map((tag) => {
                  const isActive = !!activeSpecialization && tag === activeSpecialization;
                  return (
                    <span
                      key={tag}
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{
                        background: isActive ? 'var(--cr-accent-light)' : 'var(--cr-surface-2)',
                        color: isActive ? 'var(--cr-gold-700)' : 'var(--cr-text-3)',
                      }}
                    >
                      {categoryLabel(tag, tCat)}
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        )}

        {/* Short description (up to 2 lines) so a buyer gets the gist; the full
            about lives on the page, which the card click opens. */}
        {company.about?.trim() && (
          <p className="m-0 mt-1 line-clamp-2 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
            {company.about}
          </p>
        )}
      </div>

      {/* Stat group - secondary. Gated on the CONTAINER width (the list column,
          which the filter rail narrows) not the viewport, so it only shows when
          the row genuinely has room and never crushes the name. */}
      <div className="hidden shrink-0 items-center gap-2 @min-[760px]:flex">
        <RowStat icon={Users} value={company.followerCount} label={t('statFollowers')} />
        <RowStat icon={Package} value={company.productCount} label={t('statProducts')} />
        <RowStat icon={Briefcase} value={company.openJobsCount} label={t('statOpenJobs')} />
      </div>

      {/* Actions - `relative z-[1]` keeps them above the stretched-link overlay so
          Follow / Message / View page receive their own clicks (the row link does
          not fire for them). */}
      <div className="relative z-[1] flex shrink-0 items-center gap-2">
        {isOwn ? (
          <>
            <span
              className="hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold sm:inline-flex"
              style={{ background: 'var(--cr-success-bg)', color: 'var(--cr-success)' }}
            >
              <Check size={12} aria-hidden />
              {t('yourCompany')}
            </span>
            <DsButton
              dsVariant="primary"
              dsSize="sm"
              href={`/connect/pages/${company.id}`}
              icon={<Settings2 size={14} aria-hidden />}
            >
              {t('manage')}
            </DsButton>
          </>
        ) : (
          <>
            {onToggleFollow && (
              <button
                type="button"
                aria-pressed={following}
                aria-label={
                  following
                    ? t('unfollowAria', { name: company.name })
                    : t('followAria', { name: company.name })
                }
                onClick={() => onToggleFollow(company)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
                style={
                  following
                    ? {
                        background: 'var(--cr-primary)',
                        color: '#fff',
                        border: '1px solid var(--cr-primary)',
                      }
                    : {
                        background: 'var(--cr-surface)',
                        color: 'var(--cr-primary)',
                        border: '1px solid var(--cr-border-strong)',
                      }
                }
              >
                {following ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                {following ? t('following') : t('follow')}
              </button>
            )}
            <span className="hidden @min-[440px]:inline-flex">
              <StartConversationButton
                recipientUserId={company.ownerUserId}
                partyName={company.name}
                dsVariant="ghost"
                dsSize="sm"
                iconOnly
              />
            </span>
            <DsButton
              dsVariant="primary"
              dsSize="sm"
              href={href}
              icon={<ExternalLink size={14} aria-hidden />}
            >
              {t('viewPage')}
            </DsButton>
          </>
        )}
      </div>
    </article>
  );
}
