import { describe, it, expect } from 'vitest';
import { listingDisplayStatus, isLive, isNeedsPhoto, needsDetails } from './listing-status';
import type { OwnerListing } from './marketplace.types';

/** A complete, live listing; override fields per case. */
function listing(over: Partial<OwnerListing> = {}): OwnerListing {
  return {
    _id: 'L1',
    title: 'Zari work',
    category: 'embroidery-zari',
    status: 'active',
    moderationStatus: 'approved',
    images: ['https://img/1.jpg'],
    description: 'Pure zari',
    priceType: 'fixed',
    priceMin: 500,
    ...over,
  } as OwnerListing;
}

describe('listing-status (single source of truth)', () => {
  it('a complete active+approved+photo listing is live', () => {
    const l = listing();
    expect(listingDisplayStatus(l)).toBe('live');
    expect(isLive(l)).toBe(true);
    expect(needsDetails(l)).toBe(false);
  });

  it('photo is the only hard gate: active+approved without a photo is "needs photo", not live', () => {
    const l = listing({ images: [] });
    expect(listingDisplayStatus(l)).toBe('needsPhoto');
    expect(isLive(l)).toBe(false);
    expect(isNeedsPhoto(l)).toBe(true);
  });

  it('a live listing missing price/description is STILL live, with a soft details nudge', () => {
    const noPrice = listing({ priceType: 'fixed', priceMin: null });
    expect(isLive(noPrice)).toBe(true);
    expect(needsDetails(noPrice)).toBe(true);

    const noDesc = listing({ description: '' });
    expect(isLive(noDesc)).toBe(true);
    expect(needsDetails(noDesc)).toBe(true);

    // 'negotiable' counts as a price stance, so a photo-only negotiable listing
    // missing a description is live + needs details.
    const negotiable = listing({ priceType: 'negotiable', priceMin: null, description: '' });
    expect(isLive(negotiable)).toBe(true);
    expect(needsDetails(negotiable)).toBe(true);
  });

  it('lifecycle statuses map straight through and never read as live', () => {
    expect(listingDisplayStatus(listing({ status: 'draft' }))).toBe('draft');
    expect(listingDisplayStatus(listing({ status: 'paused' }))).toBe('paused');
    expect(listingDisplayStatus(listing({ status: 'expired' }))).toBe('expired');
    expect(listingDisplayStatus(listing({ status: 'rejected' }))).toBe('rejected');
    expect(listingDisplayStatus(listing({ status: 'pending_review' }))).toBe('pending');
  });

  it('a moderation verdict wins over active (future-proofs if moderation is re-enabled)', () => {
    expect(listingDisplayStatus(listing({ moderationStatus: 'pending' }))).toBe('pending');
    expect(listingDisplayStatus(listing({ moderationStatus: 'rejected' }))).toBe('rejected');
  });
});
