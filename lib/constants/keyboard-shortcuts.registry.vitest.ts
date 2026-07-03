import { describe, it, expect } from 'vitest';
import { getChordKeysForPath } from './keyboard-shortcuts.registry';

// Guards the surface-aware reverse lookup. The bug: `/connect/feed` is the
// action of BOTH `g>c` ("Switch to Connect", bound on erp/account only) and
// the Connect module chord `g>f`. A surface-blind first-match returned the
// inert `g>c` for the Connect "Home" tooltip; the surface filter must pick the
// chord that is actually pressable on the rail it renders on.
describe('getChordKeysForPath', () => {
  it('returns the Connect-bound chord for the feed, not the inert switcher', () => {
    // The actual bug: on the Connect surface the feed must teach g>f, not g>c.
    expect(getChordKeysForPath('/connect/feed', 'connect')).toBe('g>f');
  });

  it('resolves other Connect nav targets to their module chords', () => {
    expect(getChordKeysForPath('/connect/network', 'connect')).toBe('g>n');
    expect(getChordKeysForPath('/connect/profile', 'connect')).toBe('g>p');
  });

  it('keeps ERP dashboard resolving to its own chord, not the cross-product switcher', () => {
    // `/dashboard` is the action of both `g>e` (Switch to ERP, surface
    // connect/account) and `g>d` (Go to dashboard, surface erp). On the ERP
    // surface the pressable one is g>d.
    expect(getChordKeysForPath('/dashboard', 'erp')).toBe('g>d');
  });

  it('still resolves an all-surface account chord without a surface arg', () => {
    expect(getChordKeysForPath('/account/security')).toBe('g>k');
  });

  it('returns undefined when no chord is pressable on the surface', () => {
    // Marketplace has no chord at all.
    expect(getChordKeysForPath('/connect/marketplace', 'connect')).toBeUndefined();
    expect(getChordKeysForPath('/nope/nowhere', 'connect')).toBeUndefined();
  });

  it('preserves first-match behaviour when no surface is given (back-compat)', () => {
    // Surface-blind, the cross-product switcher is listed first and still wins -
    // documents that the old behaviour is intact for any surface-agnostic caller.
    expect(getChordKeysForPath('/connect/feed')).toBe('g>c');
  });
});
