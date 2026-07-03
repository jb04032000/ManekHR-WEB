'use client';

/**
 * CompanyPagePreview - the sticky, live-updating company-card preview shown
 * beside the CompanyPageEditor form. It renders the page header anatomy exactly
 * as the public `/company/[slug]` surface (CompanyPageView): the banner-or-
 * gradient cover with a stitch flourish, the overlapping logo-or-initials tile,
 * the name, the specialization line, a location row, and a visibility pill.
 *
 * It is presentation-only: every value is a prop the editor feeds from the
 * live form (`Form.useWatch`) + the upload state. New page, so it states "New
 * page" honestly instead of fabricating a follower count, and the ERP-linked
 * badge only shows when the page is actually ERP-linked.
 */

import { useLocale, useTranslations } from 'next-intl';
import {
  BookOpen,
  Eye,
  Gauge,
  Globe,
  GraduationCap,
  Languages,
  Layers,
  Lock,
  MapPin,
  MonitorPlay,
  Package,
  Users2,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import TrustBadgeRow from '@/components/connect/TrustBadgeRow';
import { languageLabel } from './company-labels';
import { categoryLabel } from '../search.types';
import type { CompanyPageKind, EntityVisibility } from './entities.types';

interface Props {
  name?: string;
  /** Live logo URL (the first uploaded image), if any. */
  logoUrl?: string;
  /** Live banner URL (the first uploaded image), if any. */
  bannerUrl?: string;
  /** The about / description blurb (Overview section). */
  about?: string;
  /** Business vs institute. Drives the "Institute" pill + the capabilities swap.
   *  Defaults to 'business'. */
  kind?: CompanyPageKind;
  /** The specialization tags (the line under the name shows the first one;
   *  the Capabilities grid lists them all). */
  specialization?: string[];
  /** Capabilities-panel fields (mirrored into the Overview spec-grid). */
  machineCapacity?: string;
  production?: string;
  /** Institute-only capabilities: courses offered + delivery modes (shown when
   *  kind==='institute', swapping the business machines/production block). */
  coursesOffered?: string[];
  modes?: ('online' | 'offline')[];
  languages?: string[];
  district?: string;
  city?: string;
  state?: string;
  visibility?: EntityVisibility;
  /** Whether the page is ERP-linked (shows the derived trust badge). */
  erpLinked?: boolean;
}

/** Two-letter initials from a name (the logo fallback), matching the public
 *  page's single-initial fallback but richer for the small preview tile. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const first = words[0][0] ?? '';
  const second = words[1] ? words[1][0] : (words[0][1] ?? '');
  return (first + second).toUpperCase();
}

const VIS_META: Record<
  EntityVisibility,
  { icon: typeof Globe; tone: 'success' | 'brand' | 'neutral' }
> = {
  public: { icon: Globe, tone: 'success' },
  connections: { icon: Users2, tone: 'brand' },
  hidden: { icon: Lock, tone: 'neutral' },
};

const PILL_TONE: Record<'success' | 'brand' | 'neutral', { bg: string; fg: string }> = {
  success: { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
  brand: { bg: 'var(--cr-pill-brand-bg)', fg: 'var(--cr-pill-brand-fg)' },
  neutral: { bg: 'var(--cr-surface-2)', fg: 'var(--cr-text-3)' },
};

export default function CompanyPagePreview({
  name,
  logoUrl,
  bannerUrl,
  about,
  kind = 'business',
  specialization,
  machineCapacity,
  production,
  coursesOffered,
  modes,
  languages,
  district,
  city,
  state,
  visibility = 'public',
  erpLinked = false,
}: Props) {
  const t = useTranslations('connect.companyPageAdmin');
  // Reuse the public page's section labels so the preview reads identically to
  // what buyers see on `/company/[slug]` (CompanyPageView).
  const tPage = useTranslations('connect.companyPage');
  const tCat = useTranslations('connect.search.listing.category');
  const locale = useLocale();
  const trimmedName = name?.trim() ?? '';
  const hasName = trimmedName.length > 0;
  const location = [city, district, state]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
  const isInstitute = kind === 'institute';
  const specs = specialization?.map((s) => s?.trim()).filter(Boolean) as string[] | undefined;
  const courses = coursesOffered?.map((c) => c?.trim()).filter(Boolean) as string[] | undefined;
  const langs = languages?.map((l) => l?.trim()).filter(Boolean) as string[] | undefined;
  // Delivery modes (institute) - de-duped, only the two known values kept.
  const modeList = (modes ?? []).filter((m) => m === 'online' || m === 'offline');
  const aboutText = about?.trim() ?? '';
  const machineText = machineCapacity?.trim() ?? '';
  const productionText = production?.trim() ?? '';
  // The line under the name: first course for an institute, first spec otherwise.
  const specLine = (isInstitute ? courses?.[0] : specs?.[0]) ?? '';
  // The capabilities block shows when the active kind has any content (institute
  // -> courses/modes/languages; business -> specs/machines/production/languages).
  const hasCapabilities = isInstitute
    ? (courses?.length ?? 0) > 0 || modeList.length > 0 || (langs?.length ?? 0) > 0
    : (specs?.length ?? 0) > 0 || !!machineText || !!productionText || (langs?.length ?? 0) > 0;
  const vis = VIS_META[visibility];
  const VisIcon = vis.icon;
  const pill = PILL_TONE[vis.tone];

  return (
    <div className="flex flex-col gap-3">
      {/* Live-preview flag */}
      <div
        className="flex items-center gap-2 px-0.5 text-[11px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <Eye size={13} aria-hidden style={{ color: 'var(--cr-primary)' }} />
        {t('previewFlag')}
        <span
          className="ms-auto inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-normal normal-case"
          style={{ color: 'var(--cr-success)' }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--cr-success-solid)' }}
          />
          {t('previewLive')}
        </span>
      </div>

      {/* The header card - same anatomy as the public CompanyPageView. */}
      <article
        className="overflow-hidden"
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        {/* Cover: the uploaded banner, or the textile-warm gradient + stitch
            flourish (the one decorative element, mirrored from the public page). */}
        <div
          className="relative h-24 w-full overflow-hidden"
          style={{ background: bannerUrl ? undefined : 'var(--cr-grad-hero)' }}
        >
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded banner creative; next/image adds no optimisation here
            <img src={bannerUrl} alt="" aria-hidden className="h-full w-full object-cover" />
          ) : (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 376 96"
              preserveAspectRatio="none"
              aria-hidden
            >
              <circle
                cx="56"
                cy="22"
                r="70"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeDasharray="2 11"
                opacity="0.26"
              />
              <circle
                cx="320"
                cy="86"
                r="90"
                fill="none"
                stroke="var(--cr-gold-400)"
                strokeWidth="1.1"
                strokeDasharray="2 12"
                opacity="0.42"
              />
            </svg>
          )}
        </div>

        <div className="px-4 pb-4">
          {/* Overlapping logo tile (the canonical company anatomy). `relative
              z-[1]` lifts it above the position:relative cover so the overlapping
              top edge paints in front of (not behind) the banner. */}
          <div
            className="relative z-[1] -mt-8 flex h-16 w-16 items-center justify-center overflow-hidden"
            style={{
              borderRadius: 'var(--cr-radius-md)',
              border: '3px solid var(--cr-surface)',
              background: logoUrl ? 'var(--cr-surface-2)' : 'var(--cr-grad-indigo)',
              boxShadow: 'var(--cr-shadow-md)',
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo creative; next/image adds no optimisation here
              <img src={logoUrl} alt="" aria-hidden className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden className="text-[20px] font-extrabold" style={{ color: '#fff' }}>
                {initialsOf(trimmedName) || t('previewLogoFallback')}
              </span>
            )}
          </div>

          {/* Name */}
          <h3
            className="m-0 mt-2.5 text-[18px] font-bold"
            style={{ color: hasName ? 'var(--cr-text)' : 'var(--cr-text-5)' }}
          >
            {hasName ? trimmedName : t('previewNamePlaceholder')}
          </h3>

          {/* Specialization line (first spec tag) */}
          <p className="m-0 mt-1 text-[12.5px] font-medium" style={{ color: 'var(--cr-text-2)' }}>
            {specLine || (
              <span style={{ color: 'var(--cr-text-5)' }}>{t('previewSpecPlaceholder')}</span>
            )}
          </p>

          {/* Location */}
          {location && (
            <p
              className="m-0 mt-2 inline-flex items-center gap-1 text-[11.5px]"
              style={{ color: 'var(--cr-text-4)' }}
            >
              <MapPin size={12} aria-hidden />
              {location}
            </p>
          )}

          {/* ERP-linked badge (real) + an Institute pill (institute pages only) +
              the visibility pill. The Institute pill mirrors the visibility pill's
              shape and the public CompanyPageView's institute badge. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {erpLinked && <TrustBadgeRow badges={['erp']} size="sm" />}
            {isInstitute && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold"
                style={{
                  borderRadius: 'var(--cr-radius-full)',
                  background: 'var(--cr-pill-brand-bg)',
                  color: 'var(--cr-pill-brand-fg)',
                }}
              >
                <GraduationCap size={11} aria-hidden />
                {t('previewInstituteBadge')}
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold"
              style={{
                borderRadius: 'var(--cr-radius-full)',
                background: pill.bg,
                color: pill.fg,
              }}
            >
              <VisIcon size={11} aria-hidden />
              {t(`visibilityPill.${visibility}`)}
            </span>
          </div>

          {/* Honest "new page" line - no fabricated follower count. */}
          <p className="m-0 mt-2.5 text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('previewNewPage')}
          </p>

          {/* About (Overview) - mirrors CompanyPageView's About section. */}
          {aboutText && (
            <div className="mt-4 border-t pt-3.5" style={{ borderColor: 'var(--cr-divider)' }}>
              <h4
                className="m-0 mb-1.5 text-[12px] font-semibold"
                style={{ color: 'var(--cr-text)' }}
              >
                {tPage('about')}
              </h4>
              <p
                className="m-0 line-clamp-4 text-[12px] leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--cr-text-3)' }}
              >
                {aboutText}
              </p>
            </div>
          )}

          {/* Capabilities (Overview "What we do") - the labelled spec list,
              populated cells only, mirroring CompanyPageView. */}
          {hasCapabilities && (
            <div className="mt-4 border-t pt-3.5" style={{ borderColor: 'var(--cr-divider)' }}>
              <h4
                className="m-0 mb-2 text-[12px] font-semibold"
                style={{ color: 'var(--cr-text)' }}
              >
                {tPage('capabilities')}
              </h4>
              {/* The cell list swaps by kind: an institute shows courses + modes;
                  a business shows specialization + machines/production. Languages
                  ride on both. Mirrors the public CompanyPageView institute swap. */}
              <div className="flex flex-col gap-2.5">
                {isInstitute ? (
                  <>
                    {(courses?.length ?? 0) > 0 && (
                      <PreviewSpec icon={BookOpen} label={tPage('coursesOffered')}>
                        <div className="flex flex-wrap gap-1">
                          {courses!.map((c) => (
                            <span
                              key={c}
                              className="rounded-full px-1.5 py-0.5 text-[10.5px] font-medium"
                              style={{
                                background: 'var(--cr-surface-2)',
                                color: 'var(--cr-text-3)',
                              }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </PreviewSpec>
                    )}
                    {modeList.length > 0 && (
                      <PreviewSpec icon={MonitorPlay} label={tPage('modes')}>
                        {modeList
                          .map((m) => (m === 'online' ? tPage('modeOnline') : tPage('modeOffline')))
                          .join(', ')}
                      </PreviewSpec>
                    )}
                  </>
                ) : (
                  <>
                    {(specs?.length ?? 0) > 0 && (
                      <PreviewSpec icon={Layers} label={tPage('specialization')}>
                        <div className="flex flex-wrap gap-1">
                          {specs!.map((s) => (
                            <span
                              key={s}
                              className="rounded-full px-1.5 py-0.5 text-[10.5px] font-medium"
                              style={{
                                background: 'var(--cr-surface-2)',
                                color: 'var(--cr-text-3)',
                              }}
                            >
                              {categoryLabel(s, tCat)}
                            </span>
                          ))}
                        </div>
                      </PreviewSpec>
                    )}
                    {machineText && (
                      <PreviewSpec icon={Gauge} label={tPage('machineCapacity')}>
                        {machineText}
                      </PreviewSpec>
                    )}
                    {productionText && (
                      <PreviewSpec icon={Package} label={tPage('production')}>
                        {productionText}
                      </PreviewSpec>
                    )}
                  </>
                )}
                {(langs?.length ?? 0) > 0 && (
                  <PreviewSpec icon={Languages} label={tPage('languages')}>
                    {langs!.map((l) => languageLabel(l, locale)).join(', ')}
                  </PreviewSpec>
                )}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Short helper note */}
      <div
        className="flex items-start gap-2 p-3"
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        <Eye
          size={14}
          aria-hidden
          style={{ color: 'var(--cr-text-4)', flex: 'none', marginTop: 1 }}
        />
        <p className="m-0 text-[11.5px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
          {t('previewHelp')}
        </p>
      </div>
    </div>
  );
}

/** One labelled capability row in the preview's Overview block: a small uppercase
 *  icon+label and the real value. Compact counterpart of CompanyPageView's
 *  SpecCell, stacked rather than gridded to fit the narrow preview column. */
function PreviewSpec({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1 text-[9.5px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <Icon size={11} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
        {label}
      </div>
      <div
        className="mt-0.5 text-[12px] font-medium"
        style={{ color: 'var(--cr-text-2)', lineHeight: 1.45 }}
      >
        {children}
      </div>
    </div>
  );
}
