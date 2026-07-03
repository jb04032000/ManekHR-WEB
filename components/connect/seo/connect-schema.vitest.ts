import { describe, it, expect } from 'vitest';
import {
  productJsonLd,
  courseJsonLd,
  serviceJsonLd,
  organizationJsonLd,
  personJsonLd,
  jobPostingJsonLd,
  breadcrumbJsonLd,
} from './connect-schema';
import type { ListingDetail } from '@/features/connect/marketplace/marketplace.types';
import type { Job } from '@/features/connect/jobs/jobs.types';

/**
 * Snapshot-of-shape tests for the Connect JSON-LD builders. The invariant under
 * test: we only emit fields the page truly shows (Google penalizes mismatches).
 * Offers appear ONLY when a real price is public; a JobPosting only when its
 * required fields exist. Cross-module: connect-schema.ts.
 */

function listing(over: Partial<ListingDetail>): ListingDetail {
  return {
    _id: 'l1',
    ownerUserId: 'u1',
    title: 'Banarasi silk saree',
    description: 'Pure silk, zari border.',
    category: 'finished-goods',
    priceType: 'fixed',
    images: ['https://cdn/x.jpg'],
    verified: false,
    ...over,
  } as ListingDetail;
}

describe('productJsonLd', () => {
  it('emits a fixed-price Offer when price is public', () => {
    const data = productJsonLd(listing({ priceType: 'fixed', priceMin: 1200 }), {
      url: 'https://z/products/l1',
      sellerName: 'Surat Silks',
      sellerUrl: '/store/surat-silks',
    }) as Record<string, unknown>;
    expect(data['@type']).toBe('Product');
    expect(data.name).toBe('Banarasi silk saree');
    expect(data.image).toEqual(['https://cdn/x.jpg']);
    expect(data.offers).toMatchObject({
      '@type': 'Offer',
      price: '1200',
      priceCurrency: 'INR',
    });
    expect((data.brand as Record<string, unknown>).name).toBe('Surat Silks');
  });

  it('emits an AggregateOffer for a price range', () => {
    const data = productJsonLd(listing({ priceType: 'range', priceMin: 800, priceMax: 1500 }), {
      url: 'https://z/products/l1',
    }) as Record<string, unknown>;
    expect(data.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '800',
      highPrice: '1500',
      priceCurrency: 'INR',
    });
  });

  it('omits offers entirely when the listing is negotiable (no public price)', () => {
    const data = productJsonLd(listing({ priceType: 'negotiable', priceMin: null }), {
      url: 'https://z/products/l1',
    }) as Record<string, unknown>;
    expect(data.offers).toBeUndefined();
  });
});

describe('courseJsonLd', () => {
  it('emits a free Course with credential, skills, and a 0-INR offer', () => {
    const data = courseJsonLd(
      listing({
        title: 'Aari embroidery basics',
        category: 'course',
        priceType: 'negotiable',
        priceMin: null,
        courseDetails: {
          durationLabel: '3 months',
          mode: 'offline',
          feeType: 'free',
          certificate: true,
          skillsTaught: ['Aari', 'Zardosi'],
        },
      }),
      {
        url: 'https://z/products/l1',
        providerName: 'Surat Institute',
        providerUrl: '/store/surat-institute',
      },
    ) as Record<string, unknown>;
    expect(data['@type']).toBe('Course');
    expect(data.name).toBe('Aari embroidery basics');
    expect(data.isAccessibleForFree).toBe(true);
    expect(data.teaches).toEqual(['Aari', 'Zardosi']);
    expect(data.educationalCredentialAwarded).toBe('Certificate');
    expect(data.offers).toMatchObject({
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      category: 'Free',
    });
    const provider = data.provider as Record<string, unknown>;
    expect(provider.name).toBe('Surat Institute');
    expect(provider['@type']).toBe('Organization');
  });

  it('emits a paid Course with a real Offer and omits certificate/skills/provider when absent', () => {
    const data = courseJsonLd(
      listing({
        category: 'course',
        priceType: 'fixed',
        priceMin: 5000,
        courseDetails: {
          durationLabel: '6 weeks',
          mode: 'online',
          feeType: 'fixed',
          certificate: false,
          skillsTaught: [],
        },
      }),
      { url: 'https://z/products/l1' },
    ) as Record<string, unknown>;
    expect(data['@type']).toBe('Course');
    expect(data.isAccessibleForFree).toBeUndefined();
    expect(data.educationalCredentialAwarded).toBeUndefined();
    expect(data.teaches).toBeUndefined();
    expect(data.offers).toMatchObject({ '@type': 'Offer', price: '5000', priceCurrency: 'INR' });
    expect(data.provider).toBeUndefined();
  });
});

describe('serviceJsonLd', () => {
  it('emits a Service with serviceType, areaServed, provider, and a real-price Offer', () => {
    const data = serviceJsonLd(
      listing({
        title: 'Loom maintenance',
        category: 'maintenance',
        priceType: 'fixed',
        priceMin: 500,
        serviceDetails: {
          deliveryMode: 'on-site',
          pricingModel: 'per-visit',
          coverageArea: 'Surat and Ahmedabad',
          yearsExperience: 8,
        },
      }),
      {
        url: 'https://z/products/l1',
        providerName: 'Surat Loom Care',
        providerUrl: '/store/surat-loom-care',
      },
    ) as Record<string, unknown>;
    expect(data['@type']).toBe('Service');
    expect(data.name).toBe('Loom maintenance');
    expect(data.serviceType).toBe('maintenance');
    expect(data.areaServed).toBe('Surat and Ahmedabad');
    expect(data.offers).toMatchObject({ '@type': 'Offer', price: '500', priceCurrency: 'INR' });
    const provider = data.provider as Record<string, unknown>;
    expect(provider.name).toBe('Surat Loom Care');
    expect(provider['@type']).toBe('Organization');
  });

  it('omits offers when the service is negotiable, and omits areaServed/provider when absent', () => {
    const data = serviceJsonLd(
      listing({
        category: 'consulting',
        priceType: 'negotiable',
        priceMin: null,
        serviceDetails: { deliveryMode: 'remote', pricingModel: 'negotiable' },
      }),
      { url: 'https://z/products/l1' },
    ) as Record<string, unknown>;
    expect(data['@type']).toBe('Service');
    expect(data.serviceType).toBe('consulting');
    expect(data.offers).toBeUndefined();
    expect(data.areaServed).toBeUndefined();
    expect(data.provider).toBeUndefined();
  });
});

describe('organizationJsonLd', () => {
  it('is an Organization with no address when none is shown', () => {
    const data = organizationJsonLd({
      name: 'Surat Silks',
      url: '/store/surat-silks',
      logo: 'https://cdn/logo.png',
      description: 'Wholesale sarees',
    }) as Record<string, unknown>;
    expect(data['@type']).toBe('Organization');
    expect(data.address).toBeUndefined();
    expect(data.logo).toBe('https://cdn/logo.png');
  });

  it('upgrades to LocalBusiness with PostalAddress when an address is shown', () => {
    const data = organizationJsonLd({
      name: 'Surat Silks',
      url: '/company/surat-silks',
      address: { locality: 'Surat', region: 'Gujarat' },
    }) as Record<string, unknown>;
    expect(data['@type']).toBe('LocalBusiness');
    expect((data.address as Record<string, unknown>).addressLocality).toBe('Surat');
    expect((data.address as Record<string, unknown>).addressCountry).toBe('IN');
  });

  it('emits EducationalOrganization for an institute company page', () => {
    const data = organizationJsonLd({
      type: 'EducationalOrganization',
      name: 'Surat Embroidery Institute',
      url: '/company/surat-embroidery-institute',
      logo: 'https://cdn/logo.png',
      description: 'Aari and zardosi training.',
    }) as Record<string, unknown>;
    expect(data['@type']).toBe('EducationalOrganization');
    expect(data.name).toBe('Surat Embroidery Institute');
  });
});

describe('personJsonLd', () => {
  it('wraps a Person in a ProfilePage and includes jobTitle/image when shown', () => {
    const data = personJsonLd({
      name: 'Jayesh B',
      url: '/u/jayesh',
      image: 'https://cdn/a.jpg',
      jobTitle: 'Embroidery karigar',
    }) as Record<string, unknown>;
    expect(data['@type']).toBe('ProfilePage');
    const person = data.mainEntity as Record<string, unknown>;
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe('Jayesh B');
    expect(person.jobTitle).toBe('Embroidery karigar');
    expect(person.image).toBe('https://cdn/a.jpg');
  });

  it('omits jobTitle/image when not shown', () => {
    const person = (personJsonLd({ name: 'No Headline', url: '/u/x' }) as Record<string, unknown>)
      .mainEntity as Record<string, unknown>;
    expect(person.jobTitle).toBeUndefined();
    expect(person.image).toBeUndefined();
  });
});

function job(over: Partial<Job>): Job {
  return {
    _id: 'j1',
    companyUserId: 'co',
    companyPageId: null,
    title: 'Machine operator',
    description: 'Daily wage, festive season.',
    responsibilities: [],
    category: 'embroidery-zari',
    role: 'operator',
    wageType: 'daily',
    wageMin: 500,
    wageMax: 700,
    openings: 2,
    location: { district: 'Surat', city: 'Surat', state: 'Gujarat' },
    skills: [],
    machineType: '',
    employmentType: 'full_time',
    experienceMin: null,
    shift: null,
    workingDays: '',
    languages: [],
    benefits: [],
    closesAt: null,
    status: 'open',
    applicationsCount: 0,
    views: 0,
    boostCampaignId: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  } as Job;
}

describe('jobPostingJsonLd', () => {
  it('emits a valid JobPosting with required fields, location, salary', () => {
    const data = jobPostingJsonLd(job({}), {
      url: 'https://z/jobs/j1',
      hiringOrgName: 'Surat Silks',
      hiringOrgUrl: '/company/surat-silks',
    }) as Record<string, unknown>;
    expect(data['@type']).toBe('JobPosting');
    expect(data.title).toBe('Machine operator');
    expect(data.datePosted).toBe('2026-06-01T00:00:00.000Z');
    expect(data.employmentType).toBe('FULL_TIME');
    expect((data.hiringOrganization as Record<string, unknown>).name).toBe('Surat Silks');
    expect((data.jobLocation as Record<string, unknown>)['@type']).toBe('Place');
    expect((data.baseSalary as Record<string, unknown>).currency).toBe('INR');
  });

  it('includes validThrough only when closesAt is set', () => {
    const withClose = jobPostingJsonLd(job({ closesAt: '2026-07-01T00:00:00.000Z' }), {
      url: 'https://z/jobs/j1',
      hiringOrgName: 'X',
    }) as Record<string, unknown>;
    expect(withClose.validThrough).toBe('2026-07-01T00:00:00.000Z');
    const noClose = jobPostingJsonLd(job({ closesAt: null }), {
      url: 'https://z/jobs/j1',
      hiringOrgName: 'X',
    }) as Record<string, unknown>;
    expect(noClose.validThrough).toBeUndefined();
  });

  it('returns null when a required field (description) is missing', () => {
    expect(jobPostingJsonLd(job({ description: '' }), { url: 'u', hiringOrgName: 'X' })).toBeNull();
  });

  it('returns null when no hiring org name resolved', () => {
    expect(jobPostingJsonLd(job({}), { url: 'u', hiringOrgName: '' })).toBeNull();
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from 1 and makes paths absolute', () => {
    const data = breadcrumbJsonLd([
      { name: 'Shop', path: '/store/x' },
      { name: 'Product', path: '/products/y' },
    ]) as Record<string, unknown>;
    expect(data['@type']).toBe('BreadcrumbList');
    const items = data.itemListElement as Array<Record<string, unknown>>;
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(String(items[0].item)).toContain('/store/x');
  });
});
