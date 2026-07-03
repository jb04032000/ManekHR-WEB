import { describe, it, expect } from 'vitest';
import { showJobsTab, showOwnerEmpty, showPlacementsTab, showAlumniTab } from './companyJobs.logic';

/**
 * Pure visibility rules for the company-page tabs. The institute Placements /
 * Alumni rules (Institutes Phase 2, Feature 2) mirror the Jobs rule: the owner
 * always sees the tab (so they reach the invite CTA), a visitor only when there
 * is real content. Cross-checks the helpers consumed by CompanyPageView.
 */
describe('companyJobs.logic', () => {
  describe('showJobsTab', () => {
    it('shows for the owner even with no jobs, and for a visitor only with jobs', () => {
      expect(showJobsTab(0, true)).toBe(true);
      expect(showJobsTab(0, false)).toBe(false);
      expect(showJobsTab(3, false)).toBe(true);
    });
  });

  describe('showOwnerEmpty', () => {
    it('is true only for an owner with zero jobs', () => {
      expect(showOwnerEmpty(0, true)).toBe(true);
      expect(showOwnerEmpty(2, true)).toBe(false);
      expect(showOwnerEmpty(0, false)).toBe(false);
    });
  });

  describe('showPlacementsTab', () => {
    it('shows for the owner even when empty (to reach the invite CTA)', () => {
      expect(showPlacementsTab(false, true)).toBe(true);
    });
    it('hides for a visitor when empty', () => {
      expect(showPlacementsTab(false, false)).toBe(false);
    });
    it('shows for a visitor when there is content', () => {
      expect(showPlacementsTab(true, false)).toBe(true);
    });
  });

  describe('showAlumniTab', () => {
    it('shows for the owner even when empty (to reach the invite CTA)', () => {
      expect(showAlumniTab(false, true)).toBe(true);
    });
    it('hides for a visitor when empty', () => {
      expect(showAlumniTab(false, false)).toBe(false);
    });
    it('shows for a visitor when there is content', () => {
      expect(showAlumniTab(true, false)).toBe(true);
    });
  });
});
