import { describe, it, expect } from 'vitest';
import { showJobsTab, showOwnerEmpty } from '../companyJobs.logic';

// Pure visibility rules for the company page jobs section. The owner always sees
// the tab (so they can post into an empty page); a visitor only sees it with jobs.
describe('company jobs visibility', () => {
  it('owner always sees the tab; visitor only with jobs', () => {
    expect(showJobsTab(0, true)).toBe(true);
    expect(showJobsTab(0, false)).toBe(false);
    expect(showJobsTab(2, false)).toBe(true);
    expect(showJobsTab(2, true)).toBe(true);
  });

  it('only the owner sees the empty state', () => {
    expect(showOwnerEmpty(0, true)).toBe(true);
    expect(showOwnerEmpty(0, false)).toBe(false);
    expect(showOwnerEmpty(2, true)).toBe(false);
    expect(showOwnerEmpty(2, false)).toBe(false);
  });
});
