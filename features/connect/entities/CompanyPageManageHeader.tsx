'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App, Dropdown, type MenuProps } from 'antd';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  MoreHorizontal,
  PenSquare,
  Plus,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import type { CompanyPage } from './entities.types';

interface SwitcherPage {
  id: string;
  name: string;
}

interface Props {
  page: CompanyPage;
  /** All of the owner's pages (drives the switcher; one entry hides it). */
  pages: SwitcherPage[];
  editHref: string;
  publicPath: string;
  unpublishing: boolean;
  /** Open the "Post as page" composer. */
  onPostAsPage: () => void;
  /** Scroll to / focus the share rail (Share button + setup share step). */
  onShare: () => void;
  onUnpublish: () => void;
  /** Request deletion - opens the shared type-to-confirm modal in the parent
   *  (ManageCompanyPageScreen). This header never deletes directly. */
  onRequestDelete: () => void;
}

/**
 * CompanyPageManageHeader - the console's header card: cover + overlapping logo
 * (each with an Edit affordance linking to the edit route), the page name + a
 * visibility-derived status pill + a page switcher, the public URL strip
 * (copy + view) + an owner pill, and the action cluster (Edit page, Post as
 * Page, Share, and a More menu: View as buyer, Unpublish, Delete).
 *
 * Honest only: the cover/logo show real uploads or an "add" affordance; the
 * status pill reflects the page's real `visibility`; the owner pill states the
 * caller is this page's admin (this screen 404s for non-owners).
 */
export default function CompanyPageManageHeader({
  page,
  pages,
  editHref,
  publicPath,
  unpublishing,
  onPostAsPage,
  onShare,
  onUnpublish,
  onRequestDelete,
}: Props) {
  const t = useTranslations('connect.companyPageAdmin');
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);

  const isPublic = page.visibility === 'public';
  const statusKey =
    page.visibility === 'public'
      ? 'public'
      : page.visibility === 'connections'
        ? 'connections'
        : 'hidden';

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}${publicPath}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      void message.success(t('linkCopied'));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked - no-op */
    }
  };

  // Page switcher: every page the owner has (current marked), then a divider and
  // a "create a new page" entry - so the menu reads as a complete switcher.
  const switcherItems: MenuProps['items'] = [
    ...pages.map((p) => ({
      key: p.id,
      label: (
        <Link
          href={`/connect/pages/${p.id}`}
          className="flex items-center gap-2 no-underline"
          style={{ color: 'inherit' }}
        >
          {p.id === page._id ? (
            <Check size={13} aria-hidden style={{ color: 'var(--cr-primary)' }} />
          ) : (
            <span aria-hidden style={{ width: 13 }} />
          )}
          <span className={p.id === page._id ? 'font-semibold' : undefined}>{p.name}</span>
        </Link>
      ),
    })),
    { type: 'divider' as const, key: 'div' },
    {
      key: 'create',
      label: (
        <Link
          href="/connect/pages/new"
          className="flex items-center gap-2 no-underline"
          style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
        >
          <Plus size={13} aria-hidden /> {t('createCta')}
        </Link>
      ),
    },
  ];

  // More menu: View as buyer (public page), View reviews, Unpublish (when
  // public), Delete.
  const moreItems: MenuProps['items'] = [
    {
      key: 'view',
      label: (
        <Link
          href={publicPath}
          className="flex items-center gap-2 no-underline"
          style={{ color: 'inherit' }}
        >
          <Eye size={15} aria-hidden /> {t('viewAsBuyer')}
        </Link>
      ),
    },
    {
      // Reviews live on the public page (reviews module). Deep-link straight to
      // its Reviews tab via `?tab=reviews` (CompanyPageView reads that param).
      key: 'reviews',
      label: (
        <Link
          href={`${publicPath}?tab=reviews`}
          className="flex items-center gap-2 no-underline"
          style={{ color: 'inherit' }}
        >
          <Star size={15} aria-hidden /> {t('viewReviews')}
        </Link>
      ),
    },
    ...(isPublic
      ? [
          {
            key: 'unpublish',
            disabled: unpublishing,
            label: (
              <span className="flex items-center gap-2">
                <EyeOff size={15} aria-hidden /> {t('unpublish')}
              </span>
            ),
            onClick: onUnpublish,
          },
        ]
      : []),
    { type: 'divider' as const, key: 'sep' },
    {
      key: 'delete',
      danger: true,
      label: (
        <span className="flex items-center gap-2">
          <Trash2 size={15} aria-hidden /> {t('deletePage')}
        </span>
      ),
      onClick: onRequestDelete,
    },
  ];

  return (
    <section
      className="overflow-hidden"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      {/* Cover - the uploaded banner, or a textile-warm stitch gradient with an
          inline "add cover" affordance that links to the edit route. */}
      <div
        className="relative h-[140px] w-full"
        style={{ background: page.banner ? undefined : 'var(--cr-grad-hero)' }}
      >
        {page.banner ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded banner; next/image adds no optimisation here
          <img src={page.banner} alt="" aria-hidden className="h-full w-full object-cover" />
        ) : (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1180 140"
            preserveAspectRatio="none"
            aria-hidden
          >
            <circle
              cx="120"
              cy="40"
              r="120"
              fill="none"
              stroke="var(--cr-gold-400)"
              strokeWidth="1"
              strokeDasharray="2 11"
              opacity="0.45"
            />
            <circle
              cx="1000"
              cy="120"
              r="150"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1"
              strokeDasharray="2 12"
              opacity="0.3"
            />
          </svg>
        )}
        <Link
          href={editHref}
          className="absolute inline-flex items-center gap-1.5 rounded-md px-2.5 no-underline"
          style={{
            top: 13,
            insetInlineEnd: 13,
            height: 30,
            background: 'rgba(14,24,68,0.5)',
            border: '1px solid rgba(255,255,255,0.28)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}
        >
          <ImagePlus size={13} aria-hidden /> {page.banner ? t('editCover') : t('addCover')}
        </Link>
      </div>

      <div className="px-5 pb-4">
        <div className="flex flex-wrap items-start gap-4">
          {/* Logo overlaps the cover (canonical company-page anatomy). */}
          <div className="relative shrink-0" style={{ marginTop: -46 }}>
            <div
              className="grid h-[92px] w-[92px] place-items-center overflow-hidden"
              style={{
                border: '4px solid var(--cr-surface)',
                borderRadius: 'var(--cr-radius-lg)',
                background: 'var(--cr-surface-2)',
                boxShadow: 'var(--cr-shadow-md)',
              }}
            >
              {page.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo; next/image adds no optimisation here
                <img src={page.logo} alt="" aria-hidden className="h-full w-full object-cover" />
              ) : (
                <span
                  aria-hidden
                  style={{ fontSize: 30, fontWeight: 700, color: 'var(--cr-text-4)' }}
                >
                  {page.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <Link
              href={editHref}
              aria-label={page.logo ? t('editLogo') : t('addLogo')}
              className="absolute grid place-items-center no-underline"
              style={{
                bottom: -4,
                insetInlineEnd: -4,
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                color: 'var(--cr-text-3)',
                boxShadow: 'var(--cr-shadow-sm)',
              }}
            >
              <PenSquare size={13} aria-hidden />
            </Link>
          </div>

          {/* Identity: name + status pill + switcher. */}
          <div className="min-w-0 flex-1 pt-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1
                className="m-0 text-[22px] font-bold tracking-tight"
                style={{ color: 'var(--cr-text)' }}
              >
                {page.name}
              </h1>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={{
                  border: `1px solid ${isPublic ? 'var(--cr-success)' : 'var(--cr-border)'}`,
                  background: isPublic ? 'var(--cr-success-bg)' : 'var(--cr-surface-2)',
                  color: isPublic ? 'var(--cr-success)' : 'var(--cr-text-3)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: isPublic ? 'var(--cr-success)' : 'var(--cr-text-4)',
                  }}
                />
                {t(`statusPill.${statusKey}`)}
              </span>
              {pages.length > 1 && (
                <Dropdown menu={{ items: switcherItems }} trigger={['click']}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold"
                    style={{
                      border: '1px solid var(--cr-border)',
                      background: 'var(--cr-surface)',
                      color: 'var(--cr-text-3)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('switchPage')} <ChevronDown size={13} aria-hidden />
                  </button>
                </Dropdown>
              )}
            </div>
          </div>

          {/* Action cluster - canonical DsButtons so the row matches the rest of
              the app (consistent height, hover/focus states) instead of bespoke
              hand-rolled controls. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 pt-2.5">
            <DsButton
              dsVariant="primary"
              href={editHref}
              icon={<PenSquare size={15} aria-hidden />}
            >
              {t('editPage')}
            </DsButton>
            <DsButton
              dsVariant="ghost"
              onClick={onPostAsPage}
              icon={<PenSquare size={15} aria-hidden />}
            >
              {t('postAsPage')}
            </DsButton>
            <DsButton dsVariant="ghost" onClick={onShare} icon={<Share2 size={15} aria-hidden />}>
              {t('shareCta')}
            </DsButton>
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <button
                type="button"
                aria-label={t('moreActions')}
                className="grid h-[38px] w-[38px] place-items-center rounded-md"
                style={{
                  border: '1px solid var(--cr-border)',
                  background: 'var(--cr-surface)',
                  color: 'var(--cr-text-3)',
                  cursor: 'pointer',
                }}
              >
                <MoreHorizontal size={16} aria-hidden />
              </button>
            </Dropdown>
          </div>
        </div>

        {/* Public URL strip + owner pill. */}
        <div
          className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2"
          style={{ background: 'var(--cr-surface-2)', border: '1px solid var(--cr-border)' }}
        >
          <span
            className="text-[10.5px] font-bold tracking-wide uppercase"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {t('publicUrlLabel')}
          </span>
          <span
            className="min-w-0 truncate font-mono text-[12.5px]"
            style={{ color: 'var(--cr-text-2)' }}
          >
            /company/<b style={{ color: 'var(--cr-primary)', fontWeight: 600 }}>{page.slug}</b>
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold"
              style={{
                border: `1px solid ${copied ? 'var(--cr-success)' : 'var(--cr-border)'}`,
                background: copied ? 'var(--cr-success-bg)' : 'var(--cr-surface)',
                color: copied ? 'var(--cr-success)' : 'var(--cr-text-2)',
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? t('linkCopied') : t('copyLink')}
            </button>
            <Link
              href={publicPath}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold no-underline"
              style={{
                border: '1px solid var(--cr-border)',
                background: 'var(--cr-surface)',
                color: 'var(--cr-text-2)',
              }}
            >
              <ExternalLink size={13} aria-hidden /> {t('viewPublic')}
            </Link>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
              style={{ background: 'var(--cr-accent-light)', color: 'var(--cr-gold-700)' }}
            >
              <ShieldCheck size={13} aria-hidden /> {t('ownerPill')}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
