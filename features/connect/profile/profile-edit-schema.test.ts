import { describe, it, expect } from 'vitest';
import { connectProfileUpdateSchema, paiseToRupees, rupeesToPaise } from './profile-edit-schema';

describe('rupeesToPaise', () => {
  it('converts whole rupees to integer paise', () => {
    expect(rupeesToPaise(950)).toBe(95000);
    expect(rupeesToPaise(1)).toBe(100);
  });

  it('rounds to whole paise', () => {
    expect(rupeesToPaise(10.5)).toBe(1050);
  });

  it('treats 0, negative, null and undefined as unset', () => {
    expect(rupeesToPaise(0)).toBeUndefined();
    expect(rupeesToPaise(-5)).toBeUndefined();
    expect(rupeesToPaise(null)).toBeUndefined();
    expect(rupeesToPaise(undefined)).toBeUndefined();
  });
});

describe('paiseToRupees', () => {
  it('converts paise back to rupees', () => {
    expect(paiseToRupees(95000)).toBe(950);
  });

  it('returns undefined for null / undefined', () => {
    expect(paiseToRupees(null)).toBeUndefined();
    expect(paiseToRupees(undefined)).toBeUndefined();
  });

  it('round-trips with rupeesToPaise', () => {
    expect(rupeesToPaise(paiseToRupees(280000))).toBe(280000);
  });
});

describe('connectProfileUpdateSchema', () => {
  const valid = {
    headline: 'Zari karigar',
    bio: 'About me',
    banner: '',
    skills: ['Zari', 'Sequins'],
    contactPreference: 'whatsapp',
    visibility: 'public',
    openTo: { work: true, hiring: false, deals: false, customOrders: false },
    rateCard: { dailyWage: 95000 },
    portfolio: [{ image: 'https://cdn.example/x.jpg', caption: 'Border' }],
    experience: [{ workshop: 'Surat Embroidery', role: 'Karigar' }],
  };

  it('accepts a well-formed payload', () => {
    expect(connectProfileUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown contactPreference', () => {
    const r = connectProfileUpdateSchema.safeParse({ ...valid, contactPreference: 'pigeon' });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown visibility', () => {
    const r = connectProfileUpdateSchema.safeParse({ ...valid, visibility: 'everyone' });
    expect(r.success).toBe(false);
  });

  it('rejects a portfolio item with no image', () => {
    const r = connectProfileUpdateSchema.safeParse({
      ...valid,
      portfolio: [{ caption: 'no image' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects an experience entry with an empty workshop', () => {
    const r = connectProfileUpdateSchema.safeParse({ ...valid, experience: [{ workshop: '' }] });
    expect(r.success).toBe(false);
  });

  // An experience entry may carry an optional companyPageId linking it to a
  // ManekHR CompanyPage (company-pages module). Free-typed companies leave it unset.
  it('accepts an experience entry with a companyPageId and preserves it', () => {
    const r = connectProfileUpdateSchema.safeParse({
      experience: [{ workshop: 'X', companyPageId: '64b8f0000000000000000000' }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.experience?.[0].companyPageId).toBe('64b8f0000000000000000000');
    }
  });

  it('rejects a headline longer than 160 characters', () => {
    const r = connectProfileUpdateSchema.safeParse({ ...valid, headline: 'x'.repeat(161) });
    expect(r.success).toBe(false);
  });

  it('accepts openToDetails with a 160-char detail and audience', () => {
    const r = connectProfileUpdateSchema.safeParse({
      openToDetails: { hiring: { detail: 'x'.repeat(160), audience: 'network' } },
    });
    expect(r.success).toBe(true);
  });
  it('rejects an over-long detail', () => {
    const r = connectProfileUpdateSchema.safeParse({
      openToDetails: { hiring: { detail: 'x'.repeat(161), audience: 'all' } },
    });
    expect(r.success).toBe(false);
  });

  // Services I provide - a list of { title (required), note? }. Mirrors portfolio.
  it('accepts a services entry with a title and optional note', () => {
    const r = connectProfileUpdateSchema.safeParse({ services: [{ title: 'X', note: 'y' }] });
    expect(r.success).toBe(true);
  });

  it('rejects a services entry with no title', () => {
    const r = connectProfileUpdateSchema.safeParse({ services: [{ note: 'no title' }] });
    expect(r.success).toBe(false);
  });

  // Intro video - at most one clip { url (required), posterUrl? }.
  it('accepts a videos entry with a url and optional posterUrl', () => {
    const r = connectProfileUpdateSchema.safeParse({
      videos: [{ url: 'https://cdn/clip.mp4', posterUrl: 'https://cdn/poster.jpg' }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts an empty videos array (clip removed)', () => {
    expect(connectProfileUpdateSchema.safeParse({ videos: [] }).success).toBe(true);
  });

  it('rejects a videos entry with no url', () => {
    const r = connectProfileUpdateSchema.safeParse({
      videos: [{ posterUrl: 'https://cdn/p.jpg' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects more than one video (max 1)', () => {
    const r = connectProfileUpdateSchema.safeParse({
      videos: [{ url: 'https://cdn/a.mp4' }, { url: 'https://cdn/b.mp4' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects openTo with both work and hiring on (mutually exclusive)', () => {
    const r = connectProfileUpdateSchema.safeParse({
      openTo: { work: true, hiring: true, deals: false, customOrders: false },
    });
    expect(r.success).toBe(false);
  });

  it('accepts openTo with only one of work / hiring on', () => {
    expect(
      connectProfileUpdateSchema.safeParse({
        openTo: { work: false, hiring: true, deals: false, customOrders: false },
      }).success,
    ).toBe(true);
    expect(
      connectProfileUpdateSchema.safeParse({
        openTo: { work: true, hiring: false, deals: false, customOrders: false },
      }).success,
    ).toBe(true);
  });
});
