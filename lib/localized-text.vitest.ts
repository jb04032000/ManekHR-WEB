import { describe, it, expect } from 'vitest';
import { pickLocalized } from './localized-text';

/**
 * pickLocalized resolves a per-plan LocalizedText for the active locale, with a
 * two-step fallback: requested locale -> en -> the static i18n default. Drives
 * the plan-card tagline + feature bullets (ErpPricingTable / PlanCard).
 */
describe('pickLocalized', () => {
  const value = {
    en: 'For small teams',
    'gu-en': 'Nani teams mate',
    'hi-en': 'Chhoti teams ke liye',
    gu: 'નાની ટીમો માટે',
  };

  it('returns the requested locale when present', () => {
    expect(pickLocalized(value, 'gu-en', 'STATIC')).toBe('Nani teams mate');
    expect(pickLocalized(value, 'gu', 'STATIC')).toBe('નાની ટીમો માટે');
  });

  it('falls back to en when the requested locale is missing', () => {
    expect(pickLocalized({ en: 'Only English' }, 'hi-en', 'STATIC')).toBe('Only English');
  });

  it('falls back to en when the requested locale is blank/null', () => {
    expect(pickLocalized({ en: 'English', 'gu-en': '' }, 'gu-en', 'STATIC')).toBe('English');
    expect(pickLocalized({ en: 'English', 'hi-en': null }, 'hi-en', 'STATIC')).toBe('English');
  });

  it('falls back to the static default when the value is undefined/null', () => {
    expect(pickLocalized(undefined, 'en', 'STATIC')).toBe('STATIC');
    expect(pickLocalized(null, 'gu', 'STATIC')).toBe('STATIC');
  });

  it('falls back to the static default when even en is blank', () => {
    expect(pickLocalized({ en: '' }, 'en', 'STATIC')).toBe('STATIC');
  });

  it('returns en for the en locale directly', () => {
    expect(pickLocalized(value, 'en', 'STATIC')).toBe('For small teams');
  });
});
