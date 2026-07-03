import { describe, expect, it } from 'vitest';
import { LOCALE_LABELS, LOCALE_OPTIONS, SUPPORTED_LOCALES } from '@/lib/locales';
import {
  breadcrumbJsonLd,
  erpPricingJsonLd,
  faqPageJsonLd,
  homeJsonLd,
  softwareAppJsonLd,
} from './schema';

/**
 * Marketing SEO + locale-source tests. Covers the JSON-LD builders the home and
 * /connect pages render, and the single locale list both language switchers use.
 */
describe('locale source of truth (lib/locales)', () => {
  it('exposes exactly the four site locales', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'gu', 'gu-en', 'hi-en']);
    expect(LOCALE_OPTIONS).toHaveLength(4);
    expect(Object.keys(LOCALE_LABELS)).toEqual(['en', 'gu', 'gu-en', 'hi-en']);
  });

  it('labels each locale in its own script', () => {
    expect(LOCALE_LABELS.en).toBe('English');
    expect(LOCALE_LABELS.gu).toBe('ગુજરાતી');
    expect(LOCALE_LABELS['gu-en']).toContain('English');
    expect(LOCALE_LABELS['hi-en']).toContain('English');
  });
});

describe('marketing JSON-LD builders', () => {
  it('home graph carries Organization + WebSite + SoftwareApplication', () => {
    const graph = homeJsonLd()['@graph'] as Array<{ '@type': string }>;
    const types = graph.map((node) => node['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('SoftwareApplication');
  });

  it('erpPricingJsonLd emits SoftwareApplication + AggregateOffer with real per-plan prices', () => {
    const data = erpPricingJsonLd([
      { name: 'Free', monthlyPrice: 0 },
      { name: 'Starter', monthlyPrice: 999 },
      { name: 'Growth', monthlyPrice: 2499 },
      { name: 'Business', monthlyPrice: 4999 },
    ]);
    expect(data).not.toBeNull();
    expect(data!['@type']).toBe('SoftwareApplication');
    const agg = data!.offers;
    expect(agg['@type']).toBe('AggregateOffer');
    expect(agg.priceCurrency).toBe('INR');
    expect(agg.lowPrice).toBe(0);
    expect(agg.highPrice).toBe(4999);
    expect(agg.offerCount).toBe(4);
    expect(agg.offers).toHaveLength(4);
    // Each Offer carries an explicit per-month unit price (so engines say ₹X/month).
    const starter = agg.offers.find((o) => o.name === 'Starter plan')!;
    expect(starter.priceSpecification.price).toBe(999);
    expect(starter.priceSpecification.unitCode).toBe('MON');
    expect(starter.priceSpecification.priceCurrency).toBe('INR');
  });

  it('erpPricingJsonLd returns null when no plans are available (never fake pricing)', () => {
    expect(erpPricingJsonLd([])).toBeNull();
  });

  it('faqPageJsonLd mirrors visible Q&A as FAQPage', () => {
    const data = faqPageJsonLd([{ q: 'Is Connect free?', a: 'Yes, it is free to use.' }]);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(1);
    expect(data.mainEntity[0]['@type']).toBe('Question');
    expect(data.mainEntity[0].name).toBe('Is Connect free?');
    expect(data.mainEntity[0].acceptedAnswer.text).toBe('Yes, it is free to use.');
  });

  it('softwareAppJsonLd models a free SoftwareApplication', () => {
    const data = softwareAppJsonLd({
      name: 'ManekHR Connect',
      path: '/connect',
      description: 'A free B2B network and marketplace.',
    });
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.offers.price).toBe('0');
    expect(data.offers.priceCurrency).toBe('INR');
    expect(data.url).toContain('/connect');
  });

  it('breadcrumbJsonLd numbers items from 1 with absolute URLs', () => {
    const data = breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'ManekHR Connect', path: '/connect' },
    ]);
    expect(data.itemListElement).toHaveLength(2);
    expect(data.itemListElement[0].position).toBe(1);
    expect(data.itemListElement[1].position).toBe(2);
    expect(String(data.itemListElement[1].item)).toContain('/connect');
  });
});
