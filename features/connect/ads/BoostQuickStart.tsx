'use client';

/**
 * BoostQuickStart - the "Boost something" section on the Boosts hub.
 *
 * Surfaces ONLY the things the caller actually owns and can boost right now
 * (their approved listings + open jobs, from GET /connect/ads/boosts/boostable),
 * each linking straight into the existing composer. Capped at a few per type
 * with a per-type "See all (N)" into that module's own-items view, so the hub
 * stays clean. A type with nothing eligible is hidden entirely.
 *
 * Profile intents add a contextual nudge ONLY when the intent is on and that
 * type has nothing eligible yet (e.g. "open to hiring" but no open job) - it
 * routes to where the user creates one. General posts are NOT boostable (owner
 * decision), so they never appear. When the caller has nothing boostable at all,
 * a create-first prompt points to adding a product / posting a job.
 *
 * Anchored `#boost-quick-start` so the empty state's "Start a boost" lands here.
 * Cross-module: composers at /connect/boost/{listing,job}/[id]; "see all" ->
 * /connect/stores (products) + /connect/jobs?tab=mine (jobs).
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  type LucideIcon,
  Briefcase,
  Eye,
  FileText,
  Package,
  Plus,
  Rocket,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { BoostableItem, BoostableSummary } from './ads.types';

const STORES_HREF = '/connect/stores';
const MY_JOBS_HREF = '/connect/jobs?tab=mine';
const MY_RFQS_HREF = '/connect/rfq?tab=mine';
const OPEN_TO_WORK_BOOST_HREF = '/connect/boost/open-to-work';
const HIRING_BOOST_HREF = '/connect/boost/hiring';

function composerHref(item: BoostableItem): string {
  return item.kind === 'boost_listing'
    ? `/connect/boost/listing/${item.id}`
    : item.kind === 'boost_rfq'
      ? `/connect/boost/rfq/${item.id}`
      : `/connect/boost/job/${item.id}`;
}

interface Props {
  data: BoostableSummary;
}

export default function BoostQuickStart({ data }: Props) {
  const t = useTranslations('connect.boosts.quickStart');
  const { listings, jobs, rfqs, counts, intents } = data;

  const hasListings = listings.length > 0;
  const hasJobs = jobs.length > 0;
  const hasRfqs = rfqs.length > 0;
  // Profile-intent promotions are now direct boosts (open-to-work / hiring on the
  // caller's own profile), shown whenever the intent is on - they have a real
  // target (the profile), unlike before when "open to work" had nothing to boost.
  const showWorkPromote = intents.work;
  const showHiringPromote = intents.hiring;
  // Deals/custom-orders still nudge to create a listing (no profile-level boost).
  const showDealsNudge = (intents.deals || intents.customOrders) && !hasListings;
  const nothingAtAll =
    !hasListings &&
    !hasJobs &&
    !hasRfqs &&
    !showWorkPromote &&
    !showHiringPromote &&
    !showDealsNudge;

  return (
    <section
      id="boost-quick-start"
      aria-label={t('title')}
      className="mb-6 scroll-mt-4 rounded-[var(--cr-radius-lg)] p-4 sm:p-5"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
        {t('title')}
      </h2>
      <p className="m-0 mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
        {t('subtitle')}
      </p>

      <div className="mt-4 grid gap-5">
        {hasListings && (
          <Rail
            label={t('typeListings')}
            items={listings}
            total={counts.listings}
            seeAllHref={STORES_HREF}
            kindIcon={Package}
            t={t}
          />
        )}
        {hasJobs && (
          <Rail
            label={t('typeJobs')}
            items={jobs}
            total={counts.jobs}
            seeAllHref={MY_JOBS_HREF}
            kindIcon={Briefcase}
            t={t}
          />
        )}
        {hasRfqs && (
          <Rail
            label={t('typeRfqs')}
            items={rfqs}
            total={counts.rfqs}
            seeAllHref={MY_RFQS_HREF}
            kindIcon={FileText}
            t={t}
          />
        )}

        {showWorkPromote && (
          <Nudge
            title={t('promoteWorkTitle')}
            body={t('promoteWorkBody')}
            cta={t('promoteWorkCta')}
            href={OPEN_TO_WORK_BOOST_HREF}
            icon={UserCheck}
          />
        )}
        {showHiringPromote && (
          <Nudge
            title={t('promoteHiringTitle')}
            body={t('promoteHiringBody')}
            cta={t('promoteHiringCta')}
            href={HIRING_BOOST_HREF}
            icon={UserPlus}
          />
        )}
        {showDealsNudge && (
          <Nudge
            title={t('dealsNudgeTitle')}
            body={t('dealsNudgeBody')}
            cta={t('dealsNudgeCta')}
            href={STORES_HREF}
            icon={Package}
          />
        )}

        {nothingAtAll && (
          <div
            className="rounded-[var(--cr-radius-md)] p-4 text-center"
            style={{ background: 'var(--cr-surface-2)' }}
          >
            <p className="m-0 text-[13.5px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
              {t('nothingTitle')}
            </p>
            <p
              className="m-0 mx-auto mt-1 max-w-[420px] text-[12.5px] leading-relaxed"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {t('nothingBody')}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <CreateLink href={STORES_HREF} label={t('addProduct')} icon={Package} />
              <CreateLink href={MY_JOBS_HREF} label={t('postJob')} icon={Briefcase} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type Translate = ReturnType<typeof useTranslations>;

function Rail({
  label,
  items,
  total,
  seeAllHref,
  kindIcon,
  t,
}: {
  label: string;
  items: BoostableItem[];
  total: number;
  seeAllHref: string;
  kindIcon: LucideIcon;
  t: Translate;
}) {
  // "See all (N)" only when there are more eligible items than we display.
  const showSeeAll = total > items.length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          className="m-0 text-[11px] font-bold tracking-[0.04em] uppercase"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {label}
        </h3>
        {showSeeAll && (
          <Link
            href={seeAllHref}
            className="text-[12px] font-semibold no-underline"
            style={{ color: 'var(--cr-primary)' }}
          >
            {t('seeAll', { count: total })}
          </Link>
        )}
      </div>
      <ul
        className="m-0 grid list-none gap-2.5 p-0"
        // auto-fit (not auto-fill): with only a few boostable items the cards
        // STRETCH to fill the row instead of leaving empty tracks / dead space
        // on the right. Keeps the "Boost something" box looking full + intentional.
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
      >
        {items.map((item) => (
          <li key={item.id}>
            <BoostableCard item={item} kindIcon={kindIcon} t={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoostableCard({
  item,
  kindIcon: KindIcon,
  t,
}: {
  item: BoostableItem;
  kindIcon: LucideIcon;
  t: Translate;
}) {
  return (
    <Link
      href={composerHref(item)}
      aria-label={t('boostAria', { title: item.title })}
      className="group flex items-center gap-3 rounded-[var(--cr-radius-md)] p-2.5 no-underline transition-shadow hover:shadow-sm"
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
    >
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small thumbnail, no LCP concern; next/image is overkill in this rail.
        <img
          src={item.image}
          alt=""
          aria-hidden
          className="h-11 w-11 shrink-0 rounded-[var(--cr-radius-sm)] object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--cr-radius-sm)]"
          style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
        >
          <KindIcon size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {item.title}
        </div>
        <div
          className="mt-0.5 flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {item.subtitle && <span className="truncate">{item.subtitle}</span>}
          {item.views !== null && item.views > 0 && (
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
              <Eye size={11} aria-hidden /> {t('viewsLabel', { count: item.views })}
            </span>
          )}
        </div>
      </div>
      <span
        aria-hidden
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--cr-radius-full)] px-2.5 text-[12px] font-bold"
        style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
      >
        <Rocket size={12} /> {t('boostCta')}
      </span>
    </Link>
  );
}

function Nudge({
  title,
  body,
  cta,
  href,
  icon: Icon,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-[var(--cr-radius-md)] p-3"
      style={{ background: 'var(--cr-surface-2)', border: '1px dashed var(--cr-border)' }}
    >
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {title}
        </div>
        <p className="m-0 text-[12px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
          {body}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--cr-radius-full)] px-3 text-[12.5px] font-semibold no-underline"
        style={{
          border: '1px solid var(--cr-primary)',
          background: 'var(--cr-surface)',
          color: 'var(--cr-primary)',
        }}
      >
        {cta}
      </Link>
    </div>
  );
}

function CreateLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--cr-radius-full)] px-4 text-[13px] font-semibold no-underline"
      style={{
        border: '1px solid var(--cr-border)',
        background: 'var(--cr-surface)',
        color: 'var(--cr-text-2)',
      }}
    >
      <Plus size={14} aria-hidden /> <Icon size={14} aria-hidden /> {label}
    </Link>
  );
}
