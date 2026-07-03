import { describe, it, expect } from 'vitest';
import { buildEnablePrefsPatch } from './buildEnablePrefsPatch';

describe('buildEnablePrefsPatch', () => {
  it('sets browserPush:true for every category key and global channel on', () => {
    const prefs = {
      'connect.message_received': { inPlatform: true, mobilePush: false, browserPush: false },
      'connect.followed': { inPlatform: true, mobilePush: false, browserPush: false },
    };
    const patch = buildEnablePrefsPatch(prefs, true);
    expect(patch).toEqual({
      prefs: {
        'connect.message_received': { browserPush: true },
        'connect.followed': { browserPush: true },
      },
      channels: { browserPush: true },
    });
  });

  it('sets browserPush:false everywhere when disabling', () => {
    const prefs = {
      'connect.followed': { inPlatform: true, mobilePush: false, browserPush: true },
    };
    const patch = buildEnablePrefsPatch(prefs, false);
    expect(patch).toEqual({
      prefs: { 'connect.followed': { browserPush: false } },
      channels: { browserPush: false },
    });
  });
});
