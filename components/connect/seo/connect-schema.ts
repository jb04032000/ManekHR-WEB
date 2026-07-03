/**
 * JSON-LD structured-data builders for the PUBLIC Connect entity pages
 * (product, store/company, public profile, job, breadcrumb). Emitted server-side
 * via the `<JsonLd>` component. Crawler-facing, therefore always English (never
 * localized), mirroring `components/marketing/schema.ts`.
 *
 * INVARIANT (Google penalizes mismatches): only emit a field the page actually
 * shows. Price offers are emitted ONLY when a real price is public; a negotiable
 * listing carries no `offers`. A JobPosting is emitted ONLY when its required
 * fields exist (else the builder returns null and the page skips the block).
 *
 * Cross-module: fed by the public pages under app/(connect-public)/* using the
 * same entity payloads the views render (marketplace.types ListingDetail,
 * jobs.types Job), so structured data and visible content never drift.
 */
import { env } from '@/lib/env';
import type { ListingDetail } from '@/features/connect/marketplace/marketplace.types';
import type { Job } from '@/features/connect/jobs/jobs.types';

const BASE = env.appUrl;

/** Strip any HTML + collapse whitespace + cap length. User descriptions are
 *  plain text today, but we never feed raw markup to a crawler. */
function plain(text: string | undefined | null, max = 5000): string {
  if (!text) return '';
  const stripped = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > max ? stripped.slice(0, max - 1).trimEnd() + '…' : stripped;
}

/** Absolute URL from a site-relative path (schema URLs must be absolute). */
export function absUrl(path: string): string {
  return path.startsWith('http') ? path : `${BASE}${path}`;
}

/**
 * Product schema for a listing detail page. `offers` is included ONLY when the
 * listing exposes a real price (fixed -> Offer; range -> AggregateOffer); a
 * negotiable / price-less listing omits offers entirely. `seller` points at the
 * owning store/company when known.
 */
export function productJsonLd(
  listing: ListingDetail,
  opts: { url: string; sellerName?: string; sellerUrl?: string },
): object {
  const images = (listing.images ?? []).filter(Boolean);
  const offers = buildOffers(listing, opts.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: plain(listing.description),
    ...(images.length ? { image: images } : {}),
    ...(listing.category ? { category: listing.category } : {}),
    ...(offers ? { offers } : {}),
    ...(opts.sellerName
      ? {
          brand: {
            '@type': 'Organization',
            name: opts.sellerName,
            ...(opts.sellerUrl ? { url: absUrl(opts.sellerUrl) } : {}),
          },
        }
      : {}),
  };
}

/**
 * Course schema for a `course`-category listing (Institutes Phase 1). A training
 * course is NOT a retail Product, so the course detail page emits Course instead
 * of productJsonLd, for a valid Google Course rich result. We emit only what the
 * page shows: the provider (the institute's storefront), the skills it teaches, a
 * certificate credential when offered, and a price/free offer. We deliberately
 * skip `hasCourseInstance`: batch start + a real location are not reliably
 * present, and a partial CourseInstance trips Google's enhanced-course
 * validation. Cross-module: ListingDetail.courseDetails (marketplace.types),
 * rendered by ListingDetailScreen; provider mirrors productJsonLd's seller opts.
 */
export function courseJsonLd(
  listing: ListingDetail,
  opts: { url: string; providerName?: string; providerUrl?: string },
): object {
  const course = listing.courseDetails;
  const images = (listing.images ?? []).filter(Boolean);
  const skills = (course?.skillsTaught ?? []).filter(Boolean);
  const isFree = course?.feeType === 'free';
  // Free course: emit a 0-INR Offer + isAccessibleForFree (the page shows "Free").
  // Paid course: reuse the shared price -> Offer/AggregateOffer logic.
  const offers = isFree
    ? {
        '@type': 'Offer',
        category: 'Free',
        price: '0',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        url: opts.url,
      }
    : buildOffers(listing, opts.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: listing.title,
    description: plain(listing.description),
    ...(images.length ? { image: images } : {}),
    ...(skills.length ? { teaches: skills } : {}),
    ...(course?.certificate ? { educationalCredentialAwarded: 'Certificate' } : {}),
    ...(isFree ? { isAccessibleForFree: true } : {}),
    ...(offers ? { offers } : {}),
    ...(opts.providerName
      ? {
          provider: {
            '@type': 'Organization',
            name: opts.providerName,
            ...(opts.providerUrl ? { url: absUrl(opts.providerUrl) } : {}),
          },
        }
      : {}),
  };
}

/**
 * Service schema for a service-category listing (Slice B2 - consultants,
 * maintenance, technical, transport, contractors). A service is not a retail
 * Product, so the detail page emits Service instead of productJsonLd, for a valid
 * schema.org Service description. We emit only what the page shows, mirroring
 * productJsonLd's "only emit what is public" invariant:
 *  - `serviceType` is the category (the kind of service).
 *  - `areaServed` ONLY when the listing exposes a coverage area.
 *  - `provider` points at the owning store / company when known (like
 *    productJsonLd's seller).
 *  - `offers` ONLY when a real price is public (negotiable -> no offers), reusing
 *    the shared price -> Offer/AggregateOffer logic.
 * Cross-module: ListingDetail.serviceDetails (marketplace.types), rendered by
 * ListingDetailScreen's service card; provider mirrors productJsonLd's seller opts.
 */
export function serviceJsonLd(
  listing: ListingDetail,
  opts: { url: string; providerName?: string; providerUrl?: string },
): object {
  const service = listing.serviceDetails;
  const coverageArea = service?.coverageArea?.trim();
  const offers = buildOffers(listing, opts.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: listing.title,
    description: plain(listing.description),
    ...(listing.category ? { serviceType: listing.category } : {}),
    ...(coverageArea ? { areaServed: coverageArea } : {}),
    ...(offers ? { offers } : {}),
    ...(opts.providerName
      ? {
          provider: {
            '@type': 'Organization',
            name: opts.providerName,
            ...(opts.providerUrl ? { url: absUrl(opts.providerUrl) } : {}),
          },
        }
      : {}),
  };
}

function buildOffers(listing: ListingDetail, url: string): object | null {
  const cur = 'INR';
  const min = listing.priceMin;
  const max = listing.priceMax;
  if (listing.priceType === 'fixed' && min != null) {
    return {
      '@type': 'Offer',
      price: String(min),
      priceCurrency: cur,
      availability: 'https://schema.org/InStock',
      url,
    };
  }
  if (listing.priceType === 'range' && min != null) {
    return {
      '@type': 'AggregateOffer',
      lowPrice: String(min),
      highPrice: String(max ?? min),
      priceCurrency: cur,
      availability: 'https://schema.org/InStock',
      url,
    };
  }
  // 'negotiable' or no price -> the page shows no price, so emit no offers.
  return null;
}

/**
 * Organization (or LocalBusiness / EducationalOrganization) schema for a store /
 * company page. `address` is emitted only when the page actually shows location
 * fields. Use `type: 'LocalBusiness'` when an address is present and the page
 * reads as a physical business; `type: 'EducationalOrganization'` for an
 * institute company page (kind === 'institute'); default Organization otherwise.
 */
export function organizationJsonLd(p: {
  type?: 'Organization' | 'LocalBusiness' | 'EducationalOrganization';
  name: string;
  url: string;
  logo?: string | null;
  description?: string | null;
  address?: { locality?: string; region?: string; country?: string } | null;
}): object {
  const addr = p.address;
  const hasAddr = !!(addr && (addr.locality || addr.region || addr.country));
  return {
    '@context': 'https://schema.org',
    '@type': p.type ?? (hasAddr ? 'LocalBusiness' : 'Organization'),
    name: p.name,
    url: absUrl(p.url),
    ...(p.logo ? { logo: p.logo, image: p.logo } : {}),
    ...(p.description ? { description: plain(p.description, 500) } : {}),
    ...(hasAddr
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(addr!.locality ? { addressLocality: addr!.locality } : {}),
            ...(addr!.region ? { addressRegion: addr!.region } : {}),
            addressCountry: addr!.country ?? 'IN',
          },
        }
      : {}),
  };
}

/**
 * ProfilePage + Person schema for a public profile. `jobTitle` (the headline) +
 * `image` (the avatar) are emitted only when shown.
 */
export function personJsonLd(p: {
  name: string;
  url: string;
  image?: string | null;
  jobTitle?: string | null;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: p.name,
      url: absUrl(p.url),
      ...(p.image ? { image: p.image } : {}),
      ...(p.jobTitle ? { jobTitle: plain(p.jobTitle, 200) } : {}),
    },
  };
}

/**
 * JobPosting schema (this feeds Google's jobs surface). Returns null unless the
 * required fields exist (title, description, datePosted, hiringOrganization) so
 * we never emit an invalid/penalized posting. `validThrough` comes from the
 * job's `closesAt` when set; `baseSalary` only when a wage is present.
 */
export function jobPostingJsonLd(
  job: Job,
  opts: { url: string; hiringOrgName: string; hiringOrgUrl?: string },
): object | null {
  const datePosted = job.createdAt;
  if (!job.title || !job.description || !datePosted || !opts.hiringOrgName) return null;

  const loc = job.location;
  const hasLoc = !!(loc && (loc.city || loc.district || loc.state));
  const salary = buildSalary(job);

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: plain(job.description),
    datePosted,
    ...(job.closesAt ? { validThrough: job.closesAt } : {}),
    ...(job.employmentType ? { employmentType: mapEmploymentType(job.employmentType) } : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: opts.hiringOrgName,
      ...(opts.hiringOrgUrl ? { sameAs: absUrl(opts.hiringOrgUrl) } : {}),
    },
    ...(hasLoc
      ? {
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              ...(loc!.city ? { addressLocality: loc!.city } : {}),
              addressRegion: loc!.state || loc!.district || 'Gujarat',
              addressCountry: 'IN',
            },
          },
        }
      : {}),
    ...(salary ? { baseSalary: salary } : {}),
  };
}

/** Google's canonical employmentType tokens. */
function mapEmploymentType(t: string): string {
  const map: Record<string, string> = {
    full_time: 'FULL_TIME',
    part_time: 'PART_TIME',
    contract: 'CONTRACTOR',
    temporary: 'TEMPORARY',
    apprenticeship: 'INTERN',
  };
  return map[t] ?? 'OTHER';
}

/** A unit per the wage type (daily/monthly/hourly/piece -> schema unitText). */
function buildSalary(job: Job): object | null {
  if (job.wageMin == null && job.wageMax == null) return null;
  const unit: Record<string, string> = {
    hourly: 'HOUR',
    daily: 'DAY',
    monthly: 'MONTH',
    piece: 'PIECE',
  };
  const min = job.wageMin;
  const max = job.wageMax;
  return {
    '@type': 'MonetaryAmount',
    currency: 'INR',
    value: {
      '@type': 'QuantitativeValue',
      ...(min != null ? { minValue: min } : {}),
      ...(max != null ? { maxValue: max } : {}),
      ...(job.wageType && unit[job.wageType] ? { unitText: unit[job.wageType] } : {}),
    },
  };
}

/** BreadcrumbList for pages that show a breadcrumb trail. Paths are made absolute. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}
